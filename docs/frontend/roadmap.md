好，合約已經上鏈 ✅ 接下來就換前端登場了。

下面我分成兩塊跟你講：

1. **實作步驟（你從 0 到跑在 GH Pages 的路線圖）**
2. **前端關鍵規格（給 codex/自己之後切頁面 & hooks 用的 spec）**

全部都預設：

* React + TS + Vite SPA
* 部署 GitHub Pages
* Web3 only via **`@iota/iota-sdk` + `@iota/dapp-kit`**
* 錢包 via **MetaMask + `@liquidlink-lab/iota-snap-for-metamask`**
* on-chain module：`0x4357...beebb7::annual_party`（從你 publish 的 log 來的）

---

## 一、實作步驟 Roadmap

### Step 0：整理 on-chain 常數

先在前端建一個 `src/consts/annual-party.ts`，寫死目前必要資訊：

```ts
// annual-party.ts
export const ANNUAL_PARTY_PACKAGE_ID =
  "0x8afa9d387ab7f4b6e3c9a7f9af7469f5591b5bff02761e887e7c21918d73aaa1";

export const MODULE_ANNUAL_PARTY = `${ANNUAL_PARTY_PACKAGE_ID}::annual_party`;

// 之後會用到的 moveCall target
export const ENTRY_CREATE_ACTIVITY = `${MODULE_ANNUAL_PARTY}::create_activity`;
export const ENTRY_JOIN_ACTIVITY = `${MODULE_ANNUAL_PARTY}::join_activity`;
export const ENTRY_ADD_PRIZE_FUND = `${MODULE_ANNUAL_PARTY}::add_prize_fund`;
export const ENTRY_CREATE_BONUS_EVENT = `${MODULE_ANNUAL_PARTY}::create_bonus_event`;
export const ENTRY_CLAIM_BONUS = `${MODULE_ANNUAL_PARTY}::claim_bonus`;
export const ENTRY_DRAW_PRIZE = `${MODULE_ANNUAL_PARTY}::draw_prize`;
export const ENTRY_CREATE_LOTTERY = `${MODULE_ANNUAL_PARTY}::create_lottery`;
export const ENTRY_JOIN_LOTTERY = `${MODULE_ANNUAL_PARTY}::join_lottery`;
export const ENTRY_EXECUTE_LOTTERY = `${MODULE_ANNUAL_PARTY}::execute_lottery`;
export const ENTRY_CREATE_GAME = `${MODULE_ANNUAL_PARTY}::create_game`;
export const ENTRY_SUBMIT_CHOICE = `${MODULE_ANNUAL_PARTY}::submit_choice`;
export const ENTRY_REVEAL_GAME_ANSWER = `${MODULE_ANNUAL_PARTY}::reveal_game_answer`;
export const ENTRY_CLAIM_GAME_REWARD = `${MODULE_ANNUAL_PARTY}::claim_game_reward`;
export const ENTRY_CLOSE_ACTIVITY = `${MODULE_ANNUAL_PARTY}::close_activity`;
export const ENTRY_CLAIM_CLOSE_REWARD = `${MODULE_ANNUAL_PARTY}::claim_close_reward`;
export const ENTRY_WITHDRAW_REMAINING = `${MODULE_ANNUAL_PARTY}::withdraw_remaining_after_close`;
```

另外再做一個 `network.ts` 管理 network / node URL（對應 dapp-kit 的 IotaClientProvider network 設定）。IOTA 官方建議用 `IotaClientProvider` 串好 client，然後在 app 裡透過 hooks 使用。([IOTA 文檔][1])

---

### Step 1：初始化專案 + GH Pages 設定

1. 建 Vite + React + TS 專案：

   ```bash
   npm create vite@latest iota-annual-party -- --template react-ts
   cd iota-annual-party
   ```

