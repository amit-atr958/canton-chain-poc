import { readFile, writeFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { SDK } from '@canton-network/wallet-sdk'
import { AUTH_CONFIG, LEDGER_URL } from './config.js'

// TokenTransferFactory.identityRegistryCid (daml/src/Transfer.daml) is a
// create-time-only field -- there is no update choice for it. Daml contracts
// are immutable, so every IdentityRegistry_Allow/Revoke (see allow-party.ts)
// archives the old registry contract and creates a new one, which leaves any
// existing TokenTransferFactory referencing an archived contract:
// `assertAllowlisted` in TransferFactory_Transfer then fails to `fetch` it,
// unrelated to whether the receiver is actually allowlisted. Run this
// whenever a transfer manual-verification hits that (or, defensively, after
// any allow-party.ts run) to recreate the factory against the CURRENT
// registry and update output/poc-config.json accordingly.

const here = path.dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = path.join(here, '../output/poc-config.json')

async function main() {
    const config = JSON.parse(await readFile(CONFIG_PATH, 'utf8'))
    const sdk = await SDK.create({ auth: AUTH_CONFIG, ledgerClientUrl: LEDGER_URL })

    const registryContracts = await sdk.ledger.acsReader.readJsContracts({
        templateIds: [`#canton-token-poc:Compliance:IdentityRegistry`],
        parties: [config.adminPartyId],
        filterByParty: true,
    })
    const currentRegistryCid = registryContracts[0]?.contractId
    if (!currentRegistryCid) throw new Error('No active IdentityRegistry contract found for the admin party')
    console.log('Current registry cid:', currentRegistryCid)

    await sdk.ledger
        .prepare({
            partyId: config.adminPartyId,
            commands: [
                {
                    CreateCommand: {
                        templateId: `#canton-token-poc:Transfer:TokenTransferFactory`,
                        createArguments: { admin: config.adminPartyId, identityRegistryCid: currentRegistryCid },
                    },
                },
            ],
            disclosedContracts: [],
        })
        .sign(config.adminPrivateKey)
        .execute({ partyId: config.adminPartyId })

    const factoryContracts = await sdk.ledger.acsReader.readJsContracts({
        templateIds: [`#canton-token-poc:Transfer:TokenTransferFactory`],
        parties: [config.adminPartyId],
        filterByParty: true,
    })
    const fresh = factoryContracts.find(
        (c: { createArgument?: { identityRegistryCid?: string } }) =>
            c.createArgument?.identityRegistryCid === currentRegistryCid
    )
    if (!fresh) throw new Error('Could not find freshly created TokenTransferFactory with the current registryCid')
    console.log('New TokenTransferFactory cid:', fresh.contractId)

    config.identityRegistryCid = currentRegistryCid
    config.transferFactoryCid = fresh.contractId
    await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2))
    console.log('Updated', CONFIG_PATH)
    console.log(
        "Update frontend/src/pocConfig.ts's identityRegistryCid and transferFactoryCid to these values."
    )
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
