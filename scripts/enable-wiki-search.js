#!/usr/bin/env node
// One-off: enables Wiki.js's built-in "Database - Basic" search engine (title/
// description/path match against the pages table) so unified search has real
// wiki results to merge with NodeBB's. Off by default on a fresh Wiki.js
// install — GraphQL search.search() silently returns empty results with no
// engine active, it doesn't error.
//
// Safe to re-run.
//
// Usage: node scripts/enable-wiki-search.js

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const envPath = path.join(REPO_ROOT, '.env.local');
const envText = fs.readFileSync(envPath, 'utf8');
const apiKey = envText.match(/WIKIJS_API_KEY=(.*)/)[1].trim();
const wikiUrl = envText.match(/WIKIJS_URL=(.*)/)[1].trim();

async function gql(query, variables) {
  const r = await fetch(`${wikiUrl}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query, variables }),
  });
  const d = await r.json();
  if (d.errors) throw new Error(JSON.stringify(d.errors));
  return d.data;
}

(async () => {
  const current = await gql('{ search { searchEngines { key isEnabled } } }');
  const engines = current.search.searchEngines.map(e => ({
    key: e.key,
    isEnabled: e.key === 'db',
    config: [],
  }));

  const result = await gql(
    `mutation($engines: [SearchEngineInput]) {
      search { updateSearchEngines(engines: $engines) { responseResult { succeeded message } } }
    }`,
    { engines }
  );
  console.log(result.search.updateSearchEngines.responseResult);
})().catch(e => { console.error(e); process.exit(1); });
