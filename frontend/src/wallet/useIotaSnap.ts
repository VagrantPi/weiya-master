import { useEffect, useState } from 'react';

import {
  IOTA_SNAP_ID,
  IOTA_SNAP_VERSION,
  type IotaSnapAccount,
  type SnapStatus,
} from './snapConfig';

type EthereumLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request: (args: { method: string; params?: any }) => Promise<any>;
};

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ethereum?: EthereumLike & Record<string, any>;
  }
}

export const useIotaSnap = () => {
  const [status, setStatus] = useState<SnapStatus>('NOT_INSTALLED');
  const [isLoading, setIsLoading] = useState(false);
  const [accounts, setAccounts] = useState<IotaSnapAccount[]>([]);
  const [error, setError] = useState<string | null>(null);

  const getEthereum = (): EthereumLike | null => {
    if (typeof window === 'undefined') return null;
    const { ethereum } = window;
    if (!ethereum) return null;
    return ethereum;
  };

  const readSnapAccounts = async (eth: EthereumLike) => {
    try {
      const result = await eth.request({
        method: 'wallet_invokeSnap',
        params: {
          snapId: IOTA_SNAP_ID,
          request: {
            method: 'getAccounts',
          },
        },
      });

      const list: IotaSnapAccount[] = Array.isArray(result)
        ? result.map((item) => ({
            iotaAddress: String(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (item as any).iotaAddress ??
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (item as any).address ??
                '',
            ),
          }))
        : [];

      const filtered = list.filter((a) => a.iotaAddress !== '');
      setAccounts(filtered);

      if (filtered.length > 0) {
        setStatus('CONNECTED');
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '讀取 IOTA Snap 帳戶失敗';
      setError(message);
      setStatus('ERROR');
    }
  };

  const checkSnap = async () => {
    setError(null);
    const eth = getEthereum();
    if (!eth) {
      setStatus('ERROR');
      setError('MetaMask not detected');
      return;
    }

    try {
      const snaps = await eth.request({
        method: 'wallet_getSnaps',
      });

      const hasSnap =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Object.values(snaps as Record<string, any>).some(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (snap: any) => snap.id === IOTA_SNAP_ID,
        );

      if (!hasSnap) {
        setStatus('NOT_INSTALLED');
        setAccounts([]);
        return;
      }

      setStatus('INSTALLED');
      await readSnapAccounts(eth);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '檢查 IOTA Snap 狀態失敗';
      setError(message);
      setStatus('ERROR');
    }
  };

  const connectSnap = async () => {
    setIsLoading(true);
    setError(null);
    const eth = getEthereum();
    if (!eth) {
      setStatus('ERROR');
      setError('MetaMask not detected');
      setIsLoading(false);
      return;
    }

    try {
      await eth.request({
        method: 'wallet_requestSnaps',
        params: {
          [IOTA_SNAP_ID]: { version: IOTA_SNAP_VERSION },
        },
      });

      await checkSnap();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '連線 IOTA Snap 失敗';
      setError(message);
      setStatus('ERROR');
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectSnap = async () => {
    // 目前 MetaMask Snap 沒有標準化的「解除安裝」 RPC，
    // 這裡只清除本地 state，交給使用者在 MetaMask UI 移除 Snap。
    setAccounts([]);
    setStatus('INSTALLED');
  };

  useEffect(() => {
    // 初始化時檢查一次 Snap 狀態
    void checkSnap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    status,
    isLoading,
    accounts,
    error,
    checkSnap,
    connectSnap,
    disconnectSnap,
    hasAccount: accounts.length > 0,
    currentAccount: accounts[0] ?? null,
  };
};

