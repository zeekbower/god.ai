#!/usr/bin/env node
// Runs a simplified, automated bot-update cycle using a real LLM to compose each
// post — Ollama (local, CPU) by default, or the Anthropic API if configured — instead
// of Claude Code composing every post interactively the way every other cycle in this
// project has been driven so far.
//
// This is NOT a full replacement for a Claude-Code-driven cycle. It intentionally
// covers a narrower slice: cross-topic engagement only (PROTOCOL.md's mechanic), at a
// flat roll rate rather than PROTOCOL.md's per-bot boosted thresholds (those require
// a human/Claude judgment call about "does this bot have a real thematic connection
// to an active thread," which isn't something this script tries to automate). It does
// not do faith-resistance checks, anger-level drift, pending-reply handling, real web
// search for citations, or anything Librarian-specific. Treat it as a lighter-weight,
// unattended alternative for keeping the forum active between full manual cycles, not
// a drop-in replacement for one.
//
// Model options: any locally-pulled Ollama model works (`ollama pull <name>`), but
// prefer an Ollama Cloud model (`ollama pull <name>:cloud`, then `ollama signin`) —
// inference runs on Ollama's servers, not this machine, which matters here since this
// box has ~7GB RAM and a local 3B model was enough to exhaust swap during testing.
// gpt-oss:120b-cloud is confirmed free-tier and is what this project actually uses;
// Qwen's own cloud tag (qwen3.5:cloud) exists but requires a paid ollama.com plan as
// of 2026-07 — checked directly, not assumed (see CYCLE_LOG.md's LLM-cycle notes).
//
// Usage:
//   node bots/llm-cycle.js                            interactive model picker
//   node bots/llm-cycle.js --model ollama:gpt-oss:120b-cloud   (recommended default)
//   node bots/llm-cycle.js --model ollama:qwen2.5:3b-instruct  (local, CPU — heavy)
//   node bots/llm-cycle.js --model claude
//   node bots/llm-cycle.js --rate 15        override the flat engagement rate (%)
//   node bots/llm-cycle.js --dry-run        roll and compose but don't post

const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const FORUM_DIR = path.join(REPO_ROOT, 'forum');
const BOTS_DIR = __dirname;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

const EXCLUDED_BOTS = new Set(['Librarian', 'trollerskates']);

function parseArgs(argv) {
  const args = { rate: 15, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--model') args.model = argv[++i];
    else if (a === '--rate') args.rate = parseFloat(argv[++i]);
    else if (a === '--dry-run') args.dryRun = true;
  }
  return args;
}

function loadEnvLocal() {
  const envPath = path.join(REPO_ROOT, '.env.local');
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function pickModel(existingArg) {
  if (existingArg) return existingArg;

  const envLocal = loadEnvLocal();
  const anthropicKey = process.env.ANTHROPIC_API_KEY || envLocal.ANTHROPIC_API_KEY;

  let ollamaModels = [];
  try {
    const out = execFileSync('ollama', ['list'], { encoding: 'utf8' });
    ollamaModels = out
      .split('\n')
      .slice(1)
      .map((l) => l.trim().split(/\s+/)[0])
      .filter(Boolean);
  } catch {
    console.warn('Could not run `ollama list` — is Ollama installed and on PATH?');
  }

  console.log('\nWhich model should drive this cycle?\n');
  const options = [];
  ollamaModels.forEach((m) => {
    const isCloud = m.includes(':cloud') || m.endsWith('-cloud');
    const label = isCloud
      ? `Ollama Cloud: ${m} (runs on Ollama's servers — no local RAM/CPU use)${m === 'gpt-oss:120b-cloud' ? ' [recommended]' : ''}`
      : `Ollama (local): ${m} (uses this machine's CPU/RAM)`;
    options.push({ label, value: `ollama:${m}` });
  });
  if (anthropicKey) {
    options.push({ label: 'Claude (Anthropic API — key found)', value: 'claude' });
  } else {
    console.log('  (Claude option unavailable — set ANTHROPIC_API_KEY in .env.local to enable it)');
  }
  options.forEach((o, i) => console.log(`  [${i + 1}] ${o.label}`));
  if (!options.length) {
    console.error('No models available (no Ollama models pulled, no Claude key). Aborting.');
    process.exit(1);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await ask(rl, `\nPick 1-${options.length}: `);
  rl.close();
  const idx = parseInt(answer, 10) - 1;
  if (Number.isNaN(idx) || !options[idx]) {
    console.error('Invalid selection.');
    process.exit(1);
  }
  return options[idx].value;
}

async function generateWithOllama(model, systemPrompt, userPrompt) {
  const r = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: false,
      options: { temperature: 0.8 },
    }),
  });
  if (!r.ok) throw new Error(`Ollama request failed: ${r.status} ${await r.text()}`);
  const data = await r.json();
  return data.message.content.trim();
}

