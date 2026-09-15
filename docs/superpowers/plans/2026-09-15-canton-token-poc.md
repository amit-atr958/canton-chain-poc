# Canton Token PoC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a PoC demonstrating wallet connect, Daml token minting, and token transfer on Canton Network, with an ERC-3643-style compliance allowlist layered on Canton's native CIP-0056 token standard.

**Architecture:** A Daml package implements the `Holding` and `TransferFactory` interfaces from Canton's Splice token-standard, gated by a custom `IdentityRegistry` allowlist template. A React/TypeScript frontend uses `@canton-network/wallet-sdk` directly in-browser (no backend) against a standalone Splice LocalNet instance to connect wallets, mint, and transfer.

**Tech Stack:** Daml 3.5.2 (LF target 2.1), `@canton-network/wallet-sdk`, React + TypeScript + Vite, Splice LocalNet (Docker Compose), Node.js 18+.

**Spec:** `docs/superpowers/specs/2026-09-15-canton-token-poc-design.md`

## Global Constraints

- Daml SDK version: `3.5.2`, `build-options: [--target=2.1]` (matches the Splice token-standard packages this project depends on — a mismatched LF target will fail to link).
- No backend service — all ledger interaction happens via `@canton-network/wallet-sdk` directly from the frontend or from Node bootstrap scripts. Never introduce an Express/Spring server.
- No CIP-0056 registry HTTP service — the single instrument admin party and instrument id are hardcoded in a shared frontend config module, not discovered via a registry API.
- `Allocation`/`AllocationFactory` (delivery-vs-payment) interfaces are out of scope. Only `Holding` and `TransferFactory` are implemented.
- Every transfer is one-step: `TransferFactory_Transfer` always returns `TransferInstructionResult_Completed`, never `Pending`. Do not implement the `TransferInstruction` interface — it is only needed for the pending/accept path, which this PoC doesn't use.
- Daml contracts on Canton (LF 2.x) do not support contract keys — do not use `key`/`maintainer` in any template. Look up the current `IdentityRegistry` contract by querying active contracts, not by key.

---

## Reference Material

These real, verified sources back every Daml interface signature and SDK call used below (fabricating any of this would make the plan uncompilable/unusable — do not deviate from these signatures without re-checking the source):

- `Holding` interface: `Splice.Api.Token.HoldingV1` (package `splice-api-token-holding-v1`) — `InstrumentId{admin, id}`, `Lock`, `HoldingView{owner, instrumentId, amount, lock, meta}`.
- `TransferFactory`/`Transfer`/`TransferInstructionResult`: `Splice.Api.Token.TransferInstructionV1` (package `splice-api-token-transfer-instruction-v1`).
- `Metadata`/`ExtraArgs`/`ChoiceContext`/`emptyMetadata`: `Splice.Api.Token.MetadataV1` (package `splice-api-token-metadata-v1`).
- Source repo for the above: `https://github.com/canton-network/splice`, directory `token-standard/`.
- Working reference implementation of `Holding`/`TransferFactory` for a custom token: `https://github.com/ChainSafe/canton-erc20`, package `cip56-token` (`CIP56.Token`, `CIP56.TransferFactory`).
- Wallet SDK usage (key gen, party creation, DAR upload, generic `CreateCommand`/`ExerciseCommand`, ACS queries): `https://github.com/canton-network/wallet`, `docs/wallet-integration-guide/examples/`.
- Splice LocalNet (Docker Compose bundle, ports, `make setup`): `https://github.com/digital-asset/cn-quickstart`, directory `quickstart/`.

---

### Task 1: Repo scaffolding and standalone LocalNet

**Files:**
- Create: `daml/daml.yaml`
- Create: `daml/.gitignore`
- Create: `localnet/README.md`
- Create: `.gitignore` (repo root)

**Interfaces:**
- Produces: a running Splice LocalNet reachable at `http://localhost:2975` (App User JSON Ledger API) that later tasks upload DARs to and connect wallets against.

- [ ] **Step 1: Create the Daml project skeleton**

Create `daml/daml.yaml`:

```yaml
sdk-version: 3.5.2
name: canton-token-poc
version: 1.0.0
source: src
dependencies:
  - daml-prim
  - daml-stdlib
  - daml-script
data-dependencies:
  - vendor/splice-api-token-metadata-v1-1.0.0.dar
  - vendor/splice-api-token-holding-v1-1.0.0.dar
  - vendor/splice-api-token-transfer-instruction-v1-1.0.0.dar
build-options:
  - --target=2.1
```

Create `daml/src/.gitkeep` (empty file) so the `src` directory exists for Task 3.

- [ ] **Step 2: Add root `.gitignore`**

Create `.gitignore`:

```
node_modules/
.daml/
*.dar
dist/
.env
frontend/dist/
```

- [ ] **Step 3: Clone cn-quickstart to obtain the LocalNet Docker Compose bundle**

Run: `git clone --depth 1 https://github.com/digital-asset/cn-quickstart.git localnet/cn-quickstart`

This vendors the LocalNet Docker Compose module without adopting cn-quickstart's own sample app (Daml/backend/frontend), which we don't use.

- [ ] **Step 4: Generate the LocalNet `.env` without building the sample app**

Run: `cd localnet/cn-quickstart/quickstart && make setup`

This only prompts for a deployment profile and writes `.env`/`.env.local` — it does not build or start anything (only `make build`/`make start` do, and this plan never runs those cn-quickstart targets).

- [ ] **Step 5: Start LocalNet only, bypassing cn-quickstart's own app stack**

`make start` in cn-quickstart always brings up its own sample app (frontend/backend containers) alongside LocalNet, which we don't want. Start only the LocalNet compose file directly:

```bash
cd localnet/cn-quickstart/quickstart
docker compose \
  -f docker/modules/localnet/compose.yaml \
  --env-file .env \
  --env-file docker/modules/localnet/compose.env \
  --env-file docker/modules/localnet/env/common.env \
  --profile app-provider --profile app-user --profile sv \
  up -d
```

- [ ] **Step 6: Verify LocalNet is reachable**

Run: `curl -s -o /dev/null -w '%{http_code}' http://localhost:2975/v2/version`

