#!/usr/bin/env node
// Performs the one-time "going live" steps documented in bots/PROTOCOL.md's
// "Going live" section — currently just one thing: trollerskates was built purely as
// a dev/training sparring partner (see bots/trollerskates.md's warning banner) and
// was never meant to exist once real strangers, not just notds and the other bots,
// could be on the receiving end of it.
//
// What this does:
//   1. Permanently bans the trollerskates NodeBB account (not deletes — its existing
//      posts stay in forum history as-is, per PROTOCOL.md, since they were made
//      against consenting participants during development).
//   2. Prints a reminder about the two steps this script can't do for you:
//      - If the hourly bot-update cron is running (CronCreate, session-only), confirm
//        trollerskates was never in it (PROTOCOL.md says it's excluded by design —
//        this just double-checks nothing changed).
//      - Move trollerskates' row in PROTOCOL.md's roster to a "retired" note (this
//        script does NOT edit PROTOCOL.md itself — that's a human/Claude judgment
//        call about how to phrase the historical record, not a mechanical step).
//
// Safe to re-run: skips the ban if trollerskates is already banned.
//
// Usage: node scripts/go-live.js
// This is a one-way, public-facing decision — think before running it, same as any
// other "going live" action. It does not affect NodeBB's public/private visibility
// itself (that's a hosting/network decision, not something this script touches).

const path = require('path');
const fs = require('fs');

const REPO_ROOT = path.resolve(__dirname, '..');
const FORUM_DIR = path.join(REPO_ROOT, 'forum');

if (!fs.existsSync(FORUM_DIR)) {
  console.error(`NodeBB not found at ${FORUM_DIR} — nothing to do.`);
  process.exit(1);
}

require(path.join(FORUM_DIR, 'require-main'));
const nconf = require('nconf');
nconf.argv().env({ separator: '__' });
const prestart = require(path.join(FORUM_DIR, 'src/prestart'));
prestart.loadConfig(path.join(FORUM_DIR, 'config.json'));
prestart.setupWinston();
const db = require(path.join(FORUM_DIR, 'src/database'));

db.init().then(async () => {
  const user = require(path.join(FORUM_DIR, 'src/user'));

  const uid = await user.getUidByUsername('trollerskates');
  if (!uid) {
    console.log('No trollerskates account found — nothing to retire.');
    process.exit(0);
  }

  const alreadyBanned = await user.bans.isBanned(uid);
  if (alreadyBanned) {
    console.log(`trollerskates (uid ${uid}) is already banned — nothing to do.`);
  } else {
    await user.bans.ban(uid, 0, 'Retired at go-live — see bots/PROTOCOL.md\'s "Going live" section. Not deleted; historical posts stay in forum history as-is.');
    console.log(`Banned trollerskates (uid ${uid}) permanently. Its existing posts are untouched.`);
  }

  console.log('\nRemaining manual steps (not automated by this script):');
  console.log('  1. If an hourly bot-update cron is currently running (CronCreate), confirm');
  console.log('     trollerskates was never included in it — PROTOCOL.md says it should already');
  console.log('     be excluded by design, this is just a check, not a fix.');
  console.log('  2. Move trollerskates\' row in bots/PROTOCOL.md\'s roster table to a "retired"');
  console.log('     note, per the "Going live" section — a wording/judgment call, not scripted.');
  console.log('  3. This script does not change NodeBB\'s network exposure (public/private,');
  console.log('     firewall rules, etc.) — that\'s a hosting decision, handle separately.');

  process.exit(0);
}).catch((e) => { console.error(e); process.exit(1); });
