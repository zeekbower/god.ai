#!/usr/bin/env node
// Recreates every bot's NodeBB account (and, for Librarian, her Wiki.js account
// too) on a fresh install, from scripts/data/bots.json. Each bot's persona .md
// file is already tracked in git and doesn't need regenerating — this script
// only needs to (re)create the accounts those files' control scripts talk to,
// and write fresh <name>.env credential files with the new uids.
//
// Does not itself replay historical forum posts — that's scripts/seed-posts.js,
// which needs these accounts to already exist and should run right after this.
//
// Safe to re-run: skips any bot whose NodeBB account already exists (but still
// rewrites its .env file, in case the password was lost).
//
// Usage: node scripts/seed-bots.js

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const REPO_ROOT = path.resolve(__dirname, '..');
const FORUM_DIR = path.join(REPO_ROOT, 'forum');
const BOTS_DIR = path.join(REPO_ROOT, 'bots');

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

const bots = require(path.join(__dirname, 'data/bots.json'));

async function gqlWiki(url, apiKey, query, variables) {
  const r = await fetch(`${url}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query, variables }),
  });
  const d = await r.json();
  if (d.errors) throw new Error(JSON.stringify(d.errors));
  return d.data;
}

async function setupLibrarianWikiAccount(botEnvLines) {
  const envPath = path.join(REPO_ROOT, '.env.local');
  if (!fs.existsSync(envPath)) {
    console.log('  (skipping Wiki.js account for Librarian — no .env.local / WIKIJS_API_KEY found yet)');
    return botEnvLines;
  }
  const envText = fs.readFileSync(envPath, 'utf8');
  const keyMatch = envText.match(/WIKIJS_API_KEY=(.*)/);
  const urlMatch = envText.match(/WIKIJS_URL=(.*)/);
  if (!keyMatch || !urlMatch) {
    console.log('  (skipping Wiki.js account for Librarian — WIKIJS_API_KEY/WIKIJS_URL not set)');
    return botEnvLines;
  }
  const apiKey = keyMatch[1].trim();
  const wikiUrl = urlMatch[1].trim();

  const existing = await gqlWiki(wikiUrl, apiKey, '{ users { list { id email } } }');
  let librarianUser = existing.users.list.find(u => u.email === 'librarian@localhost.local');
  let groupId;
  const groups = await gqlWiki(wikiUrl, apiKey, '{ groups { list { id name } } }');
  let curators = groups.groups.list.find(g => g.name === 'Curators');

  if (!curators) {
    const ruleId = crypto.randomUUID();
    const createGroup = await gqlWiki(
      wikiUrl, apiKey,
      'mutation($name: String!) { groups { create(name: $name) { group { id } } } }',
      { name: 'Curators' }
    );
    groupId = createGroup.groups.create.group.id;
    await gqlWiki(
      wikiUrl, apiKey,
      'mutation($id: Int!, $name: String!, $redirectOnLogin: String!, $permissions: [String]!, $pageRules: [PageRuleInput]!) { groups { update(id: $id, name: $name, redirectOnLogin: $redirectOnLogin, permissions: $permissions, pageRules: $pageRules) { responseResult { succeeded } } } }',
      {
        id: groupId, name: 'Curators', redirectOnLogin: '/',
        permissions: ['read:pages', 'write:pages', 'read:comments', 'write:comments'],
        pageRules: [{ id: ruleId, deny: false, match: 'START', roles: ['read:pages', 'write:pages'], path: '', locales: ['en'] }],
      }
    );
    console.log(`  CREATED Wiki.js "Curators" group: id ${groupId}`);
  } else {
    groupId = curators.id;
    console.log(`  EXISTS Wiki.js "Curators" group: id ${groupId}`);
  }

  const wikiPassword = crypto.randomBytes(18).toString('base64');
  if (!librarianUser) {
    await gqlWiki(
      wikiUrl, apiKey,
      'mutation($email: String!, $name: String!, $passwordRaw: String, $providerKey: String!, $groups: [Int]!, $mustChangePassword: Boolean, $sendWelcomeEmail: Boolean) { users { create(email: $email, name: $name, passwordRaw: $passwordRaw, providerKey: $providerKey, groups: $groups, mustChangePassword: $mustChangePassword, sendWelcomeEmail: $sendWelcomeEmail) { responseResult { succeeded message } } } }',
      { email: 'librarian@localhost.local', name: 'Librarian', passwordRaw: wikiPassword, providerKey: 'local', groups: [groupId], mustChangePassword: false, sendWelcomeEmail: false }
    );
    const list = await gqlWiki(wikiUrl, apiKey, '{ users { list { id email } } }');
    librarianUser = list.users.list.find(u => u.email === 'librarian@localhost.local');
    console.log(`  CREATED Wiki.js user: Librarian (id ${librarianUser.id})`);
    botEnvLines.push(`LIBRARIAN_WIKI_USER_ID=${librarianUser.id}`);
    botEnvLines.push(`LIBRARIAN_WIKI_EMAIL=librarian@localhost.local`);
    botEnvLines.push(`LIBRARIAN_WIKI_PASSWORD=${wikiPassword}`);
  } else {
    console.log(`  EXISTS Wiki.js user: Librarian (id ${librarianUser.id}) — not overwriting her password`);
    botEnvLines.push(`LIBRARIAN_WIKI_USER_ID=${librarianUser.id}`);
    botEnvLines.push(`LIBRARIAN_WIKI_EMAIL=librarian@localhost.local`);
    botEnvLines.push(`# LIBRARIAN_WIKI_PASSWORD not rewritten — account already existed`);
  }
  return botEnvLines;
}

