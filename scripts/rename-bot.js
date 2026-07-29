#!/usr/bin/env node
// Renames a Divinity Data debate bot's identity everywhere it appears:
//   1. The NodeBB account itself (username + userslug), via the same internal
//      user.updateProfile() the real "change username" account-settings flow
//      uses — not a raw DB field edit, so the username:uid/userslug:uid/
//      username:sorted indexes and the account's username-history all get
//      updated the same way a real rename would.
//   2. Its persona .md file (renamed, and every internal self-reference
//      rewritten).
//   3. Its credentials .env file (renamed, including the <OLDNAME>_* env var
//      prefix).
//   4. Its individual legacy control script, <old>-post.js, if it has one
//      (bots from before the shared post-as.js script).
//   5. Every other tracked markdown file in bots/ that cross-references the
//      old name (other bots' persona files, PROTOCOL.md, CYCLE_LOG.md,
//      trollerskates.md).
//   6. Every forum post's actual CONTENT, forum-wide (not just this bot's own
//      posts) — the account rename alone does NOT fix a literal self-intro
//      like "testbotA here..." baked into a post's text, nor another bot's
//      reply that addressed it by its old name ("testbotB, I think..."). Both
//      are real, found by hitting this directly: every one of the 18 original
//      testbotX bots had exactly one self-reference (its mandatory intro
//      post) plus 8 more cross-references scattered across other bots'
//      replies, forum-wide, none of which the account rename alone touched.
//
// Whole-word, case-sensitive replacement only. Still worth a manual diff
// review after running, especially for any bot whose old name could
// plausibly appear as a substring of something else (or is itself a common
// word/doctrinal term used unrelated to the bot, e.g. lowercase "anatta" the
// Buddhist concept vs "Anatta" the account — word-boundary regex still
// matches case-sensitively here, so it won't touch the former).
//
// IMPORTANT — after running this:
//   1. Restart NodeBB (./nodebb restart in forum/). This script writes
//      straight to MongoDB from its own short-lived process, but the actual
//      running NodeBB server keeps its own in-memory cache of user objects
//      AND post content, and won't necessarily notice the write. Confirmed by
//      hitting this for real, twice: renamed accounts kept serving the OLD
//      username over HTTP, and edited post content kept serving the OLD text,
//      until the live server was restarted — inconsistently, some uids/pids
//      showed the fix immediately and others didn't, so don't assume one
//      successful spot-check means the rest are fine.
//   2. Reindex search (nodebb-plugin-dbsearch keeps its own denormalized copy
//      of post content that action:post.edit does NOT reliably refresh in
//      this setup — confirmed a stale index entry still matched an old name
//      after a restart). Reindex via that plugin's lib/dbsearch.js
//      search.reindex() (needs global.nodebb = { require: (p) => require(p) }
//      set first, since the plugin file expects NodeBB's real plugin-loader
//      shim).
//   3. Don't trust any of this until you've re-checked at least one live HTTP
//      endpoint (a topic/post the bot appears in, and a search for its old
//      name) after both of the above.
//
// Usage:
//   node scripts/rename-bot.js --old testbotA --new EmptyTomb [--dry-run]

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const BOTS_DIR = path.join(REPO_ROOT, 'bots');
const FORUM_DIR = path.join(REPO_ROOT, 'forum');

function parseArgs(argv) {
  const args = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--old') args.old = argv[++i];
    else if (argv[i] === '--new') args.new = argv[++i];
    else if (argv[i] === '--dry-run') args.dryRun = true;
  }
  return args;
}

