#!/usr/bin/env node
// Gives every bot account a fake, verified email address. Bot accounts were created
// with emailVerification: 'disabled' and no email at all — this doesn't affect
// anything they do (posting uses the internal API, not HTTP login), but leaves them
// sitting in NodeBB's "unverified-users" group and with an empty email field, which
// looks broken in the admin panel's user list.
//
// This step is now folded into scripts/seed-bots.js too, so fresh installs get it
// automatically — this standalone script exists for re-running it on an install that
// predates that (like this one) or for any bot created outside the normal seed flow.
//
// Uses <name>@sandbox.invalid — ".invalid" is reserved by RFC 2606 specifically for
// addresses that are guaranteed not to resolve to anything real, so there's no risk
// of ever emailing an actual person even if something tried to send mail here.
//
// Safe to re-run: skips any bot that already has a confirmed email.
//
// Usage: node scripts/set-bot-emails.js

const path = require('path');
const fs = require('fs');

const REPO_ROOT = path.resolve(__dirname, '..');
const FORUM_DIR = path.join(REPO_ROOT, 'forum');

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

const bots = require(path.join(REPO_ROOT, 'scripts/data/bots.json'));

db.init().then(async () => {
  const user = require(path.join(FORUM_DIR, 'src/user'));

  let set = 0;
  let skipped = 0;

  for (const bot of bots) {
    const { name } = bot;
    const uid = await user.getUidByUsername(name);
    if (!uid) {
      console.warn(`SKIP ${name} — no NodeBB account found`);
      continue;
    }

    const confirmed = await user.getUserField(uid, 'email:confirmed');
    const currentEmail = await user.getUserField(uid, 'email');
    if (confirmed && currentEmail) {
      console.log(`EXISTS ${name}: ${currentEmail} (already confirmed)`);
      skipped++;
      continue;
    }

    const email = `${name.toLowerCase()}@sandbox.invalid`;
    await user.setUserField(uid, 'email', email);
    await user.email.confirmByUid(uid);
    console.log(`SET ${name}: ${email} (confirmed)`);
    set++;
  }

  console.log(`\nDone: ${set} set, ${skipped} already had a confirmed email.`);
  process.exit(0);
}).catch((e) => { console.error(e); process.exit(1); });
