import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useIotaClient, useIotaClientContext } from '@iota/dapp-kit';
import type { IotaObjectResponse } from '@iota/iota-sdk/client';

import type { Activity, Lottery, LotteryView } from '../types/annual-party';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapLotteryFromObject = (obj: IotaObjectResponse): Lottery => {
  if (!obj.data) {
    throw new Error('Lottery 物件不存在');
  }

  const objectId = obj.data.objectId;
  const content = obj.data.content;

  if (!content || content.dataType !== 'moveObject') {
    throw new Error('Lottery 內容格式錯誤');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawFields: any =
    Array.isArray(content.fields) || content.fields == null
      ? {}
      : 'fields' in content.fields
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (content.fields as any).fields
        : content.fields;

  const activityId = String(rawFields.activity_id ?? '');

  const statusRaw = rawFields.status;
  let status: 'OPEN' | 'DRAWN' | 'CLOSED' = 'OPEN';
  if (typeof statusRaw === 'string') {
    const upper = statusRaw.toUpperCase();
    if (upper === 'DRAWN') status = 'DRAWN';
    else if (upper === 'CLOSED') status = 'CLOSED';
    else status = 'OPEN';
  } else {
    const variant =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (statusRaw as any)?.variant ??
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (statusRaw as any)?.fields?.variant;
    if (typeof variant === 'string') {
      const upper = variant.toUpperCase();
      if (upper === 'DRAWN') status = 'DRAWN';
      else if (upper === 'CLOSED') status = 'CLOSED';
    }
  }

  const potCoin = rawFields.pot_coin ?? {};
  const potValue =
    potCoin?.fields?.value ??
    potCoin?.value ??
    rawFields.pot_amount ??
    0;

  const participants: string[] = Array.isArray(rawFields.participants)
    ? rawFields.participants.map((p: unknown) => String(p))
    : [];

  let winner: string | null = null;
  const winnerRaw = rawFields.winner;
  if (winnerRaw != null) {
    if (typeof winnerRaw === 'string') {
      winner = winnerRaw;
    } else if (Array.isArray(winnerRaw)) {
      const first = winnerRaw[0];
      if (typeof first === 'string') winner = first;
      else if (first && typeof first === 'object' && typeof first.addr === 'string') {
        winner = first.addr;
      }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fields = (winnerRaw as any).fields ?? winnerRaw;
      const inner = fields.value ?? fields.some ?? fields.addr;
      if (typeof inner === 'string') {
        winner = inner;
      }
    }
  }

  const toBigIntSafe = (value: unknown): bigint => {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number') return BigInt(value);
    if (typeof value === 'string') {
      if (value === '') return 0n;
      return BigInt(value);
    }
    return 0n;
  };

  return {
    id: objectId,
    activityId,
    status,
    potAmount: toBigIntSafe(potValue),
    participants,
    winner,
  };
};

export const useCurrentLottery = (
  activity: Activity | null,
): UseQueryResult<LotteryView | null> => {
  const client = useIotaClient();
  const { network } = useIotaClientContext();

  const lotteryId = activity?.lotteryId ?? null;
  const enabled = Boolean(lotteryId);

  return useQuery({
    queryKey: ['lottery', network, lotteryId],
    enabled,
    queryFn: async () => {
      if (!lotteryId) return null;

      const res = await client.getObject({
        id: lotteryId,
        options: {
          showContent: true,
        },
      });

      if (!res.data || res.data.content == null) {
        return null;
      }

      const lottery = mapLotteryFromObject(res);

      const view: LotteryView = {
        lottery,
        isOpen: lottery.status === 'OPEN',
        isDrawn: lottery.status === 'DRAWN',
        isClosed: lottery.status === 'CLOSED',
        participantCount: lottery.participants.length,
      };

      return view;
    },
  });
};

