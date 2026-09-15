# LocalNet

This project runs against Splice LocalNet, vendored from cn-quickstart's
Docker Compose module (`cn-quickstart/quickstart/docker/modules/localnet/`).
We do NOT use cn-quickstart's own sample Daml/backend/frontend app.

## Start

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

- JSON Ledger API: http://localhost:2975
- Validator Admin API: http://localhost:2903
- Participant Ledger API: localhost:2901

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
