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
    identityRegistryCid: '006f817d97547c53b6dffeb286191e58e0d4892aea1e8589368e28054b89daa4a0ca121220fb003ac8ae4ef761c9409da64a5c1bc3dcb83449db089e7ff1c1c8f3f28fb4cd',
    issuerCid: '001670517e35a052377016eebaac14e3fe2d62a73608ff8e61e616bd9e9d4ccccdca121220d4011d1244e570ae37a0bc70f1a95c7c2bddcc470c3b8bb40dc53ce42e32be2a',
    transferFactoryCid: '00cf40cd5a6fb585c2af259827b7b9e6befb3b68bf107f6a15650b972066885586ca1212204f156675f3d2304893dc66d838f2ec044481730d28c976b9f7e9a5ab4da56394',
} as const
