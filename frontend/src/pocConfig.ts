// Generated from scripts/bootstrap/output/poc-config.json — re-run
// `npm run bootstrap` in scripts/bootstrap and update this file if LocalNet
// is reset (bootstrapped contract ids and the admin party do not survive
// a LocalNet restart with a fresh volume).
export const POC_CONFIG = {
    packageId: '66950e160a445d00a4c1cd66c40474803549037f9c8e9d09784289b8de225ad5',
    adminPartyId: 'poc-admin::12208dd91f9d46145969b3f1003871a1898f4fcdb63d635bf7741b728dab1e8c4142',
    adminPublicKey: 'Y0kb7gRCmk9wbLqTTUVsEDin1InmrFrSUfSbyn3qwuI=',
    adminPrivateKey: '13O/CtwegrFUcWswTkQ+UemzsdhGnBt+JJsqnt1Li7xjSRvuBEKaT3BsupNNRWwQOKfUieasWtJR9JvKferC4g==',
    instrumentId: { admin: 'poc-admin::12208dd91f9d46145969b3f1003871a1898f4fcdb63d635bf7741b728dab1e8c4142', id: 'POC' },
    identityRegistryCid: '004b2173c0f508306dbf1f7445d74bafdc34d674a379ccae838b4699445663425cca12122032e10d7e4b18072972f4547d04d32a808a5c5896ce5ad637a0bf4eee3f77f582',
    issuerCid: '005f7e636f159f02e4432151f192ce491dfe1d9ab8eae9bfee4e031878d7700575ca121220a9025cb53e1f545d0724baac0cc6dfe652dbcb01d7ebd0109619506d4fa221f5',
    transferFactoryCid: '004dda4d18b6fbd40c5475ea0cc49962a14c390253972225324253d537b7b5f966ca121220bd569fd3ddaf8e800c078864dc4f669786be81c5ed6ea75a4c488faf0ea772c6',
} as const
