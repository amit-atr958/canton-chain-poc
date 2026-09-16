import { useState } from 'react'
import { connectWallet, type ConnectedWallet } from '../wallet'

type Props = {
    label: string
    wallet: ConnectedWallet | null
    onConnected: (wallet: ConnectedWallet) => void
}

export function ConnectWallet({ label, wallet, onConnected }: Props) {
    const [connecting, setConnecting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleConnect() {
        setConnecting(true)
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
            setConnecting(false)
        }
    }

    if (wallet) {
        return (
            <div>
                <strong>{label}</strong>: connected as <code>{wallet.partyId}</code>
            </div>
        )
    }

    return (
        <div>
            <button onClick={handleConnect} disabled={connecting}>
                {connecting ? 'Connecting…' : `Connect ${label} Wallet`}
            </button>
            {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
    )
}
