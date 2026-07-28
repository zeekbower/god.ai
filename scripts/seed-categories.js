#!/usr/bin/env node
// Recreates the full NodeBB category tree (Divinity Data + every subcategory) on a
// fresh install, from the checked-in snapshot in scripts/data/categories.json.
//
// Safe to re-run: skips any category whose name already exists as a child of the
// same parent, so it won't create duplicates if run more than once.
//
// Usage: node scripts/seed-categories.js
// (run from anywhere; paths below are resolved relative to this file)

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
const db = require(path.join(FORUM_DIR, 'src/database'));

const categoryTree = require(path.join(__dirname, 'data/categories.json'));

db.init().then(async () => {
  const categories = require(path.join(FORUM_DIR, 'src/categories'));

  async function findChildByName(parentCid, name) {
    if (!parentCid) {
      // Top-level: check root category list.
      const rootCids = await db.getSortedSetRange('cid:0:children', 0, -1);
      const cats = await categories.getCategoriesData(rootCids);
      return cats.find(c => c && c.name === name);
    }
    const childCids = await db.getSortedSetRange(`cid:${parentCid}:children`, 0, -1);
    const cats = await categories.getCategoriesData(childCids);
    return cats.find(c => c && c.name === name);
  }

  let created = 0;
  let skipped = 0;

  for (const top of categoryTree) {
    let topCat = await findChildByName(null, top.name);
    if (!topCat) {
      topCat = await categories.create({ name: top.name, description: top.description || '' });
      console.log(`CREATED top-level: ${top.name} (cid ${topCat.cid})`);
      created++;
    } else {
      console.log(`EXISTS top-level: ${top.name} (cid ${topCat.cid})`);
      skipped++;
    }

    for (const child of top.children || []) {
      const existing = await findChildByName(topCat.cid, child.name);
      if (existing) {
        console.log(`  EXISTS: ${child.name} (cid ${existing.cid})`);
        skipped++;
        continue;
      }
      const cat = await categories.create({
        name: child.name,
        description: child.description || '',
        parentCid: topCat.cid,
      });
      console.log(`  CREATED: ${child.name} (cid ${cat.cid})`);
      created++;
    }

    // Divinity Data has 40+ subcategories — raise the pagination limit so they
    // all actually show up (NodeBB's default of 10 hides the rest otherwise).
    if (top.children && top.children.length > 10) {
      await db.setObjectField(`category:${topCat.cid}`, 'subCategoriesPerPage', Math.max(60, top.children.length + 10));
    }
  }

  console.log(`\nDone: ${created} created, ${skipped} already existed.`);
  console.log('Restart NodeBB now (./nodebb restart) so the category cache picks these up.');
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
