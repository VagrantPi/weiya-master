import { useNavigate } from 'react-router-dom';

import { useWalletConnection } from '../hooks/useWalletConnection';

export function LandingPage() {
  const navigate = useNavigate();
  const { currentAddress, isConnected } = useWalletConnection();

  return (
    <div className="page-container">
      <div className="page-grid">
        <section className="card card-main">
          <h1 className="page-title">IOTA Annual Party Lottery</h1>
          <p className="page-subtitle">
            去中心化尾牙活動：活動、抽獎、四選一遊戲與分紅，全都在 IOTA Move
            鏈上完成。
          </p>
          <div className="page-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => navigate('/organizer')}
            >
              我是主辦（Organizer Dashboard）
            </button>
          </div>
          <div className="page-note">
            <h2>員工如何參加？</h2>
            <p>
              主辦會在活動現場提供 QRCode，掃描後即會導向
              <code className="inline-code">/party/:activityId</code>
              ，在手機上完成加入活動、領取參加獎、參與樂透與遊戲等流程。
            </p>
          </div>
        </section>
        <section className="card card-side">
          <h2 className="card-title">目前錢包狀態</h2>
          <p className="card-text">
            {isConnected
              ? `已連線，地址：${currentAddress || '-'}`
              : '尚未連線 IOTA Snap + MetaMask，請先在右上角連線。'}
          </p>
        </section>
      </div>
    </div>
  );
}

