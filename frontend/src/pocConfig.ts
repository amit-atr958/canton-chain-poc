// Generated from scripts/bootstrap/output/poc-config.json — re-run
// `npm run bootstrap` in scripts/bootstrap and update this file if LocalNet
// is reset (bootstrapped contract ids and the admin party do not survive
// a LocalNet restart with a fresh volume).
export const POC_CONFIG = {
    packageId: 'a5b380b6ad7836ef07dc9eff7c22cdf56ece19c3154909b3957d79bb0642c1ad',
    adminPartyId: 'poc-admin::122069bcbd58c9436d206929351a4e7a7adb297a9a41187a5f6b811de09096d25441',
    adminPublicKey: '6nl8PRzEw6GMdDzvR3EgtzSq7zlRU4f9rMdJlLAapPk=',
    adminPrivateKey: 'n/IssxPX6O/Zt8omRc95cZInAwV7GddXYrEzdVVmPDvqeXw9HMTDoYx0PO9HcSC3NKrvOVFTh/2sx0mUsBqk+Q==',
    instrumentId: { admin: 'poc-admin::122069bcbd58c9436d206929351a4e7a7adb297a9a41187a5f6b811de09096d25441', id: 'POC' },
    identityRegistryCid: '00d982ced764de2720feba72a7a5a26dbcb2ee031c9d36032434965f6bf71cbd18ca12122034c0fca91f4a2411a617f8c20de6358924a81160ec7d10d2103180e812744ac4',
    issuerCid: '00b5facb82b3889e028d47ccb3f70cd3b242cfe16ad7570efcf425931d44ba738bca121220e638e1782bbcefb93e019e8abc46e43534078df8f50a70b88e38212204d8dfa4',
    transferFactoryCid: '0017e6440bd06426b7b24a29a2b6976039154a4c364a5a988a3c1a4cc6146c958eca1212201cf63e15f7ba36ce8171e53bd01a6c042e527b70fad69e9aebfa001e8304bff5',
} as const
