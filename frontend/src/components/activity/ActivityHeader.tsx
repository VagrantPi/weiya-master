import type { FC } from 'react';
import QRCodeModule from 'react-qr-code';

// react-qr-code 在不同打包模式下可能以 default 或 named 匯出，這裡統一處理
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const QRCode = (QRCodeModule as any).default ?? QRCodeModule;

const ensureTrailingSlash = (value: string) =>
  value.endsWith('/') ? value : `${value}/`;

interface ActivityDetailView {
  id: string;
  organizer: string;
  name: string;
  status: 'OPEN' | 'CLOSED';
  prizePoolAmount: bigint;
  participantCount: number;
  hasBonusEvent: boolean;
  bonusAmountPerUser: bigint;
  closePayoutAmount: bigint;
  remainingPoolAfterClose: bigint;
}

interface ParticipantStatus {
  isJoined: boolean;
  participantObjectId?: string;
  hasClaimedBonus: boolean;
  hasClaimedCloseReward: boolean;
}

interface ActivityHeaderProps {
  activity: ActivityDetailView;
  participantStatus: ParticipantStatus;
  isOrganizer: boolean;
  isJoining: boolean;
  onJoin: () => Promise<void>;
}

export const ActivityHeader: FC<ActivityHeaderProps> = ({
  activity,
  participantStatus,
  isOrganizer,
  isJoining,
  onJoin,
}) => {
  const canJoin =
    !isOrganizer && !participantStatus.isJoined && activity.status === 'OPEN';

  const handleJoin = () => {
    if (!canJoin || isJoining) return;
    void onJoin();
  };

  const appBaseUrl = ensureTrailingSlash(
    (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim() ||
      `${window.location.origin}${import.meta.env.BASE_URL}`,
  );
  const participantUrl = new URL(`activities/${activity.id}`, appBaseUrl).toString();

  return (
    <header className="card section activity-header">
      <div className="activity-header-main">
        <h1 className="page-title">{activity.name}</h1>
        {isOrganizer ? (
          <div className="activity-header-qr">
            <p className="card-text" style={{ marginBottom: '0.5rem' }}>
              掃描 QRCode 可在其他裝置開啟此活動參與頁面。
            </p>
            <div
              style={{
                display: 'inline-block',
                padding: '0.75rem',
                background: '#ffffff',
                borderRadius: '0.75rem',
              }}
            >
              <QRCode
                value={participantUrl}
                size={140}
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>
            <div
              style={{
                marginTop: '0.75rem',
                display: 'flex',
                gap: '0.5rem',
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <a
                className="mono"
                href={participantUrl}
                target="_blank"
                rel="noreferrer"
              >
                {participantUrl}
              </a>
            </div>
          </div>
        ) : null}
      </div>

      <div className="activity-header-actions">
        {participantStatus.isJoined ? (
          <span className="status-tag status-open">已加入活動</span>
        ) : null}

        {canJoin ? (
          <button
            type="button"
            className="btn-primary"
            onClick={handleJoin}
            disabled={isJoining}
          >
            {isJoining ? '加入中...' : '加入活動'}
          </button>
        ) : null}
      </div>
    </header>
  );
};
