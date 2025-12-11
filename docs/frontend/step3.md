## Step 3：Activity 讀取 & 建立的 hooks + operations

### 3-1 這一步要完成什麼？

功能面這一步要做到：

1. **讀取活動資料**

   * 可以用 **Activity ObjectID 列表** 把 on-chain 的 `Activity` 拉回來。
   * 可以讀單一 Activity 詳細資訊（之後給 Activity 詳細頁使用）。

2. **建立 / 操作 Activity**

   * 建立新活動 `create_activity`
   * 加入活動 `join_activity`
   * 加碼獎金池 `add_prize_fund`
   * 關閉活動 `close_activity`
   * 主辦領回剩餘獎金 `withdraw_remaining_after_close`

   > `claim_close_reward` 先預留，會在「領獎 & Participant」那一個 step 再拆。

3. 所有鏈上互動：

   * 都要走 `@iota/dapp-kit` 的 hooks（`useIotaClient`, `useCurrentAccount`, `useSignAndExecuteTransaction`）。
   * Tx 建構用 `@iota/iota-sdk/transactions` 的 `Transaction`。
   * 風格跟 workshop 的 `useGameOperation` 一致。

---

### 3-2 新增檔案 & 專案結構

請新增以下檔案（路徑可微調，但請維持這個概念）：

1. **常數與型別**

   * `src/consts/annual-party.ts`
   * `src/types/annual-party.ts`

2. **hooks – queries**

   * `src/hooks/use-activities.ts`
   * 內含：

     * `useActivitiesQuery`
     * `useActivityQuery`

3. **hooks – mutations / operations**

   * `src/hooks/use-activity-operations.ts`
   * 內含：

     * `useActivityOperations`（回傳一包 methods）

> UI component（ActivityList / ActivityDetail）會在下一個 step 才做，這一步只負責「資料層 + operations」。

---

### 3-3 常數 & 型別規格

#### 3-3-1 on-chain 常數

在 `src/consts/annual-party.ts`：

```ts
import { Network } from "@iota/dapp-kit";

export const ANNUAL_PARTY = {
  testnet: {
    packageId:
      "0x43572924a0b39b6509737f93365c5eac9cf2718fe6bdd312281face6fcbeebb7",
    module: "annual_party",
  },
  // devnet / mainnet 如有需要再加
} as const;

export const IOTA_COIN_TYPE = "0x2::iota::IOTA";

export const getAnnualPartyConfig = (network: Network | undefined) => {
  const key = network ?? "testnet";
  return ANNUAL_PARTY[key];
};
```

衍生出來的 type string，後續 hooks 要用：

* `ACTIVITY_TYPE = \`${packageId}::annual_party::Activity``
* `PARTICIPANT_TYPE = \`${packageId}::annual_party::Participant``
  （這一步不直接用到 Participant type，但先定好沒壞處）

#### 3-3-2 TS 型別：Activity

在 `src/types/annual-party.ts` 定義 **前端使用的 Activity ViewModel**
（不是完整 on-chain 型別，而是整理過給 UI 用的）

```ts
export type ActivityStatus = "OPEN" | "CLOSED";

export interface ActivityOnChainRaw {
  // 原始 client 回傳的 object（Move struct）型別，型別可用 any，
  // 但請至少保留 id / content 結構，方便 parsing function 使用。
  id: string;
  // ... 其他欄位依 IOTA SDK 回傳結構定義（可設為 any）
  // 這裡重點是後面有 mapActivityFromObject() 來 parse
}

export interface Activity {
  id: string;
  organizer: string;
  name: string;

  status: ActivityStatus;

  prizePool: bigint; // 對應 prize_pool_coin.value
  participantCount: number;

  hasBonusEvent: boolean;
  bonusAmountPerUser: bigint;

  closePayoutAmount: bigint;
  remainingPoolAfterClose: bigint;

  participants: string[];
  eligibleFlags: boolean[];

  lotteryId: string | null;
  currentGameId: string | null;
}
```

另外需要一個 helper function（寫在 `src/hooks/use-activities.ts` 或單獨 `mappers.ts`）：

```ts
export const mapActivityFromObject = (obj: any): Activity => {
  // 要根據 IOTA SDK getObject 回傳的 Move struct 內容，
  // 把 fields 映射到 Activity 介面：
  // - obj.data.content.fields.organizer
  // - obj.data.content.fields.name
  // - obj.data.content.fields.status
  // - obj.data.content.fields.prize_pool_coin.fields.value
  // ...
};
```

> 具體欄位命名請「參考 workshop 的 `useHeroInventory` 實作方式」，以實際 SDK 回傳結構為準。

---

### 3-4 Queries：Activity 讀取 hooks

檔案：`src/hooks/use-activities.ts`

#### 3-4-1 `useActivitiesQuery`

用途：

* 透過一組 **已知的 Activity ObjectID 列表** 撈出多個 Activity。
* 這一步先不做「用 events or indexer 搜尋全部活動」，先支援「由外部傳入 id 列表」的版本：

  * 後面如果有 indexer / view function，可以再換實作。

Signature：

```ts
import { UseQueryResult } from "@tanstack/react-query";

