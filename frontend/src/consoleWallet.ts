import { consoleWallet } from '@console-wallet/dapp-sdk'
import type { ConnectedWallet } from './wallet'

// Real bridge to the "Console Wallet" browser extension
// (https://chromewebstore.google.com/detail/console-wallet/lpnfhpbpmlobjlgkdmnjieeihjmihhjd),
// via @console-wallet/dapp-sdk's window.postMessage transport (CIP-0103).
//
// Signing/submission methods in this SDK (submitCommands, signBatch,
// prepareExecute, ledgerApi) are typed to CANTON_NETWORK_VARIANTS, a fixed
// enum of DevNet/TestNet/MainNet with no LocalNet option, and only cover
// sending Canton Coin / CIP-56 coins -- there's no way for a dApp to hand
// this extension an arbitrary prepared Daml transaction to co-sign. So a
// Console Wallet party connected here can be used as a real party (e.g. as
// a Mint recipient, or a Transfer receiver, both signed by someone else),
// but it cannot be the *sender* of a Transfer in this PoC, since that
// requires signing with a private key this app never has access to.

export async function isConsoleWalletInstalled(): Promise<boolean> {
    const availability = await consoleWallet.checkExtensionAvailability()
    return availability.status === 'installed'
}

export async function connectConsoleWallet(): Promise<ConnectedWallet> {
    const availability = await consoleWallet.checkExtensionAvailability()
    if (availability.status !== 'installed') {
        throw new Error(
            'Console Wallet extension not detected. Install it from the Chrome Web Store, then reload this page.'
        )
    }

    const status = await consoleWallet.connect({ name: 'Canton Token PoC', target: 'local' })
    if (!status.isConnected) {
        throw new Error(status.reason ?? 'Console Wallet connection was rejected')
    }

    const account = await consoleWallet.getPrimaryAccount()
    if (!account) {
        throw new Error('Console Wallet reported connected but has no active account')
    }

    return {
        partyId: account.partyId,
        publicKey: account.publicKey,
        source: 'console-wallet',
    }
}

export async function disconnectConsoleWallet(): Promise<void> {
    await consoleWallet.disconnect()
}
