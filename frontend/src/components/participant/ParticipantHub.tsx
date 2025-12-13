// frontend/src/components/participant/ParticipantHub.tsx
import type { FC } from 'react';
import { ActionCard } from '../layouts/ActionCard';
import './ParticipantHub.css';

// Again, a huge props interface to keep logic separate
interface ParticipantHubProps {
  activity: any;
  isJoined: boolean;
  myParticipant: any;
  currentAddress: string | null;
  
  // Boolean flags to control card visibility
  shouldShowBonusCard: boolean;
  shouldShowLotteryCard: boolean;
  shouldShowGameCard: boolean;
  shouldShowCloseRewardCard: boolean;
  shouldShowWaitingCard: boolean;
  
  // Data for cards
  lotteryView: any;
  gameView: any;
  hasJoinedLottery: boolean;
  lotteryAmountInput: string;
  gameChoice: number | null;
  myGameParticipation: any;
  isAnswerCorrect: boolean;
  canClaimGameReward: boolean;
  closeView: any;
  
  // State setters
  setLotteryAmountInput: (val: string) => void;
  setGameChoice: (val: number | null) => void;
  
  // Handlers
  handleJoinActivity: () => Promise<void>;
  handleClaimBonus: () => Promise<void>;
  handleJoinLottery: () => Promise<void>;
  handleSubmitChoice: () => Promise<void>;
  handleClaimGameReward: () => Promise<void>;
  handleClaimCloseReward: () => Promise<void>;
  
  // Utils
  formatIota: (val: bigint | number) => string;
}

export const ParticipantHub: FC<ParticipantHubProps> = (props) => {
  const {
    activity, isJoined, myParticipant, currentAddress,
    shouldShowBonusCard, shouldShowLotteryCard, shouldShowGameCard,
    shouldShowCloseRewardCard, shouldShowWaitingCard,
    lotteryView, gameView, hasJoinedLottery, lotteryAmountInput, gameChoice,
    myGameParticipation, isAnswerCorrect, canClaimGameReward, closeView,
    setLotteryAmountInput, setGameChoice,
    handleJoinActivity, handleClaimBonus, handleJoinLottery, handleSubmitChoice,
    handleClaimGameReward, handleClaimCloseReward,
    formatIota,
  } = props;
  
  const game = gameView?.game ?? null;

  return (
    <div className="participant-hub">
      {/* Join Activity Card is always primary if not joined */}
      {!isJoined && activity.status === 'OPEN' && (
        <ActionCard title="Welcome" description="Join the annual party to participate in all events!">
          <button type="button" className="btn" onClick={handleJoinActivity}>Join Activity</button>
        </ActionCard>
      )}

      {isJoined && (
        <>
            {shouldShowBonusCard && (
                <ActionCard title="Claim Your Bonus" description={`A welcome gift from the organizer: ${formatIota(activity.bonusAmountPerUser)} IOTA.`}>
                    <button type="button" className="btn" onClick={handleClaimBonus} disabled={!myParticipant.canClaimBonus}>Claim Bonus</button>
                </ActionCard>
            )}
            
            {shouldShowLotteryCard && (
                <ActionCard title="Lottery Is Open" description={`Current Pot: ${formatIota(lotteryView?.lottery?.potAmount ?? 0n)} IOTA | Participants: ${lotteryView?.participantCount ?? 0}`}>
                    {hasJoinedLottery ? <p className="action-feedback">You've joined this round. Good luck!</p> : (
                        <div className="field-row">
                            <input className="field-input" value={lotteryAmountInput} onChange={(e) => setLotteryAmountInput(e.target.value)} placeholder="IOTA amount" />
                            <button type="button" className="btn" onClick={handleJoinLottery}>Join Lottery</button>
                        </div>
                    )}
                </ActionCard>
            )}

            {shouldShowGameCard && game && (
                <ActionCard title="Quiz Game Challenge" description={game.question}>
                    <div className="game-card-body">
                        <div className="game-options">
                          {game.options.map((opt: string, idx: number) => (
                            <button key={idx} type="button" className={`btn-game-option ${gameChoice === idx + 1 ? 'active' : ''}`} disabled={gameView?.isAnswerRevealed || !!myGameParticipation} onClick={() => setGameChoice(idx + 1)}>
                              {opt}
                            </button>
                          ))}
                        </div>

                        {gameView?.isOpen && !myGameParticipation && (<button type="button" className="btn" onClick={handleSubmitChoice} disabled={gameChoice == null}>Submit Answer</button>)}

                        {myGameParticipation && <p className="action-feedback">Your answer: {myGameParticipation.choice}. Waiting for reveal...</p>}

                        {gameView?.isAnswerRevealed && myGameParticipation && (
                            <div className="game-reveal">
                                <p className="action-feedback">Correct answer: {game.correctOption}. Your answer was {isAnswerCorrect ? 'correct' : 'incorrect'}.</p>
                                {isAnswerCorrect && canClaimGameReward && (
                                    <button type="button" className="btn" onClick={handleClaimGameReward}>Claim Reward</button>
                                )}
                            </div>
                        )}
                    </div>
                </ActionCard>
            )}

            {shouldShowCloseRewardCard && (
                 <ActionCard title="Activity Closed: Claim Payout" description={`The activity has ended. Your share of the remaining pool is ${formatIota(closeView.closePayoutAmount)} IOTA.`}>
                    <button type="button" className="btn" onClick={handleClaimCloseReward}>Claim Payout</button>
                </ActionCard>
            )}

            {shouldShowWaitingCard && (
                <ActionCard title="Awaiting Next Event" description="You're all set! Stand by for the organizer to launch the next bonus, lottery, or game." disabled>
                    <p className="action-feedback">All caught up.</p>
                </ActionCard>
            )}
        </>
      )}

      {activity.status === 'CLOSED' && !isJoined && (
        <ActionCard title="Activity Closed" description="This activity has already ended and can no longer be joined." disabled>
             <p className="action-feedback">Too late.</p>
        </ActionCard>
      )}
    </div>
  );
};
