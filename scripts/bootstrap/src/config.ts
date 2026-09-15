import { localNetStaticConfig, TokenProviderConfig } from '@canton-network/wallet-sdk'

export const AUTH_CONFIG: TokenProviderConfig = {
    method: 'self_signed',
    issuer: 'unsafe-auth',
    credentials: {
        clientId: localNetStaticConfig.LOCALNET_USER_ID,
        clientSecret: 'unsafe',
        audience: 'https://canton.network.global',
        scope: '',
    },
}

export const LEDGER_URL = localNetStaticConfig.LOCALNET_APP_USER_LEDGER_URL
