import { getSdk } from './sdk'

export type ConnectedWallet = {
    partyId: string
    publicKey: string
    // Only set for locally-generated wallets. A Console Wallet-connected
    // party's private key never leaves the extension, so this app can sign
    // on that party's behalf only when this is present (see TransferToken's
    // sender-signing requirement).
    privateKey?: string
    source: 'local' | 'console-wallet'
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
        source: 'local',
    }
}