const { old: oldName, new: newName, dryRun } = parseArgs(process.argv.slice(2));
if (!oldName || !newName) {
  console.error('Usage: node scripts/rename-bot.js --old <OldName> --new <NewName> [--dry-run]');
  process.exit(1);
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const boundaryRe = () => new RegExp(`\\b${escapeRegex(oldName)}\\b`, 'g');

function renameFileIfExists(oldPath, newPath, transform) {
  if (!fs.existsSync(oldPath)) return false;
  let content = fs.readFileSync(oldPath, 'utf8');
  content = transform ? transform(content) : content.replace(boundaryRe(), newName);
  if (dryRun) {
    console.log(`[dry-run] would write ${path.basename(newPath)} and remove ${path.basename(oldPath)}`);
    return true;
  }
  fs.writeFileSync(newPath, content);
  if (oldPath !== newPath) fs.unlinkSync(oldPath);
  console.log(`renamed ${path.basename(oldPath)} -> ${path.basename(newPath)}`);
  return true;
}

async function main() {
  require(path.join(FORUM_DIR, 'require-main'));
  const nconf = require('nconf');
  nconf.argv().env({ separator: '__' });
  const prestart = require(path.join(FORUM_DIR, 'src/prestart'));
  prestart.loadConfig(path.join(FORUM_DIR, 'config.json'));
  prestart.setupWinston();
  const db = require(path.join(FORUM_DIR, 'src/database'));
  await db.init();
  const meta = require(path.join(FORUM_DIR, 'src/meta'));
  await meta.configs.init();
  const user = require(path.join(FORUM_DIR, 'src/user'));

  const uid = await db.sortedSetScore('username:uid', oldName);
  if (!uid) {
    console.error(`No NodeBB account found for username "${oldName}" — aborting before touching any files.`);
    process.exit(1);
  }
  console.log(`Found uid ${uid} for ${oldName}.`);

  if (dryRun) {
    console.log(`[dry-run] would call user.updateProfile(1, { uid: ${uid}, username: '${newName}' })`);
  } else {
    await user.updateProfile(1, { uid, username: newName });
    const after = await db.getObjectFields(`user:${uid}`, ['username', 'userslug']);
    if (after.username !== newName) {
      throw new Error(`Rename did not take effect — user:${uid}.username is still "${after.username}"`);
    }
    console.log(`NodeBB account renamed: uid ${uid} is now "${after.username}" (userslug "${after.userslug}").`);
  }

  renameFileIfExists(path.join(BOTS_DIR, `${oldName}.md`), path.join(BOTS_DIR, `${newName}.md`));

  const envTransform = (content) =>
    content
      .replace(new RegExp(escapeRegex(oldName.toUpperCase()), 'g'), newName.toUpperCase())
      .replace(boundaryRe(), newName);
  renameFileIfExists(path.join(BOTS_DIR, `${oldName}.env`), path.join(BOTS_DIR, `${newName}.env`), envTransform);
  renameFileIfExists(
    path.join(BOTS_DIR, `${oldName}-post.js`),
    path.join(BOTS_DIR, `${newName}-post.js`),
    envTransform
  );

  const mdFiles = fs
    .readdirSync(BOTS_DIR)
    .filter((f) => f.endsWith('.md') && f !== `${oldName}.md` && f !== `${newName}.md`);
  for (const file of mdFiles) {
    const filePath = path.join(BOTS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    if (!boundaryRe().test(content)) continue;
    const updated = content.replace(boundaryRe(), newName);
    if (dryRun) {
      console.log(`[dry-run] would update references in ${file}`);
    } else {
      fs.writeFileSync(filePath, updated);
      console.log(`updated references in ${file}`);
    }
  }

  if (!dryRun) {
    const remaining = fs
      .readdirSync(BOTS_DIR)
      .filter((f) => f.endsWith('.md'))
      .filter((f) => boundaryRe().test(fs.readFileSync(path.join(BOTS_DIR, f), 'utf8')));
    if (remaining.length) {
      console.warn(`WARNING: "${oldName}" still appears in: ${remaining.join(', ')}`);
    } else {
      console.log(`Verified: "${oldName}" no longer appears in any tracked markdown file in bots/.`);
    }
  }

  // Forum post content, forum-wide — the bot's own self-intro plus any other
  // bot's reply that addressed it by its old name.
  const posts = require(path.join(FORUM_DIR, 'src/posts'));
  const maxPid = await db.getObjectField('global', 'nextPid');
  const allPids = [];
  for (let i = 1; i < maxPid; i++) allPids.push(i);
  const allPosts = await posts.getPostsFields(allPids, ['pid', 'content']);
  const matches = allPosts.filter((p) => p && p.content && boundaryRe().test(p.content));

  if (!matches.length) {
    console.log(`No forum post content references "${oldName}" — nothing to edit.`);
  } else if (dryRun) {
    console.log(`[dry-run] would edit ${matches.length} post(s): ${matches.map((p) => p.pid).join(', ')}`);
  } else {
    for (const { pid, content } of matches) {
      const newContent = content.replace(boundaryRe(), newName);
      await posts.edit({ pid, uid: 1, content: newContent });
      console.log(`edited post content: pid ${pid}`);
    }
    console.log(
      `${matches.length} post(s) edited. Now restart NodeBB and reindex search — see the header comment.`
    );
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
