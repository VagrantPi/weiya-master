// frontend/src/components/organizer/OrganizerDashboard.tsx
import type { FC } from 'react';
import QRCodeModule from 'react-qr-code';
import { ControlPanel } from '../layouts/ControlPanel';
import type { GameRewardMode } from '../../types/annual-party';
import './OrganizerDashboard.css';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const QRCode = (QRCodeModule as any).default ?? QRCodeModule;

// A huge props interface to accept all logic from the parent page
interface OrganizerDashboardProps {
  activity: any;
  isOrganizer: boolean;
  closeView: any;
  lotteryView: any;
  gameView: any;
  participantUrl: string;

  // State values
  bonusPerUserInput: string;
  prizeFundInput: string;
  drawAmountInput: string;
  gameQuestion: string;
  gameOptions: string[];
  gameRewardAmount: string;
  gameRewardMode: GameRewardMode;
  correctOptionInput: string;

  // State setters
  setBonusPerUserInput: (val: string) => void;
  setPrizeFundInput: (val: string) => void;
  setDrawAmountInput: (val: string) => void;
  setGameQuestion: (val: string) => void;
  setGameOptions: (val: string[]) => void;
  setGameRewardAmount: (val: string) => void;
  setGameRewardMode: (val: GameRewardMode) => void;
  setCorrectOptionInput: (val: string) => void;

  // Handlers
  handleCreateBonus: () => Promise<void>;
  handleAddPrizeFund: () => Promise<void>;
  handleDrawPrize: () => Promise<void>;
  handleCreateLottery: () => Promise<void>;
  handleExecuteLottery: () => Promise<void>;
  handleCreateGame: () => Promise<void>;
  handleRevealGameAnswer: () => Promise<void>;
  handleCloseActivity: () => Promise<void>;
  handleWithdrawRemaining: () => Promise<void>;
  
  // utils
  formatIota: (val: bigint | number) => string;
}

