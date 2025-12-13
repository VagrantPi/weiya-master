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
import { formatIota } from '../../utils/iotaUnits';

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
        <span className="mono">{activity.name}</span>
        <br />
        <span style={{ fontSize: '1.5rem' }}>Organizer Command Center</span>
      </h1>

      {!isOrganizer ? (
        <p className="warning-text">
          Attention: The connected wallet is not the organizer of this activity. Read-only mode.
        </p>
      ) : (
        <OrganizerDashboard
          activity={activity}
          isOrganizer={isOrganizer}
          closeView={closeView}
          lotteryView={lotteryView}
          gameView={gameView}
          participantUrl={participantUrl}
          bonusPerUserInput={bonusPerUserInput}
          prizeFundInput={prizeFundInput}
          drawAmountInput={drawAmountInput}
          gameQuestion={gameQuestion}
          gameOptions={gameOptions}
          gameRewardAmount={gameRewardAmount}
          gameRewardMode={gameRewardMode}
          correctOptionInput={correctOptionInput}
          setBonusPerUserInput={setBonusPerUserInput}
          setPrizeFundInput={setPrizeFundInput}
          setDrawAmountInput={setDrawAmountInput}
          setGameQuestion={setGameQuestion}
          setGameOptions={setGameOptions}
          setGameRewardAmount={setGameRewardAmount}
  
          setGameRewardMode={setGameRewardMode}
          setCorrectOptionInput={setCorrectOptionInput}
          handleCreateBonus={handleCreateBonus}
          handleAddPrizeFund={handleAddPrizeFund}
          handleDrawPrize={handleDrawPrize}
          handleCreateLottery={handleCreateLottery}
          handleExecuteLottery={handleExecuteLottery}
          handleCreateGame={handleCreateGame}
          handleRevealGameAnswer={handleRevealGameAnswer}
          handleCloseActivity={handleCloseActivity}
          handleWithdrawRemaining={handleWithdrawRemaining}
          formatIota={formatIota}
        />
      )}
    </div>
  );
}
