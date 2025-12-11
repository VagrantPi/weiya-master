import { useWalletContext } from '../contexts/WalletContext';

export const useWallet = () => {
  const ctx = useWalletContext();

  const {
    snapStatus,
    isSnapLoading,
    snapError,
    connectSnap,
    disconnectSnap,
    currentAccount,
    currentAddress,
    isReady,
    network,
  } = ctx;

  return {
    snapStatus,
    isSnapLoading,
    snapError,
    connectSnap,
    disconnectSnap,
    currentAccount,
    currentAddress,
    isReady,
    network,
    isConnected: isReady,
    isSnapInstalled: snapStatus === 'INSTALLED' || snapStatus === 'CONNECTED',
  };
};

