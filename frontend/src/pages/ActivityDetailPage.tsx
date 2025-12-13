import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { ActivityBonusPanel } from '../components/activity/ActivityBonusPanel';
import { ActivityClosePanel } from '../components/activity/ActivityClosePanel';
import { ActivityEventsPanel } from '../components/activity/ActivityEventsPanel';
import { ActivityGamePanel } from '../components/activity/ActivityGamePanel';
import { ActivityHeader } from '../components/activity/ActivityHeader';
import { ActivityLotteryPanel } from '../components/activity/ActivityLotteryPanel';
import { ActivityPrizePoolPanel } from '../components/activity/ActivityPrizePoolPanel';
import { IS_DEBUG_MODE } from '../config/iota';
import { useActivityQuery } from '../hooks/use-activities';
import { useActivityCloseOperations } from '../hooks/use-activity-close-operations';
import { useActivityOperations } from '../hooks/use-activity-operations';
import { useAnnualPartyEvents } from '../hooks/use-annual-party-events';
import { useBonusOperations } from '../hooks/use-bonus-operations';
import { useCurrentGame, useGameParticipations } from '../hooks/use-game';
import { useGameOperations } from '../hooks/use-game-operations';
import { useCurrentLottery } from '../hooks/use-lottery';
import { useLotteryOperations } from '../hooks/use-lottery-operations';
import { useMyParticipant } from '../hooks/use-participant';
import { useWallet } from '../hooks/useWallet';

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
  lotteryId?: string | null;
  currentGameId?: string | null;
}

interface ParticipantStatus {
  isJoined: boolean;
  participantObjectId?: string;
  hasClaimedBonus: boolean;
  hasClaimedCloseReward: boolean;
}

