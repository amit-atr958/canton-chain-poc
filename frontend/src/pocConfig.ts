// Generated from scripts/bootstrap/output/poc-config.json — re-run
// `npm run bootstrap` in scripts/bootstrap and update this file if LocalNet
// is reset (bootstrapped contract ids and the admin party do not survive
// a LocalNet restart with a fresh volume).
export const POC_CONFIG = {
    packageId: 'a5b380b6ad7836ef07dc9eff7c22cdf56ece19c3154909b3957d79bb0642c1ad',
    adminPartyId: 'poc-admin::12200a3ac31990206cf5292cbd9ecfda42a869b95c742d1ddd77f98ea7f39195e521',
    adminPublicKey: '5tsACRdaUyZuXCsANE9qEEidmQeiXGiPnHZ8abxWQO0=',
    adminPrivateKey: 'dQTbzeZKeXYaA0/MOb4dDTVCMvuKLSVvoz/jDWYKYW7m2wAJF1pTJm5cKwA0T2oQSJ2ZB6JcaI+cdnxpvFZA7Q==',
    instrumentId: { admin: 'poc-admin::12200a3ac31990206cf5292cbd9ecfda42a869b95c742d1ddd77f98ea7f39195e521', id: 'POC' },
    identityRegistryCid: '00cbf7ab475527e31eadde4e1b8ab8e2c42b4638e38f1155ce375246029bba4515ca1212200805d361b7c9757c2b04c25dea4f2af2d0b0adc4893fc94bae42c8d5b3cb7613',
    issuerCid: '003b81d38d8d426062668ab474335090ad66bf1227428c48c4f2ed45ec73f5bd63ca121220b0579f430af09c11c2b5f4e3c1f1d51e922800789c4bdca2ae28de70c668a3fb',
    transferFactoryCid: '00261cd91b49c9958671370a7a05bf0ec8893a0f6d5786deb2b157f883421d0b17ca12122095209c2867d618f8a65ac01c3e8d45dd8dd743d0b80baca151c38c6748f56ed7',
} as const
