## Step 9：錢包連線 & Snap 整合（hooks + context）

### 🎯 這一步的目標

1. 用 **MetaMask + IOTA Snap** 完成「連線 / 斷線 / 顯示當前帳戶」的最小流程。
2. 把 **Snap 狀態（是否安裝 / 是否授權 / 目前帳戶）** 統一包成 React Context + hooks，其他頁面只需要呼叫 hook。
3. 和 `@iota/dapp-kit` 統一：

   * dapp-kit 負責「IOTA 客戶端、currentAccount、網路資訊」。
   * Snap hook 負責「MetaMask / Snap 是否就緒、觸發連線」。

> 之後 Step 10+ 的所有 on-chain 操作 hooks（Activity / Lottery / Game …）都只需要依賴這一層「錢包已連線」。

---

## 9.1 新增 / 調整檔案列表

1. `src/config/iota.ts`
2. `src/wallet/snapConfig.ts`
3. `src/wallet/useIotaSnap.ts`
4. `src/contexts/WalletContext.tsx`
5. `src/hooks/useWallet.ts`
6. `src/App.tsx` / `src/main.tsx`（把 Provider 串起來）
7. （可選）`src/components/wallet/ConnectWalletButton.tsx`

---

## 9.2 `src/config/iota.ts` – 網路 & Package 基本設定

> 這檔在前面步驟應該已存在，如果還沒就補上，這裡只定義「跟鏈 &合約有關的常數」，不含 UI。

**需求：**

* 匯出：

  * `SUPPORTED_NETWORKS`: `"devnet" | "testnet" | "mainnet"` 中你要支援的 subset（例如只支援 devnet）。
  * `DEFAULT_NETWORK`: 預設網路 key。
  * `NETWORK_CONFIG`: 每個網路的 RPC URL、Faucet URL（如果需要）、explorer base URL。
  * `ANNUAL_PARTY_PACKAGE_ID`: 每個網路的 package id（你目前 devnet 的那顆：`0x4357...ebb7`）。

---

## 9.3 `src/wallet/snapConfig.ts` – Snap 常數 & 型別

**需求：**

* 定義 MetaMask Snap 基本資訊（以 library 要求為主，這裡用專案層常數包起來）：

```ts
export const IOTA_SNAP_ID = "npm:@liquidlink-lab/iota-snap-for-metamask";
// 或官方文件要求的 snapId 格式（如果不同再調整）

export const IOTA_SNAP_VERSION = "^1.0.0"; // version range，實際依 snap 發佈版本調整
```

* 定義一些通用型別（給 hook 內部用）：

```ts
export type SnapStatus = "NOT_INSTALLED" | "INSTALLED" | "CONNECTED" | "ERROR";

export interface IotaSnapAccount {
  iotaAddress: string;
  // 若 Snap 會回傳其他資訊（例如 chainId、label），可以再補
}
```

---

## 9.4 `src/wallet/useIotaSnap.ts` – 跟 MetaMask / Snap 直接互動的 hook

> 這一層是「最接近 window.ethereum」的 hook，專門負責：偵測錢包 / 呼叫 Snap API / 回傳狀態。
> 上層 Context 不要直接碰 `window.ethereum`。

**目標 API：**

```ts
export const useIotaSnap = () => {
  const [status, setStatus] = useState<SnapStatus>("NOT_INSTALLED");
  const [isLoading, setIsLoading] = useState(false);
  const [accounts, setAccounts] = useState<IotaSnapAccount[]>([]);
  const [error, setError] = useState<string | null>(null);

  const checkSnap = async () => { /* ... */ };
  const connectSnap = async () => { /* ... */ };
  const disconnectSnap = async () => { /* 視 Snap 能力，也可只是清掉 local state */ };

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
```

**實作要求（給 codex）：**

1. **偵測 MetaMask 是否存在**

   * 使用 `window.ethereum`。
   * 若不存在，`status` 直接標成 `"ERROR"`，`error = "MetaMask not detected"`，之後的 `connectSnap` 要給出正確錯誤訊息。

