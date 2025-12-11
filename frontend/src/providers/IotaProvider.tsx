import type { PropsWithChildren } from 'react';
import type { NetworkConfig } from '@iota/dapp-kit';
import { IotaClientProvider } from '@iota/dapp-kit';

import { DEFAULT_NETWORK, NETWORK_CONFIG } from '../config/iota';
import { WalletProvider } from '../contexts/WalletContext';

const IOTA_NETWORKS: Record<string, NetworkConfig> = {
  [DEFAULT_NETWORK]: {
    url: NETWORK_CONFIG[DEFAULT_NETWORK].rpcUrl,
  },
};

export function IotaProvider({ children }: PropsWithChildren) {
  return (
    <IotaClientProvider networks={IOTA_NETWORKS} defaultNetwork={DEFAULT_NETWORK}>
      <WalletProvider>{children}</WalletProvider>
    </IotaClientProvider>
  );
}
