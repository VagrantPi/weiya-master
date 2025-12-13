import type { FC } from 'react';
import { formatIota } from '../../utils/iotaUnits';

interface ActivityDetailView {
  id: string;
  organizer: string;
  name: string;
  status: 'OPEN' | 'CLOSED';
  prizePoolAmount: bigint;
}

interface ParticipantStatus {
  isJoined: boolean;
}

interface LotteryViewForPanel {
  id: string;
  status: 'OPEN' | 'DRAWN' | 'CLOSED';
  potAmount: bigint;
  participantsCount: number;
  hasJoinedCurrentUser: boolean;
  winnerAddr?: string | null;
}

interface ActivityLotteryPanelProps {
  activity: ActivityDetailView;
  lottery: LotteryViewForPanel | null;
  isOrganizer: boolean;
  isConnected: boolean;
  currentAddress: string | null;
  lotteryOps: {
    createLottery: () => Promise<void>;
    joinLottery: (amount: bigint) => Promise<void>;
    executeLottery: () => Promise<void>;
    isCreating: boolean;
    isJoining: boolean;
    isExecuting: boolean;
  };
  participantStatus: ParticipantStatus;
  amountInput: string;
  onAmountChange: (v: string) => void;
  onRefresh: () => Promise<void>;
}

export const ActivityLotteryPanel: FC<ActivityLotteryPanelProps> = ({
  activity,
  lottery,
  isOrganizer,
  isConnected,
  currentAddress,
  lotteryOps,
  participantStatus,
  amountInput,
  onAmountChange,
  onRefresh,
}) => {
  const handleCreateLottery = async () => {
    await lotteryOps.createLottery();
    await onRefresh();
  };

  const handleJoinLottery = async () => {
    const amount = BigInt(amountInput || '0');
    if (amount <= 0n) return;
    await lotteryOps.joinLottery(amount);
    await onRefresh();
  };

  const handleExecuteLottery = async () => {
    await lotteryOps.executeLottery();
    await onRefresh();
  };

  const canParticipantJoin =
    isConnected &&
    participantStatus.isJoined &&
    lottery &&
    lottery.status === 'OPEN' &&
    !lottery.hasJoinedCurrentUser &&
    activity.status === 'OPEN';

  const winnerIsMe =
    lottery?.status === 'DRAWN' &&
    lottery.winnerAddr &&
    currentAddress &&
    lottery.winnerAddr.toLowerCase() === currentAddress.toLowerCase();

  return (
    <section className="card section activity-panel">
      <h2 className="section-title">Lottery</h2>
      <p className="section-description">
        在活動期間開啟單次樂透，參加者投入 IOTA，並由合約依亂數開獎產生單一得獎人。
      </p>

      <div className="section-grid">
        <div className="section-item">
          <span className="meta-label">狀態</span>
          <span className="meta-value">
            {lottery ? lottery.status : '尚未建立'}
          </span>
        </div>
        <div className="section-item">
          <span className="meta-label">獎金池</span>
          <span className="meta-value">
            {lottery ? formatIota(lottery.potAmount) : '0'} IOTA
          </span>
        </div>
        <div className="section-item">
          <span className="meta-label">參與人數</span>
          <span className="meta-value">
            {lottery ? lottery.participantsCount : 0}
          </span>
        </div>
        {lottery?.winnerAddr ? (
          <div className="section-item">
            <span className="meta-label">得獎地址</span>
            <span className="meta-value mono">{lottery.winnerAddr}</span>
          </div>
        ) : null}
      </div>

      {isOrganizer ? (
        <div className="section-actions">
          {activity.status === 'OPEN' ? (
            <>
              {(!lottery || lottery.status !== 'OPEN') && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCreateLottery}
                  disabled={lotteryOps.isCreating}
                >
                  {lotteryOps.isCreating ? '建立中...' : '建立樂透'}
                </button>
              )}
              {lottery &&
              lottery.status === 'OPEN' &&
              lottery.participantsCount > 0 ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleExecuteLottery}
                  disabled={lotteryOps.isExecuting}
                >
                  {lotteryOps.isExecuting ? '開獎中...' : '開出樂透'}
                </button>
              ) : null}
            </>
          ) : (
            <p className="card-text">活動已關閉，樂透僅供檢視結果。</p>
          )}
        </div>
      ) : null}

      {!isOrganizer ? (
        <div className="section-actions">
          {!isConnected ? (
            <p className="card-text">請先連線 IOTA Snap 錢包，再參加樂透。</p>
          ) : !participantStatus.isJoined ? (
            <p className="card-text">請先加入活動，才能參與樂透。</p>
          ) : !lottery ? (
            <p className="card-text">主辦尚未建立樂透。</p>
          ) : lottery.status !== 'OPEN' ? (
            <p className="card-text">
              {winnerIsMe
                ? '本輪已開獎，你是得獎者！'
                : '本輪已開獎，如有得獎會顯示在上方。'}
            </p>
          ) : lottery.hasJoinedCurrentUser ? (
            <p className="card-text">你已參加本輪樂透，請等待開獎。</p>
          ) : (
            <div className="field-row">
              <input
                className="field-input"
                value={amountInput}
                onChange={(e) => onAmountChange(e.target.value)}
                placeholder="投入金額（IOTA）"
              />
              <button
                type="button"
                className="btn-primary"
                onClick={handleJoinLottery}
                disabled={!canParticipantJoin || lotteryOps.isJoining}
              >
                {lotteryOps.isJoining ? '送出中...' : '參加樂透'}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
};
