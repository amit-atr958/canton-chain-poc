import { useState } from 'react'
import { getSdk } from '../sdk'
import { POC_CONFIG } from '../pocConfig'
import { listHoldings } from '../holdings'
import { describeLedgerError, isComplianceRejection } from '../errors'
import type { ConnectedWallet } from '../wallet'

type Props = {
    sender: ConnectedWallet
    receiver: ConnectedWallet
    onTransferred: () => void
}

// Our DAR's data-dependencies (daml/vendor/*.dar) are LocalNet's OWN bundled
// copies of the Splice token-standard packages (extracted from the `splice`
// container's /app/splice-node/dars/ and vendored verbatim -- see
// scripts/vendor-token-standard.sh and the Task 9 investigation in the SDD
// ledger), not separately-fetched copies. This means our
// splice-api-token-transfer-instruction-v1 dependency has the EXACT SAME
// package-id LocalNet already vets natively, so the plain name-based
// templateId resolves correctly with no ambiguity -- exactly what a real
// CIP-0056-aware wallet would use, with no hardcoded package-id needed.
// (An earlier attempt vendored a separately-fetched copy of this package,
// which got a different hash than LocalNet's -- Canton refuses to vet two
// packages under the same name+version, so that copy could never be vetted,
// and every TransferFactory_Transfer exercise failed with
// UNRESOLVED_PACKAGE_NAME during interpretation. Re-vendoring LocalNet's own
// copy fixed it.)
const TRANSFER_FACTORY_INTERFACE_TEMPLATE_ID =
    '#splice-api-token-transfer-instruction-v1:Splice.Api.Token.TransferInstructionV1:TransferFactory'

export function TransferToken({ sender, receiver, onTransferred }: Props) {
    const [amount, setAmount] = useState('40')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleTransfer() {
        const senderPrivateKey = sender.privateKey
        if (!senderPrivateKey) {
            setError(
                "Transfer failed: sender is connected via Console Wallet, which can't co-sign this PoC's custom TransferFactory choice. Connect the sender with a local key instead."
            )
            return
        }
        setBusy(true)
        setError(null)
        try {
            const sdk = await getSdk()
            const holdings = await listHoldings(sender.partyId)
            if (holdings.length === 0) throw new Error('sender has no holdings to transfer')

            // TokenTransferFactory (daml/src/Transfer.daml) has `signatory admin`
            // and no observer, so it is not visible to the sender party, who is
            // not a stakeholder of it. The sender's own prepare/execute call
            // therefore cannot see this contract unless we explicitly disclose
            // it. We read it here as the admin (query-only -- this only needs
            // `parties: [POC_CONFIG.adminPartyId]` in the ACS query, not admin's
            // signature) and pass its {contractId, templateId, createdEventBlob,
            // synchronizerId} through `disclosedContracts` on the sender's
            // prepared transaction. The wallet-sdk's ACS reader always requests
            // includeCreatedEventBlob: true (see core-acs-reader's
            // readJsContractsWith), so createdEventBlob should already be
            // present here without an extra call.
            const factoryContracts = await sdk.ledger.acsReader.readJsContracts({
                templateIds: ['#canton-token-poc:Transfer:TokenTransferFactory'],
                parties: [POC_CONFIG.adminPartyId],
                filterByParty: true,
            })

            const factoryContract = (
                factoryContracts as Array<{
                    contractId: string
                    templateId: string
                    createdEventBlob?: string
                    synchronizerId?: string
                }>
            ).find((c) => c.contractId === POC_CONFIG.transferFactoryCid)
            if (!factoryContract) {
                throw new Error('TokenTransferFactory contract not found in admin ACS query')
            }
            if (!factoryContract.createdEventBlob) {
                throw new Error('TokenTransferFactory contract is missing createdEventBlob for disclosure')
            }

            const disclosedContracts = [
                {
                    contractId: factoryContract.contractId as string,
                    templateId: factoryContract.templateId as string,
                    createdEventBlob: factoryContract.createdEventBlob as string,
                    synchronizerId: factoryContract.synchronizerId as string | undefined,
                },
            ]

            const now = new Date()
            const requestedAt = new Date(now.getTime() - 1000).toISOString()
            const executeBefore = new Date(now.getTime() + 60 * 60 * 1000).toISOString()

            await sdk.ledger
                .prepare({
                    partyId: sender.partyId,
                    commands: [
                        {
                            ExerciseCommand: {
                                templateId: TRANSFER_FACTORY_INTERFACE_TEMPLATE_ID,
                                contractId: POC_CONFIG.transferFactoryCid,
                                choice: 'TransferFactory_Transfer',
                                choiceArgument: {
                                    expectedAdmin: POC_CONFIG.adminPartyId,
                                    transfer: {
                                        sender: sender.partyId,
                                        receiver: receiver.partyId,
                                        amount,
                                        instrumentId: POC_CONFIG.instrumentId,
                                        requestedAt,
                                        executeBefore,
                                        inputHoldingCids: holdings.map((h) => h.contractId),
                                        meta: { values: {} },
                                    },
                                    extraArgs: {
                                        context: { values: {} },
                                        meta: { values: {} },
                                    },
                                },
                            },
                        },
                    ],
                    disclosedContracts,
                })
                .sign(senderPrivateKey)
                .execute({ partyId: sender.partyId })

            onTransferred()
        } catch (err) {
            setError(
                isComplianceRejection(err)
                    ? `Transfer failed: receiver is not allowlisted. Run: cd scripts/bootstrap && npm run allow -- ${receiver.partyId}`
                    : `Transfer failed: ${describeLedgerError(err)}`
            )
        } finally {
            setBusy(false)
        }
    }

    return (
        <div>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} />
            <button onClick={handleTransfer} disabled={busy || !sender.privateKey}>
                {busy ? 'Transferring…' : `Transfer to ${receiver.partyId.slice(0, 12)}…`}
            </button>
            {!sender.privateKey && (
                <p style={{ color: '#666' }}>
                    Sender is connected via Console Wallet and can't sign transfers in this PoC.
                </p>
            )}
            {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
    )
}