2. **偵測 Snap 是否已安裝 / 授權**

   * 透過標準 snaps RPC，例如（實際以 library 或 MetaMask Snaps docs 為準）：
     `wallet_getSnaps` / `wallet_requestSnaps`。
   * `checkSnap()` 須做：

     * 呼叫 `wallet_getSnaps`。
     * 檢查 `IOTA_SNAP_ID` 是否出現在回傳列表。
     * 若有 → `status = "INSTALLED"`（或如果同時有帳戶資訊、直接設 "CONNECTED"）。
     * 若無 → `status = "NOT_INSTALLED"`。

3. **連線 / 安裝 Snap**

   * `connectSnap()` 流程：

     1. `setIsLoading(true)`。
     2. 透過 `wallet_requestSnaps` 請求安裝 / 授權 IOTA Snap：

        ```ts
        await window.ethereum.request({
          method: "wallet_requestSnaps",
          params: {
            [IOTA_SNAP_ID]: { version: IOTA_SNAP_VERSION },
          },
        });
        ```
     3. Snap 安裝完成後，呼叫 Snap 定義的 API，取得 IOTA 帳戶資訊。

        * 例如 library 可能有包一層 helper（`getIotaAccountsFromSnap()` 之類）。
        * 如果沒 helper，就用：
          `window.ethereum.request({ method: 'wallet_invokeSnap', params: { snapId: IOTA_SNAP_ID, request: { method: 'getAccounts' } } })`
          （具體 method 名稱請對照 Snap 官方說明，這裡只定義「需要有一個能拿到 IOTA address 的 method」。）
     4. 把回傳的 addresses map 成 `IotaSnapAccount[]` 存入 state。
     5. `status = "CONNECTED"`。

4. **錯誤處理**

   * 任一 request 出錯時：

     * `setError(error.message ?? "Unknown Snap error")`
     * `status = "ERROR"`
     * `isLoading = false`

5. **初始化行為**

   * hook `useEffect`：

     * component mount 時自動跑 `checkSnap()` 一次，讓 UI 可以立即知道現在狀態。

---

## 9.5 `src/contexts/WalletContext.tsx` – App 級別的錢包 Context

> 這個 context 把「Snap 狀態 + dapp-kit 狀態」合併成一個簡單介面，給全站使用。

**Context 型別：**

```ts
export interface WalletContextValue {
  // Snap 部分
  snapStatus: SnapStatus;
  isSnapLoading: boolean;
  snapError: string | null;
  connectSnap: () => Promise<void>;
  disconnectSnap: () => Promise<void>;

  // IOTA 帳戶（從 dapp-kit）
  currentAccount: ReturnType<typeof useCurrentAccount> | null;
  currentAddress: string;

  // 是否已準備好可以送交易
  isReady: boolean; // snapStatus === "CONNECTED" && !!currentAddress

  // 網路資訊
  network: string; // IOTA devnet/testnet 等
}
```

**Provider 結構：**

```tsx
export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { status, isLoading, error, connectSnap, disconnectSnap, currentAccount: snapAccount } =
    useIotaSnap();

  const dappKitAccount = useCurrentAccount(); // 從 @iota/dapp-kit
  const { network } = useIotaClientContext();

  const currentAddress =
    dappKitAccount?.address ?? snapAccount?.iotaAddress ?? "";

  const isReady = status === "CONNECTED" && !!currentAddress;

  const value: WalletContextValue = {
    snapStatus: status,
    isSnapLoading: isLoading,
    snapError: error,
    connectSnap,
    disconnectSnap,
    currentAccount: dappKitAccount,
    currentAddress,
    isReady,
    network,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};
```

> 實際邏輯：
>
> * 你可以選擇「以 Snap 帳戶為主，再把 address mapping 給 dapp-kit」或「讓 dapp-kit 自己處理 IOTA wallet connection」，這裡的 Context 只負責把兩者狀態整理成乾淨介面，方便後面 hooks 使用。

---

## 9.6 `src/hooks/useWallet.ts` – 給頁面和其他 hooks 用的簡化介面

**需求：**

* 很多 hooks 都只想知道「地址 / 是否 ready / 怎麼觸發 connect」，不需要知道 Snap 細節。
* 做一個薄包裝：

