import { useMemo } from 'react';

import type {
  Activity,
  ActivityCloseView,
  Participant,
} from '../types/annual-party';

export const useActivityCloseView = (
  activity: Activity | null,
  myParticipant: Participant | null,
): ActivityCloseView => {
  return useMemo(() => {
    if (!activity) {
      return {
        activity: null,
        myParticipant: null,
        isClosed: false,
        canClose: false,
        canWithdrawRemaining: false,
        closePayoutAmount: 0n,
        remainingPoolAfterClose: 0n,
        canClaimCloseReward: false,
        hasClaimedCloseReward: false,
      };
    }

    const isClosed = activity.status === 'CLOSED';
    const closePayoutAmount = activity.closePayoutAmount ?? 0n;
    const remainingPoolAfterClose = activity.remainingPoolAfterClose ?? 0n;

    const hasClaimedCloseReward = Boolean(myParticipant?.hasClaimedCloseReward);

    const canClaimCloseReward =
      isClosed &&
      closePayoutAmount > 0n &&
      Boolean(myParticipant) &&
      !myParticipant?.hasClaimedCloseReward;

    const canClose = !isClosed && activity.participantCount > 0;
    const canWithdrawRemaining = isClosed && remainingPoolAfterClose > 0n;

    return {
      activity,
      myParticipant,
      isClosed,
      canClose,
      canWithdrawRemaining,
      closePayoutAmount,
      remainingPoolAfterClose,
      canClaimCloseReward,
      hasClaimedCloseReward,
    };
  }, [activity, myParticipant]);
};

