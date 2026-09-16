# From PoC to Production

This PoC (see `README.md`) proves the three core capabilities — wallet
connect, Daml token minting, and token transfer — against a local Splice
LocalNet. It deliberately skips everything a real deployment needs around
that core: proper package lifecycle management, key custody, a backend,
compliance depth, and operations. This document is that plan: what changes,
in what order, and why — grounded in what this PoC's own build actually hit
(see `.superpowers/sdd/2026-09-15-canton-token-poc/progress.md` for the full
history), not a generic checklist.

## 1. Network progression: LocalNet → DevNet → TestNet → MainNet

Canton Network has four tiers (see
`docs/superpowers/specs/2026-09-16-no-docker-hosted-sandbox-research.md` for
the full research and citations):

| Tier | Purpose | Access |
|---|---|---|
| **LocalNet** | This PoC. Self-contained Docker Compose, no external dependency. | Anyone, `./install.sh`. |
| **DevNet** | Real decentralized Global Synchronizer infrastructure, for testing against actual Super Validators. Resets every ~3 months. | Requires running your own validator node, sponsored by a Super Validator (SV), with your validator's IP allowlisted (2-7 day turnaround). |
| **TestNet** | Production staging — no real value, but the same upgrade cadence and stability bar as MainNet. | Everything DevNet requires, **plus** Global Synchronizer Foundation Tokenomics Committee approval, applied for once the app is genuinely near production-ready (not for early development). |
| **MainNet** | Production. Real Canton Coin (CC), real value. | Invite-only — sponsored by an SV, existing validator, application provider, or the Canton Foundation. |

**What this means for planning:** budget **weeks, not days**, for DevNet
access, and treat TestNet access as a late-stage gate tied to a specific
launch date, not something to request casually early on. Identify a
sponsoring SV as one of the first production-track work items — everything
past LocalNet depends on that relationship existing. Running your own
validator node is itself a production deployment (see §6) — it's
Docker/Kubernetes-based infrastructure you operate and keep patched, not a
one-time setup.

## 2. Contract (Daml package) lifecycle in production

