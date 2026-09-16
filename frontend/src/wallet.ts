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
