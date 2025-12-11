import { useWalletConnection } from '../../hooks/useWalletConnection';

export function WalletDebugPanel() {
  const {
    currentAddress,
    network,
    isConnected,
    connectWallet,
    disconnectWallet,
    isConnecting,
    error,
  } = useWalletConnection();

  return (
    <div>
      <h2>Wallet Debug</h2>
      <p>Connected: {isConnected ? 'Yes' : 'No'}</p>
      <p>Address: {currentAddress || '-'}</p>
      <p>Network: {network}</p>
      {error ? <p>錯誤：{error.message}</p> : null}
      <button onClick={connectWallet} disabled={isConnecting}>
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </button>
      <button onClick={disconnectWallet}>Disconnect</button>
    </div>
  );
}

