import type { FC } from 'react';
import { useState } from 'react';
import { formatIota } from '../../utils/iotaUnits';

interface ActivityDetailView {
  id: string;
  organizer: string;
  name: string;
  status: 'OPEN' | 'CLOSED';
}

interface ParticipantStatus {
  isJoined: boolean;
}

interface GameViewForPanel {
  id: string;
  status: 'OPEN' | 'ANSWER_REVEALED' | 'CLOSED';
  question: string;
  options: string[];
  rewardAmount: bigint;
  rewardMode: 'SINGLE' | 'AVERAGE';
  correctOption?: number | null;
  totalCorrect: number;
  hasSubmittedByCurrentUser: boolean;
  currentUserChoice?: number | null;
  currentUserIsCorrect?: boolean | null;
  currentUserHasClaimedReward?: boolean | null;
}

interface ActivityGamePanelProps {
  activity: ActivityDetailView;
  game: GameViewForPanel | null;
  isOrganizer: boolean;
  participantStatus: ParticipantStatus;
  gameOps: {
    createGame: (params: {
      question: string;
      options: string[];
      rewardAmount: bigint;
      mode: 'SINGLE' | 'AVERAGE';
    }) => Promise<void>;
    submitChoice: (choice: number) => Promise<void>;
    revealGameAnswer: (correctOption: number) => Promise<void>;
    claimGameReward: () => Promise<void>;
    isCreating: boolean;
    isSubmitting: boolean;
    isRevealing: boolean;
    isClaiming: boolean;
  };
  onRefresh: () => Promise<void>;
}

