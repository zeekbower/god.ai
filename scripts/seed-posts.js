#!/usr/bin/env node
// Replays every topic and post that existed on the forum at the time this
// snapshot was taken, from scripts/data/posts.json — so a fresh install ends
// up with the same debate history, not just empty categories and bare bot
// accounts.
//
// Runs after seed-categories.js and seed-bots.js (needs both categories and
// bot accounts to already exist). Posts are replayed with their original
// author and original timestamp, in original order, using `fromQueue: true`
// to skip NodeBB's post-rate-limit checks (irrelevant here — this is a bulk
// historical replay, not organic real-time posting).
//
// Categories are matched by name (+ parent name), not by cid — cids are not
// stable across installs since categories.create() assigns them sequentially.
// Authors are matched by username, not uid, for the same reason.
//
// Known limitation: reply-to (quote) threading between individual posts is
// not preserved, only linear post order within a topic — NodeBB's "toPid"
// quote links aren't recorded in the snapshot. Content itself is unaffected;
// only the "in reply to post #N" UI marker is lost.
//
// Safe to re-run: skips any topic whose title already exists in its resolved
// category.
//
// Usage: node scripts/seed-posts.js

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

const topicSnapshots = require(path.join(__dirname, 'data/posts.json'));

db.init().then(async () => {
  const topicsLib = require(path.join(FORUM_DIR, 'src/topics'));
  const categories = require(path.join(FORUM_DIR, 'src/categories'));
  const user = require(path.join(FORUM_DIR, 'src/user'));
  const meta = require(path.join(FORUM_DIR, 'src/meta'));
  await meta.configs.init();

  const catCache = new Map();
  async function resolveCid(categoryName, parentName) {
    const cacheKey = `${parentName || ''}::${categoryName}`;
    if (catCache.has(cacheKey)) return catCache.get(cacheKey);

    let parentCid = null;
    if (parentName) {
      const rootCids = await db.getSortedSetRange('cid:0:children', 0, -1);
      const rootCats = await categories.getCategoriesData(rootCids);
      const parent = rootCats.find(c => c && c.name === parentName);
      if (!parent) {
        catCache.set(cacheKey, null);
        return null;
      }
      parentCid = parent.cid;
    }

    const childCids = parentCid
      ? await db.getSortedSetRange(`cid:${parentCid}:children`, 0, -1)
      : await db.getSortedSetRange('cid:0:children', 0, -1);
    const cats = await categories.getCategoriesData(childCids);
    const match = cats.find(c => c && c.name === categoryName);
    const cid = match ? match.cid : null;
    catCache.set(cacheKey, cid);
    return cid;
  }

  const uidCache = new Map();
  async function resolveUid(username) {
    if (uidCache.has(username)) return uidCache.get(username);
    const uid = await user.getUidByUsername(username);
    uidCache.set(username, uid);
    return uid;
  }

  async function topicAlreadyExists(cid, title) {
    const tids = await db.getSortedSetRange(`cid:${cid}:tids`, 0, -1);
    if (!tids.length) return false;
    const titles = await topicsLib.getTopicsFields(tids, ['title']);
    return titles.some(t => t && t.title === title);
  }

  let topicsCreated = 0;
  let topicsSkipped = 0;
  let postsCreated = 0;
  let warnings = 0;

  for (const snap of topicSnapshots) {
    const cid = await resolveCid(snap.categoryName, snap.parentName);
    if (!cid) {
      console.warn(`SKIP "${snap.title}" — category "${snap.categoryName}" (parent "${snap.parentName}") not found`);
      warnings++;
      continue;
    }

    if (await topicAlreadyExists(cid, snap.title)) {
      console.log(`EXISTS: "${snap.title}" in cid ${cid}`);
      topicsSkipped++;
      continue;
    }

    const mainPost = snap.posts.find(p => p.isMain) || snap.posts[0];
    const otherPosts = snap.posts.filter(p => p !== mainPost);

    const authorUid = await resolveUid(snap.author);
    if (!authorUid) {
      console.warn(`SKIP "${snap.title}" — author "${snap.author}" has no NodeBB account`);
      warnings++;
      continue;
    }

    let tid;
    try {
      const result = await topicsLib.post({
        uid: authorUid,
        cid,
        title: snap.title,
        content: mainPost.content,
        timestamp: snap.timestamp,
        fromQueue: true,
      });
      tid = result.topicData.tid;
      topicsCreated++;
      postsCreated++;
      console.log(`CREATED topic "${snap.title}" (tid ${tid}, cid ${cid}, author ${snap.author})`);
    } catch (e) {
      console.warn(`SKIP "${snap.title}" — failed to create: ${e.message}`);
      warnings++;
      continue;
    }

    for (const post of otherPosts) {
      const replyUid = await resolveUid(post.author);
      if (!replyUid) {
        console.warn(`  SKIP reply by "${post.author}" in "${snap.title}" — no NodeBB account`);
        warnings++;
        continue;
      }
      try {
        await topicsLib.reply({
          uid: replyUid,
          tid,
          content: post.content,
          timestamp: post.timestamp,
          fromQueue: true,
        });
        postsCreated++;
      } catch (e) {
        console.warn(`  SKIP reply by "${post.author}" in "${snap.title}": ${e.message}`);
        warnings++;
      }
    }
  }

  console.log(`\nDone: ${topicsCreated} topics created (${postsCreated} posts total), ${topicsSkipped} topics already existed, ${warnings} warnings.`);
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
