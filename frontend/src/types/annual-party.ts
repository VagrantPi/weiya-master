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

