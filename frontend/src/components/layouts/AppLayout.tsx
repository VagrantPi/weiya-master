import { Outlet, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ConnectButton } from '@iota/dapp-kit';

import { useWallet } from '../../hooks/useWallet';

export function AppLayout() {
  const navigate = useNavigate();
  const { currentAddress } = useWallet();

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
            <span className="pill-label">Account</span>
            <span className="pill-value">
              {shortAddress || 'Disconnected'}
            </span>
          </div>
          <ConnectButton />
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <Toaster richColors position="top-right" />
    </div>
  );
}
