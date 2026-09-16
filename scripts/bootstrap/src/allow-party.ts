import { readFile, writeFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { SDK } from '@canton-network/wallet-sdk'
import { AUTH_CONFIG, LEDGER_URL } from './config.js'

// Allowlists a party on the PoC's IdentityRegistry so it can receive mints
// and transfers. Needed after every `Connect Wallet` click in the frontend:
// each click allocates a brand-new external party (a fresh keypair, hence a
// structurally new party id), which the compliance allowlist rejects by
// default -- only the admin itself is allowlisted by `bootstrap.ts`. This is
// the ERC-3643-style admin approval step working as designed, not a bug.
//
// Looks up the *current* IdentityRegistry contract id via the ACS rather
// than trusting output/poc-config.json's cached value, because Allow/Revoke
// archives the old registry contract and creates a new one (Daml contracts
// are immutable) -- poc-config.json's identityRegistryCid goes stale after
// the very first Allow.

const here = path.dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = path.join(here, '../output/poc-config.json')

async function main() {
    const party = process.argv[2]
    if (!party) {
        console.error('usage: npm run allow -- <partyId>')
        process.exit(1)
    }

    const config = JSON.parse(await readFile(CONFIG_PATH, 'utf8'))
    const sdk = await SDK.create({ auth: AUTH_CONFIG, ledgerClientUrl: LEDGER_URL })

    const registryContracts = await sdk.ledger.acsReader.readJsContracts({
        templateIds: [`#canton-token-poc:Compliance:IdentityRegistry`],
        parties: [config.adminPartyId],
        filterByParty: true,
    })
    const currentRegistryCid = registryContracts[0]?.contractId
    if (!currentRegistryCid) {
        throw new Error('No active IdentityRegistry contract found for the admin party')
    }

    await sdk.ledger
        .prepare({
            partyId: config.adminPartyId,
            commands: [
                {
                    ExerciseCommand: {
                        templateId: `#canton-token-poc:Compliance:IdentityRegistry`,
                        contractId: currentRegistryCid,
                        choice: 'IdentityRegistry_Allow',
                        choiceArgument: { party },
                    },
                },
            ],
            disclosedContracts: [],
        })
        .sign(config.adminPrivateKey)
        .execute({ partyId: config.adminPartyId })

    const after = await sdk.ledger.acsReader.readJsContracts({
        templateIds: [`#canton-token-poc:Compliance:IdentityRegistry`],
        parties: [config.adminPartyId],
        filterByParty: true,
    })
    const newRegistryCid = after[0]?.contractId
    console.log(`Allowed ${party}`)
    console.log('New IdentityRegistry contract id:', newRegistryCid)

    config.identityRegistryCid = newRegistryCid
    await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2))
    console.log('Updated', CONFIG_PATH)
    console.log("Update frontend/src/pocConfig.ts's identityRegistryCid to this value.")
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