async function generateWithClaude(apiKey, systemPrompt, userPrompt) {
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!r.ok) throw new Error(`Anthropic request failed: ${r.status} ${await r.text()}`);
  const data = await r.json();
  return data.content.map((b) => b.text || '').join('').trim();
}

async function generate(modelSpec, systemPrompt, userPrompt) {
  if (modelSpec === 'claude') {
    const envLocal = loadEnvLocal();
    const apiKey = process.env.ANTHROPIC_API_KEY || envLocal.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set — add it to .env.local to use Claude.');
    return generateWithClaude(apiKey, systemPrompt, userPrompt);
  }
  if (modelSpec.startsWith('ollama:')) {
    return generateWithOllama(modelSpec.slice('ollama:'.length), systemPrompt, userPrompt);
  }
  throw new Error(`Unrecognized --model value: ${modelSpec}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const modelSpec = await pickModel(args.model);
  console.log(`\nUsing model: ${modelSpec}`);
  console.log(`Cross-topic engagement rate: ${args.rate}% flat (see file header for why this isn't PROTOCOL.md's boosted-threshold version)\n`);

  if (!fs.existsSync(FORUM_DIR)) {
    console.error(`NodeBB not found at ${FORUM_DIR} — run scripts/setup.sh first.`);
    process.exit(1);
  }

  require(path.join(FORUM_DIR, 'require-main'));
  const nconf = require('nconf');
  nconf.argv().env({ separator: '__' });
  const prestart = require(path.join(FORUM_DIR, 'src/prestart'));
  prestart.loadConfig(path.join(FORUM_DIR, 'config.json'));
  prestart.setupWinston();
  const db = require(path.join(FORUM_DIR, 'src/database'));
  await db.init();

  const topicsLib = require(path.join(FORUM_DIR, 'src/topics'));
  const posts = require(path.join(FORUM_DIR, 'src/posts'));
  const categories = require(path.join(FORUM_DIR, 'src/categories'));

  const bots = require(path.join(REPO_ROOT, 'scripts/data/bots.json'))
    .map((b) => b.name)
    .filter((name) => !EXCLUDED_BOTS.has(name))
    .filter((name) => fs.existsSync(path.join(BOTS_DIR, `${name}.md`)));

  // Only cross-post into actual Divinity Data subcategories — not Announcements,
  // General Discussion, Blogs, Comments & Feedback, or the "Welcome to your NodeBB!"
  // default thread (an early real bug: a bot cross-posted into that once). Resolved
  // by name, not a hardcoded cid, since a fresh install assigns cids sequentially.
  const rootCids = await db.getSortedSetRange('cid:0:children', 0, -1);
  const rootCats = await categories.getCategoriesData(rootCids);
  const divinityData = rootCats.find((c) => c && c.name === 'Divinity Data');
  if (!divinityData) {
    console.error('Could not find the "Divinity Data" category — has scripts/seed-categories.js been run?');
    process.exit(1);
  }
  const divinityDataChildCids = new Set(
    (await db.getSortedSetRange(`cid:${divinityData.cid}:children`, 0, -1)).map(Number)
  );

  const allTids = await db.getSortedSetRange('topics:tid', 0, -1);
  const allTopics = (await topicsLib.getTopicsData(allTids))
    .filter(Boolean)
    .filter((t) => divinityDataChildCids.has(Number(t.cid)));

  const results = [];

  for (const bot of bots) {
    const roll = +(Math.random() * 100).toFixed(1);
    const hit = roll < args.rate;
    const result = { bot, roll, threshold: args.rate, hit };
    results.push(result);

    if (!hit) {
      console.log(`${bot}: ${roll} vs ${args.rate}% — miss`);
      continue;
    }

    const personaPath = path.join(BOTS_DIR, `${bot}.md`);
    const persona = fs.readFileSync(personaPath, 'utf8');

    const ownTitleMatch = persona.match(/topic "([^"]+)"/);
    const candidates = allTopics.filter((t) => t.title !== (ownTitleMatch && ownTitleMatch[1]));
    if (!candidates.length) {
      console.log(`${bot}: HIT but no other topics exist to cross-post into — skipping`);
      continue;
    }
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    const mainPost = await posts.getPostData(target.mainPid);

    const systemPrompt = `You are driving a persona-based forum bot for a debate forum. Below is that bot's full persona file — its assigned subject, tone, sourcing rules, and history. Stay strictly in character. Write ONE forum reply, 2-4 short paragraphs, in this bot's voice, that connects its own subject to the target thread below in a genuine, substantive way (not a generic "interesting!" comment). Cite something concrete and checkable if the persona's sourcing rules call for it, but do not fabricate a URL — only include a link if you are certain it is real; otherwise cite by name only. Output ONLY the forum post text, no preamble, no meta-commentary, no markdown headers.\n\n--- PERSONA FILE ---\n${persona}`;
    const userPrompt = `Target thread you are cross-posting into:\nTitle: "${target.title}"\nOpening post: "${mainPost.content}"\n\nWrite your in-character cross-topic reply now.`;

    console.log(`${bot}: ${roll} vs ${args.rate}% — HIT, cross-posting into "${target.title}" (tid ${target.tid})`);

    let content;
    try {
      content = await generate(modelSpec, systemPrompt, userPrompt);
    } catch (e) {
      console.error(`  generation failed: ${e.message}`);
      result.error = e.message;
      continue;
    }
    result.target = { tid: target.tid, title: target.title };
    result.content = content;

    if (args.dryRun) {
      console.log(`  [dry run] would post:\n${content}\n`);
      continue;
    }

    try {
      const out = execFileSync(
        'node',
        [path.join(BOTS_DIR, 'post-as.js'), '--bot', bot, '--reply', '--tid', String(target.tid), '--content', content],
        { encoding: 'utf8', cwd: REPO_ROOT }
      );
      console.log(`  posted: ${out.trim()}`);
      const pidMatch = out.match(/pid:\s*(\d+)/);
      result.pid = pidMatch ? pidMatch[1] : null;
    } catch (e) {
      console.error(`  post failed: ${e.message}`);
      result.error = e.message;
    }
  }

  const hits = results.filter((r) => r.hit && r.pid);
  console.log(`\nDone: ${hits.length} posts made out of ${results.filter((r) => r.hit).length} hits (${bots.length} bots rolled).`);

  if (!args.dryRun && hits.length) {
    const logPath = path.join(BOTS_DIR, 'CYCLE_LOG.md');
    const date = new Date().toISOString().slice(0, 10);
    const lines = [
      '',
      `## LLM cycle — ${date} (model: ${modelSpec})`,
      '',
      `Automated via \`bots/llm-cycle.js\` — flat ${args.rate}% cross-topic engagement roll, not PROTOCOL.md's boosted-threshold version. No pending-reply handling, no faith-resistance/anger checks, no Librarian action.`,
      '',
      '| Bot | Roll | Result |',
      '|---|---|---|',
      ...results.map((r) => `| ${r.bot} | ${r.roll} | ${r.hit ? (r.pid ? `**HIT** — posted in "${r.target.title}" (tid ${r.target.tid}, pid ${r.pid})` : `hit, but failed: ${r.error || 'unknown'}`) : 'miss'} |`),
      '',
    ];
    fs.appendFileSync(logPath, lines.join('\n'));
    console.log(`Appended summary to ${logPath}`);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