export const useActivitiesQuery = (
  activityIds: string[]
): UseQueryResult<Activity[]> => { ... };
```

行為規格：

1. 透過 `useIotaClient()` 取得 `client`。
2. 透過 `useIotaClientContext()` 取得 `network`（但這裡只用來判斷 type string / 未來擴展）。
3. 若 `activityIds.length === 0`，直接回傳 `[]`。
4. 使用 `@tanstack/react-query`：

   * `queryKey = ["activities", network, activityIds]`
   * `queryFn` 內用 `Promise.all` 呼叫 IOTA client：

     * 類似 `client.getObject({ id, options: { showContent: true } })`
   * 對每個 object 呼叫 `mapActivityFromObject`，組成 `Activity[]`。

錯誤處理：

* 若有 object 讀取失敗（例如被砍掉），可以：

  * 要嘛整個 query fail
  * 要嘛略過失敗的那幾筆
    由你決定，但請保證錯誤會透過 `error` 露出，方便 UI 顯示 toast。

#### 3-4-2 `useActivityQuery`

用途：

* 用單一 Activity ID 撈一個 Activity。
* 給 Activity 詳細頁 & 操作區塊使用。

Signature：

```ts
export const useActivityQuery = (
  activityId: string | null
): UseQueryResult<Activity | null> => { ... };
```

行為規格：

1. 若 `activityId == null` 或空字串，直接 `enabled: false`。
2. `queryKey = ["activity", network, activityId]`
3. 邏輯類似 `useActivitiesQuery`，只是只抓一筆。
4. 回傳 `null` 表示找不到 / 被刪除，讓 UI 可以顯示「Activity 不存在」訊息。

---

### 3-5 Mutations：Activity operations hooks

檔案：`src/hooks/use-activity-operations.ts`

這個 hook 要統一包成一個：

```ts
export const useActivityOperations = () => {
  return {
    createActivity,
    joinActivity,
    addPrizeFund,
    closeActivity,
    withdrawRemainingAfterClose,
    isPending, // 任一 mutation 發送中時為 true
  };
};
```

#### 共用前置條件

在 hook 頭部：

```ts
const client = useIotaClient();
const currentAccount = useCurrentAccount();
const currentAddress = currentAccount?.address ?? "";
const { network } = useIotaClientContext();
const { mutateAsync: signAndExecuteTransaction, isPending } =
  useSignAndExecuteTransaction();

const { packageId } = getAnnualPartyConfig(network);
const MODULE = "annual_party";

const getTarget = (fn: string) =>
  `${packageId}::${MODULE}::${fn}`;
