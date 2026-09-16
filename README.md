# Canton Token PoC

Demonstrates three capabilities on Canton Network: wallet connect, Daml
token minting, and token transfer, with an ERC-3643-style compliance
allowlist layered on Canton's native CIP-0056 token standard.

See `docs/superpowers/specs/2026-09-15-canton-token-poc-design.md` for the
design and its scope trade-offs, and
`docs/superpowers/specs/2026-09-16-no-docker-hosted-sandbox-research.md` for
why this runs against a local Splice LocalNet (Docker) rather than a hosted
Canton sandbox — no such sandbox exists today that a Node/React-only
developer can reach without running their own validator node.

## Prerequisites

- **Docker** (for Splice LocalNet)
- **`dpm`** (Daml package manager / SDK installer) — install via
  `curl -sSL https://get.digitalasset.com/install/install.sh | sh` (the
  legacy `get.daml.com` installer does not provide `dpm` and cannot fetch
  SDK 3.5.2)
- **Node.js 22+** — not 18+. `@canton-network/wallet-sdk`'s ACS reader
  (`@canton-network/core-acs-reader`) calls the native ES2024
  `Set.prototype.union`, unavailable before Node 22 (V8 12.4). Node 18/20
  fails at runtime with `TypeError: ...archivedACs.union is not a function`
  the first time any code queries contracts — confirmed on Node 20.20.2.
  If you can't upgrade your system Node, install a project-local one with
  [nvm](https://github.com/nvm-sh/nvm) (`nvm install 22 && nvm use 22`) — no
  need to touch a system Node other things on your machine depend on.

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
   open the printed local URL (typically `http://localhost:5173`).

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
   prints a new `IdentityRegistry` contract id (Daml contracts are
   immutable, so `Allow`/`Revoke` archives the old one and creates a new
   one) — you don't need to do anything with it unless step 3 below applies.
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
