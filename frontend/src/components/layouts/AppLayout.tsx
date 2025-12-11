import { Outlet, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';

import { useWalletConnection } from '../../hooks/useWalletConnection';

export function AppLayout() {
  const navigate = useNavigate();
  const {
    currentAddress,
    network,
    isConnected,
    connectWallet,
    disconnectWallet,
    isConnecting,
  } = useWalletConnection();

  const shortAddress =
    currentAddress && currentAddress.length > 12
      ? `${currentAddress.slice(0, 6)}...${currentAddress.slice(-4)}`
      : currentAddress;

  return (
    <div className="app-root">
      <div className="app-bg" />
      <header className="app-navbar">
        <button
          type="button"
          className="app-logo"
          onClick={() => navigate('/')}
        >
          <span className="app-logo-main">IOTA Annual Party</span>
          <span className="app-logo-sub">Cyber Lottery DApp</span>
        </button>
        <div className="app-navbar-right">
          <div className="app-navbar-pill">
            <span className="pill-label">Network</span>
            <span className="pill-value">{network || 'unknown'}</span>
          </div>
          <div className="app-navbar-pill">
            <span className="pill-label">Account</span>
            <span className="pill-value">
              {shortAddress || (isConnected ? 'N/A' : 'Disconnected')}
            </span>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={isConnected ? disconnectWallet : connectWallet}
            disabled={isConnecting}
          >
            {isConnecting
              ? '連線中...'
              : isConnected
                ? 'Disconnect IOTA Snap'
                : 'Connect IOTA Snap'}
          </button>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <Toaster richColors position="top-right" />
    </div>
  );
}