Expected: `200` (or `401`/`403` if auth is enforced on this endpoint — either indicates the JSON Ledger API is up; a connection error means LocalNet isn't running).

- [ ] **Step 7: Document this in `localnet/README.md`**

```markdown
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
```

- [ ] **Step 8: Commit**

```bash
git add daml/daml.yaml daml/src/.gitkeep .gitignore localnet/README.md
git commit -m "Scaffold Daml project and standalone LocalNet setup"
```

(Note: `localnet/cn-quickstart` is a separately-cloned git repo — do not `git add` it; it stays untracked/local, matching how it's excluded implicitly since it has its own `.git`.)

---

### Task 2: Vendor the Splice token-standard DAR dependencies

**Files:**
- Create: `daml/vendor/splice-api-token-metadata-v1-1.0.0.dar` (built artifact)
- Create: `daml/vendor/splice-api-token-holding-v1-1.0.0.dar` (built artifact)
- Create: `daml/vendor/splice-api-token-transfer-instruction-v1-1.0.0.dar` (built artifact)
- Create: `scripts/vendor-token-standard.sh`

**Interfaces:**
- Produces: three `.dar` files at `daml/vendor/*.dar` that Task 1's `daml.yaml` `data-dependencies` reference by exact filename.

There's no documented public release/download URL for these DARs (verified: no GitHub Releases exist on `canton-network/splice`, and the `ChainSafe/canton-erc20` reference project checks the binaries into git without documenting their source). They must be built from source. Each of the three packages has its own standalone `daml.yaml` and must be built in dependency order: metadata → holding → transfer-instruction.

- [ ] **Step 1: Write the vendoring script**

Create `scripts/vendor-token-standard.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

SPLICE_REF="main"
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

git clone --depth 1 --branch "$SPLICE_REF" \
  https://github.com/canton-network/splice.git "$WORKDIR/splice"

TOKEN_STANDARD_DIR="$WORKDIR/splice/token-standard"
VENDOR_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/daml/vendor"
mkdir -p "$VENDOR_DIR"

for pkg in splice-api-token-metadata-v1 splice-api-token-holding-v1 splice-api-token-transfer-instruction-v1; do
  echo "Building $pkg..."
  (cd "$TOKEN_STANDARD_DIR/$pkg" && dpm build)
  cp "$TOKEN_STANDARD_DIR/$pkg/.daml/dist/${pkg}-1.0.0.dar" "$VENDOR_DIR/"
done

echo "Vendored DARs into $VENDOR_DIR:"
ls -la "$VENDOR_DIR"
```

- [ ] **Step 2: Make it executable and run it**

Run: `chmod +x scripts/vendor-token-standard.sh && ./scripts/vendor-token-standard.sh`

Expected: the script clones `canton-network/splice`, builds each of the three packages with `dpm build` in order (each package's own `daml.yaml` declares `data-dependencies` on the prior packages' built `.dar`, so building out of order will fail with a missing-file error), and copies the three resulting `.dar` files into `daml/vendor/`.

- [ ] **Step 3: Verify the DARs exist**

Run: `ls daml/vendor/*.dar`

Expected: exactly three files — `splice-api-token-metadata-v1-1.0.0.dar`, `splice-api-token-holding-v1-1.0.0.dar`, `splice-api-token-transfer-instruction-v1-1.0.0.dar`.

- [ ] **Step 4: Commit**

The `.dar` binaries are an external dependency, not a build artifact of this repo, so they should be checked in (same rationale the `ChainSafe/canton-erc20` reference project used) despite the root `.gitignore`'s `*.dar` rule:

```bash
git add -f daml/vendor/*.dar scripts/vendor-token-standard.sh
git commit -m "Vendor Splice token-standard DAR dependencies"
```

---

### Task 3: Compliance module — IdentityRegistry allowlist

**Files:**
- Create: `daml/src/Compliance.daml`
- Test: `daml/src/ComplianceTest.daml`

**Interfaces:**
- Produces: `template IdentityRegistry with admin: Party, allowlist: [Party]`, choices `IdentityRegistry_Allow : ContractId IdentityRegistry with party: Party` and `IdentityRegistry_Revoke : ContractId IdentityRegistry with party: Party` (both `controller admin`), and a helper function `assertAllowlisted : ContractId IdentityRegistry -> Party -> Party -> Update ()` (registry contract id, expected admin, party to check) — this is consumed by Task 4 and Task 5.
- Consumes: nothing (no dependency on other project modules).

- [ ] **Step 1: Write the failing test**

Create `daml/src/ComplianceTest.daml`:

```daml
module ComplianceTest where

import Daml.Script
import Compliance

test_allow_and_check : Script ()
test_allow_and_check = do
  admin <- allocateParty "admin"
  alice <- allocateParty "alice"
  bob <- allocateParty "bob"

  registryCid <- submit admin do
    createCmd IdentityRegistry with admin, allowlist = [alice]

  -- alice is allowlisted, bob is not
  _ <- submit admin do
    exerciseCmd registryCid (IdentityRegistry_Allow with party = bob)

  pure ()

test_reject_duplicate_allow : Script ()
test_reject_duplicate_allow = do
  admin <- allocateParty "admin"
  alice <- allocateParty "alice"

  registryCid <- submit admin do
    createCmd IdentityRegistry with admin, allowlist = [alice]

  submitMustFail admin do
    exerciseCmd registryCid (IdentityRegistry_Allow with party = alice)
```

- [ ] **Step 2: Run the test to verify it fails (Compliance module doesn't exist yet)**

Run: `cd daml && dpm build`

Expected: FAIL with a "module Compliance not found" or "Compliance.daml does not exist" style error.

- [ ] **Step 3: Write the implementation**

Create `daml/src/Compliance.daml`:

```daml
module Compliance where

-- | Registry of parties permitted to hold or receive this token.
-- ERC-3643-style permissioning layered on top of Canton's CIP-0056 token
-- standard, which has no built-in identity/allowlist concept.
--
-- Daml/Canton contracts are immutable (archive + create, not mutate), so
-- every Allow/Revoke produces a NEW contract id for the registry. Callers
-- must look up the current active IdentityRegistry contract before each
-- use rather than caching a contract id.
template IdentityRegistry
  with
    admin     : Party
    allowlist : [Party]
  where
    signatory admin
    observer allowlist

    choice IdentityRegistry_Allow : ContractId IdentityRegistry
      with
        party : Party
      controller admin
      do
        assertMsg "party already allowlisted" (notElem party allowlist)
        create this with allowlist = party :: allowlist

    choice IdentityRegistry_Revoke : ContractId IdentityRegistry
      with
        party : Party
      controller admin
      do
        assertMsg "party not on allowlist" (party `elem` allowlist)
        create this with allowlist = filter (/= party) allowlist

-- | Fetches the registry and asserts the given party is allowlisted.
-- Used by Token.Issue and Transfer.TransferFactory_Transfer to gate
-- who may receive holdings.
assertAllowlisted : ContractId IdentityRegistry -> Party -> Party -> Update ()
assertAllowlisted registryCid expectedAdmin party = do
  registry <- fetch registryCid
  assertMsg "identity registry admin mismatch" (registry.admin == expectedAdmin)
  assertMsg
    ("party is not allowlisted by the identity registry")
    (party `elem` registry.allowlist)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd daml && dpm build && dpm test`

Expected: PASS — both `test_allow_and_check` and `test_reject_duplicate_allow` succeed (the latter's `submitMustFail` confirms the duplicate-allow assertion fires).

- [ ] **Step 5: Commit**

```bash
git add daml/src/Compliance.daml daml/src/ComplianceTest.daml
git commit -m "Add IdentityRegistry compliance allowlist"
```

---

### Task 4: Token module — Holding interface and Issue (mint)

**Files:**
- Create: `daml/src/Token.daml`
- Test: `daml/src/TokenTest.daml`

**Interfaces:**
- Consumes: `Compliance.IdentityRegistry`, `Compliance.assertAllowlisted` (Task 3, exact signature above).
- Produces: `template TokenHolding with issuer: Party, owner: Party, amount: Decimal, instrumentId: InstrumentId, lock: Optional Lock, meta: Metadata` implementing the Splice `Holding` interface; `template TokenIssuer with issuer: Party, instrumentId: InstrumentId` with choice `Issue : ContractId TokenHolding with to: Party, amount: Decimal, identityRegistryCid: ContractId IdentityRegistry` (`controller issuer`) — consumed by Task 6 (bootstrap) and the frontend's Mint view (Task 8).

- [ ] **Step 1: Write the failing test**

Create `daml/src/TokenTest.daml`:

```daml
module TokenTest where

import Daml.Script
import Splice.Api.Token.HoldingV1 (InstrumentId(..))
import Compliance
import Token

test_mint_to_allowlisted_party : Script ()
test_mint_to_allowlisted_party = do
  issuer <- allocateParty "issuer"
  alice <- allocateParty "alice"

  registryCid <- submit issuer do
    createCmd IdentityRegistry with admin = issuer, allowlist = [alice]

  issuerCid <- submit issuer do
    createCmd TokenIssuer with
      issuer
      instrumentId = InstrumentId with admin = issuer, id = "POC"

  holdingCid <- submit issuer do
    exerciseCmd issuerCid (Issue with to = alice, amount = 100.0, identityRegistryCid = registryCid)

  Some holding <- queryContractId issuer holdingCid
  assertMsg "owner is alice" (holding.owner == alice)
  assertMsg "amount is 100" (holding.amount == 100.0)

test_mint_to_non_allowlisted_party_fails : Script ()
test_mint_to_non_allowlisted_party_fails = do
  issuer <- allocateParty "issuer"
  alice <- allocateParty "alice"
  eve <- allocateParty "eve"

  registryCid <- submit issuer do
    createCmd IdentityRegistry with admin = issuer, allowlist = [alice]

  issuerCid <- submit issuer do
    createCmd TokenIssuer with
      issuer
      instrumentId = InstrumentId with admin = issuer, id = "POC"

  submitMustFail issuer do
    exerciseCmd issuerCid (Issue with to = eve, amount = 100.0, identityRegistryCid = registryCid)
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd daml && dpm build`

Expected: FAIL — "module Token not found".

- [ ] **Step 3: Write the implementation**

Create `daml/src/Token.daml`:

```daml
module Token where

import Splice.Api.Token.MetadataV1 (emptyMetadata)
import Splice.Api.Token.HoldingV1 (Holding(..), HoldingView(..), InstrumentId, Lock)

import Compliance (IdentityRegistry, assertAllowlisted)

-- | A single owned position of the PoC token. Implements the Splice
-- Holding interface so any CIP-0056-aware wallet recognizes it.
template TokenHolding
  with
    issuer       : Party
    owner        : Party
    amount       : Decimal
    instrumentId : InstrumentId
    lock         : Optional Lock
    meta         : Splice.Api.Token.MetadataV1.Metadata
  where
    signatory issuer
    observer owner

    interface instance Holding for TokenHolding where
      view = HoldingView with owner, instrumentId, amount, lock, meta

-- | Issuer-controlled minting authority for one instrument.
template TokenIssuer
  with
    issuer       : Party
    instrumentId : InstrumentId
  where
    signatory issuer

    nonconsuming choice Issue : ContractId TokenHolding
      with
        to                  : Party
        amount              : Decimal
        identityRegistryCid : ContractId IdentityRegistry
      controller issuer
      do
        assertMsg "amount must be positive" (amount > 0.0)
        assertAllowlisted identityRegistryCid issuer to
        create TokenHolding with
          issuer
          owner = to
          amount
          instrumentId
          lock = None
          meta = emptyMetadata
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd daml && dpm build && dpm test`

Expected: PASS for both `test_mint_to_allowlisted_party` and `test_mint_to_non_allowlisted_party_fails`.

- [ ] **Step 5: Commit**

```bash
git add daml/src/Token.daml daml/src/TokenTest.daml
git commit -m "Add TokenHolding (Splice Holding interface) and Issue/mint"
```

---

### Task 5: Transfer module — TransferFactory (one-step transfer)

**Files:**
- Create: `daml/src/Transfer.daml`
- Test: `daml/src/TransferTest.daml`

**Interfaces:**
- Consumes: `Compliance.IdentityRegistry`, `Compliance.assertAllowlisted` (Task 3); `Token.TokenHolding` (Task 4, exact field names: `issuer, owner, amount, instrumentId, lock, meta`).
- Produces: `template TokenTransferFactory with admin: Party, identityRegistryCid: ContractId IdentityRegistry` implementing the Splice `TransferFactory` interface — consumed by Task 6 (bootstrap) and the frontend's Transfer view (Task 9).

- [ ] **Step 1: Write the failing test**

Create `daml/src/TransferTest.daml`:

```daml
module TransferTest where

import DA.Time (seconds, hours)
import Daml.Script
import Splice.Api.Token.HoldingV1 (InstrumentId(..), Holding)
import Splice.Api.Token.MetadataV1 (ChoiceContext(..), ExtraArgs(..), emptyMetadata)
import Splice.Api.Token.TransferInstructionV1
import Compliance
import Token
import Transfer

setup : Script (Party, Party, Party, ContractId IdentityRegistry, ContractId TokenIssuer, ContractId TokenTransferFactory)
setup = do
  issuer <- allocateParty "issuer"
  alice <- allocateParty "alice"
  bob <- allocateParty "bob"

  registryCid <- submit issuer do
    createCmd IdentityRegistry with admin = issuer, allowlist = [alice, bob]

  issuerCid <- submit issuer do
    createCmd TokenIssuer with
      issuer
      instrumentId = InstrumentId with admin = issuer, id = "POC"

  factoryCid <- submit issuer do
    createCmd TokenTransferFactory with admin = issuer, identityRegistryCid = registryCid

  pure (issuer, alice, bob, registryCid, issuerCid, factoryCid)

test_transfer_between_allowlisted_parties : Script ()
test_transfer_between_allowlisted_parties = do
  (issuer, alice, bob, _registryCid, issuerCid, factoryCid) <- setup

  holdingCid <- submit issuer do
    exerciseCmd issuerCid (Issue with to = alice, amount = 100.0, identityRegistryCid = _registryCid)

  now <- getTime
  result <- submit alice do
    exerciseCmd (toInterfaceContractId @TransferFactory factoryCid) TransferFactory_Transfer with
      expectedAdmin = issuer
      transfer = Transfer with
        sender = alice
        receiver = bob
        amount = 40.0
        instrumentId = InstrumentId with admin = issuer, id = "POC"
        requestedAt = subTime now (seconds 1)
        executeBefore = addTime now (hours 1)
        inputHoldingCids = [toInterfaceContractId @Holding holdingCid]
        meta = emptyMetadata
      extraArgs = ExtraArgs with context = ChoiceContext with values = mempty; meta = emptyMetadata

  case result.output of
    TransferInstructionResult_Completed{receiverHoldingCids} ->
      assertMsg "one receiver holding" (length receiverHoldingCids == 1)
    _ -> abort "expected Completed"

  assertMsg "one sender change holding" (length result.senderChangeCids == 1)

test_transfer_to_non_allowlisted_party_fails : Script ()
test_transfer_to_non_allowlisted_party_fails = do
  issuer <- allocateParty "issuer"
  alice <- allocateParty "alice"
  eve <- allocateParty "eve"

  registryCid <- submit issuer do
    createCmd IdentityRegistry with admin = issuer, allowlist = [alice]

  issuerCid <- submit issuer do
    createCmd TokenIssuer with
      issuer
      instrumentId = InstrumentId with admin = issuer, id = "POC"

  factoryCid <- submit issuer do
    createCmd TokenTransferFactory with admin = issuer, identityRegistryCid = registryCid

  holdingCid <- submit issuer do
    exerciseCmd issuerCid (Issue with to = alice, amount = 100.0, identityRegistryCid = registryCid)

  now <- getTime
  submitMustFail alice do
    exerciseCmd (toInterfaceContractId @TransferFactory factoryCid) TransferFactory_Transfer with
      expectedAdmin = issuer
      transfer = Transfer with
        sender = alice
        receiver = eve
        amount = 40.0
        instrumentId = InstrumentId with admin = issuer, id = "POC"
        requestedAt = subTime now (seconds 1)
        executeBefore = addTime now (hours 1)
        inputHoldingCids = [toInterfaceContractId @Holding holdingCid]
        meta = emptyMetadata
      extraArgs = ExtraArgs with context = ChoiceContext with values = mempty; meta = emptyMetadata

test_transfer_over_balance_fails : Script ()
test_transfer_over_balance_fails = do
  (issuer, alice, bob, registryCid, issuerCid, factoryCid) <- setup

  holdingCid <- submit issuer do
    exerciseCmd issuerCid (Issue with to = alice, amount = 100.0, identityRegistryCid = registryCid)

  now <- getTime
  submitMustFail alice do
    exerciseCmd (toInterfaceContractId @TransferFactory factoryCid) TransferFactory_Transfer with
      expectedAdmin = issuer
      transfer = Transfer with
        sender = alice
        receiver = bob
        amount = 1000.0
        instrumentId = InstrumentId with admin = issuer, id = "POC"
        requestedAt = subTime now (seconds 1)
        executeBefore = addTime now (hours 1)
        inputHoldingCids = [toInterfaceContractId @Holding holdingCid]
        meta = emptyMetadata
      extraArgs = ExtraArgs with context = ChoiceContext with values = mempty; meta = emptyMetadata
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd daml && dpm build`

Expected: FAIL — "module Transfer not found".

- [ ] **Step 3: Write the implementation**

Create `daml/src/Transfer.daml`:

```daml
module Transfer where

import DA.Foldable (forA_)
import Splice.Api.Token.MetadataV1 (emptyMetadata)
import Splice.Api.Token.HoldingV1 (Holding(..), InstrumentId)
import Splice.Api.Token.TransferInstructionV1

import Compliance (IdentityRegistry, assertAllowlisted)
import Token (TokenHolding(..))

-- | Splice TransferFactory implementation for the PoC token. Every
-- transfer completes atomically in one step (never Pending) — the
-- TransferInstruction interface is intentionally not implemented since
-- this factory never produces a pending instruction.
template TokenTransferFactory
  with
    admin               : Party
    identityRegistryCid : ContractId IdentityRegistry
  where
    signatory admin

    interface instance TransferFactory for TokenTransferFactory where
      view = TransferFactoryView with admin, meta = emptyMetadata

      transferFactory_transferImpl _self TransferFactory_Transfer{expectedAdmin, transfer, extraArgs = _} = do
        assertMsg "expectedAdmin mismatch" (expectedAdmin == admin)

        now <- getTime
        assertMsg "requestedAt must be in the past" (transfer.requestedAt <= now)
        assertMsg "transfer expired (executeBefore in the past)" (now < transfer.executeBefore)

        let Transfer{sender, receiver, amount, instrumentId, inputHoldingCids} = transfer
        assertMsg "amount must be positive" (amount > 0.0)
        assertMsg "inputHoldingCids must not be empty" (not (null inputHoldingCids))

        assertAllowlisted identityRegistryCid admin receiver

        total <- processInputs admin instrumentId sender inputHoldingCids
        assertMsg "insufficient input holdings" (total >= amount)

        receiverCid <- create TokenHolding with
          issuer = admin
          owner = receiver
          amount
          instrumentId
          lock = None
          meta = emptyMetadata

        senderChangeCids <- if total > amount
          then do
            changeCid <- create TokenHolding with
              issuer = admin
              owner = sender
              amount = total - amount
              instrumentId
              lock = None
              meta = emptyMetadata
            pure [toInterfaceContractId @Holding changeCid]
          else pure []

        pure TransferInstructionResult with
          output = TransferInstructionResult_Completed with
            receiverHoldingCids = [toInterfaceContractId @Holding receiverCid]
          senderChangeCids
          meta = emptyMetadata

      transferFactory_publicFetchImpl _self TransferFactory_PublicFetch{expectedAdmin, actor = _} = do
        assertMsg "expectedAdmin mismatch" (expectedAdmin == admin)
        pure TransferFactoryView with admin, meta = emptyMetadata

processInputs : Party -> InstrumentId -> Party -> [ContractId Holding] -> Update Decimal
processInputs admin instrumentId sender holdingCids = do
  amounts <- mapA processOne holdingCids
  pure (sum amounts)
  where
    processOne holdingCid = do
      let concreteCid = fromInterfaceContractId @TokenHolding holdingCid
      holding <- fetch concreteCid
      assertMsg "input holding: wrong issuer" (holding.issuer == admin)
      assertMsg "input holding: wrong owner" (holding.owner == sender)
      assertMsg "input holding: wrong instrument" (holding.instrumentId == instrumentId)
      assertMsg "input holding: must not be locked" (holding.lock == None)
      archive concreteCid
      pure holding.amount
```

Note: `mapA` is `DA.Traversable`'s `mapA`, available via `daml-stdlib` (no extra import needed beyond the prelude). Remove the unused `DA.Foldable (forA_)` import if `dpm build` warns about it being unused.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd daml && dpm build && dpm test`

Expected: PASS for all three tests — `test_transfer_between_allowlisted_parties`, `test_transfer_to_non_allowlisted_party_fails`, `test_transfer_over_balance_fails`.

- [ ] **Step 5: Commit**

```bash
git add daml/src/Transfer.daml daml/src/TransferTest.daml
git commit -m "Add TokenTransferFactory (Splice TransferFactory interface)"
```

---

### Task 6: Build the DAR and bootstrap LocalNet

**Files:**
- Create: `scripts/bootstrap/package.json`
- Create: `scripts/bootstrap/tsconfig.json`
- Create: `scripts/bootstrap/src/config.ts`
- Create: `scripts/bootstrap/src/bootstrap.ts`
- Create: `scripts/bootstrap/.env.example`

**Interfaces:**
- Consumes: `daml/.daml/dist/canton-token-poc-1.0.0.dar` (built by this task's Step 1); LocalNet at `http://localhost:2975` (Task 1).
- Produces: `scripts/bootstrap/output/poc-config.json` — `{ packageId: string, adminPartyId: string, adminPublicKey: string, adminPrivateKey: string, instrumentId: { admin: string, id: string }, identityRegistryCid: string, issuerCid: string, transferFactoryCid: string }`. This file is the single source of truth for the frontend's hardcoded config (Task 7 reads it).

- [ ] **Step 1: Build the combined DAR**

Run: `cd daml && dpm build`

Expected: produces `daml/.daml/dist/canton-token-poc-1.0.0.dar`.

- [ ] **Step 2: Extract the DAR's main package id**

Run: `dpm damlc inspect-dar daml/.daml/dist/canton-token-poc-1.0.0.dar | grep -A1 "^DAR archive contains"`

Note the package id printed for `canton-token-poc-1.0.0` (a 64-character hex string) — this is the `packageId` value used in Step 5 below and written into `poc-config.json`.

- [ ] **Step 3: Scaffold the bootstrap script package**

Create `scripts/bootstrap/package.json`:

```json
{
  "name": "canton-token-poc-bootstrap",
  "private": true,
  "type": "module",
  "scripts": {
    "bootstrap": "tsx src/bootstrap.ts"
  },
  "dependencies": {
    "@canton-network/wallet-sdk": "^0.5.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "@types/node": "^22.0.0"
  }
}
```

Create `scripts/bootstrap/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

Run: `cd scripts/bootstrap && npm install`

- [ ] **Step 4: Write the shared SDK config module**

Create `scripts/bootstrap/src/config.ts`:

```typescript
import { localNetStaticConfig, TokenProviderConfig } from '@canton-network/wallet-sdk'

export const AUTH_CONFIG: TokenProviderConfig = {
    method: 'self_signed',
    issuer: 'unsafe-auth',
    credentials: {
        clientId: localNetStaticConfig.LOCALNET_USER_ID,
        clientSecret: 'unsafe',
        audience: 'https://canton.network.global',
        scope: '',
    },
}

export const LEDGER_URL = localNetStaticConfig.LOCALNET_APP_USER_LEDGER_URL
```

- [ ] **Step 5: Write the bootstrap script**

Create `scripts/bootstrap/src/bootstrap.ts`. Replace `PACKAGE_ID_FROM_STEP_2` with the value noted in Step 2.

```typescript
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { SDK } from '@canton-network/wallet-sdk'
import { AUTH_CONFIG, LEDGER_URL } from './config.js'

const PACKAGE_ID = 'PACKAGE_ID_FROM_STEP_2'
const here = path.dirname(fileURLToPath(import.meta.url))
const DAR_PATH = path.join(here, '../../../daml/.daml/dist/canton-token-poc-1.0.0.dar')
const OUTPUT_PATH = path.join(here, '../output/poc-config.json')

async function main() {
    const sdk = await SDK.create({ auth: AUTH_CONFIG, ledgerClientUrl: LEDGER_URL })

    // 1. Upload the compiled DAR (includes the vendored token-standard
    //    dependency packages, since data-dependencies are inlined at build time).
    const darBytes = await readFile(DAR_PATH)
    await sdk.ledger.dar.upload(darBytes, PACKAGE_ID)

    // 2. Allocate the admin/issuer party.
    const adminKeys = sdk.keys.generate()
    const admin = await sdk.party.external
        .create(adminKeys.publicKey, { partyHint: 'poc-admin' })
        .sign(adminKeys.privateKey)
        .execute()

    const instrumentId = { admin: admin.partyId, id: 'POC' }

    // 3. Create the IdentityRegistry, allowlisting the admin itself for convenience.
    // (The created contract id is looked up via the ACS in step 5 below,
    // rather than parsed out of this execute() result, since that's the
    // same lookup the rest of the app uses to find the "current" registry
    // contract after any Allow/Revoke recreates it.)
    await sdk.ledger
        .prepare({
            partyId: admin.partyId,
            commands: [
                {
                    CreateCommand: {
                        templateId: `#canton-token-poc:Compliance:IdentityRegistry`,
                        createArguments: { admin: admin.partyId, allowlist: [admin.partyId] },
                    },
                },
            ],
            disclosedContracts: [],
        })
        .sign(adminKeys.privateKey)
        .execute({ partyId: admin.partyId })

    // 4. Create the TokenIssuer contract.
    await sdk.ledger
        .prepare({
            partyId: admin.partyId,
            commands: [
                {
                    CreateCommand: {
                        templateId: `#canton-token-poc:Token:TokenIssuer`,
                        createArguments: { issuer: admin.partyId, instrumentId },
                    },
                },
            ],
            disclosedContracts: [],
        })
        .sign(adminKeys.privateKey)
        .execute({ partyId: admin.partyId })

    // 5. Look up the created contracts' ids via the active contract set,
    //    which is more reliable than parsing prepare/execute results.
    const registryContracts = await sdk.ledger.acsReader.readJsContracts({
        templateIds: [`#canton-token-poc:Compliance:IdentityRegistry`],
        parties: [admin.partyId],
        filterByParty: true,
    })
    const issuerContracts = await sdk.ledger.acsReader.readJsContracts({
        templateIds: [`#canton-token-poc:Token:TokenIssuer`],
        parties: [admin.partyId],
        filterByParty: true,
    })

    const registryCid = (registryContracts[0] as any).JsActiveContract.createdEvent.contractId
    const issuerCid = (issuerContracts[0] as any).JsActiveContract.createdEvent.contractId

    // 6. Create the TokenTransferFactory, referencing the registry contract id.
    await sdk.ledger
        .prepare({
            partyId: admin.partyId,
            commands: [
                {
                    CreateCommand: {
                        templateId: `#canton-token-poc:Transfer:TokenTransferFactory`,
                        createArguments: { admin: admin.partyId, identityRegistryCid: registryCid },
                    },
                },
            ],
            disclosedContracts: [],
        })
        .sign(adminKeys.privateKey)
        .execute({ partyId: admin.partyId })

    const factoryContracts = await sdk.ledger.acsReader.readJsContracts({
        templateIds: [`#canton-token-poc:Transfer:TokenTransferFactory`],
        parties: [admin.partyId],
        filterByParty: true,
    })
    const transferFactoryCid = (factoryContracts[0] as any).JsActiveContract.createdEvent.contractId

    const config = {
        packageId: PACKAGE_ID,
        adminPartyId: admin.partyId,
        adminPublicKey: adminKeys.publicKey,
        adminPrivateKey: adminKeys.privateKey,
        instrumentId,
        identityRegistryCid: registryCid,
        issuerCid,
        transferFactoryCid,
    }

    await mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
    await writeFile(OUTPUT_PATH, JSON.stringify(config, null, 2))
    console.log('Wrote', OUTPUT_PATH)
    console.log(config)
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
```

- [ ] **Step 6: Run it against LocalNet**

Run: `cd scripts/bootstrap && npm run bootstrap`

Expected: prints the resulting config object and writes `scripts/bootstrap/output/poc-config.json` with non-empty `adminPartyId`, `identityRegistryCid`, `issuerCid`, `transferFactoryCid`. If it fails with a connection error, LocalNet isn't running (see Task 1); if it fails on `sdk.ledger.dar.upload`, double check `PACKAGE_ID` matches Step 2's output exactly.

- [ ] **Step 7: Commit**

```bash
git add scripts/bootstrap/package.json scripts/bootstrap/tsconfig.json scripts/bootstrap/src/
echo "output/" >> scripts/bootstrap/.gitignore
git add scripts/bootstrap/.gitignore
git commit -m "Add LocalNet bootstrap script (DAR upload, admin party, IdentityRegistry, TokenIssuer, TokenTransferFactory)"
```

(`poc-config.json` is generated local state — it is not committed. Task 7 reads it once to seed the frontend's own config file, which IS committed.)

---

### Task 7: Frontend scaffold, SDK client, and Connect Wallet view

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/pocConfig.ts`
- Create: `frontend/src/sdk.ts`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/views/ConnectWallet.tsx`
- Create: `frontend/src/wallet.ts`

**Interfaces:**
- Consumes: `scripts/bootstrap/output/poc-config.json` (Task 6) — copied into `frontend/src/pocConfig.ts` as a literal.
- Produces: `useWallet()` hook / `wallet.ts` exposing `{ connect(): Promise<{partyId, publicKey, privateKey}>, connected: WalletState | null }` — consumed by Task 8 (Mint) and Task 9 (Transfer) views.

- [ ] **Step 1: Scaffold the Vite React TS app**

Run: `npm create vite@latest frontend -- --template react-ts` (accept defaults, don't install yet)

Run: `cd frontend && npm install && npm install @canton-network/wallet-sdk`

- [ ] **Step 2: Copy the bootstrap output into a frontend config module**

Read `scripts/bootstrap/output/poc-config.json` (produced in Task 6) and create `frontend/src/pocConfig.ts` with its values inlined as a literal, for example:

```typescript
// Generated from scripts/bootstrap/output/poc-config.json — re-run
// `npm run bootstrap` in scripts/bootstrap and update this file if LocalNet
// is reset (bootstrapped contract ids and the admin party do not survive
// a LocalNet restart with a fresh volume).
export const POC_CONFIG = {
    packageId: '<value from poc-config.json>',
    adminPartyId: '<value from poc-config.json>',
    adminPublicKey: '<value from poc-config.json>',
    adminPrivateKey: '<value from poc-config.json>',
    instrumentId: { admin: '<value from poc-config.json>', id: 'POC' },
    identityRegistryCid: '<value from poc-config.json>',
    issuerCid: '<value from poc-config.json>',
    transferFactoryCid: '<value from poc-config.json>',
} as const
```

- [ ] **Step 3: Write the SDK client factory**

Create `frontend/src/sdk.ts`:

```typescript
import { SDK, localNetStaticConfig, type TokenProviderConfig } from '@canton-network/wallet-sdk'

const AUTH_CONFIG: TokenProviderConfig = {
    method: 'self_signed',
    issuer: 'unsafe-auth',
    credentials: {
        clientId: localNetStaticConfig.LOCALNET_USER_ID,
        clientSecret: 'unsafe',
        audience: 'https://canton.network.global',
        scope: '',
    },
}

let sdkPromise: ReturnType<typeof SDK.create> | undefined

export function getSdk() {
    if (!sdkPromise) {
        sdkPromise = SDK.create({
            auth: AUTH_CONFIG,
            ledgerClientUrl: localNetStaticConfig.LOCALNET_APP_USER_LEDGER_URL,
        })
    }
    return sdkPromise
}
```

- [ ] **Step 4: Write the wallet connection module**

Create `frontend/src/wallet.ts`:

```typescript
import { getSdk } from './sdk'

export type ConnectedWallet = {
    partyId: string
    publicKey: string
    privateKey: string
}

export async function connectWallet(partyHint: string): Promise<ConnectedWallet> {
    const sdk = await getSdk()
    const keys = sdk.keys.generate()
    const party = await sdk.party.external
        .create(keys.publicKey, { partyHint })
        .sign(keys.privateKey)
        .execute()

    return {
        partyId: party.partyId,
        publicKey: keys.publicKey,
        privateKey: keys.privateKey,
    }
}
```

- [ ] **Step 5: Write the Connect Wallet view**

Create `frontend/src/views/ConnectWallet.tsx`:

```tsx
import { useState } from 'react'
import { connectWallet, type ConnectedWallet } from '../wallet'

type Props = {
    label: string
    wallet: ConnectedWallet | null
    onConnected: (wallet: ConnectedWallet) => void
}

export function ConnectWallet({ label, wallet, onConnected }: Props) {
    const [connecting, setConnecting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleConnect() {
        setConnecting(true)
        setError(null)
        try {
            const partyHint = `poc-${label.toLowerCase()}-${Date.now()}`
            const connected = await connectWallet(partyHint)
            onConnected(connected)
        } catch (err) {
            setError(
                err instanceof Error
                    ? `${err.message} (is LocalNet running? see localnet/README.md)`
                    : String(err)
            )
        } finally {
            setConnecting(false)
        }
    }

    if (wallet) {
        return (
            <div>
                <strong>{label}</strong>: connected as <code>{wallet.partyId}</code>
            </div>
        )
    }

    return (
        <div>
            <button onClick={handleConnect} disabled={connecting}>
                {connecting ? 'Connecting…' : `Connect ${label} Wallet`}
            </button>
            {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
    )
}
```

- [ ] **Step 6: Wire up App.tsx with two wallet slots (sender/receiver)**

Create `frontend/src/App.tsx`:

```tsx
import { useState } from 'react'
import { ConnectWallet } from './views/ConnectWallet'
import type { ConnectedWallet } from './wallet'

export function App() {
    const [walletA, setWalletA] = useState<ConnectedWallet | null>(null)
    const [walletB, setWalletB] = useState<ConnectedWallet | null>(null)

    return (
        <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
            <h1>Canton Token PoC</h1>
            <section>
                <h2>1. Connect Wallets</h2>
                <ConnectWallet label="Sender" wallet={walletA} onConnected={setWalletA} />
                <ConnectWallet label="Receiver" wallet={walletB} onConnected={setWalletB} />
            </section>
        </div>
    )
}
```

Update `frontend/src/main.tsx` to render `<App />` (replace the Vite template's default `<App />` import target if it points elsewhere — keep it pointing at `./App`).

- [ ] **Step 7: Manually verify wallet connect**

Run: `cd frontend && npm run dev`, open the printed local URL, click "Connect Sender Wallet" and "Connect Receiver Wallet".

Expected: both buttons switch to showing a `partyId` string (e.g. `poc-sender-...::122...`). If you see a connection error, confirm LocalNet is running (Task 1, Step 6) and `pocConfig.ts`/`sdk.ts` URLs match your LocalNet ports.

- [ ] **Step 8: Commit**

```bash
git add frontend/
git commit -m "Scaffold frontend and implement wallet connect"
```

---

### Task 8: Mint Token view and holdings display

**Files:**
- Create: `frontend/src/holdings.ts`
- Create: `frontend/src/views/Holdings.tsx`
- Create: `frontend/src/views/MintToken.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `POC_CONFIG` (Task 7); `ConnectedWallet` (Task 7).
- Produces: `listHoldings(partyId: string): Promise<Array<{contractId: string, owner: string, amount: string}>>` — consumed by Task 9's Transfer view to pick input holdings.

- [ ] **Step 1: Write the holdings query module**

Create `frontend/src/holdings.ts`:

```typescript
import { getSdk } from './sdk'

export type HoldingSummary = {
    contractId: string
    owner: string
    amount: string
}

export async function listHoldings(partyId: string): Promise<HoldingSummary[]> {
    const sdk = await getSdk()
    const contracts = await sdk.ledger.acsReader.readJsContracts({
        templateIds: ['#canton-token-poc:Token:TokenHolding'],
        parties: [partyId],
        filterByParty: true,
    })

    return contracts.map((entry: any) => {
        const created = entry.JsActiveContract.createdEvent
        return {
            contractId: created.contractId,
            owner: created.createArgument.owner,
            amount: created.createArgument.amount,
        }
    })
}
```

- [ ] **Step 2: Write a Holdings display component**

Create `frontend/src/views/Holdings.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { listHoldings, type HoldingSummary } from '../holdings'

type Props = { partyId: string; refreshKey: number }

export function Holdings({ partyId, refreshKey }: Props) {
    const [holdings, setHoldings] = useState<HoldingSummary[]>([])
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        listHoldings(partyId)
            .then(setHoldings)
            .catch((err) => setError(err instanceof Error ? err.message : String(err)))
    }, [partyId, refreshKey])

    const total = holdings.reduce((sum, h) => sum + Number(h.amount), 0)

    return (
        <div>
            <p>Balance: {total}</p>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <ul>
                {holdings.map((h) => (
                    <li key={h.contractId}>
                        {h.amount} (contract {h.contractId.slice(0, 12)}…)
                    </li>
                ))}
            </ul>
        </div>
    )
}
```

- [ ] **Step 3: Write the Mint Token view**

Create `frontend/src/views/MintToken.tsx`:

```tsx
import { useState } from 'react'
import { getSdk } from '../sdk'
import { POC_CONFIG } from '../pocConfig'
import type { ConnectedWallet } from '../wallet'

type Props = {
    recipient: ConnectedWallet
    onMinted: () => void
}

export function MintToken({ recipient, onMinted }: Props) {
    const [amount, setAmount] = useState('100')
    const [minting, setMinting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleMint() {
        setMinting(true)
        setError(null)
        try {
            const sdk = await getSdk()
            await sdk.ledger
                .prepare({
                    partyId: POC_CONFIG.adminPartyId,
                    commands: [
                        {
                            ExerciseCommand: {
                                templateId: `#canton-token-poc:Token:TokenIssuer`,
                                contractId: POC_CONFIG.issuerCid,
                                choice: 'Issue',
                                choiceArgument: {
                                    to: recipient.partyId,
                                    amount,
                                    identityRegistryCid: POC_CONFIG.identityRegistryCid,
                                },
                            },
                        },
                    ],
                    disclosedContracts: [],
                })
                .sign(POC_CONFIG.adminPrivateKey)
                .execute({ partyId: POC_CONFIG.adminPartyId })

            onMinted()
        } catch (err) {
            setError(
                err instanceof Error
                    ? `Mint failed: ${err.message} (is the recipient allowlisted? see bootstrap step 5)`
                    : String(err)
            )
        } finally {
            setMinting(false)
        }
    }

    return (
        <div>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} />
            <button onClick={handleMint} disabled={minting}>
                {minting ? 'Minting…' : 'Mint to Sender'}
            </button>
            {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
    )
}
```

- [ ] **Step 4: Wire Mint and Holdings into App.tsx**

Modify `frontend/src/App.tsx` to add a mint section and a refresh counter, e.g.:

```tsx
import { useState } from 'react'
import { ConnectWallet } from './views/ConnectWallet'
import { MintToken } from './views/MintToken'
import { Holdings } from './views/Holdings'
import type { ConnectedWallet } from './wallet'

