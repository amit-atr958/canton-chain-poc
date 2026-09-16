import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { SDK } from '@canton-network/wallet-sdk'
import { AuthTokenProvider } from '@canton-network/core-wallet-auth'
import { AUTH_CONFIG, LEDGER_URL } from './config.js'

// Extracted via `dpm damlc inspect-dar daml/.daml/dist/canton-token-poc-1.0.0.dar`
// (Step 2 of the task brief) — the main package id of the canton-token-poc DAR.
// Changed after daml/vendor/*.dar was replaced with LocalNet's own bundled
// copies of the token-standard dependency packages (see Task 9 investigation
// in the SDD ledger) -- rebuilding against them changes our own package hash.
const PACKAGE_ID = 'a5b380b6ad7836ef07dc9eff7c22cdf56ece19c3154909b3957d79bb0642c1ad'
const here = path.dirname(fileURLToPath(import.meta.url))
const DAR_PATH = path.join(here, '../../../daml/.daml/dist/canton-token-poc-1.0.0.dar')
const OUTPUT_PATH = path.join(here, '../output/poc-config.json')

// Extracts the created contract's id from an ACSReader.readJsContracts() result.
// The wallet-sdk's readJsContracts() (as opposed to the lower-level, deprecated
// ledger.acs.read()) already returns flattened JS contract objects with
// `contractId` at the top level -- there is no `.JsActiveContract.createdEvent`
// wrapper on this path. (The task-6 brief assumed the wrapped shape; verified
// against @canton-network/core-acs-reader@1.5.1's base.d.ts readJsContracts()
// return type, which is a flat object carrying contractId/templateId/etc.
// directly.)
function contractIdOf(contracts: Array<{ contractId: string }>, label: string): string {
    const first = contracts[0]
    if (!first || !first.contractId) {
        throw new Error(`Expected at least one ${label} contract in the ACS, found: ${JSON.stringify(contracts)}`)
    }
    return first.contractId
}

// LocalNet ships with its own (already-vetted) copies of the Splice
// token-standard packages (splice-api-token-holding-v1, etc). Our DAR vendors
// its own copies of those same dependency packages (see daml/vendor/), which
// -- despite matching name+version -- hash differently from LocalNet's copies.
// Canton refuses to vet two different packages under the same name+version, so
// `sdk.ledger.dar.upload()`'s automatic "vet everything in the DAR" step fails
// with a swallowed KNOWN_PACKAGE_VERSION error on those *dependency* packages,
// silently leaving our *own* canton-token-poc package unvetted too (verified
// by querying POST /v2/package-vetting/list before/after: canton-token-poc
// never showed up as vetted after dar.upload() alone).
//
// The fix: explicitly vet only our own package by id via
// POST /v2/package-vetting/update, which the wallet-sdk does not wrap. We
// never need to (and do not attempt to) vet the vendored dependency packages
// themselves -- our bootstrap commands only ever reference canton-token-poc's
// own templates by top-level templateId, and dependency packages just need to
// be present in the package store (which dar.upload() already guarantees),
// not separately vetted.
async function vetOwnPackage(packageId: string): Promise<void> {
    const tokenProvider = new AuthTokenProvider(AUTH_CONFIG, console)
    const accessToken = await tokenProvider.getAccessToken()

    const response = await fetch(new URL('v2/package-vetting/update', LEDGER_URL), {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            changes: [
                {
                    operation: {
                        Vet: {
                            value: {
                                packages: [{ packageId }],
                            },
                        },
                    },
                },
            ],
        }),
    })

    if (!response.ok) {
        throw new Error(`Failed to vet package ${packageId}: ${response.status} ${await response.text()}`)
    }
}

async function main() {
    const sdk = await SDK.create({ auth: AUTH_CONFIG, ledgerClientUrl: LEDGER_URL })

    // 1. Upload the compiled DAR (includes the vendored token-standard
    //    dependency packages, since data-dependencies are inlined at build time).
    const darBytes = await readFile(DAR_PATH)
    await sdk.ledger.dar.upload(darBytes, PACKAGE_ID)
    await vetOwnPackage(PACKAGE_ID)

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

    const registryCid = contractIdOf(registryContracts, 'IdentityRegistry')
    const issuerCid = contractIdOf(issuerContracts, 'TokenIssuer')

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
    const transferFactoryCid = contractIdOf(factoryContracts, 'TokenTransferFactory')

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
