目標：把整個 App 的「Web3 / IOTA / Snap / React Query Provider 層」先搭好，還不用做任何 UI。

---

## 🧩 Step 2：App Provider & Wallet 基礎環境

### 🎯 階段目標

1. 在 `main.tsx` / `App.tsx` 外層，把整個 App 包進：

   * `QueryClientProvider`（React Query）
   * `IotaClientProvider`（@iota/dapp-kit）
   * `WalletProvider`（MetaMask + IOTA Snap）
2. 建立一個 **全域 Wallet Hook**（例如：`useWalletConnection`），負責：

   * 連接 / 中斷 MetaMask Snap
   * 讀取目前 `account`、`network`
   * 簡單的錯誤 / loading 狀態
3. 建立一個簡單的 **Debug Panel**（純文字即可），顯示：

   * 是否已連接 Snap
   * 目前帳號 address
   * 目前 network

> 這一步不需要任何 Tailwind / UI 套件，先確保 Web3 context 跑得起來。

---

## 📁 2.1 檔案與結構

請新增 / 修改以下檔案：

* `src/main.tsx`
* `src/App.tsx`
* `src/providers/IotaProvider.tsx`
* `src/hooks/useWalletConnection.ts`
* `src/components/debug/WalletDebugPanel.tsx`

你可以自行調整路徑，但概念是：
**Provider 放 `providers/`，Hook 放 `hooks/`，Debug 組件放 `components/debug/`。**

---

## 🧱 2.2 在 main.tsx 注入 Provider

### 需求

1. 在 `main.tsx` 中建立：

   * 一個 React Query 的 `QueryClient`
   * 用 `<QueryClientProvider>` 包住 `<App />`
2. 再往外層包一層自訂的 `<IotaProvider>`，由它負責：

   * `IotaClientProvider`（@iota/dapp-kit）
   * `WalletProvider`（MetaMask Snap）

### main.tsx（行為需求）

* 建立 `const queryClient = new QueryClient({ ... })`

  * 可以使用預設設定，或簡單調整如 `refetchOnWindowFocus: false`
* Render 結構概念如下（用 TSX）：

```tsx
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <IotaProvider>
        <App />
      </IotaProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
```

---

## 🌐 2.3 IotaProvider：IotaClient + WalletProvider + Snap

### 需求

在 `src/providers/IotaProvider.tsx` 中：

1. 匯入：

   * `IotaClientProvider`, `WalletProvider`, `NetworkConfig`, `useIotaClientContext` 等（以 @iota/dapp-kit 官方 API 為準）
   * Snap 相關的 Provider / connector，來自 `@liquidlink-lab/iota-snap-for-metamask`
2. 建立一個 `IotaProvider` component：

   * 接收 `children: ReactNode`
   * 負責把 `children` 包在：

     ```tsx
     <IotaClientProvider config={...}>
       <WalletProvider ...>
         {children}
       </WalletProvider>
     </IotaClientProvider>
     ```

### IotaClientProvider 設定

* 建立一個常數 config，先支援 **單一 network**（例如：`devnet` 或你現在部署用的 network）。
* Config 內容（範例概念，請依據 @iota/dapp-kit 的 NetworkConfig 實際型別）：

```ts
const IOTA_NETWORK_CONFIG: NetworkConfig = {
  network: "devnet", // or shimmer, 或你目前使用的 network 名稱
  nodeUrl: "https://.../api", // 使用實際的 IOTA 節點 URL
};
```

> 具體欄位請依 dapp-kit 官方型別調整。

### WalletProvider 設定（Snap）

* 整合 `@liquidlink-lab/iota-snap-for-metamask` 提供的東西：

  * 例如：`MetaMaskIotaSnapConnector`（名稱請依實際套件為準）
* 在 `WalletProvider` 的 props 中，把 Snap connector 注入進去：

  * `connectors={[metaMaskIotaSnapConnector]}` 或類似寫法（依套件 API 決定）
* Provider 大致結構：

