#!/usr/bin/env bash
set -euo pipefail

# Vendors the Splice token-standard v1 DARs (metadata, holding,
# transfer-instruction) that daml/daml.yaml's data-dependencies reference.
#
# These are extracted directly from a RUNNING LocalNet's `splice` container
# (/app/splice-node/dars/), not built from source. LocalNet's Canton
# participant auto-vets its own bundled copies of these packages on startup
# (they ship with the Splice validator image, pinned to LocalNet's
# SPLICE_VERSION). A separately-built copy of the *same* package name+version
# -- e.g. built from canton-network/splice's `main` branch, as an earlier
# version of this script did -- gets a *different* content hash (different
# source ref, compiler version, build timestamp), and Canton refuses to vet
# two different packages under the same (name, version): the participant
# already has LocalNet's copy vetted, so ours could never be vetted
# alongside it. That silently broke `TransferFactory_Transfer` (an interface
# choice, unlike `Issue`'s direct template choice) with a confusing
# `UNRESOLVED_PACKAGE_NAME` interpretation error that only showed up against
# a live ledger -- see the Task 9 investigation in
# .superpowers/sdd/2026-09-15-canton-token-poc/progress.md for the full
# debugging trail. Extracting LocalNet's own copies instead guarantees an
# exact package-id match, so our DAR builds against packages the participant
# already vets natively.
#
# Requires: LocalNet already running (see localnet/README.md) -- run this
# AFTER `docker compose ... up -d`, not before.

VENDOR_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/daml/vendor"
mkdir -p "$VENDOR_DIR"

if ! docker ps --format '{{.Names}}' | grep -qx splice; then
  echo "error: the 'splice' LocalNet container is not running -- start LocalNet first (see localnet/README.md)" >&2
  exit 1
fi

for pkg in splice-api-token-metadata-v1 splice-api-token-holding-v1 splice-api-token-transfer-instruction-v1; do
  echo "Extracting ${pkg}-1.0.0.dar from the running LocalNet..."
  docker cp "splice:/app/splice-node/dars/${pkg}-1.0.0.dar" "$VENDOR_DIR/"
done

echo "Vendored DARs into $VENDOR_DIR:"
ls -la "$VENDOR_DIR"
