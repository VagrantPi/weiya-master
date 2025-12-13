import type { IotaClient } from '@iota/iota-sdk/client';
import type { IotaEvent, IotaEventFilter } from '@iota/iota-sdk/client';

import { subscribeGraphqlWs, type GraphqlWsMode, type GraphqlWsStatus } from './graphqlWs';
import {
  type AnnualPartyEvent,
  type AnnualPartyEventSource,
  parseGraphqlEventsPayload,
  parseIotaEvent,
} from './iotaEvents';

export type AnnualPartyEventStreamMode = 'WS' | 'POLLING';

export interface AnnualPartyEventStreamStatus {
  mode: AnnualPartyEventStreamMode;
  wsStatus: GraphqlWsStatus;
  wsMode: GraphqlWsMode;
  pollingActive: boolean;
  lastError: string | null;
}

export interface StartAnnualPartyEventStreamOptions {
  client: IotaClient;
  graphqlWsUrl: string;
  packageId: string;
  module: string;
  activityId?: string | null;
  eventTypeNames?: string[];
  debug?: boolean;
  pollingIntervalMs?: number;
  onStatus?: (status: AnnualPartyEventStreamStatus) => void;
}

export interface SubscribeToAnnualPartyEventsOptions {
  graphqlWsUrl: string;
  packageId: string;
  module: string;
  debug?: boolean;
  onStatus?: (wsStatus: GraphqlWsStatus, wsMode: GraphqlWsMode) => void;
  onError?: (error: Error) => void;
}

export const subscribeToAnnualPartyEvents = (
  opts: SubscribeToAnnualPartyEventsOptions,
  onEvent: (event: AnnualPartyEvent) => void,
): (() => void) => {
  const filter = {
    MoveEventModule: { package: opts.packageId, module: opts.module },
  };

  return subscribeGraphqlWs<unknown>({
    url: opts.graphqlWsUrl,
    debug: opts.debug,
    query: `
      subscription Events($filter: SubscriptionEventFilter) {
        events(filter: $filter) {
          timestamp
          sender
          type
          json
          data { json }
        }
      }
    `,
    variables: { filter },
    reconnect: {
      initialDelayMs: 800,
      maxDelayMs: 20_000,
      maxAttempts: 5,
      ackTimeoutMs: 6000,
    },
    onStatus: (nextStatus, nextMode) => {
      opts.onStatus?.(nextStatus, nextMode);
    },
    onError: (err) => {
      opts.onError?.(err);
    },
    onNext: (payload) => {
      if (payload && typeof payload === 'object' && 'errors' in payload) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const errors = (payload as any).errors;
        if (Array.isArray(errors) && errors.length > 0) {
          const first = errors[0];
          const message =
            typeof first?.message === 'string'
              ? first.message
              : 'GraphQL subscription 回傳 errors';
          opts.onError?.(new Error(message));
          return;
        }
      }

      const events = parseGraphqlEventsPayload(payload, 'graphql');
      for (const ev of events) {
        if (ev.packageId !== opts.packageId) continue;
        if (ev.module !== opts.module) continue;
        onEvent(ev);
      }
    },
  });
};

export interface StartPollingEventsOptions {
  client: IotaClient;
  query: IotaEventFilter;
  intervalMs?: number;
  startFromLatest?: boolean;
  debug?: boolean;
}

export const startPollingEvents = (
  opts: StartPollingEventsOptions,
  onEvent: (event: IotaEvent) => void,
): (() => void) => {
  const intervalMs = opts.intervalMs ?? 4000;
  const startFromLatest = opts.startFromLatest ?? true;

  let stopped = false;
  let cursor: IotaEvent['id'] | null = null;
  let isRunning = false;
  let tickTimer: number | null = null;

  const log = (...args: unknown[]) => {
    if (!opts.debug) return;
    // eslint-disable-next-line no-console
    console.log('[poll-events]', ...args);
  };

  const initCursor = async () => {
    if (!startFromLatest) return;
    const res = await opts.client.queryEvents({
      query: opts.query,
      limit: 1,
      order: 'descending',
    });
    cursor = res.data?.[0]?.id ?? null;
  };

  const tick = async () => {
    if (stopped) return;
    if (isRunning) return;
    isRunning = true;
    try {
      if (!cursor && startFromLatest) {
        await initCursor();
        return;
      }

      const res = await opts.client.queryEvents({
        query: opts.query,
        cursor,
        limit: 50,
        order: 'ascending',
      });

      for (const ev of res.data ?? []) {
        onEvent(ev);
        cursor = ev.id;
      }
    } catch (err) {
      log('poll error', err);
    } finally {
      isRunning = false;
    }
  };

  const loop = () => {
    void tick();
    tickTimer = window.setTimeout(loop, intervalMs);
  };

  void initCursor()
    .catch((err) => log('init cursor error', err))
    .finally(() => {
      if (stopped) return;
      loop();
    });

  return () => {
    stopped = true;
    if (tickTimer != null) window.clearTimeout(tickTimer);
    tickTimer = null;
  };
};

