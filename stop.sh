#!/usr/bin/env bash
# Stops LocalNet's Docker containers (the counterpart to start.sh). Does not
# remove volumes -- bootstrapped state (admin party, contracts) survives a
# stop/start cycle. Use `docker compose ... down -v` in
# localnet/cn-quickstart/quickstart if you want a truly fresh LocalNet
# (you'll need to re-run ./install.sh's bootstrap step afterward).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QUICKSTART_DIR="$REPO_ROOT/localnet/cn-quickstart/quickstart"

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$1"; }
die() { printf '\033[1;31merror:\033[0m %s\n' "$1" >&2; exit 1; }

[ -d "$QUICKSTART_DIR" ] || die "localnet/cn-quickstart not found -- nothing to stop."
cd "$QUICKSTART_DIR"
[ -f .env ] || die ".env not found -- nothing to stop."

log "Stopping LocalNet"
docker compose -f docker/modules/localnet/compose.yaml --env-file .env down
