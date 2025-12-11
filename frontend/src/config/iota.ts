export const SUPPORTED_NETWORKS = ['devnet'] as const;

export type SupportedNetwork = (typeof SUPPORTED_NETWORKS)[number];

export const DEFAULT_NETWORK: SupportedNetwork = 'devnet';

export interface NetworkConfigEntry {
  key: SupportedNetwork;
  rpcUrl: string;
  faucetUrl?: string;
  explorerBaseUrl?: string;
}

export const NETWORK_CONFIG: Record<SupportedNetwork, NetworkConfigEntry> = {
  devnet: {
    key: 'devnet',
    rpcUrl: import.meta.env.VITE_IOTA_RPC_URL ?? 'http://localhost:1769',
    faucetUrl: import.meta.env.VITE_IOTA_FAUCET_URL,
    explorerBaseUrl: import.meta.env.VITE_IOTA_EXPLORER_URL,
  },
};

export const ANNUAL_PARTY_PACKAGE_ID =
  '0x43572924a0b39b6509737f93365c5eac9cf2718fe6bdd312281face6fcbeebb7';

