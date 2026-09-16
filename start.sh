#!/usr/bin/env bash
# Starts everything needed for a dev session, from one place: brings up
# LocalNet if it isn't already running, then runs the frontend dev server
# in the foreground (Ctrl+C stops the frontend; LocalNet keeps running in
# Docker in the background — use ./stop.sh to bring it down).
#
# Assumes ./install.sh has already been run at least once (LocalNet cloned
# and patched, Daml package built, admin party/contracts bootstrapped, and
# scripts/bootstrap/output/poc-config.json's values copied into
# frontend/src/pocConfig.ts). This script does NOT bootstrap or vendor
# anything -- it only starts what install.sh already set up.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$1"; }
die() { printf '\033[1;31merror:\033[0m %s\n' "$1" >&2; exit 1; }

QUICKSTART_DIR="$REPO_ROOT/localnet/cn-quickstart/quickstart"
[ -d "$QUICKSTART_DIR" ] || die "localnet/cn-quickstart not found -- run ./install.sh first."
[ -f "$REPO_ROOT/scripts/bootstrap/output/poc-config.json" ] || die "Not bootstrapped yet -- run ./install.sh first."

# ---------------------------------------------------------------------------
log "Selecting Node.js 22+ (wallet-sdk requires it -- see README.md)"
# ---------------------------------------------------------------------------

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck disable=SC1091
    . "$NVM_DIR/nvm.sh"
    nvm use 22 >/dev/null 2>&1 || nvm install 22
fi
command -v node >/dev/null || die "Node.js not found. Run ./install.sh first."
NODE_MAJOR="$(node -e 'console.log(process.versions.node.split(".")[0])')"
[ "$NODE_MAJOR" -ge 22 ] || die "Node.js $(node --version) found, but 22+ is required. Run ./install.sh first."

# ---------------------------------------------------------------------------
log "Starting LocalNet"
# ---------------------------------------------------------------------------

cd "$QUICKSTART_DIR"
[ -f .env ] || die ".env not found in $QUICKSTART_DIR -- run ../../../install.sh first."

export IMAGE_TAG
IMAGE_TAG="$(awk -F= '/^SPLICE_VERSION=/{print $2}' .env)"
[ -n "$IMAGE_TAG" ] || die "Could not read SPLICE_VERSION from $QUICKSTART_DIR/.env"

if [ -n "$(docker ps --filter name='^canton$' --filter status=running -q)" ]; then
    log "LocalNet already running"
else
    docker compose \
        -f docker/modules/localnet/compose.yaml \
        --env-file .env \
        --env-file docker/modules/localnet/compose.env \
        --env-file docker/modules/localnet/env/common.env \
        --profile app-provider --profile app-user --profile sv \
        up -d
    log "Waiting for the JSON Ledger API to come up"
    for i in $(seq 1 60); do
        CODE="$(curl -s -o /dev/null -w '%{http_code}' http://localhost:2975/v2/version || echo 000)"
        [ "$CODE" != "000" ] && break
        sleep 5
    done
    [ "$CODE" != "000" ] || die "LocalNet's JSON Ledger API never came up at http://localhost:2975 — check 'docker ps' / 'docker logs canton'."
    log "JSON Ledger API responding (HTTP $CODE)"
fi

cd "$REPO_ROOT/frontend"

# ---------------------------------------------------------------------------
log "Starting the frontend dev server"
# ---------------------------------------------------------------------------

[ -d node_modules ] || npm install

cat <<'EOF'

Once the dev server prints its local URL: connect a wallet, then allowlist
it before minting/transferring:

    cd scripts/bootstrap && npm run allow -- <partyId>

See README.md's Walkthrough for the full sequence. Ctrl+C stops the
frontend; LocalNet keeps running in Docker (./stop.sh brings it down).

EOF

exec npm run dev
