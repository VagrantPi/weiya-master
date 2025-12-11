import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  useCurrentAccount,
  useIotaClient,
  useIotaClientContext,
} from '@iota/dapp-kit';

import { getParticipantType } from '../consts/annual-party';
import type {
  Activity,
  MyParticipantState,
  Participant,
} from '../types/annual-party';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mapParticipantFromObject = (obj: any): Participant => {
  if (!obj.data) {
    throw new Error('Participant 物件不存在');
  }

  const objectId: string = obj.data.objectId;
  const content = obj.data.content;

  if (!content || content.dataType !== 'moveObject') {
    throw new Error('Participant 內容格式錯誤');
  }

  // IOTA Move struct fields 可能包在 fields.fields 或直接展開
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawFields: any =
    Array.isArray(content.fields) || content.fields == null
      ? {}
      : 'fields' in content.fields
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (content.fields as any).fields
        : content.fields;

  const activityId = String(rawFields.activity_id ?? '');
  const owner = String(rawFields.owner ?? '');

  const joined = Boolean(rawFields.joined);
  const hasClaimedBonus = Boolean(rawFields.has_claimed_bonus);
  const hasClaimedCloseReward = Boolean(rawFields.has_claimed_close_reward);

  return {
    id: objectId,
    activityId,
    owner,
    joined,
    hasClaimedBonus,
    hasClaimedCloseReward,
  };
};

export const useMyParticipant = (
  activityId: string | null,
  activity: Activity | null,
): UseQueryResult<MyParticipantState | null> => {
  const client = useIotaClient();
  const { network } = useIotaClientContext();
  const currentAccount = useCurrentAccount();
  const currentAddress = currentAccount?.address ?? '';

  const participantType = getParticipantType(network);

  const enabled =
    Boolean(activityId) && Boolean(currentAddress) && Boolean(participantType);

  return useQuery({
    queryKey: ['my-participant', network, currentAddress, activityId],
    enabled,
    queryFn: async () => {
      if (!enabled || !activityId || !currentAddress) {
        return null;
      }

      const res = await client.getOwnedObjects({
        owner: currentAddress,
        filter: {
          StructType: participantType,
        },
        options: {
          showContent: true,
        },
      });

      const objects = res.data ?? [];

      const participants: Participant[] = [];

      for (const item of objects) {
        try {
          const parsed = mapParticipantFromObject(item);
          if (parsed.activityId === activityId) {
            participants.push(parsed);
          }
        } catch {
          // 忽略單筆解析失敗的 Participant
          // eslint-disable-next-line no-continue
          continue;
        }
      }

      const participant = participants[0] ?? null;
      const participantObjectId = participant ? participant.id : null;

      const canClaimBonus =
        Boolean(participant) &&
        participant.joined &&
        !participant.hasClaimedBonus &&
        activity?.hasBonusEvent === true;

      const canClaimCloseReward =
        Boolean(participant) &&
        participant.joined &&
        !participant.hasClaimedCloseReward &&
        activity?.status === 'CLOSED' &&
        (activity?.closePayoutAmount ?? 0n) > 0n;

      return {
        participant,
        participantObjectId,
        canClaimBonus,
        canClaimCloseReward,
      };
    },
  });
};

export const useParticipants = (
  activityId: string | null,
): UseQueryResult<Participant[]> => {
  const client = useIotaClient();
  const { network } = useIotaClientContext();

  const participantType = getParticipantType(network);

  const enabled = Boolean(activityId) && Boolean(participantType);

  return useQuery({
    queryKey: ['participants', network, activityId],
    enabled,
    queryFn: async () => {
      if (!enabled || !activityId) {
        return [];
      }

      // 目前 IOTA SDK 尚未提供直接依 activityId 索引所有 Participant 的 API，
      // 這裡預留實作空間，先回傳空陣列以確保 UI 正常執行。
      // 未來可改為掃描對應 StructType 或使用事件索引。
      return [];
    },
  });
};

