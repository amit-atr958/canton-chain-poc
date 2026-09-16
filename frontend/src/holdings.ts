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

    // readJsContracts() already returns flattened JS contract objects with
    // contractId/createArgument at the top level -- there is no
    // `.JsActiveContract.createdEvent` wrapper on this path (see the same
    // correction documented in scripts/bootstrap/src/bootstrap.ts, verified
    // against @canton-network/core-acs-reader's base.d.ts readJsContracts()
    // return type).
    return contracts.map((created: any) => {
        return {
            contractId: created.contractId,
            owner: created.createArgument.owner,
            amount: created.createArgument.amount,
        }
    })
}
