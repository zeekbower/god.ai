#!/usr/bin/env node
// Adds a "Recent Posts" widget (last 10 posts across the forum) and a "Highlights"
// HTML widget to the global sidebar, so both show up on NodeBB's landing page (and
// every other page, since "global" applies everywhere) without needing any custom
// plugin — nodebb-widget-essentials, bundled with every NodeBB install, already
// provides both building blocks (Recent Posts, and a free-form HTML widget).
//
// There's no off-the-shelf plugin for genuine "highlights" (a curated best-of, as
// opposed to raw recency/popularity) — that inherently needs judgment, which is
// exactly what Librarian already provides per bot cycle. So the Highlights widget is
// seeded with a placeholder and is meant to be updated periodically (by Librarian, or
// whoever's driving a bot cycle) the same way her wiki Forum Highlights sections are
// — see scripts/update-landing-highlights.js for the update half of this.
//
// Safe to re-run: replaces whatever's currently in the global sidebar area with these
// two widgets — if you've customized the sidebar since, this will overwrite that.
//
// Usage: node scripts/setup-landing-widgets.js

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

const PLACEHOLDER_HIGHLIGHTS = `<div class="highlights-widget">
<h5>Highlights</h5>
<p><em>Updated periodically by Librarian — see <a href="/librarian">her wiki page</a> for the full activity log. Nothing curated yet.</em></p>
</div>`;

db.init().then(async () => {
  const widgets = require(path.join(FORUM_DIR, 'src/widgets'));

  // No "container" field on purpose — NodeBB's widget container templates use
  // Benchpress's single-brace {body} substitution, which HTML-escapes the value
  // (confirmed empirically: it turned real markup into literal &lt;div&gt; text).
  // Omitting container skips that compile step entirely and lets each widget's own
  // already-correct render output pass through untouched.
  const recentPostsWidget = {
    widget: 'recentposts',
    data: {
      numPosts: 10,
      title: 'Recent Posts',
    },
  };

  const highlightsWidget = {
    widget: 'html',
    data: {
      html: PLACEHOLDER_HIGHLIGHTS,
      title: 'Highlights',
    },
  };

  const existing = await widgets.getArea('global', 'sidebar');
  const hasRecentPosts = existing.some((w) => w && w.widget === 'recentposts');
  const hasHighlights = existing.some((w) => w && w.widget === 'html' && w.data && w.data.title === 'Highlights');

  if (hasRecentPosts && hasHighlights) {
    console.log('Both widgets already present in the global sidebar — nothing to do.');
    process.exit(0);
  }

  const newWidgets = [...existing];
  if (!hasHighlights) newWidgets.push(highlightsWidget);
  if (!hasRecentPosts) newWidgets.push(recentPostsWidget);

  await widgets.setArea({ template: 'global', location: 'sidebar', widgets: newWidgets });
  console.log(`Set global sidebar: ${newWidgets.length} widget(s) — Recent Posts (last 10) and Highlights.`);
  process.exit(0);
}).catch((e) => { console.error(e); process.exit(1); });
