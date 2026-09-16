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
    identityRegistryCid: '00c0ec66aa32083a0aebf47261762beea5a41e520764b6ae097aa6c79d552377b6ca12122043d4f6c74d064a66f63a7a1b0a906df03a5273b95dfd8bc2b2f5fceac145db65',
    issuerCid: '003b81d38d8d426062668ab474335090ad66bf1227428c48c4f2ed45ec73f5bd63ca121220b0579f430af09c11c2b5f4e3c1f1d51e922800789c4bdca2ae28de70c668a3fb',
    transferFactoryCid: '000027d8005b19f116dba6b81b04bceb181a97714fc8088b2db697afe67dae9ddeca121220fa77863154cf04c840de77295230ada9deaf2b0ae980e0e8ab766c18eb490532',
} as const
