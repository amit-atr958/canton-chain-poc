#!/usr/bin/env bash
# One-shot setup for the Canton Token PoC: Docker, dpm (Daml SDK), Node 22,
# LocalNet (with its two required nginx patches), the Daml package, and the
# bootstrap admin party/contracts. Safe to re-run — every step checks
# whether it's already done before doing it.
#
# What this does NOT do: run the frontend dev server (last manual step,
# see the end of this script's output and README.md's Walkthrough), or
# allowlist any wallet you connect from the UI (npm run allow, also a
# manual per-wallet step — see README.md).
#
# See README.md and localnet/README.md for why each of these steps exists
# and is in this specific order; this script just automates them.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33mwarning:\033[0m %s\n' "$1" >&2; }
die() { printf '\033[1;31merror:\033[0m %s\n' "$1" >&2; exit 1; }

# ---------------------------------------------------------------------------
log "Checking prerequisites"
# ---------------------------------------------------------------------------

command -v git >/dev/null || die "git is required and not on PATH."
command -v curl >/dev/null || die "curl is required and not on PATH."
command -v unzip >/dev/null || die "unzip is required and not on PATH (scripts/bootstrap/src/bootstrap.ts reads the built DAR's manifest with it)."

if ! command -v docker >/dev/null; then
    case "$(uname -s)" in
        Linux)
            log "Docker not found — installing via Docker's official convenience script (requires sudo)"
            curl -fsSL https://get.docker.com | sh
            warn "You may need to log out/in (or run 'newgrp docker') for your user to use docker without sudo."
            ;;
        *)
            die "Docker not found. Install Docker Desktop for your OS (https://docs.docker.com/get-docker/) and re-run this script."
            ;;
    esac
else
    log "Docker already installed ($(docker --version))"
fi

docker info >/dev/null 2>&1 || die "Docker is installed but not usable (daemon not running, or permission denied — try 'sudo usermod -aG docker \$USER' and re-login)."

if ! command -v dpm >/dev/null; then
    log "dpm (Daml package manager) not found — installing"
    curl -sSL https://get.digitalasset.com/install/install.sh | sh
    export PATH="$HOME/.dpm/bin:$PATH"
    if ! grep -q '.dpm/bin' "$HOME/.bashrc" 2>/dev/null; then
        echo 'export PATH="$HOME/.dpm/bin:$PATH"' >> "$HOME/.bashrc"
    fi
else
    log "dpm already installed ($(dpm --version 2>&1 | tr '\n' ' '))"
fi

NODE_OK=false
if command -v node >/dev/null; then
    NODE_MAJOR="$(node -e 'console.log(process.versions.node.split(".")[0])')"
    if [ "$NODE_MAJOR" -ge 22 ]; then
        NODE_OK=true
        log "Node.js already >=22 ($(node --version))"
    fi
fi
if [ "$NODE_OK" = false ]; then
    # @canton-network/wallet-sdk needs the native Set.prototype.union (Node 22+,
    # see README.md) -- installed via nvm in user space, never touching a
    # system Node other things on this machine might depend on.
    log "Node.js >=22 not found — installing Node 22 via nvm (user-space, won't touch system Node)"
    export NVM_DIR="$HOME/.nvm"
    if [ ! -s "$NVM_DIR/nvm.sh" ]; then
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    fi
    # shellcheck disable=SC1091
    . "$NVM_DIR/nvm.sh"
    nvm install 22
    nvm use 22
fi
# Every later `npm`/`node` invocation in this script must see the same Node
# 22 nvm just installed/selected, even in a shell that hadn't sourced nvm.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck disable=SC1091
    . "$NVM_DIR/nvm.sh"
    nvm use 22 >/dev/null 2>&1 || true
fi

# ---------------------------------------------------------------------------
log "Cloning cn-quickstart (Splice LocalNet Docker Compose bundle)"
# ---------------------------------------------------------------------------

CN_QUICKSTART_DIR="$REPO_ROOT/localnet/cn-quickstart"
if [ ! -d "$CN_QUICKSTART_DIR" ]; then
    git clone --depth 1 https://github.com/digital-asset/cn-quickstart.git "$CN_QUICKSTART_DIR"
else
    log "localnet/cn-quickstart already present — skipping clone"
fi

