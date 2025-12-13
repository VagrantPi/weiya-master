import type { AnnualPartyEvent } from './iotaEvents';

export interface LotteryExecutedEventPayload {
  activityId: string | null;
  lotteryId: string | null;
  winnerAddr: string | null;
  amount: bigint | null;
}

const readString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const readBigInt = (value: unknown): bigint | null => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return BigInt(trimmed);
    } catch {
      return null;
    }
  }
  return null;
};

const readField = (
  json: unknown,
  keys: string[],
): unknown => {
  if (!json || typeof json !== 'object') return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = json as any;

  for (const key of keys) {
    if (key in obj) return obj[key];
  }

  const fields = obj.fields;
  if (fields && typeof fields === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f = fields as any;
    for (const key of keys) {
      if (key in f) return f[key];
    }
  }

  return null;
};

// 這裡只做「寬鬆解析」，避免因節點回傳 shape 不同而失效
export const parseLotteryExecutedEventPayload = (
  event: AnnualPartyEvent,
): LotteryExecutedEventPayload | null => {
  if (event.structName !== 'LotteryExecutedEvent') return null;

  const json = event.json;

  const activityId = readString(readField(json, ['activity_id', 'activityId']));
  const lotteryId = readString(readField(json, ['lottery_id', 'lotteryId']));
  const winnerAddr = readString(readField(json, ['winner_addr', 'winnerAddr']));
  const amount = readBigInt(readField(json, ['amount']));

  return { activityId, lotteryId, winnerAddr, amount };
};

export const makeLotteryExecutedToastKey = (
  event: AnnualPartyEvent,
  payload: LotteryExecutedEventPayload,
): string => {
  return [
    event.type,
    event.timestampMs ?? '',
    payload.activityId ?? '',
    payload.lotteryId ?? '',
    payload.winnerAddr ?? '',
    payload.amount?.toString() ?? '',
  ].join('|');
};