2. 裝必要套件（基礎版）：

   ```bash
   npm i @iota/iota-sdk @iota/dapp-kit @tanstack/react-query sonner
   npm i @liquidlink-lab/iota-snap-for-metamask
   npm i react-router-dom
   ```

   > dapp-kit 官方文件的建議是搭配 React Query 使用，由 `IotaClientProvider` 提供 client、`WalletProvider` 提供錢包 context，然後透過 hooks 取用。([IOTA 文檔][1])

3. GH Pages 設定：

   * `vite.config.ts` 設 `base: '/<repo-name>/'`
   * 用 `HashRouter` 避免 GH Pages 直接 F5 404
   * 後面可以再加 GitHub Actions 自動 deploy。

---

### Step 2：Provider 樓層設計（dapp-kit + React Query + Snap）

`main.tsx` 的外層大概會長這樣（伪 spec）：

```tsx
const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <IotaClientProvider
        network="testnet" // or from env，如 VITE_IOTA_NETWORK
      >
        <WalletProvider>
          <App />
        </WalletProvider>
      </IotaClientProvider>
    </QueryClientProvider>
  </StrictMode>,
);
```

> `IotaClientProvider` 會幫你建立好 `IotaClient`，之後在 hook 中用 `useIotaClient()` 取得。`WalletProvider` 則提供 `useCurrentAccount` / `useSignAndExecuteTransaction` 等錢包相關 hook。([IOTA 文檔][1])

**Snap 部分：**

* `@liquidlink-lab/iota-snap-for-metamask` 會負責和 MetaMask Snap 溝通，你可以包一層 `useIotaSnap()`：

  * 檢查 `window.ethereum` 是否存在
  * 請求安裝 / 連接 IOTA Snap
  * 把 snap expose 出來的 IOTA account / network 資訊，對應回 dapp-kit 的 WalletProvider（例如用一個「Snap wallet adapter」的 pattern 塞進去）。
* 規格層面只要定義：

  ```ts
  type SnapConnectionStatus = "idle" | "checking" | "need_install" | "connected" | "error";

  interface UseIotaSnapResult {
    status: SnapConnectionStatus;
    connectSnap: () => Promise<void>;
    error?: Error;
  }
  ```

  App shell 可以根據 `status` 顯示「請安裝 MetaMask Snap」、「連線中」、「已連線」等 UI。

---

### Step 3：路由 & 頁面切分（Organizer vs Participant）

建議用 `react-router-dom` + HashRouter，切成這幾個 route：

* `/`：Landing + Connect Wallet + 選角色
* `/activity/:activityId/organizer`：主辦端控制台
* `/activity/:activityId/participant`：員工端畫面

**每頁需要的資料：**

1. **共用 `Activity` 狀態**

   * 從 `activityId` 抓 `Activity` object（`status`, `prize_pool_coin` 餘額, `participant_count`, `has_bonus_event`, `close_payout_amount`, `remaining_pool_after_close`, `lottery_id`, `current_game_id`）
   * 對應 hook：`useActivity(activityId)`

2. **Organizer Page**

   * Session 區塊：

     * 建立活動（for MVP 可以先不上 UI，或做一頁「Create Activity」）
     * 加碼獎金池
   * Bonus 區塊：

     * 顯示 `has_bonus_event` / `bonus_amount_per_user`
     * 呼叫 `create_bonus_event`
   * 抽獎區塊 `draw_prize`
   * 樂透管理：

     * 有無 `lottery_id`
     * 建立 / 開獎 `Lottery`
   * 四選一遊戲：

     * 建立 Game
     * 顯示目前 Game 狀態（OPEN / ANSWER_REVEALED / CLOSED）
     * 公布答案 `reveal_game_answer`
   * 活動關閉 + 主辦提款：

     * 呼叫 `close_activity`
     * 呼叫 `withdraw_remaining_after_close`