```

> 所有 `moveCall` 的 `target` 都用 `getTarget("create_activity")` 這種方式拼出來。

---

#### 3-5-1 `createActivity`

Signature：

```ts
const createActivity = async (params: {
  name: string;
  initialAmount: bigint; // 以 IOTA 最小單位
}) => { ... };
```

行為規格：

1. 檢查：`currentAddress` 必須存在，沒有就 throw `"Wallet not connected"`。
2. 建立 `const tx = new Transaction();`
3. `moveCall`：

   * `target: getTarget("create_activity")`
   * `arguments`：

     * `name`（string）
     * `initial_amount`（u64）：從 `params.initialAmount` 轉成 SDK 要求的格式
   * **注意：目前合約的 `withdraw_iota` 仍是 stub，因此這邊不需要提供 IOTA coin 物件，只要傳 pure args 即可。未來如果合約更新成真正 withdraw，這裡要改成類似 workshop 的 `getPaymentCoin()`。**
4. `signAndExecuteTransaction({ transaction: tx })`
5. `await client.waitForTransaction({ digest })`
6. 成功後：

   * 透過 `toast.success("Activity created")`
   * 觸發 `queryClient.invalidateQueries(["activities"])`，讓列表重新拉資料。

---

#### 3-5-2 `joinActivity`

Signature：

```ts
const joinActivity = async (params: {
  activityId: string;
  activityObjectId: string; // shared object id
}) => { ... };
```

對應 Move：

```move
public entry fun join_activity(
  activity_id: ID,
  activity: &mut Activity,
  ctx: &mut TxContext,
)
```

行為規格：

1. 檢查：`currentAddress` 存在。
2. `const tx = new Transaction();`
3. `moveCall`：

   * `target: getTarget("join_activity")`
   * `arguments`：

     * `tx.pure(activity_id)` – activity id（如果 IOTA SDK 有專門的 ID 型別就依照 SDK）
     * `tx.object(activityObjectId)` – shared Activity object
4. 送出、等待完成。
5. 成功後：

   * `toast.success("Joined activity")`
   * `invalidateQueries(["activity", network, activityId])`
   * `invalidateQueries(["activities", network])`

---

#### 3-5-3 `addPrizeFund`

Signature：

```ts
const addPrizeFund = async (params: {
  activityId: string;
  activityObjectId: string;
  amount: bigint;
}) => { ... };
```

對應 Move：

```move
public entry fun add_prize_fund(
  activity_id: ID,
  activity: &mut Activity,
  amount: u64,
  ctx: &mut TxContext,
)
```

行為規格：

1. 檢查：`currentAddress` 存在。
2. 目前合約的 IOTA 流程仍是 stub（`withdraw_iota(amount, ctx)`），因此這裡暫時**不需要**像 workshop 那樣使用 `getPaymentCoin()` 合併 coin；只需要把 `amount` 傳進去即可。
3. 建立 tx，`moveCall`：

   * `target: getTarget("add_prize_fund")`
   * `arguments`：

     * `tx.pure(activityId)`
     * `tx.object(activityObjectId)`
     * `tx.pure.u64(amount)`
4. 送出與等待。
5. 成功後：

   * `toast.success("Prize pool increased")`
   * invalidate `["activity", ...]` / `["activities", ...]`

> 未來如果合約改成真正使用 `Coin<IOTA>`，這裡要改成跟 workshop 一樣從 `client.getCoins` 抓 coin、merge、split 再當作 argument 傳進 `moveCall`。

---

#### 3-5-4 `closeActivity`

Signature：

```ts
const closeActivity = async (params: {
  activityId: string;
  activityObjectId: string;
}) => { ... };
```

對應 Move：

```move
public entry fun close_activity(
  activity_id: ID,
  activity: &mut Activity,
  ctx: &mut TxContext,
)
```

規格：

1. 檢查 organizer（UI 之後可以判斷 `activity.organizer === currentAddress`，這裡先 assume 前面有驗過）。
2. `moveCall`：

   * `target: getTarget("close_activity")`
   * `arguments`: `activity_id`, `activity object`
3. 成功後：

   * `toast.success("Activity closed")`
   * invalidate `["activity", ...]` / `["activities", ...]`

---

#### 3-5-5 `withdrawRemainingAfterClose`

Signature：

```ts
const withdrawRemainingAfterClose = async (params: {
  activityId: string;
  activityObjectId: string;
}) => { ... };
```

對應 Move：

```move
public entry fun withdraw_remaining_after_close(
  activity_id: ID,
  activity: &mut Activity,
  ctx: &mut TxContext,
)
```

規格：

1. 只允許 organizer 執行（UI 之後判斷）。
2. `moveCall`：

   * `target: getTarget("withdraw_remaining_after_close")`
   * `arguments`: `activity_id`, `activity object`
3. 成功後：

   * `toast.success("Remaining pool withdrawn")`
   * invalidate `["activity", ...]` / `["activities", ...]`

---

### 3-6 UX / 錯誤處理規格

1. 統一錯誤處理：

   * 每個 operation 外層 `try/catch`。
   * `error instanceof Error && toast.error(error.message)` 或加上前綴文案。

2. `isPending`：

   * 若任一 `signAndExecuteTransaction` 正在跑，`useActivityOperations` 回傳的 `isPending` 為 `true`。
   * UI 可用來：

     * disable 按鈕
     * 顯示 loading spinner / neon progress bar（cyberpunk 風格留給 UI step）

3. React Query：

   * 所有 mutation 完成後，記得 invalidate 對應的 query key，確保 Activity 資料會自動 refresh。

---

### 3-7 給未來 Step 的預留

後續 Step 會用到這些 hook：

* Activity List 頁：

  * 使用 `useActivitiesQuery` + `useActivityOperations.createActivity`
* Activity Detail 頁：

  * 使用 `useActivityQuery`
  * 搭配 `joinActivity` / `addPrizeFund` / `closeActivity` / `withdrawRemainingAfterClose`
* 之後的 Bonus / Lottery / Game hooks 會依賴：

  * `Activity` 型別中的 `lotteryId`、`currentGameId`
  * 以及 Activity status（OPEN / CLOSED）