QUICKSTART_DIR="$CN_QUICKSTART_DIR/quickstart"
APP_USER_CONF="$QUICKSTART_DIR/docker/modules/localnet/conf/nginx/app-user.conf"
CORS_HEADERS_CONF="$QUICKSTART_DIR/docker/modules/localnet/conf/nginx/swagger-ui/cors-headers.conf"

# ---------------------------------------------------------------------------
log "Applying required nginx patches (see localnet/README.md for why)"
# ---------------------------------------------------------------------------

if grep -q 'cors-options-headers.conf' "$APP_USER_CONF"; then
    log "Patch 1 (CORS preflight) already applied — skipping"
else
    log "Patch 1: adding OPTIONS-preflight handling to the json-ledger-api.localhost / canton.localhost vhosts"
    awk '
        { print }
        /include \/etc\/nginx\/includes\/cors-headers\.conf;/ {
            match($0, /^[ \t]*/)
            indent = substr($0, 1, RLENGTH)
            print indent "include /etc/nginx/includes/cors-options-headers.conf;"
        }
    ' "$APP_USER_CONF" > "$APP_USER_CONF.tmp"
    mv "$APP_USER_CONF.tmp" "$APP_USER_CONF"
fi

if grep -q ' always;' "$CORS_HEADERS_CONF"; then
    log "Patch 2 (always on CORS headers) already applied — skipping"
else
    log "Patch 2: adding 'always' to every CORS add_header directive (so error responses keep their CORS headers)"
    sed -i -E 's/^(add_header [^;]+);$/\1 always;/' "$CORS_HEADERS_CONF"
fi

# ---------------------------------------------------------------------------
log "Starting LocalNet"
# ---------------------------------------------------------------------------

cd "$QUICKSTART_DIR"

if [ ! -f .env ]; then
    log "Running 'make setup' (accepting defaults non-interactively)"
    make setup < /dev/null
else
    log ".env already exists — skipping 'make setup'"
fi

export IMAGE_TAG
IMAGE_TAG="$(awk -F= '/^SPLICE_VERSION=/{print $2}' .env)"
[ -n "$IMAGE_TAG" ] || die "Could not read SPLICE_VERSION from $QUICKSTART_DIR/.env"

if [ -n "$(docker ps --filter name='^canton$' --filter status=running -q)" ]; then
    log "LocalNet already running — skipping 'docker compose up'"
else
    docker compose \
        -f docker/modules/localnet/compose.yaml \
        --env-file .env \
        --env-file docker/modules/localnet/compose.env \
        --env-file docker/modules/localnet/env/common.env \
        --profile app-provider --profile app-user --profile sv \
        up -d
fi

log "Waiting for the JSON Ledger API to come up (this can take a couple of minutes on first start)"
for i in $(seq 1 60); do
    CODE="$(curl -s -o /dev/null -w '%{http_code}' http://localhost:2975/v2/version || echo 000)"
    [ "$CODE" != "000" ] && break
    sleep 5
done
[ "$CODE" != "000" ] || die "LocalNet's JSON Ledger API never came up at http://localhost:2975 — check 'docker ps' / 'docker logs canton'."
log "JSON Ledger API responding (HTTP $CODE)"

cd "$REPO_ROOT"

# ---------------------------------------------------------------------------
log "Vendoring the Splice token-standard DAR dependencies"
# ---------------------------------------------------------------------------

./scripts/vendor-token-standard.sh

# ---------------------------------------------------------------------------
log "Building and testing the Daml package"
# ---------------------------------------------------------------------------

export PATH="$HOME/.dpm/bin:$PATH"
(cd daml && dpm build && dpm test)

# ---------------------------------------------------------------------------
log "Bootstrapping LocalNet (uploads the DAR, allocates the admin party, creates IdentityRegistry/TokenIssuer/TokenTransferFactory)"
# ---------------------------------------------------------------------------

(cd scripts/bootstrap && npm install && npm run bootstrap)

# ---------------------------------------------------------------------------
log "Done"
# ---------------------------------------------------------------------------

cat <<'EOF'

LocalNet is running and bootstrapped. Two manual steps remain (see
README.md's Setup step 5 and Walkthrough for why these aren't automated):

  1. Copy scripts/bootstrap/output/poc-config.json's values into
     frontend/src/pocConfig.ts.
  2. cd frontend && npm install && npm run dev
     then open the printed local URL, connect a wallet, allowlist it with
     'npm run allow -- <partyId>' (in scripts/bootstrap), and mint/transfer.
EOF
