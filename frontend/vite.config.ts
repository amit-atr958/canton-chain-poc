import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// The Web Crypto API (SubtleCrypto, used by the wallet-sdk's sdk.keys.generate()
// for Connect Wallet) is only available in a "secure context" -- HTTPS, or
// http://localhost specifically. Serving over plain http://<LAN-IP> (e.g. so
// a teammate on the same network can reach this dev server directly, without
// an SSH tunnel) breaks Connect Wallet with
// "Cannot read properties of undefined (reading 'importKey')", because
// `crypto.subtle` is simply undefined outside a secure context -- this is a
// browser security restriction, not a bug in this app or the SDK.
//
// If frontend/.certs/{cert,key}.pem exist (see scripts/generate-dev-cert.sh),
// serve over HTTPS with them instead, which satisfies the secure-context
// requirement for any origin, not just localhost. Optional: local-only,
// tunnel-based dev workflows don't need this and nothing changes for them.
const certPath = path.resolve(dirname, '.certs/cert.pem')
const keyPath = path.resolve(dirname, '.certs/key.pem')
const httpsConfig =
    existsSync(certPath) && existsSync(keyPath)
        ? { cert: readFileSync(certPath), key: readFileSync(keyPath) }
        : undefined

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        https: httpsConfig,
    },
})
