#!/usr/bin/env bash
# Sets up everything this project needs on a fresh machine: the Next.js site's
# own dependencies, a fresh NodeBB forum + MongoDB, and a fresh Wiki.js instance —
# then seeds the Divinity Data category tree and every bot account from the
# checked-in data in scripts/data/.
#
# Usage: ./scripts/setup.sh
# Safe to re-run — every step skips work that's already done.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

NODEBB_VERSION="v4.14.2"
WIKIJS_VERSION="v2.5.314"
MONGODB_VERSION="7.0.14"
NODEBB_PORT=4567
WIKIJS_PORT=4568
MONGODB_PORT=27117

log()  { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
warn() { printf '\033[1;33m!! %s\033[0m\n' "$1"; }
err()  { printf '\033[1;31mERROR: %s\033[0m\n' "$1" >&2; }

# ---------------------------------------------------------------------------
log "Checking prerequisites"
# ---------------------------------------------------------------------------
command -v node >/dev/null || { err "Node.js is required (v18+). Install it first."; exit 1; }
command -v npm  >/dev/null || { err "npm is required."; exit 1; }
command -v git  >/dev/null || { err "git is required."; exit 1; }
command -v curl >/dev/null || { err "curl is required."; exit 1; }

NODE_MAJOR="$(node --version | sed -E 's/^v([0-9]+).*/\1/')"
if [ "$NODE_MAJOR" -lt 18 ]; then
  err "Node.js v18+ required, found $(node --version)."
  exit 1
fi
echo "node $(node --version), npm $(npm --version) — OK"

# ---------------------------------------------------------------------------
log "Installing god.ai (Next.js site) dependencies"
# ---------------------------------------------------------------------------
npm install

# ---------------------------------------------------------------------------
log "Setting up NodeBB ($NODEBB_VERSION)"
# ---------------------------------------------------------------------------
if [ ! -d forum ]; then
  git clone --branch "$NODEBB_VERSION" --depth 1 https://github.com/NodeBB/NodeBB.git forum
else
  echo "forum/ already exists — skipping clone"
fi

if [ ! -d forum/node_modules ]; then
  ( cd forum && npm install --omit=dev --legacy-peer-deps )
else
  echo "forum/node_modules already exists — skipping install"
fi

mkdir -p forum-data/mongo

if [ ! -f forum/config.json ]; then
  SECRET="$(node -e "console.log(require('crypto').randomBytes(24).toString('hex'))")"
  cat > forum/config.json <<EOF
{
    "url": "http://localhost:${NODEBB_PORT}",
    "secret": "${SECRET}",
    "database": "mongo",
    "port": "${NODEBB_PORT}",
    "mongo": {
        "host": "127.0.0.1",
        "port": "${MONGODB_PORT}",
        "username": "",
        "password": "",
        "database": "nodebb",
        "uri": ""
    }
}
EOF
  echo "Generated forum/config.json (fresh random secret). Edit the \"url\" field"
  echo "later if you want this reachable from other machines on your network."
else
  echo "forum/config.json already exists — leaving it alone"
fi

# ---------------------------------------------------------------------------
log "Setting up MongoDB"
# ---------------------------------------------------------------------------
if command -v mongod >/dev/null; then
  echo "System mongod found ($(mongod --version | head -1)) — will use that instead of a portable copy."
  MONGOD_BIN="mongod"
elif [ -x forum-data/mongodb/bin/mongod ]; then
  echo "Portable mongod already present — skipping download."
  MONGOD_BIN="$REPO_ROOT/forum-data/mongodb/bin/mongod"
else
  warn "No system mongod found. Downloading a portable MongoDB Community Server."
  warn "This download is pinned to Ubuntu 22.04/x86_64 — if this machine is a"
  warn "different OS/architecture, this step will likely fail. In that case,"
  warn "install MongoDB yourself (e.g. via your OS package manager or"
  warn "https://www.mongodb.com/try/download/community) and re-run this script —"
  warn "it'll detect \`mongod\` on PATH and use that instead."
  MONGO_TARBALL="mongodb-linux-x86_64-ubuntu2204-${MONGODB_VERSION}.tgz"
  curl -fL -o /tmp/mongodb.tgz \
    "https://fastdl.mongodb.org/linux/${MONGO_TARBALL}"
  mkdir -p forum-data/mongodb
  tar -xzf /tmp/mongodb.tgz -C forum-data/mongodb --strip-components=1
  rm /tmp/mongodb.tgz
  MONGOD_BIN="$REPO_ROOT/forum-data/mongodb/bin/mongod"
  echo "Portable MongoDB ${MONGODB_VERSION} installed to forum-data/mongodb/"
fi

if ! pgrep -f "mongod.*--port ${MONGODB_PORT}" >/dev/null 2>&1; then
  log "Starting MongoDB on port ${MONGODB_PORT}"
  ( cd forum-data && "$MONGOD_BIN" --dbpath ./mongo --port "${MONGODB_PORT}" --bind_ip 127.0.0.1 \
      --logpath ./mongo-startup.log --fork )
  sleep 2
else
  echo "MongoDB already running on port ${MONGODB_PORT}"
fi

# ---------------------------------------------------------------------------
log "Starting NodeBB and running first-time setup"
# ---------------------------------------------------------------------------
if ! curl -sf -m 3 "http://localhost:${NODEBB_PORT}" >/dev/null 2>&1; then
  ADMIN_EMAIL="${NODEBB_ADMIN_EMAIL:-admin@localhost.local}"
  ADMIN_PASSWORD="${NODEBB_ADMIN_PASSWORD:-$(node -e "console.log(require('crypto').randomBytes(9).toString('base64').replace(/[+/=]/g,''))")}"
  (
    cd forum
    ./nodebb setup \
      --admin:username=admin \
      --admin:password="$ADMIN_PASSWORD" \
      --admin:password:confirm="$ADMIN_PASSWORD" \
      --admin:email="$ADMIN_EMAIL" 2>&1 | tail -30 || true
    ./nodebb start
  )
  sleep 3
  echo ""
  echo "NodeBB admin credentials (SAVE THESE — printed once):"
  echo "  username: admin"
  echo "  email:    $ADMIN_EMAIL"
  echo "  password: $ADMIN_PASSWORD"
else
  echo "NodeBB already running on port ${NODEBB_PORT} — skipping setup"
fi

# ---------------------------------------------------------------------------
log "Seeding the Divinity Data category tree"
# ---------------------------------------------------------------------------
node scripts/seed-categories.js
( cd forum && ./nodebb restart >/dev/null 2>&1 ) || true
sleep 3

# ---------------------------------------------------------------------------
log "Setting up Wiki.js ($WIKIJS_VERSION)"
# ---------------------------------------------------------------------------
if [ ! -d wiki ]; then
  mkdir -p wiki
  curl -fL -o /tmp/wiki-js.tar.gz \
    "https://github.com/requarks/wiki/releases/download/${WIKIJS_VERSION}/wiki-js.tar.gz"
  tar -xzf /tmp/wiki-js.tar.gz -C wiki
  rm /tmp/wiki-js.tar.gz
else
  echo "wiki/ already exists — skipping download"
fi

if [ ! -d wiki/node_modules ]; then
  ( cd wiki && npm install )
else
  echo "wiki/node_modules already exists — skipping install"
fi

mkdir -p wiki-data

if [ ! -f wiki/config.yml ]; then
  if [ -f wiki/config.sample.yml ]; then
    cp wiki/config.sample.yml wiki/config.yml
  fi
  # Point storage/port at this repo's layout regardless of what the sample had.
  node -e "
    const fs = require('fs');
    let c = fs.readFileSync('wiki/config.yml', 'utf8');
    c = c.replace(/^port:.*/m, 'port: ${WIKIJS_PORT}');
    c = c.replace(/^( *storage:).*/m, \"\$1 ${REPO_ROOT}/wiki-data/wiki.sqlite\");
    c = c.replace(/^bindIP:.*/m, 'bindIP: 0.0.0.0');
    fs.writeFileSync('wiki/config.yml', c);
  "
  echo "Generated wiki/config.yml (SQLite storage at wiki-data/wiki.sqlite, port ${WIKIJS_PORT})"
else
  echo "wiki/config.yml already exists — leaving it alone"
fi

if ! curl -sf -m 3 "http://localhost:${WIKIJS_PORT}" >/dev/null 2>&1; then
  log "Starting Wiki.js"
  ( cd wiki && nohup node server > "$REPO_ROOT/wiki-data/wiki-runtime.log" 2>&1 & disown )
  sleep 5
  echo ""
  warn "Wiki.js needs its own one-time setup wizard: open http://localhost:${WIKIJS_PORT}"
  warn "in a browser and create the admin account there (not automatable the same"
  warn "way NodeBB is — Wiki.js's unattended /finalize endpoint requires knowing"
  warn "internal fields that change between versions; the web wizard is the"
  warn "reliable path here). Once done, generate an API key in the admin panel"
  warn "(Administration > API Access) and set WIKIJS_API_KEY + WIKIJS_URL in"
  warn "this repo's .env.local — everything else in this project (including"
  warn "scripts/seed-bots.js's Librarian account setup) needs that key."
else
  echo "Wiki.js already running on port ${WIKIJS_PORT}"
fi

# ---------------------------------------------------------------------------
log "Seeding bot accounts"
# ---------------------------------------------------------------------------
node scripts/seed-bots.js

# ---------------------------------------------------------------------------
log "Done"
# ---------------------------------------------------------------------------
echo ""
echo "Next steps:"
echo "  1. npm run dev                          — start the Next.js site (localhost:3000)"
echo "  2. http://localhost:${NODEBB_PORT}       — NodeBB forum"
echo "  3. http://localhost:${WIKIJS_PORT}       — Wiki.js (complete its setup wizard if this"
echo "                                              is a first install, then set WIKIJS_API_KEY"
echo "                                              in .env.local and re-run this script once"
echo "                                              more to finish the Librarian wiki account)"
echo ""
echo "See SETUP.md for what this script does and doesn't cover (e.g. it does not"
echo "replay historical forum posts — bots start fresh)."
