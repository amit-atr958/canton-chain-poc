# Canton Token PoC

Demonstrates three capabilities on Canton Network: wallet connect, Daml
token minting, and token transfer, with an ERC-3643-style compliance
allowlist layered on Canton's native CIP-0056 token standard.

See `docs/superpowers/specs/2026-09-15-canton-token-poc-design.md` for the
design and its scope trade-offs,
`docs/superpowers/specs/2026-09-16-no-docker-hosted-sandbox-research.md` for
why this runs against a local Splice LocalNet (Docker) rather than a hosted
Canton sandbox — no such sandbox exists today that a Node/React-only
developer can reach without running their own validator node — and
[`PRODUCTION.md`](PRODUCTION.md) for what changes to take this past a PoC:
network progression (DevNet/TestNet/MainNet), contract/package deployment
and upgrades, key management, and operations.

## Quick setup

- **`./install.sh`** — one-time setup. Installs Docker (Linux, via Docker's
  official script — macOS/Windows still need Docker Desktop installed
  manually first), `dpm`, and Node 22 (via `nvm`, without touching your
  system Node) if any are missing; clones `cn-quickstart` and applies both
  required nginx patches; starts LocalNet and waits for it to come up;
  vendors the token-standard DARs; builds and tests the Daml package; and
  bootstraps LocalNet (creates the admin party and contracts). Safe to
  re-run — every step checks whether it's already done first. Stops short
  of running the frontend (the two steps it prints at the end: copy
  `poc-config.json` into `pocConfig.ts`, then start the frontend) since
  those are one-time/manual by design (see Setup step 5 and the Walkthrough
  below).
- **`./start.sh`** — every subsequent dev session. Brings up LocalNet if it
  isn't already running, then starts the frontend dev server in the
  foreground (Ctrl+C stops it; LocalNet keeps running in Docker). Requires
  `./install.sh` to have been run at least once.
- **`./stop.sh`** — stops LocalNet's Docker containers (keeps volumes, so
  the bootstrapped admin party/contracts survive; `./start.sh` picks up
  where you left off).

Read on for what `install.sh` does and why, one step at a time — useful if
it fails partway through, or if you'd rather run the steps yourself.

## Prerequisites

Verified on Ubuntu 22.04 (x86_64); `install.sh` also targets other Linux
distros via Docker's official installer, but hasn't been tested there.
macOS/Windows need Docker Desktop installed manually (`install.sh` doesn't
attempt to install Docker on those).

- **Docker** (28.1.1 verified; any reasonably recent version with Compose
  v2 — `docker compose`, not the standalone `docker-compose` — should work)
  for Splice LocalNet.
- **`dpm`** (Daml package manager / SDK installer) — install via
  `curl -sSL https://get.digitalasset.com/install/install.sh | sh` (the
  legacy `get.daml.com` installer does not provide `dpm` and cannot fetch
  SDK 3.5.2). This project pins Daml SDK 3.5.2, installed automatically by
  `dpm install` the first time you `dpm build` (see `daml/daml.yaml`).