export const ActivityGamePanel: FC<ActivityGamePanelProps> = ({
  activity,
  game,
  isOrganizer,
  participantStatus,
  gameOps,
  onRefresh,
}) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [rewardAmount, setRewardAmount] = useState('0');
  const [mode, setMode] = useState<'SINGLE' | 'AVERAGE'>('SINGLE');
  const [correctOptionInput, setCorrectOptionInput] = useState('1');
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);

  const handleCreateGame = async () => {
    if (activity.status === 'CLOSED') return;
    if (game && game.status !== 'CLOSED') {
      const message =
        game.status === 'OPEN'
          ? '目前這題還在進行中（尚未公布答案）。建立新 Game 會讓上一題立即視為結束，之後也無法再作答/領獎。確定要繼續嗎？'
          : '目前上一題仍可領獎。依照規格，建立新 Game 後，上一題未領取的獎勵將視為放棄且不可再領。確定要繼續嗎？';
      // eslint-disable-next-line no-alert
      const confirmed = window.confirm(message);
      if (!confirmed) return;
    }
    const trimmedOptions = options.map((o) => o.trim());
    const amount = BigInt(rewardAmount || '0');
    await gameOps.createGame({
      question,
      options: trimmedOptions,
      rewardAmount: amount,
      mode,
    });
    await onRefresh();
  };

  const handleRevealAnswer = async () => {
    if (!game || game.status !== 'OPEN') return;
    const correct = Number(correctOptionInput);
    if (Number.isNaN(correct) || correct < 1 || correct > 4) return;
    await gameOps.revealGameAnswer(correct);
    await onRefresh();
  };

  const handleSubmitChoice = async () => {
    if (!game || game.status !== 'OPEN' || selectedChoice == null) return;
    await gameOps.submitChoice(selectedChoice);
    await onRefresh();
  };

  const handleClaimReward = async () => {
    if (!game) return;
    await gameOps.claimGameReward();
    await onRefresh();
  };

  const answeredCorrectly =
    !!game &&
    game.correctOption != null &&
    game.currentUserChoice != null &&
    game.correctOption === game.currentUserChoice;

  const canClaimReward =
    !!game &&
    game.status === 'ANSWER_REVEALED' &&
    game.currentUserIsCorrect &&
    !game.currentUserHasClaimedReward;

  const shouldShowCreateSection =
    activity.status !== 'CLOSED' && (!game || game.status !== 'OPEN');

  return (
    <section className="card section activity-panel">
      <h2 className="section-title">四選一 Game</h2>
      <p className="section-description">
        主辦可以出題並設定獎勵，參加者選擇 1~4 其中一個選項，公布答案後由合約計算得獎人。
      </p>

      <div className="section-grid">
        <div className="section-item">
          <span className="meta-label">狀態</span>
          <span className="meta-value">{game?.status ?? '尚未建立'}</span>
        </div>
        <div className="section-item">
          <span className="meta-label">題目</span>
          <span className="meta-value">
            {game?.question || '尚未建立遊戲'}
          </span>
        </div>
        <div className="section-item">
          <span className="meta-label">獎勵總額</span>
          <span className="meta-value">
            {game ? formatIota(game.rewardAmount) : '0'} IOTA
          </span>
        </div>
        <div className="section-item">
          <span className="meta-label">獎勵模式</span>
          <span className="meta-value">{game?.rewardMode ?? '-'}</span>
        </div>
        {game?.correctOption ? (
          <div className="section-item">
            <span className="meta-label">正確選項</span>
            <span className="meta-value">{game.correctOption}</span>
          </div>
        ) : null}
        {game ? (
          <div className="section-item">
            <span className="meta-label">答對人數</span>
            <span className="meta-value">{game.totalCorrect}</span>
          </div>
        ) : null}
      </div>

      {isOrganizer ? (
        <div className="section-actions">
          {game?.status === 'OPEN' ? (
            <p className="card-text">
              題目已發布，請先公布答案（開獎），開獎後才可建立下一題。
            </p>
          ) : null}

          {shouldShowCreateSection ? (
            <div className="field-stack">
              <label className="field-label" htmlFor="gameQuestion">
                問題內容
              </label>
              <input
                id="gameQuestion"
                className="field-input"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
              <div className="field-grid-2">
                {options.map((opt, idx) => (
                  <input
                    key={idx}
                    className="field-input"
                    placeholder={`選項 ${idx + 1}`}
                    value={opt}
                    onChange={(e) => {
                      const next = [...options];
                      next[idx] = e.target.value;
                      setOptions(next);
                    }}
                  />
                ))}
              </div>
              <div className="field-row">
                <label className="field-label" htmlFor="rewardAmount">
                  獎勵總額
                </label>
                <input
                  id="rewardAmount"
                  className="field-input"
                  value={rewardAmount}
                  onChange={(e) => setRewardAmount(e.target.value)}
                />
                <select
                  className="field-input"
                  value={mode}
                  onChange={(e) =>
                    setMode(e.target.value === 'AVERAGE' ? 'AVERAGE' : 'SINGLE')
                  }
                >
                  <option value="SINGLE">SINGLE</option>
                  <option value="AVERAGE">AVERAGE</option>
                </select>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCreateGame}
                  disabled={gameOps.isCreating}
                >
                  {gameOps.isCreating ? '建立中...' : '建立新 Game'}
                </button>
              </div>
              {game && game.status !== 'CLOSED' ? (
                <p className="card-text">
                  依照規格，建立新 Game 後，上一題（包含未領取獎勵）將視為放棄，之後不可再領。
                </p>
              ) : (
                <p className="card-text">
                  建立新 Game 後，參加者即可開始作答；主辦公布答案後，答對者可各自領取獎勵。
                </p>
              )}
            </div>
          ) : null}

          {game && game.status === 'OPEN' ? (
            <div className="field-row">
              <label className="field-label" htmlFor="correctOptionInput">
                公布正確選項（1~4）
              </label>
              <input
                id="correctOptionInput"
                className="field-input"
                value={correctOptionInput}
                onChange={(e) => setCorrectOptionInput(e.target.value)}
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={handleRevealAnswer}
                disabled={gameOps.isRevealing}
              >
                {gameOps.isRevealing ? '公布中...' : '揭露答案'}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {!isOrganizer ? (
        <div className="section-actions">
          {!game ? (
            <p className="card-text">尚未開始遊戲，請稍候主辦建立題目。</p>
          ) : game.status === 'OPEN' ? (
            <>
              <div className="game-options">
                {game.options.map((opt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={
                      selectedChoice === idx + 1
                        ? 'btn-secondary game-option-active'
                        : 'btn-secondary'
                    }
                    disabled={!participantStatus.isJoined || game.hasSubmittedByCurrentUser}
                    onClick={() => setSelectedChoice(idx + 1)}
                  >
                    {idx + 1}. {opt}
                  </button>
                ))}
              </div>
              {participantStatus.isJoined ? (
                game.hasSubmittedByCurrentUser ? (
                  <p className="card-text">你已作答，請等待主辦公布答案。</p>
                ) : (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleSubmitChoice}
                    disabled={selectedChoice == null || gameOps.isSubmitting}
                  >
                    {gameOps.isSubmitting ? '送出中...' : '送出答案'}
                  </button>
                )
              ) : (
                <p className="card-text">請先加入活動才能作答。</p>
              )}
            </>
          ) : game.status === 'ANSWER_REVEALED' ? (
            <>
              <p className="card-text">
                正確選項：{game.correctOption ?? '-'}；你選擇：
                {game.currentUserChoice ?? '-'}
              </p>
              {answeredCorrectly ? (
                canClaimReward ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleClaimReward}
                    disabled={gameOps.isClaiming}
                  >
                    {gameOps.isClaiming ? '領取中...' : '領取遊戲獎金'}
                  </button>
                ) : (
                  <p className="card-text">
                    {game.currentUserHasClaimedReward
                      ? '你已領取過此題獎勵。'
                      : '你答對了，但本輪未中獎或無可領獎勵。'}
                  </p>
                )
              ) : (
                <p className="card-text">這一題未答對，無可領取獎勵。</p>
              )}
            </>
          ) : (
            <p className="card-text">本輪遊戲已結束。</p>
          )}
        </div>
      ) : null}
    </section>
  );
};
