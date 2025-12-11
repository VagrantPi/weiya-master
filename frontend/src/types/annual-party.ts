export type ActivityStatus = 'OPEN' | 'CLOSED';

export interface ActivityOnChainRaw {
  id: string;
  // IOTA 物件原始回傳資料，保留必要欄位方便解析
  data?: {
    objectId: string;
    content?: {
      dataType: 'moveObject' | string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fields: any;
      type: string;
    } | null;
  } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw?: any;
}

export interface Activity {
  id: string;
  organizer: string;
  name: string;

  status: ActivityStatus;

  prizePool: bigint;
  participantCount: number;

  hasBonusEvent: boolean;
  bonusAmountPerUser: bigint;

  closePayoutAmount: bigint;
  remainingPoolAfterClose: bigint;

  participants: string[];
  eligibleFlags: boolean[];

  lotteryId: string | null;
  currentGameId: string | null;
}

export interface Participant {
  id: string;
  activityId: string;
  owner: string;

  joined: boolean;
  hasClaimedBonus: boolean;
  hasClaimedCloseReward: boolean;
}

export interface MyParticipantState {
  participant: Participant | null;
  participantObjectId: string | null;

  canClaimBonus: boolean;
  canClaimCloseReward: boolean;
}

export type LotteryStatus = 'OPEN' | 'DRAWN' | 'CLOSED';

export interface Lottery {
  id: string;
  activityId: string;
  status: LotteryStatus;

  potAmount: bigint;
  participants: string[];
  winner: string | null;
}

export interface LotteryView {
  lottery: Lottery | null;

  isOpen: boolean;
  isDrawn: boolean;
  isClosed: boolean;
  participantCount: number;
}

export type GameStatus = 'OPEN' | 'ANSWER_REVEALED' | 'CLOSED';
export type GameRewardMode = 'SINGLE' | 'AVERAGE';

export interface Game {
  id: string;
  activityId: string;
  status: GameStatus;

  question: string;
  options: string[];
  rewardAmount: bigint;
  rewardMode: GameRewardMode;

  correctOption: number | null;
  totalCorrect: bigint;
  winnerAddr: string | null;

  participationIds: string[];
  participationOwners: string[];
  participationChoices: number[];
}

export interface GameView {
  game: Game | null;

  isOpen: boolean;
  isAnswerRevealed: boolean;
  isClosed: boolean;

  hasCorrectOption: boolean;
  correctOptionLabel: string | null;
}

export interface GameParticipation {
  id: string;
  gameId: string;
  activityId: string;
  owner: string;

  choice: number;
  isCorrect: boolean;
  hasClaimedReward: boolean;
}

export interface GameParticipationView {
  participation: GameParticipation;
  choiceIndex: number;
  canClaim: boolean;
}

export interface ActivityCloseView {
  activity: Activity | null;
  myParticipant: Participant | null;

  isClosed: boolean;
  canClose: boolean;
  canWithdrawRemaining: boolean;

  closePayoutAmount: bigint;
  remainingPoolAfterClose: bigint;

  canClaimCloseReward: boolean;
  hasClaimedCloseReward: boolean;
}