- **Node.js 22+** — not 18+. `@canton-network/wallet-sdk`'s ACS reader
  (`@canton-network/core-acs-reader`) calls the native ES2024
  `Set.prototype.union`, unavailable before Node 22 (V8 12.4). Node 18/20
  fails at runtime with `TypeError: ...archivedACs.union is not a function`
  the first time any code queries contracts — confirmed on Node 20.20.2.
  If you can't upgrade your system Node, install a project-local one with
  [nvm](https://github.com/nvm-sh/nvm) (`nvm install 22 && nvm use 22`) — no
  need to touch a system Node other things on your machine depend on.
- **`git`, `curl`, `unzip`** — `unzip` specifically because
  `scripts/bootstrap/src/bootstrap.ts` reads the built DAR's own manifest
  with it (see that file's comments).
- **Hardware:** LocalNet runs 11 containers (participant, synchronizer,
  Splice validator, Postgres, nginx, and several web UIs). Verified running
  comfortably on 4 CPU cores / 8GB RAM / a few GB of free disk for the
  Docker images — this is a real, not-cut-down multi-service stack, not a
  lightweight mock, so treat 8GB RAM as a practical floor, not a nice-to-have,
  especially if anything else is running on the same machine.
- **Network:** everything runs locally — no outbound access needed once
  Docker images, the Daml SDK, and npm packages are downloaded (all one-time,
  during `install.sh`).

## Setup

1. **Start LocalNet** — see `localnet/README.md`. This also documents a
   required one-line nginx patch (CORS preflight handling) that upstream
   `cn-quickstart` doesn't ship yet — apply it to the freshly cloned
   checkout *before* the first `docker compose up -d`.
2. **Vendor the Splice token-standard DAR dependencies** (requires LocalNet
   already running — see below):
   `./scripts/vendor-token-standard.sh`

   This extracts `splice-api-token-{metadata,holding,transfer-instruction}-v1`
   directly from the running `splice` container's bundled DARs, rather than
   building them from source. A separately-built copy of the same package
   name+version gets a different content hash, and Canton refuses to vet two
   different packages under the same (name, version) — so a from-source copy
   can never be vetted alongside LocalNet's own, which silently breaks any
   *interface* choice exercised on it (e.g. `TransferFactory_Transfer`) with
   a confusing `UNRESOLVED_PACKAGE_NAME` ledger error, even though direct
   template choices (e.g. `Issue`) work fine. See the Task 9 investigation in
   `.superpowers/sdd/2026-09-15-canton-token-poc/progress.md` for the full
   debugging trail if you hit this after re-vendoring from a different
   source.
3. **Build and test the Daml package:** `cd daml && dpm build && dpm test`
   (all 8 Daml Script tests should pass).
4. **Bootstrap LocalNet** (uploads the DAR, allocates the admin party,
   creates the `IdentityRegistry`/`TokenIssuer`/`TokenTransferFactory`
   contracts):
   ```
   cd scripts/bootstrap
   npm install
   npm run bootstrap
   ```
5. Copy the resulting `scripts/bootstrap/output/poc-config.json` values into
   `frontend/src/pocConfig.ts` (its header comment says the same). This is a
   one-time copy, not a build step — the frontend hardcodes this config
   rather than fetching it, per the design's no-registry-service scope
   decision.
6. **Run the frontend:** `cd frontend && npm install && npm run dev`, then
   open the printed local URL (typically `http://localhost:5173`). Steps 1
   and 6 together are what `./start.sh` automates for every session after
   this first-time setup — see Quick setup above.

   If LocalNet isn't reachable at `json-ledger-api.localhost:2000` from
   wherever the browser runs (e.g. LocalNet is on a different machine,
   reached through an SSH tunnel), set `VITE_LEDGER_URL` before `npm run
   dev` to override `frontend/src/sdk.ts`'s default.

## Walkthrough

1. Click **Connect Sender Wallet** and **Connect Receiver Wallet**. Each
   allocates a brand-new external party (a fresh keypair) — the party id is
   structurally different every time you click, even for the "same" browser
   session.
2. **Allowlist both wallets before minting or transferring.**
   `scripts/bootstrap` only allowlists the admin party itself — every freshly
   connected wallet needs an explicit admin approval, which is the
   ERC-3643-style compliance gate working as designed, not a missing step:
   ```
   cd scripts/bootstrap
   npm run allow -- <senderPartyId>
   npm run allow -- <receiverPartyId>
   ```
   Copy the party id shown under "connected as" in the UI. Each `allow` run
   updates `output/poc-config.json`'s `identityRegistryCid` automatically
   (Daml contracts are immutable, so `Allow`/`Revoke` archives the old
   `IdentityRegistry` and creates a new one) — copy that value into
   `frontend/src/pocConfig.ts` unless step 3 below applies instead.
3. **If you've run `npm run allow` since the last bootstrap or since the last
   transfer setup**, `TokenTransferFactory`'s `identityRegistryCid` field
   (set once at creation, with no update choice) is now stale and any
   transfer will fail regardless of allowlist status. Recreate it:
   ```
   npm run recreate-transfer-factory
   ```
   and copy the printed `identityRegistryCid`/`transferFactoryCid` values
   into `frontend/src/pocConfig.ts`, the same way you did in Setup step 5.
4. Click **Mint to Sender** — the Sender's holdings list shows the minted
   balance.
5. Click **Transfer to poc-receiver…** — balances update on both sides
   (sender decreases by the transferred amount, receiver increases by the
   same amount).
6. To see the compliance rejection path: skip step 2 for a wallet (or
   connect a third, never-allowlisted one) and attempt a mint or transfer to
   it — the UI surfaces a readable "is the recipient/receiver allowlisted?"
   error rather than a silent failure or a raw ledger error.

### Config drifts out of sync — how to tell

`frontend/src/pocConfig.ts` is a hand-copied snapshot of ledger state, not
queried live (by design — see Scope below). It goes stale whenever:
- LocalNet is restarted with a fresh volume (`packageId`, `adminPartyId`,
  every contract id all change — re-run Setup steps 4-5 from scratch).
- Any `npm run allow` runs (`identityRegistryCid` changes — see Walkthrough
  step 3, which also then requires `npm run recreate-transfer-factory`).

A `Mint failed` / `Transfer failed` error whose message doesn't mention
"allowlisted" is usually this — check `frontend/src/pocConfig.ts` against the
current `scripts/bootstrap/output/poc-config.json` (bootstrap) or the
`identityRegistryCid`/`transferFactoryCid` last printed by `npm run allow` /
`npm run recreate-transfer-factory`.

## Scope

- No backend service — the frontend talks to LocalNet's JSON Ledger API
  directly via `@canton-network/wallet-sdk` (through LocalNet's nginx CORS
  proxy, `json-ledger-api.localhost` — see `localnet/README.md`, not the raw
  participant port, which sends no CORS headers at all).
- No CIP-0056 registry HTTP service — the single instrument/admin is
  hardcoded in `frontend/src/pocConfig.ts`.
- Only one-step (`Completed`) transfers — no pending/accept flow, no
  `Allocation`/delivery-vs-payment.
- No self-service allowlisting UI — allowlisting a new wallet is an
  admin-run script (`npm run allow`), matching the ERC-3643-style
  compliance model (an admin approves who may hold/receive the token), not a
  PoC omission.

## Known limitations / next steps

Found during the final whole-branch review (see the SDD ledger for full
detail) — none of these block the PoC's three stated capabilities, all of
which are implemented and live-verified, but they're the first things to
address before extending this past PoC scope. See [`PRODUCTION.md`](PRODUCTION.md)
for the fuller production-readiness treatment of these and other gaps
(key management, the registry service, network access, operations):

- **Compliance checks the receiver only, never the sender.**
  `Transfer.daml`'s `TransferFactory_Transfer` asserts the *receiver* is
  allowlisted but never re-checks the *sender* — an ERC-3643-style model
  (which the spec names) should gate both sides, so a revoked holder isn't
  implicitly blocked from transferring out by anything other than losing
  ACS visibility as a side effect. `IdentityRegistry_Revoke` also has no
  test. Cheap fix: one more `assertAllowlisted` call plus a revoke-then-
  transfer-fails test.
- **`TokenTransferFactory.identityRegistryCid` is a create-time snapshot
  with no update choice** — every `Allow`/`Revoke` after it exists makes it
  stale (see `npm run recreate-transfer-factory` and the Walkthrough above).
  The cleanest fix is architectural: have the frontend resolve both
  `identityRegistryCid` and `transferFactoryCid` from the ACS at connect
  time (the same lookup `allow-party.ts`/`recreate-transfer-factory.ts`
  already do) instead of hand-copying them into `pocConfig.ts` — this
  would remove the whole "config drifts out of sync" failure class. Not
  done here because it changes the frontend's data-fetching shape against
  an already live-verified flow; noted as the highest-value follow-up.
- **Holdings are queried via the concrete `TokenHolding` template
  (`holdings.ts`), not the `Holding` interface** — the design's original
  intent (`Token.daml`'s doc comment) was for any CIP-0056-aware wallet to
  recognize balances via the interface; that path is implemented in Daml
  but never actually exercised by this frontend.
- **Test coverage gap:** `IdentityRegistry_Revoke`, the exact-balance
  transfer branch (no sender change output), and the wrong-owner input
  rejection in `Transfer.daml`'s `processInputs` are not covered by any
  Daml Script test, though the code paths exist and look correct on
  inspection.
- **No client-side validation on amount inputs** (mint/transfer) — a
  non-numeric or invalid value reaches the ledger and surfaces as a
  (diagnosable, post-CORS-fix) ledger error rather than a friendly
  client-side message.
- Error messages in `MintToken.tsx`/`TransferToken.tsx` append an
  "is the recipient/receiver allowlisted?" hint to *every* failure, not
  just compliance rejections — mildly misleading for e.g. insufficient-
  balance errors. Matching on the Daml assertion text would let the UI
  distinguish them properly.
