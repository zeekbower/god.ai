#!/usr/bin/env node
// Control script for posting to NodeBB as Ridvan (see Ridvan.md).
// Usage:
//   node Ridvan-post.js --new --cid <cid> --title "..." --content "..."
//   node Ridvan-post.js --reply --tid <tid> --content "..." [--toPid <pid>]

const FORUM_DIR = '/home/notds/code/WEBSITES/god.ai/forum';
const RIDVAN_UID = 5;

function parseArgs(argv) {
  const args = { mode: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--new') args.mode = 'new';
    else if (a === '--reply') args.mode = 'reply';
    else if (a === '--cid') args.cid = argv[++i];
    else if (a === '--title') args.title = argv[++i];
    else if (a === '--content') args.content = argv[++i];
    else if (a === '--tid') args.tid = argv[++i];
    else if (a === '--toPid') args.toPid = argv[++i];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

if (!args.mode || !args.content) {
  console.error('Usage:\n' +
    '  node Ridvan-post.js --new --cid <cid> --title "..." --content "..."\n' +
    '  node Ridvan-post.js --reply --tid <tid> --content "..." [--toPid <pid>]');
  process.exit(1);
}
if (args.mode === 'new' && (!args.cid || !args.title)) {
  console.error('--new requires --cid and --title');
  process.exit(1);
}
if (args.mode === 'reply' && !args.tid) {
  console.error('--reply requires --tid');
  process.exit(1);
}

require(`${FORUM_DIR}/require-main`);
const nconf = require('nconf');
nconf.argv().env({ separator: '__' });
const path = require('path');
const prestart = require(`${FORUM_DIR}/src/prestart`);
prestart.loadConfig(path.join(FORUM_DIR, 'config.json'));
prestart.setupWinston();
const db = require(`${FORUM_DIR}/src/database`);

db.init().then(async () => {
  const meta = require(`${FORUM_DIR}/src/meta`);
  await meta.configs.init();
  const topics = require(`${FORUM_DIR}/src/topics`);

  if (args.mode === 'new') {
    const { topicData, postData } = await topics.post({
      uid: RIDVAN_UID,
      cid: parseInt(args.cid, 10),
      title: args.title,
      content: args.content,
    });
    console.log('CREATED topic tid:', topicData.tid, 'pid:', postData.pid);
  } else {
    const postData = await topics.reply({
      uid: RIDVAN_UID,
      tid: parseInt(args.tid, 10),
      content: args.content,
      toPid: args.toPid ? parseInt(args.toPid, 10) : undefined,
    });
    console.log('REPLIED pid:', postData.pid, 'in tid:', args.tid);
  }
  process.exit(0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