3. **Participant Page**

   * 報名按鈕 `join_activity`
   * 領取參加獎 `claim_bonus`
   * 顯示個人 `Participant` 狀態（是否已 join、是否領過 bonus、是否領過 close reward）
   * 樂透：

     * 金額輸入 + `join_lottery`
   * 四選一遊戲：

     * 顯示題目 / 選項
     * 選擇一次 `submit_choice`
     * 顯示答案 / 是否得獎
     * 領取獎勵 `claim_game_reward`
   * 活動關閉後：

     * 顯示 `close_payout_amount`
     * 領取關閉獎金 `claim_close_reward`

---

### Step 4：Domain Hooks 設計（重點：全部用 dapp-kit + iota-sdk）

參考你提供的 `useGameOperation` pattern，這邊我幫你規劃三個大的 hook：

1. **`useAnnualPartyRead(activityId)`**

   * 專門負責「讀」：

     * `Activity`
     * 當前 `Lottery`
     * 當前 `Game`
     * 使用者對應的 `Participant`
     * 使用者對應的 `GameParticipation`

2. **`useAnnualPartyOrganizerActions(activityId)`**

   * Organizer 才能用的 entry function

3. **`useAnnualPartyParticipantActions(activityId)`**

   * Participant 用的 entry function

下面是**規格**（接近 codex 可以直接實作的型別定義）：

#### 4.1 共用工具：`useIotaTransaction()`

統一包一層，你之後所有寫入操作都走這一層。

```ts
import { useIotaClient, useSignAndExecuteTransaction } from "@iota/dapp-kit";
import { Transaction } from "@iota/iota-sdk/transactions";

export const useIotaTransaction = () => {
  const client = useIotaClient();
  const { mutateAsync: signAndExecuteTransaction, isPending } =
    useSignAndExecuteTransaction();

  const execute = async (build: (tx: Transaction) => void | Promise<void>) => {
    const tx = new Transaction();
    await build(tx);

    const result = await signAndExecuteTransaction({ transaction: tx });
    await client.waitForTransaction({ digest: result.digest });

    return result;
  };

  return { execute, isPending };
};
```

> 這個 pattern 跟 workshop Lesson 6 裡面用 `Transaction` 建 moveCall，再用 `useSignAndExecuteTransaction` 送出類似。([GitHub][2])

---

#### 4.2 `useAnnualPartyOrganizerActions(activityId)`

輸出 interface（簡化 spec）：

```ts
interface UseAnnualPartyOrganizerActions {
  createActivity: (params: { name: string; initialAmount: bigint }) => Promise<void>;
  addPrizeFund: (amount: bigint) => Promise<void>;

  createBonusEvent: (bonusPerUser: bigint) => Promise<void>;
  drawPrize: (amount: bigint, clientSeed?: bigint) => Promise<void>;

  createLottery: () => Promise<void>;
  executeLottery: (clientSeed?: bigint) => Promise<void>;

  createGame: (params: {
    question: string;
    options: [string, string, string, string];
    rewardAmount: bigint;
    modeCode: 0 | 1; // 0=SINGLE, 1=AVERAGE
  }) => Promise<void>;
  revealGameAnswer: (params: { correctOption: 1 | 2 | 3 | 4; clientSeed?: bigint }) => Promise<void>;

  closeActivity: () => Promise<void>;
  withdrawRemainingAfterClose: () => Promise<void>;

  isPending: boolean; // 從 useIotaTransaction 帶出
}
```

裡面每一個函式都會長得很像你現有 `useGameOperation`：

```ts
const { execute, isPending } = useIotaTransaction();
const currentAccount = useCurrentAccount();
const currentAddress = currentAccount?.address ?? "";

const createBonusEvent = async (bonusPerUser: bigint) => {
  try {
    await execute((tx) => {
      tx.moveCall({
        target: ENTRY_CREATE_BONUS_EVENT,
        arguments: [
          tx.pure.id(activityId), // Activity ID
          tx.object(/* Activity shared object ID / or from props */),
          tx.pure.u64(Number(bonusPerUser)),
          // tx object for TxContext 自己不用傳，Runtime 會補
        ],
      });
    });
    toast.success("Bonus event created");
  } catch (e) {
    toast.error(`Failed to create bonus event: ${(e as Error).message}`);
  }
};
```

