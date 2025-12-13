import { useState } from 'react';
import { toast } from 'sonner';

interface CreateActivityPanelProps {
  disabled: boolean;
  isCreating: boolean;
  onCreate: (name: string, initialAmount: bigint | number) => Promise<void>;
}

export function CreateActivityPanel({
  disabled,
  isCreating,
  onCreate,
}: CreateActivityPanelProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (disabled || isCreating) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('請輸入活動名稱');
      return;
    }

    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error('請輸入大於 0 的獎金池金額');
      return;
    }

    try {
      await onCreate(trimmedName, BigInt(parsed));
      setName('');
      setAmount('');
      toast.success('活動建立成功');
    } catch (error) {
      if (error instanceof Error) {
        toast.error(`建立活動失敗：${error.message}`);
      } else {
        toast.error(`建立活動失敗：${error}`);
      }
    }
  };

  const isDisabled = disabled || isCreating;

  return (
    <form className="create-activity-form" onSubmit={handleSubmit}>
      <h2 className="card-title">建立新活動</h2>
      <p className="card-text">
        從目前帳戶提取 IOTA 作為獎金池，之後仍可在活動頁面加碼。
      </p>
      {disabled ? (
        <p className="card-text">請先連接 IOTA Snap 錢包，再建立活動。</p>
      ) : null}
      <div className="field-stack">
        <label className="field-label" htmlFor="activity-name">
          活動名稱
        </label>
        <input
          id="activity-name"
          className="field-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：2024 公司尾牙"
          disabled={isDisabled}
        />
      </div>
      <div className="field-stack">
        <label className="field-label" htmlFor="activity-amount">
          初始獎金池（IOTA）
        </label>
        <input
          id="activity-amount"
          className="field-input"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="例如：1000000"
          disabled={isDisabled}
        />
      </div>
      <button
        type="submit"
        className="btn"
        disabled={isDisabled}
      >
        {isCreating ? '建立中...' : '建立活動'}
      </button>
    </form>
  );
}
