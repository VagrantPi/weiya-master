import type { IotaEvent } from '@iota/iota-sdk/client';

export type AnnualPartyEventSource = 'graphql' | 'polling';

export interface AnnualPartyEvent {
  source: AnnualPartyEventSource;
  timestampMs: string | null;
  sender: string;
  type: string;
  packageId: string | null;
  module: string | null;
  structName: string;
  activityId: string | null;
  json: unknown;
}

const readString = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim() !== '') return value;
  return null;
};

export const splitMoveType = (moveType: string): {
  packageId: string | null;
  module: string | null;
  structName: string;
} => {
  const parts = moveType.split('::');
  const packageId = readString(parts[0]);
  const module = readString(parts[1]);
  const structName = readString(parts[2]) ?? moveType;
  return { packageId, module, structName };
};

export const extractActivityId = (json: unknown): string | null => {
  if (!json || typeof json !== 'object') return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const j = json as any;

  const direct =
    readString(j.activity_id) ??
    readString(j.activityId) ??
    readString(j.activity) ??
    null;
  if (direct) return direct;

  const fields = j.fields;
  if (fields && typeof fields === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f = fields as any;
    return readString(f.activity_id) ?? readString(f.activityId) ?? null;
  }

  return null;
};

export const parseIotaEvent = (
  event: IotaEvent,
  source: AnnualPartyEventSource,
): AnnualPartyEvent => {
  const { packageId, module, structName } = splitMoveType(event.type);
  const json = event.parsedJson;
  return {
    source,
    timestampMs: event.timestampMs ?? null,
    sender: event.sender,
    type: event.type,
    packageId,
    module: module ?? event.transactionModule ?? null,
    structName,
    activityId: extractActivityId(json),
    json,
  };
};

type GraphqlEventNode = {
  timestamp?: unknown;
  timestampMs?: unknown;
  sender?: unknown;
  type?: unknown;
  json?: unknown;
  parsedJson?: unknown;
  data?: { json?: unknown } | null;
};

const normalizeGraphqlEvent = (node: GraphqlEventNode): AnnualPartyEvent | null => {
  const sender = readString(node.sender);
  const type = readString(node.type);
  if (!sender || !type) return null;

  const { packageId, module, structName } = splitMoveType(type);

  const json = node.json ?? node.parsedJson ?? node.data?.json ?? null;
  const timestampMs = readString(node.timestampMs) ?? readString(node.timestamp);

  return {
    source: 'graphql',
    timestampMs,
    sender,
    type,
    packageId,
    module,
    structName,
    activityId: extractActivityId(json),
    json,
  };
};

// GraphQL subscription payload 的格式可能隨節點/版本而不同，這裡用寬鬆策略解析
export const parseGraphqlEventsPayload = (
  payload: unknown,
  source: AnnualPartyEventSource,
): AnnualPartyEvent[] => {
  if (!payload || typeof payload !== 'object') return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const root = payload as any;

  const data = root.data ?? root;
  const eventsNode = data?.events ?? null;

  const parsed: AnnualPartyEvent[] = [];

  if (Array.isArray(eventsNode)) {
    for (const item of eventsNode) {
      const ev = normalizeGraphqlEvent(item as GraphqlEventNode);
      if (ev) parsed.push({ ...ev, source });
    }
    return parsed;
  }

  if (eventsNode && typeof eventsNode === 'object') {
    const ev = normalizeGraphqlEvent(eventsNode as GraphqlEventNode);
    if (ev) parsed.push({ ...ev, source });
  }

  return parsed;
};
