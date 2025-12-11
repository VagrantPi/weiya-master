import { useWallet } from '../../hooks/useWallet';

export function ConnectWalletButton() {
  const {
    snapStatus,
    isSnapLoading,
    snapError,
    connectSnap,
    disconnectSnap,
    currentAddress,
    network,
    isConnected,
  } = useWallet();

  const shortAddress =
    currentAddress && currentAddress.length > 12
      ? `${currentAddress.slice(0, 6)}...${currentAddress.slice(-4)}`
      : currentAddress;

  const handleClick = async () => {
    if (isConnected) {
      await disconnectSnap();
      return;
    }
    await connectSnap();
  };

  let label = 'Connect IOTA Snap';
  if (snapStatus === 'NOT_INSTALLED') {
    label = 'Install IOTA Snap';
  } else if (snapStatus === 'INSTALLED') {
    label = 'Connect IOTA Snap';
  } else if (snapStatus === 'CONNECTED') {
    label = shortAddress ? `Connected: ${shortAddress}` : 'Connected';
  } else if (snapStatus === 'ERROR') {
    label = 'Open MetaMask';
  }

  return (
    <div className="wallet-btn-wrapper">
      <button
        type="button"
        className="btn-primary"
        onClick={handleClick}
        disabled={isSnapLoading}
      >
        {isSnapLoading ? '連線中...' : label}
      </button>
      <div className="wallet-btn-meta">
        <span className="wallet-network-label">Network</span>
        <span className="wallet-network-value">{network}</span>
      </div>
      {snapError ? (
        <p className="wallet-error-text">錢包錯誤：{snapError}</p>
      ) : null}
    </div>
  );
}

