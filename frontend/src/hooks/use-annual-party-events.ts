import { useEffect, useMemo, useRef, useState } from 'react';
import { useIotaClient, useIotaClientContext } from '@iota/dapp-kit';

import { getAnnualPartyConfig } from '../consts/annual-party';
import { startAnnualPartyEventStream, type AnnualPartyEventStreamStatus } from '../lib/iotaEventStream';
import type { AnnualPartyEvent } from '../lib/iotaEvents';

export interface UseAnnualPartyEventsOptions {
  enabled?: boolean;
  activityId?: string | null;
  eventTypeNames?: string[];
  enableAutoRefresh?: boolean;
  onRelevantEvent?: () => void;
  onEvent?: (event: AnnualPartyEvent) => void;
  maxEvents?: number;
  pollingIntervalMs?: number;
}

const DEFAULT_WS_URL = 'wss://api.testnet.iota.cafe/graphql';

const buildGraphqlWsUrl = (): string => {
  const envUrl = import.meta.env.VITE_IOTA_GRAPHQL_WS_URL;
  if (typeof envUrl === 'string' && envUrl.trim() !== '') return envUrl;
  return DEFAULT_WS_URL;
};

export const useAnnualPartyEvents = (
  options: UseAnnualPartyEventsOptions = {},
): {
  status: AnnualPartyEventStreamStatus;
  events: AnnualPartyEvent[];
} => {
  const client = useIotaClient();
  const { network } = useIotaClientContext();
  const cfg = getAnnualPartyConfig(network);

  const [events, setEvents] = useState<AnnualPartyEvent[]>([]);
  const [status, setStatus] = useState<AnnualPartyEventStreamStatus>({
    mode: 'WS',
    wsStatus: 'IDLE',
    wsMode: 'unknown',
    pollingActive: false,
    lastError: null,
  });

  const onEventRef = useRef<UseAnnualPartyEventsOptions['onEvent']>(undefined);
  const onRelevantEventRef = useRef<UseAnnualPartyEventsOptions['onRelevantEvent']>(undefined);

  useEffect(() => {
    onEventRef.current = options.onEvent;
  }, [options.onEvent]);

  useEffect(() => {
    onRelevantEventRef.current = options.onRelevantEvent;
  }, [options.onRelevantEvent]);

  const optsMemo = useMemo(() => {
    return {
      enabled: options.enabled ?? true,
      activityId: options.activityId ?? null,
      eventTypeNames: options.eventTypeNames ?? [],
      enableAutoRefresh: options.enableAutoRefresh ?? false,
      maxEvents: options.maxEvents ?? 50,
      pollingIntervalMs: options.pollingIntervalMs ?? 10_000,
    };
  }, [
    options.activityId,
    options.enableAutoRefresh,
    options.eventTypeNames,
    options.enabled,
    options.maxEvents,
    options.pollingIntervalMs,
  ]);

  const lastAutoRefreshAtRef = useRef(0);

  useEffect(() => {
    if (!optsMemo.enabled) {
      return;
    }

    const graphqlWsUrl = buildGraphqlWsUrl();
    const debug = Boolean(import.meta.env.DEV);

    const stop = startAnnualPartyEventStream(
      {
        client,
        graphqlWsUrl,
        packageId: cfg.packageId,
        module: cfg.module,
        activityId: optsMemo.activityId,
        eventTypeNames: optsMemo.eventTypeNames,
        pollingIntervalMs: optsMemo.pollingIntervalMs,
        debug,
        onStatus: setStatus,
      },
      (ev) => {
        onEventRef.current?.(ev);
        if (optsMemo.maxEvents > 0) {
          setEvents((prev) => [ev, ...prev].slice(0, optsMemo.maxEvents));
        }

        if (!optsMemo.enableAutoRefresh) return;
        if (!onRelevantEventRef.current) return;

        const now = Date.now();
        if (now - lastAutoRefreshAtRef.current < 1500) return;
        lastAutoRefreshAtRef.current = now;
        onRelevantEventRef.current();
      },
    );

    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, cfg.packageId, cfg.module, optsMemo.activityId, JSON.stringify(optsMemo.eventTypeNames), optsMemo.enableAutoRefresh, network, optsMemo.enabled, optsMemo.maxEvents, optsMemo.pollingIntervalMs]);

  return { status, events };
};