```tsx
export const IotaProvider: React.FC<PropsWithChildren> = ({ children }) => {
  return (
    <IotaClientProvider config={IOTA_NETWORK_CONFIG}>
      <WalletProvider /* 把 Snap connector 丟進來 */>
        {children}
      </WalletProvider>
    </IotaClientProvider>
  );
};
```

---

## 🔌 2.4 useWalletConnection Hook

檔案：`src/hooks/useWalletConnection.ts`

### 需求

包一層共用 Hook，對外提供：

* `currentAccount`
* `currentAddress`
* `network`
* `isConnected`
* `connectWallet` 函式（觸發 Snap 連線）
* `disconnectWallet` 函式（若支援）
* `isConnecting` / `error`（可選）

### 行為

1. 內部使用 `@iota/dapp-kit` 的 hook，例如：

   * `useCurrentAccount()`
   * `useIotaClientContext()` 取得 network 相關資訊
   * `useWallet` 或 Snap 提供的 connect 函式（依實際 API 設計）
2. `currentAddress` 預設為空字串 `""`（當沒連線時）。
3. `isConnected` 條件：

   * `currentAccount != null && currentAccount.address != null`

### 回傳型別（概念）

```ts
export const useWalletConnection = () => {
  // ...
  return {
    currentAccount,
    currentAddress,
    network,
    isConnected,
    connectWallet,
    disconnectWallet,
    isConnecting,
    error,
  };
};
```

---

## 🧪 2.5 WalletDebugPanel：確認 Provider 是否正常

檔案：`src/components/debug/WalletDebugPanel.tsx`

### 需求

* 建立一個 React component：

  * 使用 `useWalletConnection()`
* 在畫面上顯示：

  * `Connected: true / false`
  * `Address: 0x....`（沒連線顯示 `-`）
  * `Network: devnet / ...`
* 提供兩個按鈕：

  * 「Connect Wallet」→ 呼叫 `connectWallet()`
  * 「Disconnect」→ 呼叫 `disconnectWallet()`（如果有實作）

UI 可以非常簡單，例如：

```tsx
export const WalletDebugPanel: React.FC = () => {
  const {
    currentAddress,
    network,
    isConnected,
    connectWallet,
    disconnectWallet,
    isConnecting,
  } = useWalletConnection();

  return (
    <div>
      <h2>Wallet Debug</h2>
      <p>Connected: {isConnected ? "Yes" : "No"}</p>
      <p>Address: {currentAddress || "-"}</p>
      <p>Network: {network}</p>
      <button onClick={connectWallet} disabled={isConnecting}>
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </button>
      <button onClick={disconnectWallet}>Disconnect</button>
    </div>
  );
};
```

---

## 🏠 2.6 在 App.tsx 中掛上 Debug Panel

檔案：`src/App.tsx`

### 需求

* 目前 App 僅需要：

  * 顯示專案名稱，例如：`"IOTA Annual Party DApp"`
  * 渲染 `<WalletDebugPanel />`
* 之後會再替換成實際 UI / cyberpunk 風格，現在純功能驗證。

範例：

```tsx
import { WalletDebugPanel } from "./components/debug/WalletDebugPanel";

export const App = () => {
  return (
    <div>
      <h1>IOTA Annual Party DApp</h1>
      <WalletDebugPanel />
    </div>
  );
};
```

---

## ✅ Step 2 驗收標準

1. 專案啟動後（`npm run dev` 或 `pnpm dev`）：

   * 首頁看得到「IOTA Annual Party DApp」+ Wallet Debug 區塊。
2. 點擊「Connect Wallet」：

   * 會觸發 MetaMask / Snap 連線流程（實際 UI / popup 依 Snap 實作為準）。
3. 連線成功後：

   * `Connected: Yes`
   * `Address` 顯示目前帳號
   * `Network` 顯示正確 network 名稱（例如 devnet）
4. 重新整理頁面後，Wallet 狀態能正常重新讀取（如果 Snap / dapp-kit 有提供持久化）。
