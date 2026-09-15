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

let sdkPromise: ReturnType<typeof SDK.create> | undefined

export function getSdk() {
    if (!sdkPromise) {
        sdkPromise = SDK.create({
            auth: AUTH_CONFIG,
            ledgerClientUrl: localNetStaticConfig.LOCALNET_APP_USER_LEDGER_URL,
        })
    }
    return sdkPromise
}
