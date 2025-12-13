import { Outlet, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ConnectButton } from '@iota/dapp-kit';

export function AppLayout() {
  const navigate = useNavigate();

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
