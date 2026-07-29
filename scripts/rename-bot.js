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
//
// Forum posts themselves need no changes — NodeBB posts store the author's
// uid, not a username snapshot, so every past post picks up the new username
// automatically once step 1 completes.
//
// Whole-word, case-sensitive replacement only. Still worth a manual diff
// review after running, especially for any bot whose old name could
// plausibly appear as a substring of something else.
//
// IMPORTANT — restart NodeBB after running this (./nodebb restart in forum/):
// this script writes straight to MongoDB from its own short-lived process, but
// the actual running NodeBB server keeps its own in-memory cache of user
// objects and won't necessarily notice the write. Confirmed by hitting this
// for real: several renamed accounts kept serving the OLD username over HTTP
// (/api/search, /api/user/uid/<uid>, etc.) until the live server was
// restarted, even though direct DB reads and the persona/env/script files were
// already correct. Don't trust a rename until you've restarted NodeBB and
// re-checked at least one live HTTP endpoint for the renamed uid.
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

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