export function ActivityDetailPage() {
  const { id: activityIdParam } = useParams<{ id: string }>();
  const activityId = activityIdParam ?? '';

  const { currentAddress, isConnected } = useWallet();

  const activityQuery = useActivityQuery(activityId);
  const activity = activityQuery.data ?? null;

  const myParticipantQuery = useMyParticipant(activityId, activity);
  const myParticipantState = myParticipantQuery.data ?? null;
  const myParticipant = myParticipantState?.participant ?? null;

  const lotteryQuery = useCurrentLottery(activity);
  const lotteryView = lotteryQuery.data ?? null;

  const gameQuery = useCurrentGame(activity);
  const gameView = gameQuery.data ?? null;
  const game = gameView?.game ?? null;
  const gameParticipationsQuery = useGameParticipations(game ?? null);

  const activityOps = useActivityOperations();
  const bonusOpsRaw = useBonusOperations();
  const lotteryOpsRaw = useLotteryOperations();
  const gameOpsRaw = useGameOperations();
  const closeOpsRaw = useActivityCloseOperations();

  const [lotteryAmountInput, setLotteryAmountInput] = useState('0');

  const isOrganizer = useMemo(() => {
    if (!activity || !currentAddress || !isConnected) return false;
    return activity.organizer.toLowerCase() === currentAddress.toLowerCase();
  }, [activity, currentAddress, isConnected]);

  const activityDetail: ActivityDetailView | null = useMemo(() => {
    if (!activity) return null;
    return {
      id: activity.id,
      organizer: activity.organizer,
      name: activity.name,
      status: activity.status,
      prizePoolAmount: activity.prizePool,
      participantCount: activity.participantCount,
      hasBonusEvent: activity.hasBonusEvent,
      bonusAmountPerUser: activity.bonusAmountPerUser,
      closePayoutAmount: activity.closePayoutAmount,
      remainingPoolAfterClose: activity.remainingPoolAfterClose,
      lotteryId: activity.lotteryId,
      currentGameId: activity.currentGameId,
    };
  }, [activity]);

  const participantStatus: ParticipantStatus = useMemo(() => {
    return {
      isJoined: Boolean(myParticipant?.joined),
      participantObjectId: myParticipantState?.participantObjectId ?? undefined,
      hasClaimedBonus: Boolean(myParticipant?.hasClaimedBonus),
      hasClaimedCloseReward: Boolean(myParticipant?.hasClaimedCloseReward),
    };
  }, [myParticipant, myParticipantState]);

  const myGameParticipation = useMemo(() => {
    if (!game || !gameParticipationsQuery.data || !currentAddress) return null;
    return (
      gameParticipationsQuery.data.find(
        (p) => p.owner.toLowerCase() === currentAddress.toLowerCase(),
      ) ?? null
    );
  }, [currentAddress, game, gameParticipationsQuery.data]);

  const handleRefreshAll = useCallback(async () => {
    await Promise.all([
      activityQuery.refetch(),
      myParticipantQuery.refetch(),
      lotteryQuery.refetch(),
      gameQuery.refetch(),
      gameParticipationsQuery.refetch(),
    ]);
  }, [
    activityQuery,
    gameParticipationsQuery,
    gameQuery,
    lotteryQuery,
    myParticipantQuery,
  ]);

  // 背景訂閱鏈上事件，避免因為 Event Feed UI 被隱藏而失去自動刷新能力
  const annualPartyEvents = useAnnualPartyEvents({
    enabled: Boolean(activityId),
    activityId,
    enableAutoRefresh: true,
    onRelevantEvent: () => void handleRefreshAll(),
    maxEvents: 0,
    pollingIntervalMs: 10_000,
  });

  // 保底：僅在事件串流未連上、且未進入 polling fallback 時，低頻輪詢狀態
  useEffect(() => {
    if (!activityId) return;
    if (annualPartyEvents.status.mode === 'POLLING') return;
    if (annualPartyEvents.status.wsStatus === 'CONNECTED') return;

    const intervalMs = 15_000;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void handleRefreshAll();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [activityId, annualPartyEvents.status.mode, annualPartyEvents.status.wsStatus, handleRefreshAll]);

  const handleJoinActivity = async () => {
    if (!activityDetail) return;
    await activityOps.joinActivity({
      activityId: activityDetail.id,
      activityObjectId: activityDetail.id,
    });
    await handleRefreshAll();
  };

  const prizePoolOps = {
    addPrizeFund: async (amount: bigint) => {
      if (!activityDetail) return;
      await activityOps.addPrizeFund({
        activityId: activityDetail.id,
        activityObjectId: activityDetail.id,
        amount,
      });
      await handleRefreshAll();
    },
    isAdding: activityOps.isPending,
  };

  const bonusOps = {
    createBonusEvent: async (bonusPerUser: bigint) => {
      if (!activityDetail) return;
      await bonusOpsRaw.createBonusEvent({
        activityId: activityDetail.id,
        activityObjectId: activityDetail.id,
        bonusPerUser,
      });
      await handleRefreshAll();
    },
    claimBonus: async (participantObjectId: string) => {
      if (!activityDetail) return;
      await bonusOpsRaw.claimBonus({
        activityId: activityDetail.id,
        activityObjectId: activityDetail.id,
        participantObjectId,
      });
      await handleRefreshAll();
    },
    isCreatingBonus: bonusOpsRaw.isPending,
    isClaimingBonus: bonusOpsRaw.isPending,
  };

  const lotteryForPanel = useMemo(() => {
    if (!lotteryView || !lotteryView.lottery) return null;
    const { lottery } = lotteryView;
    const hasJoinedCurrentUser =
      !!currentAddress &&
      lottery.participants.some(
        (addr) => addr.toLowerCase() === currentAddress.toLowerCase(),
      );
    return {
      id: lottery.id,
      status: lottery.status,
      potAmount: lottery.potAmount,
      participantsCount: lotteryView.participantCount,
      hasJoinedCurrentUser,
      winnerAddr: lottery.winner,
    };
  }, [currentAddress, lotteryView]);

  const lotteryOps = {
    createLottery: async () => {
      if (!activityDetail) return;
      await lotteryOpsRaw.createLottery({
        activityId: activityDetail.id,
        activityObjectId: activityDetail.id,
      });
      await handleRefreshAll();
    },
    joinLottery: async (amount: bigint) => {
      if (!activityDetail || !lotteryView?.lottery) return;
      await lotteryOpsRaw.joinLottery({
        activityId: activityDetail.id,
        activityObjectId: activityDetail.id,
        lotteryId: lotteryView.lottery.id,
        lotteryObjectId: lotteryView.lottery.id,
        amount,
      });
      await handleRefreshAll();
    },
    executeLottery: async () => {
      if (!activityDetail || !lotteryView?.lottery) return;
      await lotteryOpsRaw.executeLottery({
        activityId: activityDetail.id,
        activityObjectId: activityDetail.id,
        lotteryId: lotteryView.lottery.id,
        lotteryObjectId: lotteryView.lottery.id,
      });
      await handleRefreshAll();
    },
    isCreating: lotteryOpsRaw.isPending,
    isJoining: lotteryOpsRaw.isPending,
    isExecuting: lotteryOpsRaw.isPending,
  };

  const gameForPanel = useMemo(() => {
    if (!game) return null;

    const userChoice = myGameParticipation?.choice ?? null;
    const correctOption = game.correctOption;

    let isEligibleForReward = false;
    const hasClaimedReward = Boolean(myGameParticipation?.hasClaimedReward);

    if (
      game.status === 'ANSWER_REVEALED' &&
      userChoice != null &&
      correctOption != null
    ) {
      const answeredCorrect = userChoice === correctOption;
      if (answeredCorrect) {
        if (game.rewardMode === 'AVERAGE') {
          // AVERAGE 模式：只要答對即可視為有領獎資格
          isEligibleForReward = true;
        } else if (
          game.winnerAddr &&
          currentAddress &&
          game.winnerAddr.toLowerCase() === currentAddress.toLowerCase()
        ) {
          // SINGLE 模式：需同時答對且被選為得獎者
          isEligibleForReward = true;
        }
      }
    }

    return {
      id: game.id,
      status: game.status,
      question: game.question,
      options: game.options,
      rewardAmount: game.rewardAmount,
      rewardMode: game.rewardMode,
      correctOption: game.correctOption,
      totalCorrect: Number(game.totalCorrect),
      hasSubmittedByCurrentUser: Boolean(myGameParticipation),
      currentUserChoice: userChoice,
      currentUserIsCorrect: isEligibleForReward,
      currentUserHasClaimedReward: hasClaimedReward,
    };
  }, [currentAddress, game, myGameParticipation]);

  const gameOps = {
    createGame: async (params: {
      question: string;
      options: string[];
      rewardAmount: bigint;
      mode: 'SINGLE' | 'AVERAGE';
    }) => {
      if (!activityDetail) return;
      await gameOpsRaw.createGame({
        activityId: activityDetail.id,
        activityObjectId: activityDetail.id,
        question: params.question,
        options: params.options,
        rewardAmount: params.rewardAmount,
        mode: params.mode,
      });
      await handleRefreshAll();
    },
    submitChoice: async (choice: number) => {
      if (!activityDetail || !game) return;
      await gameOpsRaw.submitChoice({
        activityId: activityDetail.id,
        activityObjectId: activityDetail.id,
        gameId: game.id,
        gameObjectId: game.id,
        choice,
      });
      await handleRefreshAll();
    },
    revealGameAnswer: async (correctOption: number) => {
      if (!activityDetail || !game) return;
      await gameOpsRaw.revealGameAnswer({
        activityId: activityDetail.id,
        activityObjectId: activityDetail.id,
        gameId: game.id,
        gameObjectId: game.id,
        correctOption,
      });
      await handleRefreshAll();
    },
    claimGameReward: async () => {
      if (!activityDetail || !game || !myGameParticipation) return;
      await gameOpsRaw.claimGameReward({
        activityId: activityDetail.id,
        activityObjectId: activityDetail.id,
        gameId: game.id,
        gameObjectId: game.id,
        participationObjectId: myGameParticipation.id,
      });
      await handleRefreshAll();
    },
    isCreating: gameOpsRaw.isPending,
    isSubmitting: gameOpsRaw.isPending,
    isRevealing: gameOpsRaw.isPending,
    isClaiming: gameOpsRaw.isPending,
  };

  const closeOps = {
    closeActivity: async () => {
      if (!activityDetail) return;
      await closeOpsRaw.closeActivity({
        activityId: activityDetail.id,
        activityObjectId: activityDetail.id,
      });
      await handleRefreshAll();
    },
    claimCloseReward: async (participantObjectId: string) => {
      if (!activityDetail) return;
      await closeOpsRaw.claimCloseReward({
        activityId: activityDetail.id,
        activityObjectId: activityDetail.id,
        participantObjectId,
      });
      await handleRefreshAll();
    },
    withdrawRemainingAfterClose: async () => {
      if (!activityDetail) return;
      await closeOpsRaw.withdrawRemainingAfterClose({
        activityId: activityDetail.id,
        activityObjectId: activityDetail.id,
      });
      await handleRefreshAll();
    },
    isClosing: closeOpsRaw.isPending,
    isClaiming: closeOpsRaw.isPending,
    isWithdrawing: closeOpsRaw.isPending,
  };

  if (!activityId) {
    return <p>無效的活動 ID。</p>;
  }

  if (activityQuery.isLoading) {
    return <p>載入活動中...</p>;
  }

  if (!activityDetail) {
    return <p>找不到活動或載入失敗。</p>;
  }

  return (
    <div className="page-container">
      <ActivityHeader
        activity={activityDetail}
        participantStatus={participantStatus}
        isOrganizer={isOrganizer}
        isJoining={activityOps.isPending}
        onJoin={handleJoinActivity}
      />

      <div className="activity-detail-grid">
        {IS_DEBUG_MODE ? (
          <ActivityEventsPanel
            activityId={activityDetail.id}
            isConnected={isConnected}
            currentAddress={currentAddress}
            onRelevantEvent={() => void handleRefreshAll()}
          />
        ) : null}

        {isOrganizer ? (
          <ActivityPrizePoolPanel
            activity={activityDetail}
            isOrganizer={isOrganizer}
            ops={prizePoolOps}
            onRefresh={handleRefreshAll}
          />
        ) : null}

        {isOrganizer ||
        (participantStatus.isJoined &&
          activityDetail.hasBonusEvent &&
          !participantStatus.hasClaimedBonus) ? (
          <ActivityBonusPanel
            activity={activityDetail}
            participantStatus={participantStatus}
            isOrganizer={isOrganizer}
            bonusOps={bonusOps}
            onRefresh={handleRefreshAll}
          />
        ) : null}

        {isOrganizer || (participantStatus.isJoined && Boolean(activityDetail.lotteryId)) ? (
          <ActivityLotteryPanel
            activity={activityDetail}
            lottery={lotteryForPanel}
            isOrganizer={isOrganizer}
            isConnected={isConnected}
            currentAddress={currentAddress}
            lotteryOps={lotteryOps}
            participantStatus={participantStatus}
            amountInput={lotteryAmountInput}
            onAmountChange={setLotteryAmountInput}
            onRefresh={handleRefreshAll}
          />
        ) : null}

        {isOrganizer ||
        (participantStatus.isJoined &&
          Boolean(gameForPanel) &&
          (gameForPanel?.status === 'OPEN' ||
            (gameForPanel?.status === 'ANSWER_REVEALED' &&
              gameForPanel.currentUserIsCorrect &&
              !gameForPanel.currentUserHasClaimedReward))) ? (
          <ActivityGamePanel
            activity={activityDetail}
            game={gameForPanel}
            isOrganizer={isOrganizer}
            participantStatus={participantStatus}
            gameOps={gameOps}
            onRefresh={handleRefreshAll}
          />
        ) : null}

        {isOrganizer ||
        (participantStatus.isJoined &&
          activityDetail.status === 'CLOSED' &&
          activityDetail.closePayoutAmount > 0n &&
          !participantStatus.hasClaimedCloseReward) ? (
          <ActivityClosePanel
            activity={activityDetail}
            isOrganizer={isOrganizer}
            participantStatus={participantStatus}
            closeOps={closeOps}
            onRefresh={handleRefreshAll}
          />
        ) : null}

        {!isOrganizer &&
        participantStatus.isJoined &&
        !(
          (activityDetail.hasBonusEvent && !participantStatus.hasClaimedBonus) ||
          Boolean(activityDetail.lotteryId) ||
          (Boolean(gameForPanel) &&
            (gameForPanel?.status === 'OPEN' ||
              (gameForPanel?.status === 'ANSWER_REVEALED' &&
                gameForPanel.currentUserIsCorrect &&
                !gameForPanel.currentUserHasClaimedReward))) ||
          (activityDetail.status === 'CLOSED' &&
            activityDetail.closePayoutAmount > 0n &&
            !participantStatus.hasClaimedCloseReward)
        ) ? 
        activityDetail.status === 'CLOSED' ? (
          <section className="card section activity-panel">
            <h2 className="section-title">活動已結束</h2>
          </section>
        ) :
        (
          <section className="card section activity-panel">
            <h2 className="section-title">等待活動發佈</h2>
            <p className="section-description">
              你已加入活動，請等待主辦開啟 Bonus / Lottery / Game，或活動結束後開放領取分紅。
            </p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