> 具體 `arguments` 要依 IOTA Move bindings 怎麼 encode `ID`、`&mut Activity` 而定（和 workshop Lesson 6 會是一樣的風格），這邊 spec 的重點是在「**所有寫入操作都用 Transaction + moveCall + useSignAndExecuteTransaction**」，不要自己打 JSON-RPC。([GitHub][2])

---

#### 4.3 `useAnnualPartyParticipantActions(activityId)`

interface 規格：

```ts
interface UseAnnualPartyParticipantActions {
  joinActivity: () => Promise<void>;
  claimBonus: () => Promise<void>;

  joinLottery: (amount: bigint) => Promise<void>;

  submitChoice: (choice: 1 | 2 | 3 | 4) => Promise<void>;
  claimGameReward: () => Promise<void>;

  claimCloseReward: () => Promise<void>;

  isPending: boolean;
}
```

實作同樣經過 `useIotaTransaction`。呼叫方式像：

```ts
const { joinActivity, claimBonus, joinLottery, ... } =
  useAnnualPartyParticipantActions(activityId);

<button onClick={() => joinActivity()}>Join</button>
<button onClick={() => claimBonus()}>Claim Bonus</button>
```

---

#### 4.4 `useAnnualPartyRead(activityId)`

這個 hook 會使用 `useIotaClient` + `@tanstack/react-query` 去讀鏈上 object，最好用 **React Query** 的 `queryKey` + `refetchInterval` 取代手動 setInterval polling。

規格：

```ts
interface ActivityView {
  id: string;
  organizer: string;
  name: string;
  status: "OPEN" | "CLOSED";
  prizePool: bigint;
  participantCount: number;
  hasBonusEvent: boolean;
  bonusAmountPerUser: bigint;
  closePayoutAmount: bigint;
  remainingPoolAfterClose: bigint;
  lotteryId?: string;
  currentGameId?: string;
}

interface ParticipantView {
  objectId: string;
  owner: string;
  joined: boolean;
  hasClaimedBonus: boolean;
  hasClaimedCloseReward: boolean;
}

interface LotteryView { /* 略，包含 pot amount / participants / status / winner */}
interface GameView { /* question / options / status / rewardAmount / rewardMode / correctOption / etc. */ }

interface UseAnnualPartyReadResult {
  activity?: ActivityView;
  participant?: ParticipantView;
  lottery?: LotteryView;
  game?: GameView;
  isLoading: boolean;
  refetchAll: () => Promise<void>;
}
```

實作重點：

* 用 `client.getObject()` / `client.getObjects()` 去讀 `Activity` / `Lottery` / `Game` / `Participant` 的 object 資料，解析到上述 view 型別。

* 用 React Query：

  ```ts
  const activityQuery = useQuery({
    queryKey: ["activity", activityId],
    queryFn: () => fetchActivity(client, activityId),
    refetchInterval: 8_000, // 尾牙 UI 不用秒刷
  });
  ```

* 對「使用者相關的 object」可以用 `client.getOwnedObjects({ owner: address, ... })` 過濾出 Participant / GameParticipation。

> dapp-kit 本身就是設計給 React Query / hooks 用的組合，這樣做是跟官方推薦的 pattern 對齊。([IOTA 文檔][1])

---

### Step 5：Polling / React Query 策略（你之前問的 pooling 最佳化）

簡單規格一下每種資料的刷新頻率：

* Activity details：`refetchInterval: 10s`（狀態不會秒變）
* Lottery / Game 狀態：在 Organizer 面板上可以用 `5s`，Participant 畫面則改成「按鈕觸發手動 refresh」+ claim 成功後再強制 refetch。
* Participants / GameParticipation：
  user 相關的部分，通常在：

  * 按下 join / submit / claim 之後，成功就 `refetch()` 一次即可；
  * 不需要長期 polling。

---

