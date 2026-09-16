import { useEffect, useState } from 'react'
import { listHoldings, type HoldingSummary } from '../holdings'

type Props = { partyId: string; refreshKey: number }

export function Holdings({ partyId, refreshKey }: Props) {
    const [holdings, setHoldings] = useState<HoldingSummary[]>([])
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        listHoldings(partyId)
            .then(setHoldings)
            .catch((err) => setError(err instanceof Error ? err.message : String(err)))
    }, [partyId, refreshKey])

    const total = holdings.reduce((sum, h) => sum + Number(h.amount), 0)

    return (
        <div>
            <p>Balance: {total}</p>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <ul>
                {holdings.map((h) => (
                    <li key={h.contractId}>
                        {h.amount} (contract {h.contractId.slice(0, 12)}…)
                    </li>
                ))}
            </ul>
        </div>
    )
}
