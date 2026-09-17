#!/usr/bin/env bash
# Generates a self-signed TLS cert for the frontend dev server, so it can be
# served over HTTPS -- required for Connect Wallet to work when reached over
# anything other than http://localhost (see frontend/vite.config.ts's
# comment: the Web Crypto API needed for wallet key generation is only
# available in a "secure context", and plain HTTP only counts as one for
# localhost specifically). Needed when this dev server is reached over a
# LAN/VPN IP or hostname by a browser on a different machine.
#
# Usage: ./scripts/generate-dev-cert.sh [host]
#   host: the IP or hostname browsers will use to reach this server
#         (default: 10.10.1.121 -- change it or pass yours as an argument)
#
# The browser will still show a "not secure" / self-signed-certificate
# warning on first visit -- click through it (e.g. Chrome's "Advanced ->
# Proceed") once per browser. That one-time warning is expected and does not
# indicate anything is broken.

set -euo pipefail

HOST="${1:-10.10.1.121}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_DIR="$REPO_ROOT/frontend/.certs"

mkdir -p "$CERT_DIR"
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout "$CERT_DIR/key.pem" -out "$CERT_DIR/cert.pem" -days 365 \
  -subj "/CN=$HOST" \
  -addext "subjectAltName=IP:$HOST,DNS:localhost,IP:127.0.0.1"

echo "Generated $CERT_DIR/{cert,key}.pem for $HOST."
echo "Restart the frontend dev server (./start.sh, or 'npm run dev' in frontend/) to pick it up."
echo "Open https://$HOST:<port>/ (not http://) -- your browser will warn about the"
echo "self-signed cert once; proceed through that warning."
