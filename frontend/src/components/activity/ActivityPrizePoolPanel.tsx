import type { FC } from 'react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { formatIota } from '../../utils/iotaUnits';

interface ActivityDetailView {
  id: string;
  status: 'OPEN' | 'CLOSED';
  prizePoolAmount: bigint;
}

interface ActivityPrizePoolPanelProps {
  activity: ActivityDetailView;
  isOrganizer: boolean;
  ops: {
    addPrizeFund: (amount: bigint) => Promise<void>;
    isAdding: boolean;
  };
  onRefresh: () => Promise<void>;
}

const parseBigIntInput = (raw: string): bigint | null => {
  const trimmed = raw.trim();
  if (!trimmed) return 0n;
  try {
    return BigInt(trimmed);
  } catch {
    return null;
  }
};

export const ActivityPrizePoolPanel: FC<ActivityPrizePoolPanelProps> = ({
  activity,
  isOrganizer,
  ops,
  onRefresh,
}) => {
  const [amountInput, setAmountInput] = useState('0');

  const parsedAmount = useMemo(
    () => parseBigIntInput(amountInput),
    [amountInput],
  );

  const canAdd =
    isOrganizer &&
    activity.status === 'OPEN' &&
    parsedAmount != null &&
    parsedAmount > 0n;

  const handleAdd = async () => {
    if (!canAdd || parsedAmount == null) return;
    try {
      await ops.addPrizeFund(parsedAmount);
      await onRefresh();
      setAmountInput('0');
    } catch (err) {
      if (err instanceof Error) {
        toast.error(`加碼獎金池失敗：${err.message}`);
      } else {
        toast.error('加碼獎金池失敗');
      }
    }
  };

  return (
    <section className="card section activity-panel">
      <h2 className="section-title">獎金池加碼</h2>
      <p className="section-description">
        只有主辦可在活動進行中加碼獎金池，後續 Bonus / 抽獎 / 遊戲 / 結算都會使用同一個獎金池。
      </p>

      <div className="section-grid">
        <div className="section-item">
          <span className="meta-label">目前獎金池</span>
          <span className="meta-value">{formatIota(activity.prizePoolAmount)} IOTA</span>
        </div>
        <div className="section-item">
          <span className="meta-label">活動狀態</span>
          <span className="meta-value">{activity.status}</span>
        </div>
      </div>

      {isOrganizer ? (
        <div className="section-actions">
          {activity.status === 'OPEN' ? (
            <div className="field-row">
              <label className="field-label" htmlFor="addPrizeFundAmount">
                加碼金額（IOTA）
              </label>
              <input
                id="addPrizeFundAmount"
                className="field-input"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="例如：10"
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={handleAdd}
                disabled={!canAdd || ops.isAdding}
              >
                {ops.isAdding ? '加碼中...' : '加碼獎金池'}
              </button>
            </div>
          ) : (
            <p className="card-text">活動已關閉，無法再加碼獎金池。</p>
          )}

          {parsedAmount == null ? (
            <p className="card-text">請輸入正確的整數 IOTA 金額。</p>
          ) : null}
        </div>
      ) : (
        <div className="section-actions">
          <p className="card-text">只有主辦可以加碼獎金池。</p>
        </div>
      )}
    </section>
  );
};

