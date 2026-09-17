import { useState } from 'react'
import { connectWallet, type ConnectedWallet } from '../wallet'
import { connectConsoleWallet } from '../consoleWallet'

type Props = {
    label: string
    wallet: ConnectedWallet | null
    onConnected: (wallet: ConnectedWallet) => void
}

const CONSOLE_WALLET_STORE_URL =
    'https://chromewebstore.google.com/detail/console-wallet/lpnfhpbpmlobjlgkdmnjieeihjmihhjd'

export function ConnectWallet({ label, wallet, onConnected }: Props) {
    const [connecting, setConnecting] = useState<'local' | 'console-wallet' | null>(null)
    const [error, setError] = useState<string | null>(null)

    async function handleConnectLocal() {
        setConnecting('local')
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
            setConnecting(null)
        }
    }

    async function handleConnectConsoleWallet() {
        setConnecting('console-wallet')
        setError(null)
        try {
            const connected = await connectConsoleWallet()
            onConnected(connected)
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setConnecting(null)
        }
    }

    if (wallet) {
        return (
            <div>
                <strong>{label}</strong>: connected as <code>{wallet.partyId}</code>
                {wallet.source === 'console-wallet' && (
                    <span> (Console Wallet — receive-only in this PoC, see below)</span>
                )}
            </div>
        )
    }

    return (
        <div>
            <button onClick={handleConnectLocal} disabled={connecting !== null}>
                {connecting === 'local' ? 'Connecting…' : `Connect ${label} Wallet (local key)`}
            </button>{' '}
            <button onClick={handleConnectConsoleWallet} disabled={connecting !== null}>
                {connecting === 'console-wallet' ? 'Connecting…' : 'Connect with Console Wallet'}
            </button>
            {error && (
                <p style={{ color: 'red' }}>
                    {error}{' '}
                    {error.includes('not detected') && (
                        <a href={CONSOLE_WALLET_STORE_URL} target="_blank" rel="noreferrer">
                            Get Console Wallet
                        </a>
                    )}
                </p>
            )}
            <p style={{ fontSize: '0.85em', color: '#666' }}>
                A Console Wallet-connected party has a real self-custodial key held in the
                extension, not this app — it can be minted to and receive transfers, but it
                can't be the sender in this PoC's Transfer step (the extension has no way to
                co-sign our custom TransferFactory choice; see frontend/src/consoleWallet.ts).
            </p>
        </div>
    )
}
