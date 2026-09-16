import { SDK, localNetStaticConfig, type TokenProviderConfig } from '@canton-network/wallet-sdk'

const AUTH_CONFIG: TokenProviderConfig = {
    method: 'self_signed',
    issuer: 'unsafe-auth',
    credentials: {
        clientId: localNetStaticConfig.LOCALNET_USER_ID,
        clientSecret: 'unsafe',
        audience: 'https://canton.network.global',
        scope: '',
    },
}

// LocalNet's raw participant JSON Ledger API (localNetStaticConfig.LOCALNET_APP_USER_LEDGER_URL,
// http://localhost:2975) sends no CORS headers at all, so a browser can't call it directly.
// LocalNet's nginx also proxies the same API at json-ledger-api.localhost on the app-user UI
// port with CORS headers added (see conf/nginx/app-user.conf) - that's the one a frontend must use.
const BROWSER_LEDGER_URL = new URL('http://json-ledger-api.localhost:2000')

let sdkPromise: ReturnType<typeof SDK.create> | undefined

export function getSdk() {
    if (!sdkPromise) {
        sdkPromise = SDK.create({
            auth: AUTH_CONFIG,
            ledgerClientUrl: BROWSER_LEDGER_URL,
        })
    }
    return sdkPromise
}
