# Canton Token PoC — Design

## Goal

A proof-of-concept demonstrating three capabilities on Canton Network:

1. Create a wallet address (Canton party + key pair) and connect it.
2. Create a Daml contract and mint a token.
3. Transfer a token to another wallet.

Reference: [Canton Network docs — Choose Your Path](https://docs.canton.network/appdev/get-started/choose-your-path)

> **Note (2026-09-16):** a hosted, no-Docker sandbox alternative (so only Node.js/React
> would need to be installed) was investigated and found not viable — see
> [`2026-09-16-no-docker-hosted-sandbox-research.md`](2026-09-16-no-docker-hosted-sandbox-research.md).
> Docker (for Splice LocalNet) and a one-time local Daml SDK install (to compile the
> custom compliance template) remain required; this spec's architecture is unchanged.

## Scope decisions

- **Token standard**: implement a pragmatic subset of Canton's native **CIP-0056 Token
  Standard** — the `Holding` interface (so the Wallet SDK recognizes balances natively)
  plus `TransferFactory` (one-step transfer, `Completed` result path only). **Correction
  (2026-09-16):** the implementation plan's Global Constraints explicitly forbid
  implementing the `TransferInstruction` interface itself — it's only needed for the
  pending/accept path, which this PoC never uses — so despite this line's original
  wording, `TokenTransferFactory` does NOT implement `TransferInstruction`; only
  `TransferFactory`. The `Allocation` / delivery-vs-payment interfaces are out of scope
  either way — not needed for a simple wallet-to-wallet transfer.
- **Registry**: CIP-0056 normally requires a registry HTTP API for factory/instrument
  discovery. Out of scope for this PoC — there is a single hardcoded issuer/admin party
  and instrument, so the frontend hardcodes that config instead of querying a registry
  service.
- **Compliance**: the user requested "ERC-3643" style behavior. ERC-3643 is an
  Ethereum/Solidity standard (permissioned security tokens with on-chain identity
  checks) and does not run on Canton/Daml directly. Instead, we layer ERC-3643-style
  *semantics* on top of CIP-0056: a Daml `IdentityRegistry` template holding an
  allowlist of parties, checked on `Issue` and `TransferFactory_Transfer`.
- **No backend service**: the frontend uses `@canton-network/wallet-sdk` directly
  in-browser against LocalNet's JSON Ledger API. Keys stay client-side. No Node/Express
  or Spring Boot layer (unlike the heavier `cn-quickstart` reference app).
- **Ledger**: Splice LocalNet (Canton's dockerized local validator + domain) for local
  dev only. Not a deployment target.

## Architecture

```
┌─────────────────────────────┐
│  frontend/ (React + TS,     │
│  Vite)                      │
│  - Connect Wallet view      │
│  - Mint Token view          │
│  - Transfer Token view      │
│  uses @canton-network/      │
│  wallet-sdk directly        │
└──────────────┬───────────────┘
               │ JSON Ledger API (HTTP)
               ▼
┌─────────────────────────────┐
│  Splice LocalNet             │
│  (docker-compose, in         │
│   localnet/)                 │
│  - validator node            │
│  - domain/synchronizer       │
└──────────────┬───────────────┘
               │ loads
               ▼
┌─────────────────────────────┐
│  daml/ (Daml package)        │
│  - Token.daml (Holding impl, │
│    Issue choice)             │
│  - Transfer.daml             │
│    (TransferFactory,         │
│    TransferInstruction)      │
│  - Compliance.daml           │
│    (IdentityRegistry,        │
│    allowlist check)          │
└───────────────────────────────┘
```

## Components

1. **`daml/`** — Daml project (`daml.yaml` + modules):
   - `Token.daml`: token instrument + `Holding` interface implementation; `Issue`
     choice mints a new `Holding` to a party, gated by the `IdentityRegistry`
     allowlist check.
   - `Transfer.daml`: `TransferFactory` (registry-maintained) exposing
     `TransferFactory_Transfer`; `TransferInstruction` for the one-step `Completed`
     path. On success, archives the sender's input `Holding` and creates two new
     `Holding` contracts (receiver amount + sender remainder, if any).
   - `Compliance.daml`: `IdentityRegistry` template storing an allowlist of parties;
     helper used by `Issue` and `TransferFactory_Transfer` to reject non-allowlisted
     receivers with a clear `assertMsg`.

2. **`frontend/`** — Vite + React + TypeScript app:
   - **Connect Wallet**: uses Wallet SDK to generate/load a key pair, allocate a
     Canton party against LocalNet, establish a session.
   - **Mint Token**: issuer (fixed admin party, pre-provisioned in LocalNet setup)
     exercises `Issue` to mint tokens to the connected wallet's party.
   - **Transfer Token**: connected wallet exercises `TransferFactory_Transfer` to
     move tokens to another wallet's party, subject to the allowlist check.
   - Displays holdings by querying the Wallet SDK's token-standard holdings query
     (`localNetTokenStandardDefault`).

3. **`localnet/`** — Splice LocalNet docker-compose configuration and any
   LocalNet-specific config (party/admin bootstrap).

4. **`scripts/`** — helper scripts: bootstrap LocalNet, `daml build`, upload the
   compiled DAR to LocalNet, seed the `IdentityRegistry` with initial allowlisted
   parties.

## Data flow

1. User opens the frontend and clicks **Connect Wallet** → Wallet SDK generates a
   key pair and allocates a Canton party against LocalNet → session established.
2. The issuer (fixed admin party) mints tokens to the connected party by exercising
   `Issue` on the Token template → allowlist check runs → a `Holding`-interface
   contract is created for the receiver.
3. The frontend queries holdings via the Wallet SDK's token-standard holdings query
   and displays the balance.
4. User transfers: frontend exercises `TransferFactory_Transfer` (single
   hardcoded instrument/admin) → allowlist check runs against the receiver →
   on success, sender's input `Holding` is archived and new `Holding` contracts are
   created for sender remainder and receiver amount (`TransferInstructionResult`
   = `Completed`).
5. If the receiver isn't allowlisted, the choice fails (`assertMsg`) and the
   frontend surfaces a compliance-specific error rather than a generic ledger
   rejection.

## Error handling

- Compliance failures (receiver not on `IdentityRegistry` allowlist) fail via
  `assertMsg` with a distinct message, shown as a readable compliance error in the
  UI (not a generic "transaction failed").
- Insufficient-balance transfers fail via `assertMsg` on the `Holding` amount check.
- Wallet-connect failures (LocalNet not reachable) show a "start LocalNet" message
  in the UI rather than a raw network error.

## Testing

- `daml test` (Daml Script) scenarios:
  - Minting increases the receiver's holding balance.
  - Transfer between two allowlisted parties moves the correct balance.
  - Transfer to a non-allowlisted party fails with the compliance error.
  - Transfer of more than the available balance fails.
- No frontend test automation in PoC scope — manual walkthrough (connect → mint →
  transfer) is the acceptance check.
