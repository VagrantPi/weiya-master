import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { useActivityQuery } from '../../hooks/use-activities';
import { useActivityCloseOperations } from '../../hooks/use-activity-close-operations';
import { useActivityCloseView } from '../../hooks/use-activity-close-view';
import { useActivityOperations } from '../../hooks/use-activity-operations';
import { useBonusOperations } from '../../hooks/use-bonus-operations';
import { useCurrentGame, useGameParticipations } from '../../hooks/use-game';
import { useGameOperations } from '../../hooks/use-game-operations';
import { useCurrentLottery } from '../../hooks/use-lottery';
import { useLotteryOperations } from '../../hooks/use-lottery-operations';
import { useMyParticipant } from '../../hooks/use-participant';
import { useWalletConnection } from '../../hooks/useWalletConnection';

export function ParticipantActivityPage() {
  const params = useParams<{ activityId: string }>();
  const activityId = params.activityId ?? '';

  const { currentAddress, isConnected } = useWalletConnection();

  const { data: activity, isLoading, error } = useActivityQuery(activityId);
  const { data: myParticipantState } = useMyParticipant(
    activityId,
    activity ?? null,
  );

  const myParticipant = myParticipantState?.participant ?? null;

  const closeView = useActivityCloseView(activity ?? null, myParticipant);

  const lotteryViewQuery = useCurrentLottery(activity ?? null);
  const lotteryView = lotteryViewQuery.data ?? null;

  const gameViewQuery = useCurrentGame(activity ?? null);
  const gameView = gameViewQuery.data ?? null;
  const game = gameView?.game ?? null;
  const participationsQuery = useGameParticipations(game ?? null);

  const { joinActivity, addPrizeFund } = useActivityOperations();
  const { claimBonus, claimCloseReward } = useBonusOperations();
  const { joinLottery } = useLotteryOperations();
  const { submitChoice, claimGameReward } = useGameOperations();
  const { claimCloseReward: claimCloseRewardOrganizerSide } =
    useActivityCloseOperations();

  const [lotteryAmountInput, setLotteryAmountInput] = useState('0');
  const [gameChoice, setGameChoice] = useState<number | null>(null);

  const myGameParticipation = useMemo(() => {
    if (!game || !participationsQuery.data) return null;
    return participationsQuery.data.find((p) => p.owner === currentAddress) ?? null;
  }, [currentAddress, game, participationsQuery.data]);

  if (!activityId) {
    return <p>無效的活動 ID。</p>;
  }

  if (isLoading) {
    return <p>載入活動中...</p>;
  }

  if (error || !activity) {
    return <p>找不到活動或載入失敗。</p>;
  }

  const handleJoinActivity = async () => {
    if (!activity) return;
    await joinActivity({
      activityId: activity.id,
      activityObjectId: activity.id,
    });
  };

  const handleClaimBonus = async () => {
    if (!activity || !myParticipantState?.participantObjectId) return;
    await claimBonus({
      activityId: activity.id,
      activityObjectId: activity.id,
      participantObjectId: myParticipantState.participantObjectId,
    });
  };

  const handleJoinLottery = async () => {
    if (
      !activity ||
      !lotteryView?.lottery ||
      !myParticipant ||
      !lotteryAmountInput
    ) {
      return;
    }
    const amount = BigInt(lotteryAmountInput || '0');
    await joinLottery({
      activityId: activity.id,
      activityObjectId: activity.id,
      lotteryId: lotteryView.lottery.id,
      lotteryObjectId: lotteryView.lottery.id,
      amount,
    });
  };

  const handleSubmitChoice = async () => {
    if (!activity || !game || gameChoice == null) return;
    await submitChoice({
      activityId: activity.id,
      activityObjectId: activity.id,
      gameId: game.id,
      gameObjectId: game.id,
      choice: gameChoice,
    });
  };

  const handleClaimGameReward = async () => {
    if (!activity || !game || !myGameParticipation) return;
    await claimGameReward({
      activityId: activity.id,
      activityObjectId: activity.id,
      gameId: game.id,
      gameObjectId: game.id,
      participationObjectId: myGameParticipation.id,
    });
  };

  const handleClaimCloseReward = async () => {
    if (!activity || !myParticipantState?.participantObjectId) return;
    await claimCloseReward({
      activityId: activity.id,
      activityObjectId: activity.id,
      participantObjectId: myParticipantState.participantObjectId,
    });
  };

  const isJoined = Boolean(myParticipant?.joined);

  return (
    <div className="page-container">
      <h1 className="page-title">
        尾牙活動 - <span className="mono">{activity.name}</span>
      </h1>

      <div className="participant-grid">
        <section className="card">
          <h2 className="card-title">Activity Info</h2>
          <p className="card-text">
            Organizer:{' '}
            <span className="mono">
              {activity.organizer.slice(0, 10)}...
            </span>
          </p>
          <p className="card-text">
            狀態：
            <span
              className={
                activity.status === 'OPEN'
                  ? 'status-tag status-open'
                  : 'status-tag status-closed'
              }
            >
              {activity.status}
            </span>
          </p>
          <p className="card-text">
            獎金池：{activity.prizePool.toString()} IOTA ｜ 參與人數：
            {activity.participantCount}
          </p>
          <p className="card-text">
            你目前的地址：
            <span className="mono">
              {isConnected ? currentAddress || '-' : '尚未連線'}
            </span>
          </p>
        </section>

        <section className="card">
          <h2 className="card-title">Join Activity</h2>
          {activity.status !== 'OPEN' ? (
            <p className="card-text">活動已關閉，無法再加入。</p>
          ) : isJoined ? (
            <p className="card-text">你已加入此活動，請繼續參與其它遊戲與抽獎。</p>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={handleJoinActivity}
            >
              加入尾牙活動
            </button>
          )}
        </section>

        <section className="card">
          <h2 className="card-title">Bonus</h2>
          <p className="card-text">
            {activity.hasBonusEvent
              ? `本場有參加獎，每人 ${activity.bonusAmountPerUser.toString()} IOTA。`
              : '本場尚未設定參加獎。'}
          </p>
          {myParticipantState?.canClaimBonus ? (
            <button
              type="button"
              className="btn-primary"
              onClick={handleClaimBonus}
            >
              領取參加獎
            </button>
          ) : (
            <p className="card-text">
              {isJoined
                ? '目前沒有可領取的參加獎，或已經領取過。'
                : '請先加入活動，才能領取參加獎。'}
            </p>
          )}
        </section>

        <section className="card">
          <h2 className="card-title">Lottery</h2>
          <p className="card-text">
            狀態：{lotteryView?.lottery?.status ?? '暫未開啟'}
          </p>
          {lotteryView?.lottery ? (
            <>
              <p className="card-text">
                奬金池：{lotteryView.lottery.potAmount.toString()} IOTA ｜ 參與人數：
                {lotteryView.participantCount}
              </p>
              {lotteryView.isOpen ? (
                <>
                  <div className="field-row">
                    <input
                      className="field-input"
                      value={lotteryAmountInput}
                      onChange={(e) => setLotteryAmountInput(e.target.value)}
                      placeholder="投入金額"
                    />
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleJoinLottery}
                    >
                      參與樂透
                    </button>
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <p className="card-text">Organizer 尚未開啟樂透。</p>
          )}
        </section>

        <section className="card">
          <h2 className="card-title">Game</h2>
          {game ? (
            <>
              <p className="card-text">題目：{game.question}</p>
              <div className="game-options">
                {game.options.map((opt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={
                      gameChoice === idx + 1
                        ? 'btn-secondary game-option-active'
                        : 'btn-secondary'
                    }
                    disabled={gameView?.isAnswerRevealed || !!myGameParticipation}
                    onClick={() => setGameChoice(idx + 1)}
                  >
                    {idx + 1}. {opt}
                  </button>
                ))}
              </div>
              {gameView?.isOpen && !myGameParticipation ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSubmitChoice}
                  disabled={gameChoice == null}
                >
                  送出答案
                </button>
              ) : null}
              {gameView?.isAnswerRevealed && myGameParticipation ? (
                <>
                  <p className="card-text">
                    你的答案：選項 {myGameParticipation.choice}；正確選項：
                    {game.correctOption ?? '-'}
                  </p>
                  {myGameParticipation.isCorrect &&
                  !myGameParticipation.hasClaimedReward ? (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleClaimGameReward}
                    >
                      領取遊戲獎勵
                    </button>
                  ) : (
                    <p className="card-text">
                      {myGameParticipation.isCorrect
                        ? '你已領取獎勵或無可領獎勵。'
                        : '此題已結束，未領獎視為放棄。'}
                    </p>
                  )}
                </>
              ) : null}
            </>
          ) : (
            <p className="card-text">尚未開始遊戲，請稍候。</p>
          )}
        </section>

        <section className="card">
          <h2 className="card-title">Close Reward</h2>
          {activity.status === 'CLOSED' ? (
            <>
              <p className="card-text">
                結算分紅總額：{closeView.closePayoutAmount.toString()} IOTA
              </p>
              {myParticipantState?.canClaimCloseReward ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleClaimCloseReward}
                >
                  領取尾牙分紅
                </button>
              ) : (
                <p className="card-text">
                  {myParticipant?.hasClaimedCloseReward
                    ? '你已經領取過尾牙分紅。'
                    : '目前沒有可領取的分紅，或活動仍在進行中。'}
                </p>
              )}
            </>
          ) : (
            <p className="card-text">
              活動尚未關閉。關閉後，你可以在此頁領取終局分紅。
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

