import type { FC } from 'react';
import { useState } from 'react';
import { formatIota } from '../../utils/iotaUnits';

interface ActivityDetailView {
  id: string;
  organizer: string;
  name: string;
  status: 'OPEN' | 'CLOSED';
  prizePoolAmount: bigint;
  participantCount: number;
  hasBonusEvent: boolean;
  bonusAmountPerUser: bigint;
}

interface ParticipantStatus {
  isJoined: boolean;
  participantObjectId?: string;
  hasClaimedBonus: boolean;
}

interface ActivityBonusPanelProps {
  activity: ActivityDetailView;
  participantStatus: ParticipantStatus;
  isOrganizer: boolean;
  bonusOps: {
    createBonusEvent: (bonusPerUser: bigint) => Promise<void>;
    claimBonus: (participantObjectId: string) => Promise<void>;
    isCreatingBonus: boolean;
    isClaimingBonus: boolean;
  };
  onRefresh: () => Promise<void>;
}

export const ActivityBonusPanel: FC<ActivityBonusPanelProps> = ({
  activity,
  participantStatus,
  isOrganizer,
  bonusOps,
  onRefresh,
}) => {
  const [bonusInput, setBonusInput] = useState(
    activity.bonusAmountPerUser.toString(),
  );

  const canCreateBonus =
    isOrganizer &&
    activity.status === 'OPEN' &&
    !activity.hasBonusEvent &&
    activity.participantCount > 0;

  const canClaimBonus =
    activity.hasBonusEvent &&
    participantStatus.isJoined &&
    !participantStatus.hasClaimedBonus &&
    Boolean(participantStatus.participantObjectId);

  const handleCreateBonus = async () => {
    if (!canCreateBonus) return;
    const amount = BigInt(bonusInput || '0');
    await bonusOps.createBonusEvent(amount);
    await onRefresh();
  };

  const handleClaimBonus = async () => {
    if (!canClaimBonus || !participantStatus.participantObjectId) return;
    await bonusOps.claimBonus(participantStatus.participantObjectId);
    await onRefresh();
  };

  return (
    <section className="card section activity-panel">
      <h2 className="section-title">參加獎 Bonus</h2>

      <div className="section-grid">
        <div className="section-item">
          <span className="meta-label">每人參加獎金額</span>
          <span className="meta-value">
            {formatIota(activity.bonusAmountPerUser)} IOTA
          </span>
        </div>
      </div>

      {isOrganizer ? (
        <div className="section-actions">
          {canCreateBonus ? (
            <div className="field-row">
              <label className="field-label" htmlFor="bonusPerUserInput">
                每人參加獎金額
              </label>
              <input
                id="bonusPerUserInput"
                className="field-input"
                value={bonusInput}
                onChange={(e) => setBonusInput(e.target.value)}
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCreateBonus}
                disabled={bonusOps.isCreatingBonus}
              >
                {bonusOps.isCreatingBonus ? '建立中...' : '建立參加獎事件'}
              </button>
            </div>
          ) : (
            <p className="card-text">
              只有在活動開啟且已有參加者、尚未建立參加獎時才能建立。
            </p>
          )}
        </div>
      ) : null}

      {!isOrganizer ? (
        <div className="section-actions">
          {participantStatus.isJoined ? (
            canClaimBonus ? (
              <button
                type="button"
                className="btn-primary"
                onClick={handleClaimBonus}
                disabled={bonusOps.isClaimingBonus}
              >
                {bonusOps.isClaimingBonus ? '領取中...' : '領取參加獎'}
              </button>
            ) : participantStatus.hasClaimedBonus ? (
              <p className="card-text">你已領取過參加獎。</p>
            ) : activity.hasBonusEvent ? (
              <p className="card-text">目前沒有可領取的參加獎。</p>
            ) : (
              <p className="card-text">主辦尚未建立參加獎事件。</p>
            )
          ) : (
            <p className="card-text">請先加入活動才能領取參加獎。</p>
          )}
        </div>
      ) : null}
    </section>
  );
};