const normalizeTypeNames = (names: string[] | undefined): string[] => {
  if (!names || names.length === 0) return [];
  return names.map((name) => name.trim()).filter(Boolean);
};

const eventMatches = (
  event: AnnualPartyEvent,
  cfg: { packageId: string; module: string; activityId?: string | null; eventTypeNames?: string[] },
) => {
  if (event.packageId !== cfg.packageId) return false;
  if (event.module !== cfg.module) return false;

  // 若指定 activityId，則只處理該活動相關事件（event 沒帶 activityId 的話視為不相關）
  if (cfg.activityId && (!event.activityId || cfg.activityId !== event.activityId)) {
    return false;
  }

  const names = normalizeTypeNames(cfg.eventTypeNames);
  if (names.length === 0) return true;

  const lower = event.structName.toLowerCase();
  return names.some((n) => lower === n.toLowerCase() || event.type.toLowerCase().includes(n.toLowerCase()));
};

export const startAnnualPartyEventStream = (
  opts: StartAnnualPartyEventStreamOptions,
  onEvent: (event: AnnualPartyEvent) => void,
): (() => void) => {
  let stopped = false;

  let mode: AnnualPartyEventStreamMode = 'WS';
  let wsStatus: GraphqlWsStatus = 'IDLE';
  let wsMode: GraphqlWsMode = 'unknown';
  let pollingActive = false;
  let lastError: string | null = null;

  const emitStatus = () => {
    opts.onStatus?.({
      mode,
      wsStatus,
      wsMode,
      pollingActive,
      lastError,
    });
  };

  const setError = (err: unknown, fallback: string) => {
    if (err instanceof Error) lastError = err.message;
    else if (typeof err === 'string') lastError = err;
    else lastError = fallback;
    emitStatus();
  };

  const stopPollingRef: { current: (() => void) | null } = { current: null };
  const stopWsRef: { current: (() => void) | null } = { current: null };

  const startPolling = (source: AnnualPartyEventSource) => {
    if (stopPollingRef.current) return;

    mode = 'POLLING';
    pollingActive = true;
    emitStatus();

    const intervalMs = opts.pollingIntervalMs ?? 4000;

    let cursor: IotaEvent['id'] | null = null;
    let isRunning = false;
    let tickTimer: number | null = null;

    const query: IotaEventFilter = {
      MoveModule: { package: opts.packageId, module: opts.module },
    };

    const initCursor = async () => {
      try {
        const res = await opts.client.queryEvents({
          query,
          limit: 1,
          order: 'descending',
        });
        cursor = res.data?.[0]?.id ?? null;
      } catch (err) {
        setError(err, '初始化事件 cursor 失敗');
      }
    };

    const tick = async () => {
      if (stopped) return;
      if (isRunning) return;
      isRunning = true;
      try {
        if (!cursor) {
          await initCursor();
          return;
        }

        const res = await opts.client.queryEvents({
          query,
          cursor,
          limit: 50,
          order: 'ascending',
        });

        for (const ev of res.data ?? []) {
          const parsed = parseIotaEvent(ev, source);
          if (!eventMatches(parsed, opts)) continue;
          onEvent(parsed);
          cursor = ev.id;
        }
      } catch (err) {
        setError(err, '輪詢事件失敗');
      } finally {
        isRunning = false;
      }
    };

    const loop = () => {
      void tick();
      tickTimer = window.setTimeout(loop, intervalMs);
    };

    void initCursor().then(() => {
      if (stopped) return;
      loop();
    });

    stopPollingRef.current = () => {
      pollingActive = false;
      emitStatus();
      if (tickTimer != null) window.clearTimeout(tickTimer);
      tickTimer = null;
      stopPollingRef.current = null;
    };
  };

  const startWs = () => {
    stopWsRef.current = subscribeToAnnualPartyEvents(
      {
        graphqlWsUrl: opts.graphqlWsUrl,
        packageId: opts.packageId,
        module: opts.module,
        debug: opts.debug,
        onStatus: (nextStatus, nextMode) => {
          wsStatus = nextStatus;
          wsMode = nextMode;
          emitStatus();
        },
        onError: (err) => {
          setError(err, 'GraphQL 訂閱失敗');
          if (stopped) return;

          // WS 失敗時自動切到 polling（符合 GitHub Pages 無後端假設）
          if (mode === 'WS') {
            // 避免 WS 重連與 polling 同時進行，造成不必要的負載
            stopWsRef.current?.();
            stopWsRef.current = null;
            startPolling('polling');
          }
        },
      },
      (ev) => {
        if (!eventMatches(ev, opts)) return;
        onEvent(ev);
      },
    );
  };

  startWs();
  emitStatus();

  return () => {
    stopped = true;
    stopWsRef.current?.();
    stopWsRef.current = null;
    stopPollingRef.current?.();
    stopPollingRef.current = null;
  };
};
