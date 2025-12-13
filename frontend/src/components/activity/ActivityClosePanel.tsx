import type { FC } from 'react';
import { formatIota } from '../../utils/iotaUnits';

interface ActivityDetailView {
  id: string;
  organizer: string;
  name: string;
  status: 'OPEN' | 'CLOSED';
  closePayoutAmount: bigint;
  remainingPoolAfterClose: bigint;
}

interface ParticipantStatus {
  isJoined: boolean;
  participantObjectId?: string;
  hasClaimedCloseReward: boolean;
}

interface ActivityClosePanelProps {
  activity: ActivityDetailView;
  isOrganizer: boolean;
  participantStatus: ParticipantStatus;
  closeOps: {
    closeActivity: () => Promise<void>;
    claimCloseReward: (participantObjectId: string) => Promise<void>;
    withdrawRemainingAfterClose: () => Promise<void>;
    isClosing: boolean;
    isClaiming: boolean;
    isWithdrawing: boolean;
  };
  onRefresh: () => Promise<void>;
}

export const ActivityClosePanel: FC<ActivityClosePanelProps> = ({
  activity,
  isOrganizer,
  participantStatus,
  closeOps,
  onRefresh,
}) => {
  const handleCloseActivity = async () => {
    await closeOps.closeActivity();
    await onRefresh();
  };

  const handleWithdrawRemaining = async () => {
    await closeOps.withdrawRemainingAfterClose();
    await onRefresh();
  };

  const handleClaimCloseReward = async () => {
    if (!participantStatus.participantObjectId) return;
    await closeOps.claimCloseReward(participantStatus.participantObjectId);
    await onRefresh();
  };

  const canClaimCloseReward =
    activity.status === 'CLOSED' &&
    participantStatus.isJoined &&
    activity.closePayoutAmount > 0n &&
    !participantStatus.hasClaimedCloseReward &&
    participantStatus.participantObjectId;

  const canWithdrawRemaining =
    activity.status === 'CLOSED' && activity.remainingPoolAfterClose > 0n;

  return (
    <section className="card section activity-panel">
      <h2 className="section-title">Close &amp; Settlement</h2>
      <p className="section-description">
        活動結束後，合約會計算所有參加者的平均結算獎金，主辦可領回剩餘獎金。
      </p>

      <div className="section-grid">
        <div className="section-item">
          <span className="meta-label">活動狀態</span>
          <span className="meta-value">
            {activity.status === 'OPEN' ? 'OPEN' : 'CLOSED'}
          </span>
        </div>
        <div className="section-item">
          <span className="meta-label">每人結算獎金</span>
          <span className="meta-value">
            {formatIota(activity.closePayoutAmount)} IOTA
          </span>
        </div>
        <div className="section-item">
          <span className="meta-label">剩餘獎金池</span>
          <span className="meta-value">
            {formatIota(activity.remainingPoolAfterClose)} IOTA
          </span>
        </div>
      </div>

      {isOrganizer ? (
        <div className="section-actions">
          {activity.status === 'OPEN' ? (
            <button
              type="button"
              className="btn"
              onClick={handleCloseActivity}
              disabled={closeOps.isClosing}
            >
              {closeOps.isClosing ? '關閉中...' : '關閉活動並計算平均獎金'}
            </button>
          ) : null}

          {activity.status === 'CLOSED' && canWithdrawRemaining ? (
            <button
              type="button"
              className="btn"
              onClick={handleWithdrawRemaining}
              disabled={closeOps.isWithdrawing}
            >
              {closeOps.isWithdrawing ? '領回中...' : '領回剩餘獎金'}
            </button>
          ) : null}
        </div>
      ) : null}

      {!isOrganizer ? (
        <div className="section-actions">
          {activity.status !== 'CLOSED' ? (
            <p className="card-text">
              活動尚未關閉，關閉後若有平均分配獎金，可在此領取。
            </p>
          ) : canClaimCloseReward ? (
            <button
              type="button"
              className="btn"
              onClick={handleClaimCloseReward}
              disabled={closeOps.isClaiming}
            >
              {closeOps.isClaiming ? '領取中...' : '領取活動結算獎金'}
            </button>
          ) : participantStatus.hasClaimedCloseReward ? (
            <p className="card-text">你已領取過結算獎金。</p>
          ) : activity.closePayoutAmount === 0n ? (
            <p className="card-text">本活動無結算獎金。</p>
          ) : (
            <p className="card-text">目前沒有可領取的結算獎金。</p>
          )}
        </div>
      ) : null}
    </section>
  );
};