### Step 6：Cyberpunk 風格設計（給 codex 的最低限規格）

你 UI 交給 codex 做沒問題，但前端 spec 可以先定義幾個 baseline，讓未來元件長得一致：

* **主題：**

  * 背景：`#020617` ~ `#050816` 類暗底
  * 主要螢光色：IOTA 綠系 + Cyberpunk 粉紫

    * Primary：`#00f5d4`
    * Secondary：`#ff6ec7`
    * Accent：`#fbbf24`
* **Layout：**

  * 單頁 2 欄：

    * 左側：活動總覽 + 狀態卡片
    * 右側：目前操作（抽獎 / 樂透 / Game / 領獎）
* **效果：**

  * 漸層線框 + 模糊玻璃（glassmorphism card）
  * 按鈕 hover 時加 outer glow + 微動畫（scale 1.03）
* **字型：**

  * 英文可用 `Orbitron` or `Rajdhani` 類 SF 字體，中文字用 Noto Sans / 思源黑體。

你只要在 spec 先說明：「所有卡片都用相同 neon card component」、「所有按鈕都用同一個 `<NeonButton />`」，之後 codex 只要實作那幾個共用元件就好。

---

## 二、關鍵規格總結（給 codex / 未來自己看的 TL;DR）

### A. 技術棧 & infra

* React 18 + TypeScript + Vite SPA
* Routing：`react-router-dom` + `HashRouter`
* Data fetching：`@tanstack/react-query`
* IOTA SDK：

  * `@iota/iota-sdk`：`Transaction`、Client API
  * `@iota/dapp-kit`：`IotaClientProvider`、`WalletProvider`、`useIotaClient`、`useCurrentAccount`、`useSignAndExecuteTransaction` 等([IOTA 文檔][1])
* Wallet：

  * `MetaMask` + `@liquidlink-lab/iota-snap-for-metamask`
  * 自行封裝 `useIotaSnap()` hook
* Notifications：`sonner`
* Deploy：GitHub Pages（`base` + Actions）

### B. Hook 規格（核心）

1. `useIotaSnap(): { status, connectSnap, error }`
2. `useIotaTransaction(): { execute(buildTx), isPending }`
3. `useAnnualPartyRead(activityId)`：

   * 回傳 `activity / participant / lottery / game` 的 view model + `isLoading / refetchAll`
4. `useAnnualPartyOrganizerActions(activityId)`：

   * 包所有 Organizer 對應的 Move entry：

     * `createActivity`
     * `addPrizeFund`
     * `createBonusEvent`
     * `drawPrize`
     * `createLottery`
     * `executeLottery`
     * `createGame`
     * `revealGameAnswer`
     * `closeActivity`
     * `withdrawRemainingAfterClose`
5. `useAnnualPartyParticipantActions(activityId)`：

   * `joinActivity`
   * `claimBonus`
   * `joinLottery`
   * `submitChoice`
   * `claimGameReward`
   * `claimCloseReward`

全部的 write hook 一律：

* 用 `useCurrentAccount()` 拿 address
* 用 `Transaction` 建 `moveCall`
* 用 `useSignAndExecuteTransaction()` 送出
* `client.waitForTransaction()` 等上鏈
* 成功 / 失敗用 `toast` 告知

---

如果你願意下一步，我可以直接幫你生出：

* `main.tsx` Provider 版型
* `useIotaTransaction` 完整實作
* `useAnnualPartyOrganizerActions` / `useAnnualPartyParticipantActions` 的骨架（只留 TODO 在 moveCall arguments 位置，等你對照 Lesson-6 版型貼上）。

[1]: https://docs.iota.org/developer/ts-sdk/dapp-kit/wallet-provider "WalletProvider | IOTA Documentation"
[2]: https://github.com/Liquidlink-Lab/IOTA-move-workshop-2025/tree/main/Lesson-6 "IOTA-move-workshop-2025/Lesson-6 at main · Liquidlink-Lab/IOTA-move-workshop-2025 · GitHub"
