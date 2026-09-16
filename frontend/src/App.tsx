import { useState } from 'react'
import { ConnectWallet } from './views/ConnectWallet'
import { MintToken } from './views/MintToken'
import { Holdings } from './views/Holdings'
import type { ConnectedWallet } from './wallet'

export function App() {
    const [walletA, setWalletA] = useState<ConnectedWallet | null>(null)
    const [walletB, setWalletB] = useState<ConnectedWallet | null>(null)
    const [refreshKey, setRefreshKey] = useState(0)

    return (
        <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
            <h1>Canton Token PoC</h1>
            <section>
                <h2>1. Connect Wallets</h2>
                <ConnectWallet label="Sender" wallet={walletA} onConnected={setWalletA} />
                <ConnectWallet label="Receiver" wallet={walletB} onConnected={setWalletB} />
            </section>

            {walletA && (
                <section>
                    <h2>2. Mint</h2>
                    <MintToken recipient={walletA} onMinted={() => setRefreshKey((k) => k + 1)} />
                    <Holdings partyId={walletA.partyId} refreshKey={refreshKey} />
                </section>
            )}
        </div>
    )
}