export function App() {
    const [walletA, setWalletA] = useState<ConnectedWallet | null>(null)
    const [walletB, setWalletB] = useState<ConnectedWallet | null>(null)
    const [refreshKey, setRefreshKey] = useState(0)

    return (
        <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
            <h1>Canton Token PoC</h1>
            <section>
                <h2>1. Connect Wallets</h2>
                <ConnectWallet label="Sender" wallet={walletA} onConnected={setWalletA} />
                <ConnectWallet label="Receiver" wallet={walletB} onConnected={setWalletB} />
            </section>

            {walletA && (
                <section>
                    <h2>2. Mint</h2>
                    <MintToken recipient={walletA} onMinted={() => setRefreshKey((k) => k + 1)} />
                    <Holdings partyId={walletA.partyId} refreshKey={refreshKey} />
                </section>
            )}
        </div>
    )
}
```

- [ ] **Step 5: Manually verify minting**

Run: `cd frontend && npm run dev`, connect the Sender wallet, then click "Mint to Sender".

Expected: the Holdings list under it shows one entry with the minted amount and the balance updates. If it fails with a compliance error, first exercise `IdentityRegistry_Allow` for the sender's party id against `POC_CONFIG.identityRegistryCid` (e.g. via a one-off script using the same `ExerciseCommand` pattern as Step 3, signed by the admin) — bootstrap only allowlists the admin itself.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/holdings.ts frontend/src/views/Holdings.tsx frontend/src/views/MintToken.tsx frontend/src/App.tsx
git commit -m "Add mint view and holdings display"
```

