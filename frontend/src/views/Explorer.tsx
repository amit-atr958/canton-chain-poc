import { useState } from 'react'
import { getSdk } from '../sdk'
import { describeLedgerError } from '../errors'

type Props = { partyId: string; label: string }

type ContractSummary = {
    contractId: string
    templateId: string
    createArgument: unknown
}

// A minimal in-app "explorer": Canton is privacy-preserving, so there is no
// public block explorer that could show every party's activity the way
// Etherscan does for Ethereum -- a party can only ever see contracts it is
// a stakeholder of. This lists exactly that (every active contract visible
// to the given party, not just TokenHolding), which is the closest honest
// analogue: "what does this wallet currently hold and see on the ledger".
export function Explorer({ partyId, label }: Props) {
    const [contracts, setContracts] = useState<ContractSummary[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [expanded, setExpanded] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    async function loadContracts() {
        setLoading(true)
        setError(null)
        try {
            const sdk = await getSdk()
            // readJsContracts()/the underlying AcsService has no "all templates"
            // wildcard option -- passing filterByParty:true with no templateIds
            // builds an EMPTY cumulative filter, which the v2 Ledger API treats as
            // "match nothing" rather than "match everything" (confirmed by reading
            // @canton-network/core-acs-reader's buildActiveContractFilter: it only
            // ever emits TemplateFilter/InterfaceFilter entries, never a
            // WildcardFilter one). So list every template this app actually
            // creates that names an external party as a stakeholder -- within
            // this PoC's scope that's the full set of what any connected wallet
            // could see anyway (Canton's privacy model means a party never sees
            // contracts it isn't a stakeholder of, regardless of what we ask for).
            const result = await sdk.ledger.acsReader.readJsContracts({
                templateIds: [
                    '#canton-token-poc:Token:TokenHolding',
                    '#canton-token-poc:Compliance:IdentityRegistry',
                ],
                parties: [partyId],
                filterByParty: true,
            })
            // Querying multiple templateIds in one call can return the same
            // contract more than once (observed: a single TokenHolding listed
            // twice) -- dedupe by contractId defensively, since a contract can
            // only exist once on the ledger regardless of how many filter
            // clauses matched it.
            const byContractId = new Map<string, ContractSummary>()
            for (const c of result as ContractSummary[]) {
                byContractId.set(c.contractId, {
                    contractId: c.contractId,
                    templateId: c.templateId,
                    createArgument: c.createArgument,
                })
            }
            setContracts([...byContractId.values()])
        } catch (err) {
            setError(describeLedgerError(err))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ marginTop: 8, fontSize: 14 }}>
            <button onClick={loadContracts} disabled={loading}>
                {loading ? 'Loading…' : contracts === null ? `Explore ${label}'s contracts` : 'Refresh'}
            </button>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            {contracts !== null && (
                <>
                    <p style={{ color: '#666', margin: '4px 0' }}>
                        {contracts.length} contract{contracts.length === 1 ? '' : 's'} visible to this party
                    </p>
                    <ul style={{ paddingLeft: 16 }}>
                        {contracts.map((c) => {
                            const shortTemplate = c.templateId.split(':').slice(1).join(':') || c.templateId
                            const isOpen = expanded === c.contractId
                            return (
                                <li key={c.contractId} style={{ marginBottom: 4 }}>
                                    <button
                                        onClick={() => setExpanded(isOpen ? null : c.contractId)}
                                        style={{ fontFamily: 'monospace', fontSize: 13, textAlign: 'left' }}
                                    >
                                        {isOpen ? '▾' : '▸'} {shortTemplate} — {c.contractId.slice(0, 16)}…
                                    </button>
                                    {isOpen && (
                                        <pre
                                            style={{
                                                fontSize: 12,
                                                background: '#f5f5f5',
                                                padding: 8,
                                                overflowX: 'auto',
                                                maxWidth: 640,
                                            }}
                                        >
                                            {JSON.stringify(
                                                { contractId: c.contractId, templateId: c.templateId, createArgument: c.createArgument },
                                                null,
                                                2
                                            )}
                                        </pre>
                                    )}
                                </li>
                            )
                        })}
                    </ul>
                </>
            )}
        </div>
    )
}
