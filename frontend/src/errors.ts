// The wallet-sdk's ledger errors are plain objects (e.g.
// {code: 'DAML_FAILURE', cause: 'Interpretation error: ...', ...}), not
// Error instances -- `err instanceof Error` is false for them, so the
// naive `String(err)` fallback renders as the useless "[object Object]".
// This extracts the actual message wherever it lives.
export function describeLedgerError(err: unknown): string {
    if (err instanceof Error) return err.message
    if (err && typeof err === 'object') {
        const cause = (err as { cause?: unknown }).cause
        if (typeof cause === 'string' && cause.length > 0) return cause
        try {
            return JSON.stringify(err)
        } catch {
            // fall through
        }
    }
    return String(err)
}

// Distinguishes the specific IdentityRegistry compliance rejection
// (Compliance.daml's assertAllowlisted) from every other failure, so the UI
// can show a targeted, actionable hint only when it's actually relevant --
// not on every error (e.g. insufficient balance, stale contract ids).
export function isComplianceRejection(err: unknown): boolean {
    return describeLedgerError(err).includes('is not allowlisted by the identity registry')
}
