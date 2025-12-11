import {
  createContext,
  type PropsWithChildren,
  type ReactNode,
  useContext,
  useMemo,
} from 'react';
import { useCurrentAccount, useIotaClientContext } from '@iota/dapp-kit';

import { useIotaSnap } from '../wallet/useIotaSnap';
import type { SnapStatus } from '../wallet/snapConfig';

export interface WalletContextValue {
  snapStatus: SnapStatus;
  isSnapLoading: boolean;
  snapError: string | null;
  connectSnap: () => Promise<void>;
  disconnectSnap: () => Promise<void>;

  currentAccount: ReturnType<typeof useCurrentAccount> | null;
  currentAddress: string;

  isReady: boolean;

  network: string;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: PropsWithChildren<ReactNode>) {
  const {
    status,
    isLoading,
    error,
    connectSnap,
    disconnectSnap,
    currentAccount: snapAccount,
  } = useIotaSnap();

  const dappKitAccount = useCurrentAccount();
  const { network } = useIotaClientContext();

  const currentAddress =
    dappKitAccount?.address ?? snapAccount?.iotaAddress ?? '';

  const isReady = status === 'CONNECTED' && Boolean(currentAddress);

  const value: WalletContextValue = useMemo(
    () => ({
      snapStatus: status,
      isSnapLoading: isLoading,
      snapError: error,
      connectSnap,
      disconnectSnap,
      currentAccount: dappKitAccount ?? null,
      currentAddress,
      isReady,
      network,
    }),
    [
      connectSnap,
      currentAddress,
      dappKitAccount,
      disconnectSnap,
      error,
      isLoading,
      isReady,
      network,
      status,
    ],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export const useWalletContext = () => {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error('useWalletContext 必須在 WalletProvider 內使用');
  }
  return ctx;
};