---

### Task 9: Transfer Token view (including compliance rejection demo)

**Files:**
- Create: `frontend/src/views/TransferToken.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `listHoldings` (Task 8); `POC_CONFIG` (Task 7); `ConnectedWallet` (Task 7).

- [ ] **Step 1: Write the Transfer Token view**

Create `frontend/src/views/TransferToken.tsx`:

```tsx
import { useState } from 'react'
import { getSdk } from '../sdk'
import { POC_CONFIG } from '../pocConfig'
import { listHoldings } from '../holdings'
import type { ConnectedWallet } from '../wallet'

type Props = {
    sender: ConnectedWallet
    receiver: ConnectedWallet
    onTransferred: () => void
}

export function TransferToken({ sender, receiver, onTransferred }: Props) {
    const [amount, setAmount] = useState('40')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleTransfer() {
        setBusy(true)
        setError(null)
        try {
            const sdk = await getSdk()
            const holdings = await listHoldings(sender.partyId)
            if (holdings.length === 0) throw new Error('sender has no holdings to transfer')

            const now = new Date()
            const requestedAt = new Date(now.getTime() - 1000).toISOString()
            const executeBefore = new Date(now.getTime() + 60 * 60 * 1000).toISOString()

            await sdk.ledger
                .prepare({
                    partyId: sender.partyId,
                    commands: [
                        {
                            ExerciseCommand: {
                                templateId:
                                    '#splice-api-token-transfer-instruction-v1:Splice.Api.Token.TransferInstructionV1:TransferFactory',
                                contractId: POC_CONFIG.transferFactoryCid,
                                choice: 'TransferFactory_Transfer',
                                choiceArgument: {
                                    expectedAdmin: POC_CONFIG.adminPartyId,
                                    transfer: {
                                        sender: sender.partyId,
                                        receiver: receiver.partyId,
                                        amount,
                                        instrumentId: POC_CONFIG.instrumentId,
                                        requestedAt,
                                        executeBefore,
                                        inputHoldingCids: holdings.map((h) => h.contractId),
                                        meta: { values: {} },
                                    },
                                    extraArgs: {
                                        context: { values: {} },
                                        meta: { values: {} },
                                    },
                                },
                            },
                        },
                    ],
                    disclosedContracts: [],
                })
                .sign(sender.privateKey)
                .execute({ partyId: sender.partyId })

            onTransferred()
        } catch (err) {
            setError(
                err instanceof Error
                    ? `Transfer failed: ${err.message} (is the receiver allowlisted?)`
                    : String(err)
            )
        } finally {
            setBusy(false)
        }
    }

    return (
        <div>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} />
            <button onClick={handleTransfer} disabled={busy}>
                {busy ? 'Transferring…' : `Transfer to ${receiver.partyId.slice(0, 12)}…`}
            </button>
            {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
    )
}
```

Note the `templateId` here is the Splice **interface** id (`Splice.Api.Token.TransferInstructionV1:TransferFactory`), not our concrete `Transfer:TokenTransferFactory` template id — `TransferFactory_Transfer` is a choice defined on the interface, and any CIP-0056-compliant wallet would exercise it exactly this way without knowing our concrete template. Contrast with `MintToken.tsx`'s `Issue` choice, which is our own template's own choice and correctly uses our concrete template id.

- [ ] **Step 2: Wire Transfer into App.tsx**

Modify `frontend/src/App.tsx` to add the transfer section once both wallets are connected:

```tsx
{walletA && walletB && (
    <section>
        <h2>3. Transfer</h2>
        <TransferToken
            sender={walletA}
            receiver={walletB}
            onTransferred={() => setRefreshKey((k) => k + 1)}
        />
        <h3>Receiver holdings</h3>
        <Holdings partyId={walletB.partyId} refreshKey={refreshKey} />
    </section>
)}
```

Add the `import { TransferToken } from './views/TransferToken'` line.

- [ ] **Step 3: Manually verify the successful transfer path**

With Sender holding minted tokens (Task 8) and Receiver connected, exercise `IdentityRegistry_Allow` for the Receiver's party id (same one-off pattern as Task 8 Step 5), then click Transfer.

Expected: Sender's balance decreases, Receiver's balance increases by the transferred amount.

- [ ] **Step 4: Manually verify the compliance rejection path**

Connect a third wallet in the browser console or via a temporary extra `ConnectWallet` slot, do NOT allowlist it, and attempt a transfer to it.

Expected: the transfer fails and the UI shows the "Transfer failed... is the receiver allowlisted?" error rather than a silent failure or crash.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/TransferToken.tsx frontend/src/App.tsx
git commit -m "Add transfer view with compliance-rejection error handling"
```

