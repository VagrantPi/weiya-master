import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import QRCodeModule from 'react-qr-code';

import { useActivityQuery } from '../../hooks/use-activities';
import { useActivityCloseOperations } from '../../hooks/use-activity-close-operations';
import { useActivityCloseView } from '../../hooks/use-activity-close-view';
import { useActivityOperations } from '../../hooks/use-activity-operations';
import { useBonusOperations } from '../../hooks/use-bonus-operations';
import { useCurrentGame } from '../../hooks/use-game';
import { useGameOperations } from '../../hooks/use-game-operations';
import { useCurrentLottery } from '../../hooks/use-lottery';
import { useLotteryOperations } from '../../hooks/use-lottery-operations';
import { useMyParticipant } from '../../hooks/use-participant';
import type { GameRewardMode } from '../../types/annual-party';

// react-qr-code 在不同打包模式下可能以 default 或 named 匯出，這裡統一處理
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const QRCode = (QRCodeModule as any).default ?? QRCodeModule;

export function OrganizerActivityDetailPage() {
  const params = useParams<{ activityId: string }>();
  const activityId = params.activityId ?? '';

  const { data: activity, isLoading, error } = useActivityQuery(activityId);

  const { data: myParticipantState } = useMyParticipant(
    activityId,
    activity ?? null,
  );

  const myParticipant = myParticipantState?.participant ?? null;

  const closeView = useActivityCloseView(activity ?? null, myParticipant);

  const lotteryViewQuery = useCurrentLottery(activity ?? null);
  const gameViewQuery = useCurrentGame(activity ?? null);
  const game = gameViewQuery.data?.game ?? null;

  const { createActivity, addPrizeFund } = useActivityOperations();
  const { createBonusEvent } = useBonusOperations();
  const { createLottery, executeLottery } = useLotteryOperations();
  const { createGame, revealGameAnswer } = useGameOperations();
  const { closeActivity, withdrawRemainingAfterClose } =
    useActivityCloseOperations();

  const [bonusPerUserInput, setBonusPerUserInput] = useState('0');
  const [prizeFundInput, setPrizeFundInput] = useState('0');
  const [drawAmountInput, setDrawAmountInput] = useState('0');
  const [gameQuestion, setGameQuestion] = useState('');
  const [gameOptions, setGameOptions] = useState(['', '', '', '']);
  const [gameRewardAmount, setGameRewardAmount] = useState('0');
  const [gameRewardMode, setGameRewardMode] =
    useState<GameRewardMode>('SINGLE');
  const [correctOptionInput, setCorrectOptionInput] = useState('1');

  const lotteryView = lotteryViewQuery.data ?? null;
  const gameView = gameViewQuery.data ?? null;

  const isOrganizer = useMemo(() => {
    if (!activity || !myParticipantState) return false;
    return activity.organizer === myParticipantState.participant?.owner;
  }, [activity, myParticipantState]);

  if (!activityId) {
    return <p>無效的活動 ID。</p>;
  }

  if (isLoading) {
    return <p>載入活動中...</p>;
  }

  if (error || !activity) {
    return <p>找不到活動或載入失敗。</p>;
  }

  const handleCreateBonus = async () => {
    if (!activity) return;
    const amount = BigInt(bonusPerUserInput || '0');
    await createBonusEvent({
      activityId: activity.id,
      activityObjectId: activity.id,
      bonusPerUser: amount,
    });
  };

  const handleAddPrizeFund = async () => {
    if (!activity) return;
    const amount = BigInt(prizeFundInput || '0');
    await addPrizeFund({
      activityId: activity.id,
      activityObjectId: activity.id,
      amount,
    });
  };

  const handleDrawPrize = async () => {
    if (!activity) return;
    const amount = BigInt(drawAmountInput || '0');
    // 目前合約中 draw_prize 尚未包成 hook，先預留 createActivity 作為 placeholder
    await createActivity({
      name: `${activity.name}-bonus-draw`,
      initialAmount: amount,
    });
  };

  const handleCreateLottery = async () => {
    if (!activity) return;
    await createLottery({
      activityId: activity.id,
      activityObjectId: activity.id,
    });
  };

  const handleExecuteLottery = async () => {
    if (!activity || !lotteryView?.lottery) return;
    await executeLottery({
      activityId: activity.id,
      activityObjectId: activity.id,
      lotteryId: lotteryView.lottery.id,
      lotteryObjectId: lotteryView.lottery.id,
    });
  };

  const handleCreateGame = async () => {
    if (!activity) return;
    const opts = gameOptions.map((o) => o.trim());
    const amount = BigInt(gameRewardAmount || '0');
    await createGame({
      activityId: activity.id,
      activityObjectId: activity.id,
      question: gameQuestion,
      options: opts,
      rewardAmount: amount,
      mode: gameRewardMode,
    });
  };

  const handleRevealGameAnswer = async () => {
    if (!activity || !game) return;
    const correct = Number(correctOptionInput);
    await revealGameAnswer({
      activityId: activity.id,
      activityObjectId: activity.id,
      gameId: game.id,
      gameObjectId: game.id,
      correctOption: correct,
    });
  };

  const handleCloseActivity = async () => {
    if (!activity) return;
    await closeActivity({
      activityId: activity.id,
      activityObjectId: activity.id,
    });
  };

  const handleWithdrawRemaining = async () => {
    if (!activity) return;
    await withdrawRemainingAfterClose({
      activityId: activity.id,
      activityObjectId: activity.id,
    });
  };

  const participantUrl = `${window.location.origin}${import.meta.env.BASE_URL}party/${activity.id}`;

  return (
    <div className="page-container">
      <h1 className="page-title">
        Activity Detail - <span className="mono">{activity.name}</span>
      </h1>

      {!isOrganizer ? (
        <p className="warning-text">
          注意：目前錢包地址並非此活動 Organizer，只能檢視基本資訊。
        </p>
      ) : null}

      <section className="card section">
        <h2 className="section-title">Overview</h2>
        <div className="section-grid">
          <div className="section-item">
            <span className="meta-label">Organizer</span>
            <span className="meta-value mono">
              {activity.organizer}
              {isOrganizer ? '（You）' : ''}
            </span>
          </div>
          <div className="section-item">
            <span className="meta-label">Status</span>
            <span
              className={
                activity.status === 'OPEN'
                  ? 'status-tag status-open'
                  : 'status-tag status-closed'
              }
            >
              {activity.status}
            </span>
          </div>
          <div className="section-item">
            <span className="meta-label">Participants</span>
            <span className="meta-value">{activity.participantCount}</span>
          </div>
          <div className="section-item">
            <span className="meta-label">Prize Pool</span>
            <span className="meta-value">{activity.prizePool.toString()} IOTA</span>
          </div>
          <div className="section-item">
            <span className="meta-label">Close Payout Amount</span>
            <span className="meta-value">
              {closeView.closePayoutAmount.toString()} IOTA
            </span>
          </div>
          <div className="section-item">
            <span className="meta-label">Remaining After Close</span>
            <span className="meta-value">
              {closeView.remainingPoolAfterClose.toString()} IOTA
            </span>
          </div>
        </div>
      </section>

      <section className="card section">
        <h2 className="section-title">Participant QR Link</h2>
        <p className="section-description">
          員工可以掃描此 QRCode 進入簽到與活動參與頁面。
        </p>
        <div style={{ display: 'inline-block', padding: '0.75rem', background: '#050515', borderRadius: '0.75rem' }}>
          <QRCode value={participantUrl} size={140} />
        </div>
        <p className="card-text mono" style={{ marginTop: '0.75rem', fontSize: '0.8rem', wordBreak: 'break-all' }}>
          {participantUrl}
        </p>
      </section>

      <section className="card section">
        <h2 className="section-title">Bonus &amp; Prize Draw</h2>
        <p className="section-description">
          管理參加獎與一次性抽獎。實際鏈上邏輯以 Move 模組為準。
        </p>
        <div className="section-grid">
          <div className="section-item">
            <span className="meta-label">Has Bonus Event</span>
            <span className="meta-value">
              {activity.hasBonusEvent ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="section-item">
            <span className="meta-label">Bonus per User</span>
            <span className="meta-value">
              {activity.bonusAmountPerUser.toString()} IOTA
            </span>
          </div>
        </div>
        {isOrganizer ? (
          <div className="section-actions">
            <div className="field-row">
              <label className="field-label" htmlFor="bonusPerUser">
                每位員工參加獎金額
              </label>
              <input
                id="bonusPerUser"
                className="field-input"
                value={bonusPerUserInput}
                onChange={(e) => setBonusPerUserInput(e.target.value)}
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCreateBonus}
              >
                建立 Bonus Event
              </button>
            </div>

            <div className="field-row">
              <label className="field-label" htmlFor="prizeFund">
                加碼獎金池金額
              </label>
              <input
                id="prizeFund"
                className="field-input"
                value={prizeFundInput}
                onChange={(e) => setPrizeFundInput(e.target.value)}
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={handleAddPrizeFund}
              >
                Add Prize Fund
              </button>
            </div>

            <div className="field-row">
              <label className="field-label" htmlFor="drawAmount">
                抽獎總額（暫時 placeholder）
              </label>
              <input
                id="drawAmount"
                className="field-input"
                value={drawAmountInput}
                onChange={(e) => setDrawAmountInput(e.target.value)}
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={handleDrawPrize}
              >
                執行抽獎（暫用）
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="card section">
        <h2 className="section-title">Lottery</h2>
        <p className="section-description">
          控管本活動目前開啟中的樂透，員工在 Participant 頁面參與。
        </p>
        <div className="section-grid">
          <div className="section-item">
            <span className="meta-label">Status</span>
            <span className="meta-value">
              {lotteryView?.lottery?.status ?? 'N/A'}
            </span>
          </div>
          <div className="section-item">
            <span className="meta-label">Participants</span>
            <span className="meta-value">
              {lotteryView?.participantCount ?? 0}
            </span>
          </div>
          <div className="section-item">
            <span className="meta-label">Pot Amount</span>
            <span className="meta-value">
              {lotteryView?.lottery
                ? lotteryView.lottery.potAmount.toString()
                : '0'}{' '}
              IOTA
            </span>
          </div>
        </div>
        {isOrganizer ? (
          <div className="section-actions">
            {!lotteryView?.lottery ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCreateLottery}
              >
                Create Lottery
              </button>
            ) : null}
            {lotteryView?.isOpen && lotteryView.participantCount > 0 ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={handleExecuteLottery}
              >
                Execute Lottery
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="card section">
        <h2 className="section-title">Game</h2>
        <p className="section-description">
          管理四選一遊戲（問題、選項、獎勵模式與公布正解）。
        </p>

        <div className="section-grid">
          <div className="section-item">
            <span className="meta-label">Status</span>
            <span className="meta-value">{gameView?.game?.status ?? 'N/A'}</span>
          </div>
          <div className="section-item">
            <span className="meta-label">Question</span>
            <span className="meta-value">
              {gameView?.game?.question || '尚未建立遊戲'}
            </span>
          </div>
          <div className="section-item">
            <span className="meta-label">Reward Amount</span>
            <span className="meta-value">
              {gameView?.game
                ? gameView.game.rewardAmount.toString()
                : '0'}{' '}
              IOTA
            </span>
          </div>
          <div className="section-item">
            <span className="meta-label">Reward Mode</span>
            <span className="meta-value">
              {gameView?.game?.rewardMode ?? '-'}
            </span>
          </div>
        </div>

        {isOrganizer ? (
          <div className="section-actions">
            {!gameView?.game || gameView.isClosed ? (
              <div className="field-stack">
                <label className="field-label" htmlFor="gameQuestion">
                  問題內容
                </label>
                <input
                  id="gameQuestion"
                  className="field-input"
                  value={gameQuestion}
                  onChange={(e) => setGameQuestion(e.target.value)}
                />
                <div className="field-grid-2">
                  {gameOptions.map((opt, idx) => (
                    <input
                      key={idx}
                      className="field-input"
                      placeholder={`選項 ${idx + 1}`}
                      value={opt}
                      onChange={(e) => {
                        const next = [...gameOptions];
                        next[idx] = e.target.value;
                        setGameOptions(next);
                      }}
                    />
                  ))}
                </div>
                <div className="field-row">
                  <label className="field-label" htmlFor="gameRewardAmount">
                    獎勵總額
                  </label>
                  <input
                    id="gameRewardAmount"
                    className="field-input"
                    value={gameRewardAmount}
                    onChange={(e) => setGameRewardAmount(e.target.value)}
                  />
                  <select
                    className="field-input"
                    value={gameRewardMode}
                    onChange={(e) =>
                      setGameRewardMode(e.target.value as GameRewardMode)
                    }
                  >
                    <option value="SINGLE">SINGLE</option>
                    <option value="AVERAGE">AVERAGE</option>
                  </select>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleCreateGame}
                  >
                    建立新遊戲
                  </button>
                </div>
              </div>
            ) : null}

            {gameView?.isOpen && game ? (
              <div className="field-row">
                <label className="field-label" htmlFor="correctOption">
                  公布正確選項（1~4）
                </label>
                <input
                  id="correctOption"
                  className="field-input"
                  value={correctOptionInput}
                  onChange={(e) => setCorrectOptionInput(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleRevealGameAnswer}
                >
                  公布答案
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="card section">
        <h2 className="section-title">Close &amp; Settlement</h2>
        <p className="section-description">
          控管活動關閉與結算，員工會在 Participant 頁面自行領取 close reward。
        </p>

        <div className="section-grid">
          <div className="section-item">
            <span className="meta-label">Status</span>
            <span className="meta-value">
              {closeView.isClosed ? 'CLOSED' : 'OPEN'}
            </span>
          </div>
          <div className="section-item">
            <span className="meta-label">Participants</span>
            <span className="meta-value">{activity.participantCount}</span>
          </div>
          <div className="section-item">
            <span className="meta-label">Close Payout Amount</span>
            <span className="meta-value">
              {closeView.closePayoutAmount.toString()} IOTA
            </span>
          </div>
          <div className="section-item">
            <span className="meta-label">Remaining Pool</span>
            <span className="meta-value">
              {closeView.remainingPoolAfterClose.toString()} IOTA
            </span>
          </div>
        </div>

        {isOrganizer ? (
          <div className="section-actions">
            {!closeView.isClosed && closeView.canClose ? (
              <button
                type="button"
                className="btn-danger"
                onClick={handleCloseActivity}
              >
                關閉活動並計算銷帳
              </button>
            ) : null}
            {closeView.isClosed && closeView.canWithdrawRemaining ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={handleWithdrawRemaining}
              >
                領回剩餘獎金
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
