import type { FC } from 'react';
import { useMemo, useState } from 'react';
import { useRef } from 'react';
import { toast } from 'sonner';

import { useAnnualPartyEvents } from '../../hooks/use-annual-party-events';
import { makeLotteryExecutedToastKey, parseLotteryExecutedEventPayload } from '../../lib/annualPartyEventPayload';
import { formatIota } from '../../utils/iotaUnits';

const short = (addr: string) => {
  if (!addr) return '';
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
};

export const ActivityEventsPanel: FC<{
  activityId: string;
  isConnected: boolean;
  currentAddress: string;
  onRelevantEvent?: () => void;
}> = ({ activityId, isConnected, currentAddress, onRelevantEvent }) => {
  const [typeFilter, setTypeFilter] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const toastedKeysRef = useRef<Set<string>>(new Set());

  const { events, status } = useAnnualPartyEvents({
    activityId,
    enableAutoRefresh: autoRefresh,
    onRelevantEvent,
    eventTypeNames: typeFilter.trim() ? [typeFilter.trim()] : [],
    onEvent: (ev) => {
      if (!isConnected || !currentAddress) return;
      if (ev.structName !== 'LotteryExecutedEvent') return;

      const payload = parseLotteryExecutedEventPayload(ev);
      if (!payload?.winnerAddr) return;
      if (payload.activityId && payload.activityId !== activityId) return;

      if (payload.winnerAddr.toLowerCase() !== currentAddress.toLowerCase()) {
        return;
      }

      const key = makeLotteryExecutedToastKey(ev, payload);
      if (toastedKeysRef.current.has(key)) return;
      toastedKeysRef.current.add(key);

      const amount = payload.amount ?? 0n;
      toast.success(`恭喜你抽中樂透！獎金 ${formatIota(amount)} IOTA`);
    },
  });

  const label = useMemo(() => {
    if (status.mode === 'POLLING') return 'Polling';
    if (status.wsStatus === 'CONNECTED') return 'WebSocket 已連線';
    if (status.wsStatus === 'RECONNECTING') return 'WebSocket 重連中';
    if (status.wsStatus === 'FAILED') return 'WebSocket 失敗（已切換 Polling）';
    return 'WebSocket 連線中';
  }, [status.mode, status.wsStatus]);

  return (
    <section className="card section activity-panel">
      <h2 className="section-title">事件 Event Feed</h2>
      <p className="section-description">
        透過 GraphQL WebSocket 訂閱鏈上事件，若連線失敗會自動改用 polling。
      </p>

      <div className="section-grid">
        <div className="section-item">
          <span className="meta-label">模式</span>
          <span className="meta-value">{label}</span>
        </div>
        <div className="section-item">
          <span className="meta-label">最近錯誤</span>
          <span className="meta-value">{status.lastError ?? '—'}</span>
        </div>
      </div>

      <div className="section-actions">
        <div className="field-row" style={{ gap: '0.5rem' }}>
          <label className="field-label" htmlFor="eventTypeFilter">
            事件類型過濾（可輸入 struct 名稱）
          </label>
          <input
            id="eventTypeFilter"
            className="field-input"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            placeholder="例如：ActivityCreatedEvent"
          />
          <label className="field-label" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            收到事件自動刷新
          </label>
        </div>
      </div>

      <div className="section-actions">
        {events.length === 0 ? (
          <p className="card-text">尚未收到事件。</p>
        ) : (
          <div className="card-text" style={{ display: 'grid', gap: '0.5rem' }}>
            {events.slice(0, 10).map((ev, idx) => (
              <div
                key={`${ev.type}-${ev.timestampMs ?? '0'}-${ev.sender}-${idx}`}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.75rem',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(10,10,25,0.6)',
                }}
              >
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span className="mono">{ev.structName}</span>
                  <span>from {short(ev.sender)}</span>
                  <span style={{ opacity: 0.8 }}>{ev.timestampMs ?? '—'}</span>
                  <span style={{ opacity: 0.8 }}>{ev.source}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
