#!/usr/bin/env node
// Updates the "Highlights" HTML widget in the global sidebar (see
// scripts/setup-landing-widgets.js for how it got there). Meant to be run each bot
// cycle — a few sentences on the most genuinely interesting exchange(s) from recent
// activity, with links, the same curatorial judgment Librarian already applies to the
// wiki's Forum Highlights sections, just surfaced on the forum landing page too.
//
// Usage: node scripts/update-landing-highlights.js path/to/highlights.html
//   (pass a file containing the HTML/markdown-ish snippet to show; keep it short —
//   this renders in a sidebar widget, not a full page)

const path = require('path');
const fs = require('fs');

const REPO_ROOT = path.resolve(__dirname, '..');
const FORUM_DIR = path.join(REPO_ROOT, 'forum');

const contentFile = process.argv[2];
if (!contentFile) {
  console.error('Usage: node scripts/update-landing-highlights.js path/to/highlights.html');
  process.exit(1);
}
if (!fs.existsSync(contentFile)) {
  console.error(`File not found: ${contentFile}`);
  process.exit(1);
}
const newHtml = fs.readFileSync(contentFile, 'utf8').trim();

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

db.init().then(async () => {
  const widgets = require(path.join(FORUM_DIR, 'src/widgets'));

  const existing = await widgets.getArea('global', 'sidebar');
  const idx = existing.findIndex((w) => w && w.widget === 'html' && w.data && w.data.title === 'Highlights');
  if (idx === -1) {
    console.error('No Highlights widget found in the global sidebar — run scripts/setup-landing-widgets.js first.');
    process.exit(1);
  }

  existing[idx].data.html = `<div class="highlights-widget"><h5>Highlights</h5>${newHtml}</div>`;
  await widgets.setArea({ template: 'global', location: 'sidebar', widgets: existing });
  console.log('Updated the Highlights widget.');
  process.exit(0);
}).catch((e) => { console.error(e); process.exit(1); });
