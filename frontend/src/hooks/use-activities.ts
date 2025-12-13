import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useIotaClient, useIotaClientContext } from '@iota/dapp-kit';
import type { IotaObjectResponse } from '@iota/iota-sdk/client';

import { getActivityType, getAnnualPartyConfig } from '../consts/annual-party';
import type { Activity, ActivityView } from '../types/annual-party';

const toBigIntSafe = (value: unknown): bigint => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  if (typeof value === 'string') {
    if (value === '') return 0n;
    return BigInt(value);
  }
  return 0n;
};

const toNumberSafe = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    if (value === '') return 0;
    const parsed = Number(value);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const parseStatus = (status: unknown): 'OPEN' | 'CLOSED' => {
  if (typeof status === 'string') {
    if (status.toUpperCase() === 'CLOSED') return 'CLOSED';
    return 'OPEN';
  }

  const variant =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (status as any)?.variant ??
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (status as any)?.fields?.variant;
  if (typeof variant === 'string' && variant.toUpperCase() === 'CLOSED') {
    return 'CLOSED';
  }
  return 'OPEN';
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parseOptionId = (optionValue: any): string | null => {
  if (!optionValue) return null;
  if (typeof optionValue === 'string') return optionValue;
  if (Array.isArray(optionValue)) {
    const first = optionValue[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && typeof first.id === 'string') {
      return first.id;
    }
    return null;
  }

  const variant = optionValue.variant ?? optionValue.fields?.variant;
  if (typeof variant === 'string' && variant.toLowerCase() === 'none') {
    return null;
  }

  const fields = optionValue.fields ?? optionValue;
  const inner = fields.value ?? fields.id ?? fields.some;
  if (typeof inner === 'string') return inner;
  if (inner && typeof inner === 'object' && typeof inner.id === 'string') {
    return inner.id;
  }

  return null;
};

export const mapActivityFromObject = (obj: IotaObjectResponse): Activity => {
  if (!obj.data) {
    throw new Error('Activity 物件不存在');
  }

  const objectId = obj.data.objectId;
  const content = obj.data.content;

  if (!content || content.dataType !== 'moveObject') {
    throw new Error('Activity 內容格式錯誤');
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

  const organizer = String(rawFields.organizer ?? '');
  const name = String(rawFields.name ?? '');

  const status = parseStatus(rawFields.status);

  const prizeCoin = rawFields.prize_pool_coin ?? {};
  const prizeValueRaw =
    prizeCoin?.fields?.value ??
    prizeCoin?.value ??
    rawFields.prize_pool_coin ??
    rawFields.prize_pool ??
    0;

  const participantCount = toNumberSafe(rawFields.participant_count);

  const hasBonusEvent = Boolean(rawFields.has_bonus_event);
  const bonusAmountPerUser = toBigIntSafe(
    rawFields.bonus_amount_per_user ?? 0,
  );

  const closePayoutAmount = toBigIntSafe(rawFields.close_payout_amount ?? 0);
  const remainingPoolAfterClose = toBigIntSafe(
    rawFields.remaining_pool_after_close ?? 0,
  );

  const participants: string[] = Array.isArray(rawFields.participants)
    ? rawFields.participants.map((p: unknown) => String(p))
    : [];

  const eligibleFlags: boolean[] = Array.isArray(rawFields.eligible_flags)
    ? rawFields.eligible_flags.map((flag: unknown) => Boolean(flag))
    : [];

  const lotteryId = parseOptionId(rawFields.lottery_id);
  const currentGameId = parseOptionId(rawFields.current_game_id);

  return {
    id: objectId,
    organizer,
    name,
    status,
    prizePool: toBigIntSafe(prizeValueRaw),
    participantCount,
    hasBonusEvent,
    bonusAmountPerUser,
    closePayoutAmount,
    remainingPoolAfterClose,
    participants,
    eligibleFlags,
    lotteryId,
    currentGameId,
  };
};

export const useActivityList = (): {
  activities: Activity[];
  isLoading: boolean;
  error: Error | null;
} => {
  const { network } = useIotaClientContext();

  const query = useQuery<Activity[], Error>({
    queryKey: ['activity-list', network],
    // 這裡先回傳空陣列作為預設實作，後續可以依照 TPM 規格改成從鏈上查詢所有 Activity。
    queryFn: async () => [],
  });

  return {
    activities: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error ?? null,
  };
};

export const useActivitiesQuery = (): UseQueryResult<ActivityView[]> => {
  const client = useIotaClient();
  const { network } = useIotaClientContext();

  return useQuery({
    queryKey: ['activities', network],
    queryFn: async () => {
      const { packageId, module } = getAnnualPartyConfig(network);
      const activityType = getActivityType(network);

      // 先透過事件查詢所有 ActivityCreatedEvent，
      // 再根據 event 中的 activity_id 讀取對應的 Activity 物件。
      const eventType = `${packageId}::${module}::ActivityCreatedEvent`;

      const eventsRes = await client.queryEvents({
        query: { MoveEventType: eventType },
        limit: 100,
        order: 'descending',
      });

      const ids: string[] = [];

      for (const ev of eventsRes.data ?? []) {
        const parsed = ev.parsedJson;
        if (!parsed || typeof parsed !== 'object') continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const activityId = (parsed as any).activity_id;
        if (typeof activityId === 'string') {
          ids.push(activityId);
        }
      }

      const uniqueIds = Array.from(new Set(ids));
      if (uniqueIds.length === 0) {
        return [];
      }

      const objects = await client.multiGetObjects({
        ids: uniqueIds,
        options: {
          showContent: true,
        },
      });

      const byId: Record<string, ActivityView> = {};

      for (const obj of objects) {
        try {
          if (!obj.data || !obj.data.content) continue;
          if (
            obj.data.content.dataType !== 'moveObject' ||
            obj.data.content.type !== activityType
          ) {
            continue;
          }

          const act = mapActivityFromObject(obj as IotaObjectResponse);
          byId[act.id] = {
            id: act.id,
            organizer: act.organizer,
            name: act.name,
            status: act.status,
            prizePoolAmount: act.prizePool,
            participantCount: act.participantCount,
            hasBonusEvent: act.hasBonusEvent,
            closePayoutAmount: act.closePayoutAmount,
          };
        } catch {
          // 忽略單筆解析錯誤
          // eslint-disable-next-line no-continue
          continue;
        }
      }

      // 依 event 出現順序組成列表
      const views: ActivityView[] = [];
      for (const id of uniqueIds) {
        const view = byId[id];
        if (view) {
          views.push(view);
        }
      }

      return views;
    },
  });
};

export const useActivityQuery = (
  activityId: string | null,
): UseQueryResult<Activity | null> => {
  const client = useIotaClient();
  const { network } = useIotaClientContext();

  return useQuery({
    queryKey: ['activity', network, activityId],
    enabled: Boolean(activityId),
    queryFn: async () => {
      if (!activityId) return null;

      const res = await client.getObject({
        id: activityId,
        options: {
          showContent: true,
        },
      });

      if (res.error || !res.data) {
        return null;
      }

      return mapActivityFromObject(res);
    },
  });
};
