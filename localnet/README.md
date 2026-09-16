# LocalNet

This project runs against Splice LocalNet, vendored from cn-quickstart's
Docker Compose module (`cn-quickstart/quickstart/docker/modules/localnet/`).
We do NOT use cn-quickstart's own sample Daml/backend/frontend app.

## Start

    git clone --depth 1 https://github.com/digital-asset/cn-quickstart.git cn-quickstart

`cn-quickstart` is intentionally **not** committed to this repo (it's a
separate upstream project vendored at setup time, listed in `.gitignore`) —
clone it fresh into `localnet/` before the first run. Then apply the two
nginx patches below to your fresh clone before starting LocalNet.

    cd cn-quickstart/quickstart
    make setup   # one-time, generates .env — does not build or start anything
    docker compose \
      -f docker/modules/localnet/compose.yaml \
      --env-file .env \
      --env-file docker/modules/localnet/compose.env \
      --env-file docker/modules/localnet/env/common.env \
      --profile app-provider --profile app-user --profile sv \
      up -d

## Stop

    docker compose -f docker/modules/localnet/compose.yaml --env-file .env down

## Key endpoints (App User)

- JSON Ledger API (raw participant port, **no CORS headers — do not use from a
  browser**): http://localhost:2975
- JSON Ledger API (nginx proxy, CORS-enabled, **this is what the frontend
  uses**): http://json-ledger-api.localhost:2000
- Validator Admin API: http://localhost:2903
- Participant Ledger API: localhost:2901

## Required patch: CORS preflight (OPTIONS) on the JSON Ledger API proxy

`@canton-network/wallet-sdk`'s `localNetStaticConfig.LOCALNET_APP_USER_LEDGER_URL`
defaults to the raw participant port `http://localhost:2975`, which sends no
`Access-Control-Allow-*` headers at all — a browser cannot call it directly
(this project's `frontend/src/sdk.ts` overrides `ledgerClientUrl` to the nginx
proxy below instead). The proxy vhost (`conf/nginx/app-user.conf`,
`json-ledger-api.localhost` / `canton.localhost` server blocks) adds CORS
headers on normal responses via `include cors-headers.conf;`, but as vendored
from upstream it does **not** handle the CORS preflight `OPTIONS` request
(unlike the sibling `swagger-ui` vhost, which already includes both).
Without this, the browser's preflight gets a 405/no-CORS-headers response and
every ledger call fails before it starts.

**Patch required before `docker compose up`** — add the same
`cors-options-headers.conf` include the swagger-ui vhost already uses, to both
the `canton.localhost` and `json-ledger-api.localhost` server blocks in
`conf/nginx/app-user.conf`:

```nginx
server {
  listen ${APP_USER_UI_PORT};
  server_name json-ledger-api.localhost;
  location / {
    proxy_pass http://canton:2${PARTICIPANT_JSON_API_PORT_SUFFIX};
    include /etc/nginx/includes/cors-headers.conf;
    include /etc/nginx/includes/cors-options-headers.conf;   # <- add this line
  }
}
```

(Same one-line addition to the `canton.localhost` block above it — it's the
deprecated alias for the same proxy.) Apply this to the freshly cloned
`cn-quickstart` checkout before the first `docker compose up -d`, on every
machine this is set up on — it's not part of upstream cn-quickstart yet.

## Required patch #2: `add_header ... always` on the CORS headers

Even with the preflight fix above, minting/transferring still failed in the
browser with a generic `CORS policy: No 'Access-Control-Allow-Origin' header`
error on the real POST to `/v2/interactive-submission/prepare` — not on the
preflight. Root cause: nginx's `add_header` directive **only applies to
2xx/3xx responses unless given the `always` parameter**; any non-2xx ledger
response (e.g. a rejected/failing command) silently drops the CORS headers,
and the browser reports a generic CORS failure instead of surfacing the real
HTTP status/body. This masked real errors (including the expected
"party is not allowlisted" compliance rejection) as CORS failures during
Task 8 verification.

**Patch required** — add `always` to every directive in
`conf/nginx/swagger-ui/cors-headers.conf` (shared by the swagger-ui,
canton.localhost, and json-ledger-api.localhost vhosts):

```nginx
add_header Access-Control-Allow-Origin * always;
add_header Access-Control-Allow-Methods 'GET, POST, OPTIONS' always;
add_header Access-Control-Allow-Headers 'Origin, Content-Type, Accept' always;
```

Restart the `nginx` container after editing this file (`docker restart
nginx` — it's a bind-mounted file, no image rebuild needed) for the change
to take effect.

## Allowlisting a newly connected wallet before minting/transferring

`scripts/bootstrap` only allowlists the admin party itself. Every
`Connect Wallet` click in the frontend allocates a brand-new external party
(a fresh keypair, hence a structurally new party id each time), which the
`IdentityRegistry` allowlist rejects by default — this is the ERC-3643-style
admin-approval compliance gate working as designed, not a bug. Before a
freshly connected wallet can receive a mint or a transfer, allowlist it from
`scripts/bootstrap`:

    cd scripts/bootstrap
    npm run allow -- <partyId>

This also prints the new `IdentityRegistryContractId` (Allow/Revoke archives
the old registry contract and creates a new one, since Daml contracts are
immutable) — update `frontend/src/pocConfig.ts`'s `identityRegistryCid` to
the printed value afterward.

## Environment notes (this sandbox)

`IMAGE_TAG` is normally exported by cn-quickstart's `Makefile` (from
`SPLICE_VERSION` in `.env`) before it invokes `docker compose`. Since we call
`docker compose` directly (bypassing `make start`, which also brings up
cn-quickstart's own sample app), `IMAGE_TAG` must be exported manually first:

    export IMAGE_TAG=$(awk -F= '/^SPLICE_VERSION=/{print $2}' .env)

If host ports 5432 (postgres) or 3000 (nginx app-provider UI) are already in
use by other services on the machine, override them before `up -d`:

    export DB_PORT=5555            # default 5432
    export APP_PROVIDER_UI_PORT=3001  # default 3000

These only change host-side port bindings; the App User JSON Ledger API stays
on port 2975 as documented above.

## Required Node.js version: 22+, not 18+

`@canton-network/wallet-sdk`'s ACS reader (`@canton-network/core-acs-reader`)
calls the native `Set.prototype.union` (an ES2024 Set method, unavailable
before V8 12.4 / Node.js 22) when merging active-contract-set pages. On
Node.js 18/20 this fails at runtime with
`TypeError: this.state.archivedACs.union is not a function` the first time
any code queries contracts (e.g. `scripts/bootstrap`, or the frontend's
holdings query in Tasks 8/9) — confirmed on Node 20.20.2, fixed by switching
to Node 22.23.2 (via `nvm install 22`, no system Node change needed). Use
Node 22+ for every `npm install`/`npm run` in this repo (`daml/` and its
`dpm`/Daml SDK toolchain are unaffected — this is a frontend/bootstrap-script,
i.e. wallet-sdk-consumer, requirement only).
