// Generated from scripts/bootstrap/output/poc-config.json — re-run
// `npm run bootstrap` in scripts/bootstrap and update this file if LocalNet
// is reset (bootstrapped contract ids and the admin party do not survive
// a LocalNet restart with a fresh volume).
export const POC_CONFIG = {
    packageId: 'a5b380b6ad7836ef07dc9eff7c22cdf56ece19c3154909b3957d79bb0642c1ad',
    adminPartyId: 'poc-admin::122072941f9a7e7c642733d18b0dba57096ca374dda80863cbc774797469ece38292',
    adminPublicKey: 'abfALKBOs37PeuFg7nFf71whNdphBdAgb3UYkfTVSjQ=',
    adminPrivateKey: 'IFvxOlwkJ8/RfMn7mQFD8/180WiqlVIyr0mddDAJE2ppt8AsoE6zfs964WDucV/vXCE12mEF0CBvdRiR9NVKNA==',
    instrumentId: { admin: 'poc-admin::122072941f9a7e7c642733d18b0dba57096ca374dda80863cbc774797469ece38292', id: 'POC' },
    identityRegistryCid: '00e223566d1c73310f15d86b144767d4ef138fcfcdcaf49dacff2146e0f412d26cca1212201522f8678c054acec22bd9a800a2bd19e4d1dd6d49fd303df0ee0ddd2dfb5277',
    issuerCid: '002941dc9346b3ce5fa3466f3419eb38437d255767dbaa486df4940d6b751bfe7dca12122005b8b714ee526c9f26c1cab250f9ac495c40ff511b9ec9ea1a8b4e4573b27c5b',
    transferFactoryCid: '00843cf6ff0928868185ae0bd04cc08925d9a95ad78a66434a2098a60b5e91291dca121220dd5b51cd76a0c0b624c70fd08a3d5d67af9bfb4b4106f81c9eafb6fce546c4b5',
} as const
