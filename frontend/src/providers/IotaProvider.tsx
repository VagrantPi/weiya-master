import { useEffect, type PropsWithChildren, type ReactNode } from 'react';
import type { NetworkConfig } from '@iota/dapp-kit';
import { IotaClientProvider, WalletProvider as DappKitWalletProvider } from '@iota/dapp-kit';
import { registerIotaSnapWallet } from '@liquidlink-lab/iota-snap-for-metamask';

import { DEFAULT_NETWORK, NETWORK_CONFIG } from '../config/iota';

const IOTA_NETWORKS: Record<string, NetworkConfig> = {
  [DEFAULT_NETWORK]: {
    url: NETWORK_CONFIG[DEFAULT_NETWORK].rpcUrl,
  },
};

export function IotaProvider({ children }: PropsWithChildren<{ children?: ReactNode }>) {
  useEffect(() => {
    registerIotaSnapWallet();
  }, []);

  return (
    <IotaClientProvider networks={IOTA_NETWORKS} defaultNetwork={DEFAULT_NETWORK}>
      <DappKitWalletProvider autoConnect chain={`iota:${DEFAULT_NETWORK}`}>
        {children}
      </DappKitWalletProvider>
    </IotaClientProvider>
  );
}
