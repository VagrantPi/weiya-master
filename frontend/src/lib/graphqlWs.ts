export type GraphqlWsMode = 'graphql-transport-ws' | 'graphql-ws' | 'unknown';

export type GraphqlWsStatus =
  | 'IDLE'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'FAILED'
  | 'CLOSED';

export interface GraphqlWsSubscribeOptions<TData> {
  url: string;
  query: string;
  variables?: Record<string, unknown>;
  onNext: (data: TData) => void;
  onStatus?: (status: GraphqlWsStatus, mode: GraphqlWsMode) => void;
  onError?: (error: Error) => void;
  debug?: boolean;
  reconnect?: {
    initialDelayMs?: number;
    maxDelayMs?: number;
    maxAttempts?: number;
    ackTimeoutMs?: number;
  };
}

const toError = (value: unknown, fallback: string): Error => {
  if (value instanceof Error) return value;
  if (typeof value === 'string') return new Error(value);
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(fallback);
  }
};

const safeJsonParse = (raw: string): unknown => {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
};

const computeBackoffMs = (
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
) => {
  const factor = Math.max(0, attempt);
  const next = initialDelayMs * Math.pow(2, factor);
  const jitter = Math.floor(Math.random() * 200);
  return Math.min(maxDelayMs, next + jitter);
};

type TransportWsInboundMessage =
  | { type: 'connection_ack' }
  | { type: 'next'; id: string; payload: unknown }
  | { type: 'error'; id?: string; payload?: unknown }
  | { type: 'complete'; id: string }
  | { type: 'ping'; payload?: unknown }
  | { type: 'pong'; payload?: unknown }
  | { type: string; [key: string]: unknown };

type LegacyWsInboundMessage =
  | { type: 'connection_ack' }
  | { type: 'data'; id: string; payload: unknown }
  | { type: 'error'; id?: string; payload?: unknown }
  | { type: 'complete'; id: string }
  | { type: 'ka' }
  | { type: string; [key: string]: unknown };

