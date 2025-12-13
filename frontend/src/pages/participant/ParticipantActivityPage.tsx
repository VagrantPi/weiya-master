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
      <ParticipantHud
        activityName={activity.name}
        status={activity.status}
        prizePool={formatIota(activity.prizePool)}
        participantCount={activity.participantCount}
        userAddress={currentAddress}
        isConnected={isConnected}
      />
      <ParticipantHub
        activity={activity}
        isJoined={isJoined}
        myParticipant={myParticipant}
        currentAddress={currentAddress}
        shouldShowBonusCard={shouldShowBonusCard}
        shouldShowLotteryCard={shouldShowLotteryCard}
        shouldShowGameCard={shouldShowGameCard}
        shouldShowCloseRewardCard={shouldShowCloseRewardCard}
        shouldShowWaitingCard={shouldShowWaitingCard}
        lotteryView={lotteryView}
        gameView={gameView}
        hasJoinedLottery={hasJoinedLottery}
        lotteryAmountInput={lotteryAmountInput}
        gameChoice={gameChoice}
        myGameParticipation={myGameParticipation}
        isAnswerCorrect={isAnswerCorrect}
        canClaimGameReward={canClaimGameReward}
        closeView={closeView}
        setLotteryAmountInput={setLotteryAmountInput}
        setGameChoice={setGameChoice}
        handleJoinActivity={handleJoinActivity}
        handleClaimBonus={handleClaimBonus}
        handleJoinLottery={handleJoinLottery}
        handleSubmitChoice={handleSubmitChoice}
        handleClaimGameReward={handleClaimGameReward}
        handleClaimCloseReward={handleClaimCloseReward}
        formatIota={formatIota}
      />
    </div>
  );
}