---

### Task 10: End-to-end walkthrough documentation

**Files:**
- Create: `README.md` (repo root)

**Interfaces:**
- Consumes: nothing new — documents the already-implemented flow from Tasks 1-9.

- [ ] **Step 1: Write the README**

Create `README.md`:

```markdown
# Canton Token PoC

Demonstrates three capabilities on Canton Network: wallet connect, Daml
token minting, and token transfer, with an ERC-3643-style compliance
allowlist layered on Canton's native CIP-0056 token standard.

See `docs/superpowers/specs/2026-09-15-canton-token-poc-design.md` for
the design and its scope trade-offs.

## Prerequisites

- Docker (for Splice LocalNet)
- `dpm` (Daml package manager / SDK installer)
- Node.js 18+

## Setup

1. Start LocalNet — see `localnet/README.md`.
2. Vendor the Splice token-standard DAR dependencies:
   `./scripts/vendor-token-standard.sh`
3. Build and test the Daml package: `cd daml && dpm build && dpm test`
4. Bootstrap LocalNet (uploads the DAR, allocates the admin party, creates
   the IdentityRegistry/TokenIssuer/TokenTransferFactory contracts):
   `cd scripts/bootstrap && npm install && npm run bootstrap`
5. Copy the resulting `scripts/bootstrap/output/poc-config.json` values
   into `frontend/src/pocConfig.ts`.
6. Run the frontend: `cd frontend && npm install && npm run dev`

## Walkthrough

1. Click "Connect Sender Wallet" and "Connect Receiver Wallet".
2. Click "Mint to Sender" — the Sender's holdings list shows the minted
   balance.
3. Allowlist the Receiver (see `frontend/src/views/TransferToken.tsx`'s
   comment on `IdentityRegistry_Allow` — there's no UI for this step in
   the PoC; run it as a one-off script).
4. Click "Transfer" — balances update on both sides.
5. To see the compliance rejection path, attempt a transfer to a
   non-allowlisted party and observe the error message.

## Scope

- No backend service — the frontend talks to LocalNet's JSON Ledger API
  directly via `@canton-network/wallet-sdk`.
- No CIP-0056 registry HTTP service — the single instrument/admin is
  hardcoded in `frontend/src/pocConfig.ts`.
- Only one-step (`Completed`) transfers — no pending/accept flow, no
  `Allocation`/delivery-vs-payment.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Add end-to-end walkthrough README"
```