export const subscribeGraphqlWs = <TData>(
  options: GraphqlWsSubscribeOptions<TData>,
): (() => void) => {
  const reconnectCfg = options.reconnect ?? {};
  const initialDelayMs = reconnectCfg.initialDelayMs ?? 800;
  const maxDelayMs = reconnectCfg.maxDelayMs ?? 30_000;
  const maxAttempts = reconnectCfg.maxAttempts ?? 5;
  const ackTimeoutMs = reconnectCfg.ackTimeoutMs ?? 6000;

  let stopped = false;
  let ws: WebSocket | null = null;
  let status: GraphqlWsStatus = 'IDLE';
  let mode: GraphqlWsMode = 'unknown';
  let attempt = 0;
  let ackTimer: number | null = null;
  let reconnectTimer: number | null = null;

  const subscriptionId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const log = (...args: unknown[]) => {
    if (!options.debug) return;
    // eslint-disable-next-line no-console
    console.log('[graphql-ws]', ...args);
  };

  const emitStatus = (next: GraphqlWsStatus) => {
    status = next;
    options.onStatus?.(status, mode);
  };

  const cleanupTimers = () => {
    if (ackTimer != null) {
      window.clearTimeout(ackTimer);
      ackTimer = null;
    }
    if (reconnectTimer != null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const closeSocket = () => {
    if (!ws) return;
    try {
      ws.close();
    } catch {
      // 忽略 close 失敗
    }
    ws = null;
  };

  const stop = () => {
    stopped = true;
    cleanupTimers();
    closeSocket();
    emitStatus('CLOSED');
  };

  const send = (payload: unknown) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify(payload));
    } catch (err) {
      options.onError?.(toError(err, 'WebSocket 傳送失敗'));
    }
  };

  const startSubscription = () => {
    if (!ws) return;
    if (mode === 'graphql-ws') {
      send({
        id: subscriptionId,
        type: 'start',
        payload: { query: options.query, variables: options.variables ?? {} },
      });
      return;
    }

    send({
      id: subscriptionId,
      type: 'subscribe',
      payload: { query: options.query, variables: options.variables ?? {} },
    });
  };

  const scheduleReconnect = (reason: string) => {
    if (stopped) return;

    cleanupTimers();
    closeSocket();

    if (attempt >= maxAttempts) {
      emitStatus('FAILED');
      options.onError?.(
        new Error(`GraphQL 訂閱連線失敗（已重試 ${attempt} 次）：${reason}`),
      );
      return;
    }

    emitStatus('RECONNECTING');
    const delayMs = computeBackoffMs(attempt, initialDelayMs, maxDelayMs);
    attempt += 1;
    log('reconnect scheduled', { delayMs, reason, attempt });
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delayMs);
  };

  const onTransportMessage = (msg: TransportWsInboundMessage) => {
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'connection_ack') {
      cleanupTimers();
      attempt = 0;
      emitStatus('CONNECTED');
      startSubscription();
      return;
    }

    if (msg.type === 'ping') {
      send({ type: 'pong', payload: msg.payload });
      return;
    }

    if (msg.type === 'next' && msg.id === subscriptionId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = (msg as any).payload;
      options.onNext(payload as TData);
      return;
    }

    if (msg.type === 'error') {
      options.onError?.(toError(msg.payload, 'GraphQL 訂閱回傳 error'));
      scheduleReconnect('subscription error');
      return;
    }

    if (msg.type === 'complete' && msg.id === subscriptionId) {
      scheduleReconnect('subscription complete');
    }
  };

  const onLegacyMessage = (msg: LegacyWsInboundMessage) => {
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'connection_ack') {
      cleanupTimers();
      attempt = 0;
      emitStatus('CONNECTED');
      startSubscription();
      return;
    }

    if (msg.type === 'ka') {
      return;
    }

    if (msg.type === 'data' && msg.id === subscriptionId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = (msg as any).payload;
      options.onNext(payload as TData);
      return;
    }

    if (msg.type === 'error') {
      options.onError?.(toError(msg.payload, 'GraphQL 訂閱回傳 error'));
      scheduleReconnect('subscription error');
      return;
    }

    if (msg.type === 'complete' && msg.id === subscriptionId) {
      scheduleReconnect('subscription complete');
    }
  };

  const connect = () => {
    if (stopped) return;
    cleanupTimers();
    closeSocket();

    emitStatus(attempt > 0 ? 'RECONNECTING' : 'CONNECTING');

    const protocols = ['graphql-transport-ws', 'graphql-ws'];
    ws = new WebSocket(options.url, protocols);

    ws.onopen = () => {
      mode = (ws?.protocol as GraphqlWsMode) || 'unknown';
      log('open', { mode, url: options.url });
      options.onStatus?.(status, mode);

      send({ type: 'connection_init', payload: {} });

      ackTimer = window.setTimeout(() => {
        ackTimer = null;
        scheduleReconnect('ack timeout');
      }, ackTimeoutMs);
    };

    ws.onmessage = (event) => {
      const raw =
        typeof event.data === 'string' ? event.data : String(event.data ?? '');
      const parsed = safeJsonParse(raw);
      if (!parsed || typeof parsed !== 'object') return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const type = (parsed as any).type;
      if (typeof type !== 'string') return;

      if (mode === 'graphql-ws') {
        onLegacyMessage(parsed as LegacyWsInboundMessage);
      } else {
        onTransportMessage(parsed as TransportWsInboundMessage);
      }
    };

    ws.onerror = (err) => {
      log('error', err);
      options.onError?.(toError(err, 'WebSocket 錯誤'));
    };

    ws.onclose = (event) => {
      log('close', { code: event.code, reason: event.reason });
      if (stopped) return;
      scheduleReconnect(`close ${event.code} ${event.reason}`);
    };
  };

  connect();
  return stop;
};

