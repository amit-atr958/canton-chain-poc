// Generated from scripts/bootstrap/output/poc-config.json — re-run
// `npm run bootstrap` in scripts/bootstrap and update this file if LocalNet
// is reset (bootstrapped contract ids and the admin party do not survive
// a LocalNet restart with a fresh volume).
export const POC_CONFIG = {
    packageId: 'a5b380b6ad7836ef07dc9eff7c22cdf56ece19c3154909b3957d79bb0642c1ad',
    adminPartyId: 'poc-admin::1220ee3ce8a0ec50174cb8e06bfb5d2ea63fdda519c03d3ff4162ea2daf9c6e3ca63',
    adminPublicKey: '671uJmIm5PhOE/Jf0CRSepDsAzntM4K1RUEhQvBSa1M=',
    adminPrivateKey: 'fEON5hUChaHxiGrc44RDtE8/C4NZuWXTXw+m2BjtyW7rvW4mYibk+E4T8l/QJFJ6kOwDOe0zgrVFQSFC8FJrUw==',
    instrumentId: { admin: 'poc-admin::1220ee3ce8a0ec50174cb8e06bfb5d2ea63fdda519c03d3ff4162ea2daf9c6e3ca63', id: 'POC' },
    identityRegistryCid: '00e41a06539c5be6cd063279f820377ef38cdcc01f090471b21c4f4ace9742eb3fca12122092192bf18977fb20934fe313cab624a97cc0710816cc6356825f856bed5afeef',
    issuerCid: '0026bb359189f7f3b6c54c793e395c54f3d9aad3e43efc471da1f80fcf19e34381ca121220c7d38122046892b38465646763da19f7ed760bf2d66e0290636d5598b4bd5731',
    transferFactoryCid: '00b9b9cfc5a826947165ed1aec494b539e0fb5f57752e47ea4222b9b537b774e43ca121220abc1fd9a47619c8d75a0a55fd8ca6f29e0dd2bfc41fe19d9c79ec069efa65d35',
} as const