```ts
export const useWallet = () => {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within WalletProvider");
  }

  const {
    snapStatus,
    isSnapLoading,
    snapError,
    connectSnap,
    disconnectSnap,
    currentAccount,
    currentAddress,
    isReady,
    network,
  } = ctx;

  return {
    snapStatus,
    isSnapLoading,
    snapError,
    connectSnap,
    disconnectSnap,
    currentAccount,
    currentAddress,
    isReady,
    network,
    // 方便 UI 判斷
    isConnected: isReady,
    isSnapInstalled: snapStatus === "INSTALLED" || snapStatus === "CONNECTED",
  };
};
```

---

## 9.7 `src/App.tsx` / `src/main.tsx` – Provider 組裝順序

> 這邊要把：`QueryClientProvider`（react-query）+ `IotaClientProvider`（dapp-kit）+ `WalletProvider` 串起來。

**組裝要求：**

1. 最外層：`QueryClientProvider`。
2. 裡層包 `IotaClientProvider`（`@iota/dapp-kit` 提供，用來注入 IOTA client & network）。
3. 再包 `WalletProvider`（我們剛做的）。
4. 最內層是 Router（Step 8 做好的 routes）。

範例（概念層次）：

```tsx
<QueryClientProvider client={queryClient}>
  <IotaClientProvider network={DEFAULT_NETWORK} /* ...rpcUrl 等設定 */>
    <WalletProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </WalletProvider>
  </IotaClientProvider>
</QueryClientProvider>
```

> codex 要依 dapp-kit 官方提供的 Provider 實際名稱實作（通常會有 `IotaAppKitProvider` / `IotaWalletProvider` 之類的 wrapper）。

---

## 9.8 `src/components/wallet/ConnectWalletButton.tsx` – 共用錢包按鈕

> UI 風格會交給 codex，但功能需求要寫清楚。

**需求：**

* 使用 `useWallet()`。

* 根據狀態顯示不同文案：

  | 狀態                               | 按鈕 / 顯示文案                   |
  | -------------------------------- | --------------------------- |
  | 沒有 MetaMask / Snap error         | 顯示錯誤警告（紅字）+「開啟 MetaMask」    |
  | `snapStatus === "NOT_INSTALLED"` | `Install IOTA Snap`         |
  | `snapStatus === "INSTALLED"`     | `Connect IOTA Snap`         |
  | `snapStatus === "CONNECTED"`     | 顯示縮短地址 + `Disconnect`（如果需要） |

* 點擊行為：

  * 按鈕 `onClick` → 呼叫 `connectSnap()`。
  * `isSnapLoading` 時按鈕要 disabled 並顯示 Loading 狀態。

* Cyberpunk 風格（交給 codex）建議：

  * 霓虹外框（例如青色 / 紫色 glow）。
  * hover 時外框脈動效果。
  * 顯示當前 network（devnet / testnet）+ 簡短地址（例如 `0x1234...abcd`）。

---

## 9.9 與後續 hooks 的整合約束

之後的所有鏈上 hooks（你前面已規劃的）必須遵守：

1. **進入點一律使用 `useWallet()` 拿地址 / network：**

   * `const { currentAddress, network, isReady } = useWallet();`
2. **如果 `!isReady`：**

   * 不發 transaction。
   * UI 顯示「請先連接 IOTA Snap」。
3. **`useActivityOperations` / `useLotteryOperations` / `useGameOperations` 等：**

   * 不再自己處理錢包連線，只接受 `ctx` & 物件 ID。

---

## 這一步完成的定義（Done Definition）

* [ ] `useIotaSnap` 可以：

  * [ ] 偵測 MetaMask 存在與否。
  * [ ] 偵測 Snap 是否已安裝。
  * [ ] 呼叫 Snap 取得至少一個 IOTA address。
* [ ] `WalletContext` 已經把 Snap + dapp-kit 狀態整合好。
* [ ] `useWallet` 提供 `currentAddress`、`isReady` 等簡單介面。
* [ ] App 的 root 已經用 `QueryClientProvider + IotaClientProvider + WalletProvider` 包起來。
* [ ] 有一個可重用的 `ConnectWalletButton`，可以放在 Header / Activity 頁最上方，用來觸發 Snap 連線。

