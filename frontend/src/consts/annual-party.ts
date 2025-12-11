import type { Network } from '@iota/iota-sdk/client';

export interface AnnualPartyConfig {
  packageId: string;
  module: string;
  randomObjectId: string;
}

// 年會 DApp 套件與模組設定（依網路區分）
export const ANNUAL_PARTY: Record<string, AnnualPartyConfig> = {
  testnet: {
    packageId:
      '0x43572924a0b39b6509737f93365c5eac9cf2718fe6bdd312281face6fcbeebb7',
    module: 'annual_party',
    randomObjectId: '0x6',
  },
  devnet: {
    packageId:
      '0x43572924a0b39b6509737f93365c5eac9cf2718fe6bdd312281face6fcbeebb7',
    module: 'annual_party',
    randomObjectId: '0x6',
  },
};

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

export const getLotteryType = (network: Network | string | undefined) => {
  const { packageId, module } = getAnnualPartyConfig(network);
  return `${packageId}::${module}::Lottery`;
};
