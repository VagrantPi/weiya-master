import { useCallback, useMemo } from 'react';
import {
  useCurrentAccount,
  useCurrentWallet,
  useWallets,
  useConnectWallet,
  useDisconnectWallet,
  useIotaClientContext,
} from '@iota/dapp-kit';
import { registerIotaSnapWallet } from '@liquidlink-lab/iota-snap-for-metamask';
import type { WalletAccount } from '@iota/wallet-standard';

type UseWalletConnectionResult = {
  currentAccount: WalletAccount | null;
  currentAddress: string;
  network: string;
  isConnected: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  isConnecting: boolean;
  error: Error | null;
};

export function useWalletConnection(): UseWalletConnectionResult {
  const currentAccount = useCurrentAccount();
  const { network } = useIotaClientContext();
  const wallets = useWallets();
  const { isConnected, isConnecting } = useCurrentWallet();

  const connectMutation = useConnectWallet();
  const disconnectMutation = useDisconnectWallet();

  const currentAddress = currentAccount?.address ?? '';

  const snapWallet = useMemo(
    () => wallets.find((wallet) => wallet.name === 'IOTA MetaMask Snap') ?? registerIotaSnapWallet(),
    [wallets],
  );

  const connectWallet = useCallback(async () => {
    if (!snapWallet) {
      throw new Error('MetaMask IOTA Snap 未安裝或不可用');
    }
    await connectMutation.mutateAsync({ wallet: snapWallet });
  }, [connectMutation, snapWallet]);

  const disconnectWallet = useCallback(async () => {
    if (!isConnected) return;
    await disconnectMutation.mutateAsync();
  }, [disconnectMutation, isConnected]);

  const mergedError = (connectMutation.error ?? disconnectMutation.error) ?? null;

  return {
    currentAccount,
    currentAddress,
    network,
    isConnected,
    connectWallet,
    disconnectWallet,
    isConnecting: isConnecting || connectMutation.isPending || disconnectMutation.isPending,
    error: mergedError,
  };
}