export const OrganizerDashboard: FC<OrganizerDashboardProps> = (props) => {
  const {
    activity, isOrganizer, closeView, lotteryView, gameView, participantUrl,
    bonusPerUserInput, prizeFundInput, drawAmountInput, gameQuestion, gameOptions,
    gameRewardAmount, gameRewardMode, correctOptionInput,
    setBonusPerUserInput, setPrizeFundInput, setDrawAmountInput, setGameQuestion,
    setGameOptions, setGameRewardAmount, setGameRewardMode, setCorrectOptionInput,
    handleCreateBonus, handleAddPrizeFund, handleDrawPrize, handleCreateLottery,
    handleExecuteLottery, handleCreateGame, handleRevealGameAnswer,
    handleCloseActivity, handleWithdrawRemaining,
    formatIota
  } = props;
  
  const game = gameView?.game ?? null;

  return (
    <div className="organizer-dashboard">
      <ControlPanel title="Overview" status={activity.status} statusClassName={activity.status === 'OPEN' ? 'status-open' : 'status-closed'}>
        <div className="hud-grid">
            <div className="hud-item">
                <span className="hud-label">Organizer</span>
                <span className="hud-value mono">{activity.organizer} {isOrganizer && '(You)'}</span>
            </div>
            <div className="hud-item">
                <span className="hud-label">Participants</span>
                <span className="hud-value">{activity.participantCount}</span>
            </div>
            <div className="hud-item">
                <span className="hud-label">Prize Pool</span>
                <span className="hud-value">{formatIota(activity.prizePool)} IOTA</span>
            </div>
            <div className="hud-item">
                <span className="hud-label">Close Payout</span>
                <span className="hud-value">{formatIota(closeView.closePayoutAmount)} IOTA</span>
            </div>
        </div>
      </ControlPanel>
      
      <ControlPanel title="Participant QR Link">
        <p className="panel-description">
          Employees can scan this QR code to join the activity.
        </p>
        <div className="qr-container">
          <QRCode value={participantUrl} size={140} bgColor="var(--color-background-panel)" fgColor="var(--color-accent-primary)" />
        </div>
        <p className="card-text mono url-text">{participantUrl}</p>
      </ControlPanel>
      
      <ControlPanel title="Funds Management">
         <div className="field-stack">
            <div className="field-row">
              <label className="field-label" htmlFor="prizeFund">Add to prize pool</label>
              <input id="prizeFund" className="field-input" value={prizeFundInput} onChange={(e) => setPrizeFundInput(e.target.value)} />
              <button type="button" className="btn" onClick={handleAddPrizeFund}>Add Fund</button>
            </div>
         </div>
      </ControlPanel>
      
      <ControlPanel title="Bonus & Draw" status={activity.hasBonusEvent ? 'ACTIVE' : 'INACTIVE'}>
        <div className="field-stack">
            <div className="field-row">
              <label className="field-label" htmlFor="bonusPerUser">Bonus per participant</label>
              <input id="bonusPerUser" className="field-input" value={bonusPerUserInput} onChange={(e) => setBonusPerUserInput(e.target.value)} />
              <button type="button" className="btn" onClick={handleCreateBonus} disabled={activity.hasBonusEvent}>Create Bonus</button>
            </div>
            <div className="field-row">
              <label className="field-label" htmlFor="drawAmount">Draw prize amount</label>
              <input id="drawAmount" className="field-input" value={drawAmountInput} onChange={(e) => setDrawAmountInput(e.target.value)} />
              <button type="button" className="btn" onClick={handleDrawPrize}>Draw Prize</button>
            </div>
        </div>
      </ControlPanel>
      
      <ControlPanel title="Lottery" status={lotteryView?.lottery?.status ?? 'N/A'}>
        <div className="hud-grid">
            <div className="hud-item">
                <span className="hud-label">Participants</span>
                <span className="hud-value">{lotteryView?.participantCount ?? 0}</span>
            </div>
            <div className="hud-item">
                <span className="hud-label">Total Pot</span>
                <span className="hud-value">{lotteryView?.lottery ? formatIota(lotteryView.lottery.potAmount) : '0'} IOTA</span>
            </div>
        </div>
        <div className="panel-actions">
            {!lotteryView?.lottery && (<button type="button" className="btn" onClick={handleCreateLottery}>Create Lottery</button>)}
            {lotteryView?.isOpen && lotteryView.participantCount > 0 && (<button type="button" className="btn" onClick={handleExecuteLottery}>Execute Lottery</button>)}
        </div>
      </ControlPanel>

      <ControlPanel title="Quiz Game" status={gameView?.game?.status ?? 'N/A'}>
        {!gameView?.game || gameView.isClosed ? (
            <div className="field-stack">
                <label className="field-label" htmlFor="gameQuestion">Question</label>
                <input id="gameQuestion" className="field-input" value={gameQuestion} onChange={(e) => setGameQuestion(e.target.value)} />
                <div className="field-grid-2">
                  {gameOptions.map((opt, idx) => (<input key={idx} className="field-input" placeholder={`Option ${idx + 1}`} value={opt} onChange={(e) => { const next = [...gameOptions]; next[idx] = e.target.value; setGameOptions(next);}}/>))}
                </div>
                <div className="field-row">
                  <label className="field-label">Reward</label>
                  <input className="field-input" value={gameRewardAmount} onChange={(e) => setGameRewardAmount(e.target.value)} />
                  <select className="field-input" value={gameRewardMode} onChange={(e) => setGameRewardMode(e.target.value as GameRewardMode)}>
                    <option value="SINGLE">SINGLE</option>
                    <option value="AVERAGE">AVERAGE</option>
                  </select>
                </div>
                <button type="button" className="btn" onClick={handleCreateGame}>Create New Game</button>
            </div>
        ) : null}

        {gameView?.isOpen && game ? (
            <div className="field-row">
                <label className="field-label" htmlFor="correctOption">Correct Option (1-4)</label>
                <input id="correctOption" className="field-input" value={correctOptionInput} onChange={(e) => setCorrectOptionInput(e.target.value)} />
                <button type="button" className="btn" onClick={handleRevealGameAnswer}>Reveal Answer</button>
            </div>
        ) : null}
      </ControlPanel>

      <ControlPanel title="Close & Settlement" status={activity.status}>
        <p className="panel-description">Close the activity to calculate and enable final payouts for all participants.</p>
        <div className="panel-actions">
          {!closeView.isClosed && closeView.canClose && (<button type="button" className="btn btn-danger" onClick={handleCloseActivity}>Close Activity</button>)}
          {closeView.isClosed && closeView.canWithdrawRemaining && (<button type="button" className="btn" onClick={handleWithdrawRemaining}>Withdraw Remainder</button>)}
        </div>
      </ControlPanel>
    </div>
  );
};