db.init().then(async () => {
  const user = require(path.join(FORUM_DIR, 'src/user'));
  const meta = require(path.join(FORUM_DIR, 'src/meta'));
  await meta.configs.init();
  const threshold = meta.config.newbieReputationThreshold;
  const target = threshold + 5;

  for (const bot of bots) {
    const name = bot.name;
    let uid = await user.getUidByUsername(name);
    let password = null;
    if (!uid) {
      password = crypto.randomBytes(18).toString('base64');
      uid = await user.create({ username: name, password, fullname: name }, { emailVerification: 'disabled' });
      console.log(`CREATED ${name}: uid ${uid}`);
    } else {
      console.log(`EXISTS ${name}: uid ${uid}`);
    }

    const current = parseInt(await db.getObjectField(`user:${uid}`, 'reputation'), 10) || 0;
    const delta = target - current;
    if (delta > 0) await user.incrementUserReputationBy(uid, delta);

    // Fake, RFC-2606-reserved (.invalid — guaranteed non-resolving) verified email,
    // so bots don't sit unverified/emailless in the admin panel. See
    // scripts/set-bot-emails.js for the standalone version of this step.
    if (!(await user.getUserField(uid, 'email:confirmed'))) {
      await user.setUserField(uid, 'email', `${name.toLowerCase()}@sandbox.invalid`);
      await user.email.confirmByUid(uid);
    }

    const envPath = path.join(BOTS_DIR, `${name}.env`);
    let lines;
    if (password) {
      lines = [
        `${name.toUpperCase()}_UID=${uid}`,
        `${name.toUpperCase()}_USERNAME=${name}`,
        `${name.toUpperCase()}_PASSWORD=${password}`,
      ];
    } else if (fs.existsSync(envPath)) {
      console.log(`  (keeping existing ${name}.env — account already existed)`);
      continue;
    } else {
      // Account exists (e.g. re-run after partial failure) but .env is missing —
      // we don't know the original password, so generate a new one and reset it.
      password = crypto.randomBytes(18).toString('base64');
      await user.setUserField(uid, 'password', await user.hashPassword(password));
      lines = [
        `${name.toUpperCase()}_UID=${uid}`,
        `${name.toUpperCase()}_USERNAME=${name}`,
        `${name.toUpperCase()}_PASSWORD=${password}  # reset — original .env was missing`,
      ];
    }

    if (bot.wikiAccount) {
      await setupLibrarianWikiAccount(lines);
    }

    fs.writeFileSync(envPath, lines.join('\n') + '\n');
  }

  console.log(`\nDone. ${bots.length} bots processed. Run scripts/seed-posts.js next to`);
  console.log('replay each bot\'s forum history (introductions, debates, etc.).');
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
