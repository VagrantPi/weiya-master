import { useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { useActivityQuery } from '../../hooks/use-activities';
import { useActivityCloseView } from '../../hooks/use-activity-close-view';
import { useActivityOperations } from '../../hooks/use-activity-operations';
import { useAnnualPartyEvents } from '../../hooks/use-annual-party-events';
import { useBonusOperations } from '../../hooks/use-bonus-operations';
import { useCurrentGame, useGameParticipations } from '../../hooks/use-game';
import { useGameOperations } from '../../hooks/use-game-operations';
import { useCurrentLottery } from '../../hooks/use-lottery';
import { useLotteryOperations } from '../../hooks/use-lottery-operations';
import { useMyParticipant } from '../../hooks/use-participant';
import { useWallet } from '../../hooks/useWallet';
import { makeLotteryExecutedToastKey, parseLotteryExecutedEventPayload } from '../../lib/annualPartyEventPayload';
import { formatIota } from '../../utils/iotaUnits';

export function ParticipantActivityPage() {
  const params = useParams<{ activityId: string }>();
  const activityId = params.activityId ?? '';

  const { currentAddress, isConnected } = useWallet();

  const activityQuery = useActivityQuery(activityId);
  const activity = activityQuery.data ?? null;

  const myParticipantQuery = useMyParticipant(
    activityId,
    activity ?? null,
  );

  const myParticipantState = myParticipantQuery.data ?? null;
  const myParticipant = myParticipantState?.participant ?? null;

  const closeView = useActivityCloseView(activity ?? null, myParticipant);

  const lotteryViewQuery = useCurrentLottery(activity ?? null);
  const lotteryView = lotteryViewQuery.data ?? null;

  const gameViewQuery = useCurrentGame(activity ?? null);
  const gameView = gameViewQuery.data ?? null;
  const game = gameView?.game ?? null;
  const participationsQuery = useGameParticipations(game ?? null);

  const { joinActivity } = useActivityOperations();
  const { claimBonus, claimCloseReward } = useBonusOperations();
  const { joinLottery } = useLotteryOperations();
  const { submitChoice, claimGameReward } = useGameOperations();

  const [lotteryAmountInput, setLotteryAmountInput] = useState('0');
  const [gameChoice, setGameChoice] = useState<number | null>(null);

  const myGameParticipation = useMemo(() => {
    if (!game || !participationsQuery.data) return null;
    return participationsQuery.data.find((p) => p.owner === currentAddress) ?? null;
  }, [currentAddress, game, participationsQuery.data]);

  const userChoice = myGameParticipation?.choice ?? null;
  const correctOption = game?.correctOption ?? null;
  const hasClaimedGameReward = Boolean(myGameParticipation?.hasClaimedReward);

  let isAnswerCorrect = false;
  let canClaimGameReward = false;

  if (
    game &&
    gameView?.isAnswerRevealed &&
    userChoice != null &&
    correctOption != null
  ) {
    isAnswerCorrect = userChoice === correctOption;
    if (isAnswerCorrect) {
      if (game.rewardMode === 'AVERAGE') {
        // AVERAGE 模式：只要答對即可領取分攤獎勵（未領取過）
        canClaimGameReward = !hasClaimedGameReward;
      } else if (
        game.winnerAddr &&
        currentAddress &&
        game.winnerAddr.toLowerCase() === currentAddress.toLowerCase()
      ) {
        // SINGLE 模式：需同時答對且為隨機選出的 winner
        canClaimGameReward = !hasClaimedGameReward;
      }
    }
  }

  const handleRefreshAll = async () => {
    await Promise.all([
      activityQuery.refetch(),
      myParticipantQuery.refetch(),
      lotteryViewQuery.refetch(),
      gameViewQuery.refetch(),
      participationsQuery.refetch(),
    ]);
  };

  const toastedKeysRef = useRef<Set<string>>(new Set());

  useAnnualPartyEvents({
    activityId,
    eventTypeNames: ['LotteryExecutedEvent'],
    enableAutoRefresh: true,
    onRelevantEvent: () => void handleRefreshAll(),
    onEvent: (ev) => {
      if (!isConnected || !currentAddress) return;
      if (ev.structName !== 'LotteryExecutedEvent') return;

      const payload = parseLotteryExecutedEventPayload(ev);
      if (!payload?.winnerAddr) return;
      if (payload.activityId && payload.activityId !== activityId) return;

      if (payload.winnerAddr.toLowerCase() !== currentAddress.toLowerCase()) {
        return;
      }

      const key = makeLotteryExecutedToastKey(ev, payload);
      if (toastedKeysRef.current.has(key)) return;
      toastedKeysRef.current.add(key);

      toast.success(
        `恭喜你抽中樂透！獎金 ${formatIota(payload.amount ?? 0n)} IOTA`,
      );
    },
  });

  if (!activityId) {
    return <p>無效的活動 ID。</p>;
  }

  if (activityQuery.isLoading) {
    return <p>載入活動中...</p>;
  }

  if (activityQuery.error || !activity) {
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
  const hasJoinedLottery =
    Boolean(lotteryView?.lottery) &&
    Boolean(currentAddress) &&
    (lotteryView?.lottery?.participants ?? []).some((addr) =>
      addr.toLowerCase() === currentAddress.toLowerCase(),
    );

  const shouldShowBonusCard =
    isJoined && activity.hasBonusEvent && !myParticipant?.hasClaimedBonus;

  const shouldShowLotteryCard =
    isJoined && Boolean(lotteryView?.lottery) && lotteryView?.isOpen;

  const shouldShowGameCard =
    isJoined &&
    Boolean(game) &&
    (gameView?.isOpen ||
      (gameView?.isAnswerRevealed && isAnswerCorrect && canClaimGameReward));

  const shouldShowCloseRewardCard = Boolean(myParticipantState?.canClaimCloseReward);

  const shouldShowWaitingCard =
    isJoined &&
    !shouldShowBonusCard &&
    !shouldShowLotteryCard &&
    !shouldShowGameCard &&
    !shouldShowCloseRewardCard;

  return (
    <div className="page-container">
      <div className="page-header-row">
        <h1 className="page-title">
          尾牙活動 - <span className="mono">{activity.name}</span>
        </h1>
      </div>

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
            獎金池：{formatIota(activity.prizePool)} IOTA ｜ 參與人數：
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

        {shouldShowWaitingCard ? (
          <section className="card">
            <h2 className="card-title">等待活動發佈</h2>
            <p className="card-text">
              你已加入活動，請等待主辦陸續開啟 Bonus / Lottery / Game，或活動結束後開放領取分紅。
            </p>
          </section>
        ) : null}

        {shouldShowBonusCard ? (
          <section className="card">
            <h2 className="card-title">Bonus</h2>
            <p className="card-text">
              本場有參加獎，每人 {formatIota(activity.bonusAmountPerUser)} IOTA。
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
              <p className="card-text">目前沒有可領取的參加獎。</p>
            )}
          </section>
        ) : null}

        {shouldShowLotteryCard ? (
          <section className="card">
            <h2 className="card-title">Lottery</h2>
            <p className="card-text">
              奬金池：{formatIota(lotteryView?.lottery?.potAmount ?? 0n)} IOTA ｜ 參與人數：
              {lotteryView?.participantCount ?? 0}
            </p>
            {hasJoinedLottery ? (
              <p className="card-text">你已參與本輪樂透，請等待主辦開獎。</p>
            ) : (
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
            )}
          </section>
        ) : null}

        {shouldShowGameCard ? (
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
                {gameView?.isOpen ? (
                  myGameParticipation ? (
                    <p className="card-text">你已作答，請等待主辦公布答案。</p>
                  ) : (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleSubmitChoice}
                      disabled={gameChoice == null}
                    >
                      送出答案
                    </button>
                  )
                ) : null}
                {gameView?.isAnswerRevealed && myGameParticipation ? (
                  <>
                    <p className="card-text">
                      你的答案：選項 {myGameParticipation.choice}；正確選項：
                      {game.correctOption ?? '-'}
                    </p>
                    {isAnswerCorrect && canClaimGameReward ? (
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={handleClaimGameReward}
                      >
                        領取遊戲獎勵
                      </button>
                    ) : null}
                  </>
                ) : null}
              </>
            ) : null}
          </section>
        ) : null}

        {shouldShowCloseRewardCard ? (
          <section className="card">
            <h2 className="card-title">Close Reward</h2>
            <p className="card-text">
              結算分紅總額：{formatIota(closeView.closePayoutAmount)} IOTA
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={handleClaimCloseReward}
            >
              領取尾牙分紅
            </button>
          </section>
        ) : null}
      </div>
    </div>
  );
}
