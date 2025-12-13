import { getFullnodeUrl } from '@iota/iota-sdk/client';

export const SUPPORTED_NETWORKS = ['testnet'] as const;

export type SupportedNetwork = (typeof SUPPORTED_NETWORKS)[number];

export const DEFAULT_NETWORK: SupportedNetwork = 'testnet';

export const IS_DEBUG_MODE = false;

export interface NetworkConfigEntry {
  key: SupportedNetwork;
  rpcUrl: string;
  faucetUrl?: string;
  explorerBaseUrl?: string;
}

export const NETWORK_CONFIG: Record<SupportedNetwork, NetworkConfigEntry> = {
  testnet: {
    key: 'testnet',
    rpcUrl:
      import.meta.env.VITE_IOTA_RPC_URL ??
      getFullnodeUrl('testnet'),
    faucetUrl: import.meta.env.VITE_IOTA_FAUCET_URL,
    explorerBaseUrl: import.meta.env.VITE_IOTA_EXPLORER_URL,
  },
};

export const ANNUAL_PARTY_PACKAGE_ID =
  '0x8afa9d387ab7f4b6e3c9a7f9af7469f5591b5bff02761e887e7c21918d73aaa1';
