import { useState } from 'react'
import { getSdk } from '../sdk'
import { POC_CONFIG } from '../pocConfig'
import { describeLedgerError, isComplianceRejection } from '../errors'
import type { ConnectedWallet } from '../wallet'

type Props = {
    recipient: ConnectedWallet
    onMinted: () => void
}

export function MintToken({ recipient, onMinted }: Props) {
    const [amount, setAmount] = useState('100')
    const [minting, setMinting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleMint() {
        setMinting(true)
        setError(null)
        try {
            const sdk = await getSdk()
            await sdk.ledger
                .prepare({
                    partyId: POC_CONFIG.adminPartyId,
                    commands: [
                        {
                            ExerciseCommand: {
                                templateId: `#canton-token-poc:Token:TokenIssuer`,
                                contractId: POC_CONFIG.issuerCid,
                                choice: 'Issue',
                                choiceArgument: {
                                    to: recipient.partyId,
                                    amount,
                                    identityRegistryCid: POC_CONFIG.identityRegistryCid,
                                },
                            },
                        },
                    ],
                    disclosedContracts: [],
                })
                .sign(POC_CONFIG.adminPrivateKey)
                .execute({ partyId: POC_CONFIG.adminPartyId })

            onMinted()
        } catch (err) {
            setError(
                isComplianceRejection(err)
                    ? `Mint failed: recipient is not allowlisted. Run: cd scripts/bootstrap && npm run allow -- ${recipient.partyId}`
                    : `Mint failed: ${describeLedgerError(err)}`
            )
        } finally {
            setMinting(false)
        }
    }

    return (
        <div>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} />
            <button onClick={handleMint} disabled={minting}>
                {minting ? 'Minting…' : 'Mint to Sender'}
            </button>
            {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
    )
}
