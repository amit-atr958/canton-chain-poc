#!/usr/bin/env bash
set -euo pipefail

# Vendors the Splice token-standard v1 DARs (metadata, holding,
# transfer-instruction) that daml/daml.yaml's data-dependencies reference.
#
# There is no published release/download URL for these DARs, so they are
# built from source by cloning canton-network/splice and running `dpm build`
# in each package directory, in dependency order (metadata -> holding ->
# transfer-instruction).
#
# Note: each package's own daml.yaml declares its data-dependencies on the
# *previous* package's DAR using the filename "<pkg>-current.dar" (this is
# how the splice monorepo's sbt/daml build tooling names its outputs), but a
# plain `dpm build` run outside that tooling produces "<pkg>-<version>.dar"
# (e.g. "<pkg>-1.0.0.dar") instead. After building each dependency package we
# therefore copy its versioned DAR to the "-current.dar" name the next
# package's daml.yaml expects, purely as a local build-time shim.

SDK_VERSION="3.5.2"
SPLICE_REF="main"
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

# Ensure the SDK version declared by the token-standard packages is
# available; `dpm build` fails fast with SDK_NOT_INSTALLED otherwise.
dpm install "$SDK_VERSION"

git clone --depth 1 --branch "$SPLICE_REF" \
  https://github.com/canton-network/splice.git "$WORKDIR/splice"

TOKEN_STANDARD_DIR="$WORKDIR/splice/token-standard"
VENDOR_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/daml/vendor"
mkdir -p "$VENDOR_DIR"

for pkg in splice-api-token-metadata-v1 splice-api-token-holding-v1 splice-api-token-transfer-instruction-v1; do
  echo "Building $pkg..."
  (cd "$TOKEN_STANDARD_DIR/$pkg" && dpm build)
  DAR="$TOKEN_STANDARD_DIR/$pkg/.daml/dist/${pkg}-1.0.0.dar"
  cp "$DAR" "$VENDOR_DIR/"
  # Shim expected by the next package's data-dependencies (see note above).
  cp "$DAR" "$TOKEN_STANDARD_DIR/$pkg/.daml/dist/${pkg}-current.dar"
done

echo "Vendored DARs into $VENDOR_DIR:"
ls -la "$VENDOR_DIR"
