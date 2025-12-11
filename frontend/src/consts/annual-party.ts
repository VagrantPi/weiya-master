import type { Network } from '@iota/iota-sdk/client';

// 年會 DApp 套件與模組設定（依網路區分）
export const ANNUAL_PARTY = {
  testnet: {
    packageId:
      '0x43572924a0b39b6509737f93365c5eac9cf2718fe6bdd312281face6fcbeebb7',
    module: 'annual_party',
  },
  devnet: {
    packageId:
      '0x43572924a0b39b6509737f93365c5eac9cf2718fe6bdd312281face6fcbeebb7',
    module: 'annual_party',
  },
} as const;

export const IOTA_COIN_TYPE = '0x2::iota::IOTA';

export const getAnnualPartyConfig = (network: Network | string | undefined) => {
  const key = (network ?? 'testnet') as keyof typeof ANNUAL_PARTY;
  return ANNUAL_PARTY[key] ?? ANNUAL_PARTY.testnet;
};

export const getActivityType = (network: Network | string | undefined) => {
  const { packageId, module } = getAnnualPartyConfig(network);
  return `${packageId}::${module}::Activity`;
};

export const getParticipantType = (network: Network | string | undefined) => {
  const { packageId, module } = getAnnualPartyConfig(network);
  return `${packageId}::${module}::Participant`;
};