This is where the PoC hit its deepest bug (`UNRESOLVED_PACKAGE_NAME`, see
the SDD ledger's Task 9 entry) and where production discipline differs most
from what `install.sh` does.

### 2.1 Build once, promote everywhere

The PoC's `daml.yaml` `data-dependencies` on `daml/vendor/*.dar` means the
compiled package's own content hash depends on *exactly* which dependency
bytes were vendored — vendoring a different (even semantically identical)
copy silently produces a different package id (this happened twice during
this PoC's own build). In production:

- **Build the DAR exactly once per release**, from a pinned, version-locked
  set of dependencies (pin `daml.yaml`'s `data-dependencies` to a specific,
  checksummed artifact — not "whatever LocalNet happens to bundle" the way
  this PoC's fixed vendor script does, since production environments don't
  give you a container to `docker cp` a matching copy out of).
- **Promote the same DAR bytes** through DevNet → TestNet → MainNet. Never
  rebuild per-environment — a rebuild is a new package id even if no source
  changed, per the LF 2.x package-identity model, and every rebuild is a
  fresh integration-testing burden (this PoC's `PACKAGE_ID` drifted twice
  purely from unrelated vendoring changes, breaking bootstrap silently until
  caught — see `scripts/bootstrap/src/bootstrap.ts`'s comment on why it now
  reads the id from the DAR at runtime instead of hand-copying it).
- **Track package ids as build artifacts**, not source: store the built DAR
  and its package id together (e.g. as a release artifact with a manifest),
  so "what's actually deployed on TestNet" is always answerable without
  re-deriving it from source at a point in time that may no longer build the
  same way.

### 2.2 Vetting

This PoC's LocalNet setup uses a narrow, single-package vet
(`scripts/bootstrap/src/bootstrap.ts`'s `vetOwnPackage`) as a workaround for
a dependency-name collision that doesn't exist once the DAR is built
correctly (see §2.1). In production, on a real participant:

- Vetting is a **topology transaction** the participant operator authorizes
  — it's an operational action with real consequences (a badly-vetted
  package can break in-flight transactions for every party the participant
  hosts), not a build step.
- Use the standard `dpm`/Ledger API DAR upload flow, which vets the full DAR
  (including dependencies) as one transaction, rather than this PoC's
  narrow single-package workaround — that workaround only exists because
  the PoC's dependencies collided with LocalNet's own bundled copies (fixed
  in §2.1, so this doesn't recur once builds are correct).
- Plan an explicit **unvetting/decommissioning step** for retired package
  versions once no live contracts reference them — this PoC's package
  store still has two dead, never-cleaned-up package ids from earlier
  rebuilds (harmless in a disposable LocalNet, not something to carry into
  a long-lived production package store).

### 2.3 Upgrades

Canton's LF 2.x smart-contract-upgrading model lets a new package version
supersede an old one *by name*, for compatible schema changes, without
migrating existing contracts. This PoC never exercises that path (every
"upgrade" so far has been a full package-id change from a dependency
rebuild, not an intentional versioned upgrade). For production:

- Adopt semantic versioning in `daml.yaml` from day one, and treat any
  template/interface signature change as either (a) upgrade-compatible
  (additive, backward-compatible — ships as a new version, no contract
  migration needed) or (b) breaking (needs an explicit migration: exercise
  a choice that archives the old contract and creates its replacement under
  the new template, or a batch migration script for existing state).
- **`TokenTransferFactory.identityRegistryCid`'s current design is exactly
  the kind of thing to fix before this matters in production** — it's a
  create-time-only field with no update choice (see `README.md`'s Known
  limitations), which already forces a full contract-recreation dance in
  this PoC (`npm run recreate-transfer-factory`) every time the registry
  changes. In production, either add an explicit update choice, or resolve
  the current registry contract via `ChoiceContext`/`ExtraArgs` at exercise
  time (the standard's own mechanism for this, currently ignored — see
  `Transfer.daml:24`'s `extraArgs = _`) instead of a stored snapshot.
- CI enforces `dpm build && dpm test` (and, ideally, `dpm upgrade-check`
  against the prior released version) on every change before a release
  artifact is cut — this PoC's manual `dpm build && dpm test` workflow
  (documented in `README.md`) becomes a required, automated gate.

### 2.4 Test coverage

`daml/src/*Test.daml` covers the four scenarios the plan specified (mint,
transfer, compliance rejection, over-balance rejection) but has known gaps
flagged during the final review (`README.md`'s Known limitations):
`IdentityRegistry_Revoke`, the exact-balance transfer branch, and the
wrong-owner input-holding rejection in `Transfer.daml`'s `processInputs` are
all real code paths with no test. Close these before production — the
wrong-owner check in particular is the one that actually prevents a party
from spending someone else's holdings.

## 3. Key management and identity

**This PoC's single biggest departure from anything production-viable:**
`frontend/src/pocConfig.ts` ships the admin party's private key in
plaintext, in the browser bundle. This is explicitly scoped and documented
as acceptable *only* because it signs transactions on a disposable local
ledger with zero real value (see the design spec's scope decisions and the
final review's confirmation that nothing in this PoC makes that posture
worse). It must never reach a real network as-is.

For production:

- **Admin/issuer keys never touch a browser.** Move admin-signed operations
  (mint, allowlist management) behind a backend service that holds the
  signing key in a proper secrets store (cloud KMS, HashiCorp Vault, or an
  HSM for anything MainNet-facing) and exposes authenticated, authorized
  endpoints — not the raw ledger — to the frontend.
- **End-user wallets need real custody**, not a `sdk.keys.generate()` call
  that hands the raw private key back to a React `useState`. Options in
  increasing order of user-facing complexity: a hosted wallet provider,
  hardware-wallet-backed signing, or MPC/threshold signing — evaluated
  against how much custody risk the product is willing to accept per user.
- **The frontend never needs `POC_CONFIG.adminPrivateKey`, `adminPartyId`,
  or `issuerCid`/`transferFactoryCid` hardcoded** once there's a backend and
  a real CIP-0056 registry (§4) — those become server-side configuration or
  values discovered via the registry, not client-shipped constants.
- **Run and operate your own participant node(s)** for anything past
  DevNet — see §6. Participant key material (the node's own signing keys,
  distinct from any party's external keys) needs the same custody rigor as
  application-level admin keys.

## 4. CIP-0056 registry service

The design spec explicitly scopes this out for the PoC ("a single hardcoded
issuer/admin party and instrument, so the frontend hardcodes that config
instead of querying a registry service" — see the design spec's scope
decisions). Production needs the real thing:

- Stand up a registry HTTP API (per the CIP-0056 standard) that resolves
  instrument/factory metadata dynamically, so a wallet doesn't need
  hardcoded knowledge of which party issued which instrument.
- This also removes the `pocConfig.ts` staleness problem entirely (see
  `README.md`'s "Config drifts out of sync" section) — a real registry
  answers "what's the current `TokenTransferFactory` contract id" live,
  instead of a value someone hand-copies after every `Allow`/`Revoke`.

## 5. Compliance depth

The PoC's `IdentityRegistry` is a minimal allowlist that only gates the
*receiver* of a mint/transfer (`Transfer.daml:35`), never the sender — a
real gap against the ERC-3643 model the spec names (see `README.md`'s Known
limitations). Before production:

- Add the symmetric sender-side check (`assertAllowlisted identityRegistryCid
  admin sender`) and a test that revokes a holder and confirms they can no
  longer transfer out.
- Replace the toy allowlist with real identity verification — KYC/AML
  provider integration, on-chain attestations, or whatever the actual
  regulatory posture requires for the asset class involved. This PoC's
  `IdentityRegistry_Allow`/`Revoke` model (admin-run script, no self-service
  UI) is a reasonable starting *shape* for the authorization flow, but the
  admin's decision-making behind each `Allow` needs to be backed by a real
  process, not a manual CLI command.
- Build an audit trail: who was allowlisted/revoked, when, and why — this
  matters both for compliance review and for incident response.

## 6. Infrastructure and operations

- **Participant node operation.** This PoC never runs its own participant —
  LocalNet bundles one. Production means operating (or paying an operator
  for) a real participant node: Docker/Kubernetes deployment, monitoring,
  patching in step with Canton/Splice releases, backup and disaster
  recovery for its state.
- **Observability.** Ledger health, synchronizer connectivity, transaction
  success/failure rates, and package-vetting state all need monitoring and
  alerting — this PoC's only "observability" is reading container logs by
  hand.
- **Backend service.** Once admin operations move server-side (§3) and a
  registry exists (§4), that backend needs its own production concerns:
  authentication/authorization, rate limiting, audit logging, and its own
  test/deploy pipeline — deliberately out of scope for this PoC (design
  spec: "No backend service").
- **CI/CD.** Automate `dpm build && dpm test` (Daml) and `npx tsc --noEmit`
  (frontend/scripts) on every change, plus the release-artifact promotion
  flow from §2.1, rather than the manual `install.sh`/`README.md` workflow
  this PoC relies on.
- **Runbooks.** At minimum: synchronizer downtime, a compromised key,
  a bad package vetted in error, and validator node failure/recovery.

## 7. Cost model

MainNet transactions cost Canton Coin (CC) — plan a fee budget and a
sponsorship/reward strategy (e.g. the Global Synchronizer's app-rewards
program for featured applications) before launch; this PoC's LocalNet has
no real fees at all, so the cost model has zero PoC-stage validation.

## 8. Suggested milestones

1. **Harden the Daml package**: close the test-coverage gaps (§2.4), add
   the sender-side compliance check (§5), fix the registry-staleness design
   (§2.3).
2. **Build the backend + registry** (§3, §4): move admin key custody and
   instrument/factory discovery server-side.
3. **Secure DevNet access**: identify and engage a sponsoring SV (§1) in
   parallel with #1-2, given the multi-week lead time.
4. **DevNet pilot**: deploy the hardened package and backend, exercise the
   full flow against real Global Synchronizer infrastructure.
5. **Security review**: third-party audit of the Daml templates and the new
   backend before requesting TestNet access.
6. **TestNet**: apply once genuinely near production-ready (§1); validate
   the full user journey with no real value at stake.
7. **MainNet launch**: with a real key-custody solution, cost model, and
   operational runbooks in place.
