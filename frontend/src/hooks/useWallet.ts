import {
  useCurrentAccount,
  useCurrentWallet,
  useIotaClientContext,
} from '@iota/dapp-kit';

export const useWallet = () => {
  const currentAccount = useCurrentAccount();
  const { network } = useIotaClientContext();
  const { isConnected } = useCurrentWallet();

  const currentAddress = currentAccount?.address ?? '';
  const isReady = isConnected && Boolean(currentAddress);

  return {
    snapStatus: isReady ? 'CONNECTED' : 'NOT_INSTALLED',
    isSnapLoading: false,
    snapError: null as string | null,
    connectSnap: async () => {},
    disconnectSnap: async () => {},
    currentAccount,
    currentAddress,
    isReady,
    network,
    isConnected,
    isSnapInstalled: isConnected,
  };
};

