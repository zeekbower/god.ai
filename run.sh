#!/usr/bin/env bash
# Makes sure the site, NodeBB, and Wiki.js are all up (starting whichever aren't),
# then opens the landing page in the default browser.
#
# Usage: ./run.sh
# Assumes scripts/setup.sh has already been run at least once — this script starts
# existing services, it doesn't install or configure anything from scratch.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

SITE_PORT=3000
NODEBB_PORT=4567
WIKIJS_PORT=4568
MONGODB_PORT=27117

log()  { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
warn() { printf '\033[1;33m!! %s\033[0m\n' "$1"; }
err()  { printf '\033[1;31mERROR: %s\033[0m\n' "$1" >&2; }

up() { curl -sf -m 3 "http://localhost:$1" -o /dev/null 2>&1; }

wait_until_up() {
  local port="$1" name="$2" tries="${3:-30}"
  for _ in $(seq 1 "$tries"); do
    up "$port" && { echo "$name is up (localhost:$port)."; return 0; }
    sleep 1
  done
  warn "$name didn't come up on localhost:$port within ${tries}s — check its log."
  return 1
}

# ---------------------------------------------------------------------------
log "MongoDB (NodeBB's database)"
# ---------------------------------------------------------------------------
if pgrep -f "mongod.*--port ${MONGODB_PORT}" >/dev/null 2>&1; then
  echo "MongoDB already running on port ${MONGODB_PORT}."
else
  if command -v mongod >/dev/null; then
    MONGOD_BIN="mongod"
  elif [ -x forum-data/mongodb/bin/mongod ]; then
    MONGOD_BIN="$REPO_ROOT/forum-data/mongodb/bin/mongod"
  else
    err "No mongod found (system or portable). Run ./scripts/setup.sh first."
    exit 1
  fi
  echo "Starting MongoDB..."
  mkdir -p forum-data/mongo
  ( cd forum-data && "$MONGOD_BIN" --dbpath ./mongo --port "${MONGODB_PORT}" --bind_ip 127.0.0.1 \
      --logpath ./mongo-startup.log --fork --networkMessageCompressors snappy,zstd )
  sleep 2
fi

# ---------------------------------------------------------------------------
log "NodeBB (forum)"
# ---------------------------------------------------------------------------
if up "$NODEBB_PORT"; then
  echo "NodeBB already up on localhost:${NODEBB_PORT}."
elif [ -d forum ]; then
  echo "Starting NodeBB..."
  ( cd forum && ./nodebb start )
  wait_until_up "$NODEBB_PORT" "NodeBB"
else
  err "forum/ not found. Run ./scripts/setup.sh first."
  exit 1
fi

# ---------------------------------------------------------------------------
log "Wiki.js (wiki)"
# ---------------------------------------------------------------------------
if up "$WIKIJS_PORT"; then
  echo "Wiki.js already up on localhost:${WIKIJS_PORT}."
elif [ -d wiki ]; then
  echo "Starting Wiki.js..."
  mkdir -p wiki-data
  ( cd wiki && nohup node server > "$REPO_ROOT/wiki-data/wiki-runtime.log" 2>&1 & disown )
  wait_until_up "$WIKIJS_PORT" "Wiki.js"
else
  err "wiki/ not found. Run ./scripts/setup.sh first."
  exit 1
fi

# ---------------------------------------------------------------------------
log "Web server (Next.js site)"
# ---------------------------------------------------------------------------
if up "$SITE_PORT"; then
  echo "Site already up on localhost:${SITE_PORT}."
else
  echo "Starting the dev server..."
  mkdir -p .next
  nohup npm run dev > .next/run-dev.log 2>&1 &
  disown
  wait_until_up "$SITE_PORT" "Site" 60
fi

# ---------------------------------------------------------------------------
log "Opening the landing page"
# ---------------------------------------------------------------------------
URL="http://localhost:${SITE_PORT}"
if command -v xdg-open >/dev/null; then
  xdg-open "$URL" >/dev/null 2>&1 &
elif command -v open >/dev/null; then
  open "$URL"
elif command -v wslview >/dev/null; then
  wslview "$URL"
elif command -v cmd.exe >/dev/null; then
  cmd.exe /c start "$URL" >/dev/null 2>&1
else
  warn "Couldn't detect a way to open a browser automatically. Open this yourself:"
  echo "  $URL"
  exit 0
fi

echo "Opened $URL"
