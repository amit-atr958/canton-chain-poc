// Generated from scripts/bootstrap/output/poc-config.json — re-run
// `npm run bootstrap` in scripts/bootstrap and update this file if LocalNet
// is reset (bootstrapped contract ids and the admin party do not survive
// a LocalNet restart with a fresh volume).
export const POC_CONFIG = {
    packageId: '66950e160a445d00a4c1cd66c40474803549037f9c8e9d09784289b8de225ad5',
    adminPartyId: 'poc-admin::1220ec30ca193dafdaa1d10a440c32f357d1ceccec38d0d7591be5e60fbd58ef2e4a',
    adminPublicKey: 'PtnH9KfM9n2GTW5pvLfy0lbScvqluCbiGZqTiFbuI+M=',
    adminPrivateKey: 'vzbWSyCTXbwnZns+BGjU+SDSfWwr50xrfhMfnx7G+As+2cf0p8z2fYZNbmm8t/LSVtJy+qW4JuIZmpOIVu4j4w==',
    instrumentId: { admin: 'poc-admin::1220ec30ca193dafdaa1d10a440c32f357d1ceccec38d0d7591be5e60fbd58ef2e4a', id: 'POC' },
    identityRegistryCid: '007632e350c6124bf860727b8c77079da0c772a46f9523888baf6b89f7cc249df5ca121220f2c4e23697fe2bf89ed66e00ff8ee1696b1a5a1d8bddb28daa5fcfe30adc1d3f',
    issuerCid: '001670517e35a052377016eebaac14e3fe2d62a73608ff8e61e616bd9e9d4ccccdca121220d4011d1244e570ae37a0bc70f1a95c7c2bddcc470c3b8bb40dc53ce42e32be2a',
    transferFactoryCid: '00199c0f96458418170e617e7035fb4b936d8cdf589ed466b7e28bf1f86fd8b59fca121220bfda04687e2205cf57edb837481a34c8a16763f2341a2cdbba807e74702a73e0',
} as const
