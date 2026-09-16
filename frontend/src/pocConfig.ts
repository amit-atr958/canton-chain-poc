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
    identityRegistryCid: '0037b94b35cca440abec258cccf192a07455ab8f7e19d607dca75e1afef4e39ff9ca121220aef9ea5a53877f7727aefc125c04d1f707b27a4c661d9cef2b20c4a18815c03a',
    issuerCid: '00b5facb82b3889e028d47ccb3f70cd3b242cfe16ad7570efcf425931d44ba738bca121220e638e1782bbcefb93e019e8abc46e43534078df8f50a70b88e38212204d8dfa4',
    transferFactoryCid: '00a828c8aa34eac0270f4ed38978fe282a1f66b6c9ed178f67fa6014fb9d6f6a8dca1212204389b55e24bb2115da8d9ebf74471be6d9a45f8447e79049ed013e9a3211c18a',
} as const
