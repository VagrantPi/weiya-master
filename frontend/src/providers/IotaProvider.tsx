import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import type { NetworkConfig } from '@iota/dapp-kit';
import { IotaClientProvider, WalletProvider } from '@iota/dapp-kit';
import { registerIotaSnapWallet } from '@liquidlink-lab/iota-snap-for-metamask';

const IOTA_NETWORKS: Record<string, NetworkConfig> = {
  devnet: {
    url: import.meta.env.VITE_IOTA_RPC_URL ?? 'http://localhost:1769',
  },
};

export function IotaProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    registerIotaSnapWallet();
  }, []);

  return (
    <IotaClientProvider networks={IOTA_NETWORKS} defaultNetwork="devnet">
      <WalletProvider autoConnect chain="iota:devnet">
        {children}
      </WalletProvider>
    </IotaClientProvider>
  );
}

