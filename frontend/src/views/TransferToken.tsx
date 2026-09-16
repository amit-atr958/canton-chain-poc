import { useState } from 'react'
import { getSdk } from '../sdk'
import { POC_CONFIG } from '../pocConfig'
import { listHoldings } from '../holdings'
import type { ConnectedWallet } from '../wallet'

type Props = {
    sender: ConnectedWallet
    receiver: ConnectedWallet
    onTransferred: () => void
}

// Our own uploaded DAR vendors its own copy of the
// splice-api-token-transfer-instruction-v1 package. LocalNet also ships its
// own built-in copy of a package with the exact same name
// (splice-api-token-transfer-instruction-v1), under a *different*
// package-id, as part of its own Splice/token-standard installation. A
// name-based templateId reference (`#splice-api-token-transfer-instruction-v1:...`)
// resolves to whichever package is vetted under that name, which is
// LocalNet's built-in one -- not ours -- and our TokenTransferFactory's
// interface instance only implements our own vendored copy. So we must
// reference our copy by its exact package-id (extracted via
// `dpm damlc inspect-dar` on our built DAR) instead of by name.
const TRANSFER_FACTORY_INTERFACE_TEMPLATE_ID =
    'b665908a9e885680fa4126b5644197547417e5f29e85bff162c26e4e6e67d0a8:Splice.Api.Token.TransferInstructionV1:TransferFactory'

export function TransferToken({ sender, receiver, onTransferred }: Props) {
    const [amount, setAmount] = useState('40')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleTransfer() {
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

            // Uncomment to verify the live response shape against a running
            // LocalNet instance -- see task-9-report.md for why this is still
            // unverified in this environment:
            // console.log('factoryContracts raw result', JSON.stringify(factoryContracts))

            const factoryContract = (factoryContracts as any[]).find(
                (c) => c.contractId === POC_CONFIG.transferFactoryCid
            )
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
                .sign(sender.privateKey)
                .execute({ partyId: sender.partyId })

            onTransferred()
        } catch (err) {
            setError(
                err instanceof Error
                    ? `Transfer failed: ${err.message} (is the receiver allowlisted?)`
                    : String(err)
            )
        } finally {
            setBusy(false)
        }
    }

    return (
        <div>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} />
            <button onClick={handleTransfer} disabled={busy}>
                {busy ? 'Transferring…' : `Transfer to ${receiver.partyId.slice(0, 12)}…`}
            </button>
            {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
    )
}
