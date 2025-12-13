## Step 5：Lottery hooks

### 5-1 這一步要完成什麼？

目標是把 **樂透完整 lifecycle** 都包成 hooks：

1. **讀取目前 Activity 的 Lottery 狀態**

   * 從 `Activity.lottery_id` 找到當前這一場 Lottery 物件。
   * 提供簡單旗標：例如是否 OPEN、是否已抽完、獎池金額、參與人數。

2. **Organizer 操作**

   * `create_lottery`：建立一場新的樂透。
   * `execute_lottery`：執行樂透抽獎，隨機抽出一位 winner。

3. **Participant 操作**

   * `join_lottery`：投入 IOTA 參加樂透。

全部遵守：

* 前端為 React + TS SPA。
* IOTA 互動使用：

  * `@iota/dapp-kit`（`useIotaClient` / `useIotaClientContext` / `useCurrentAccount` / `useSignAndExecuteTransaction`）
  * `@iota/iota-sdk/transactions` 的 `Transaction`
* Move 端對應函式：

  * `create_lottery`
  * `join_lottery`
  * `execute_lottery`

---

## 5-2 檔案調整清單

這一步會動到三個主要地方：

1. 型別補完（若還沒建）

   * `src/types/annual-party.ts`

     * 定義 `Lottery` 型別（對應 Move struct）。
     * 前端 view model：`LotteryView`（方便 UI 用）。

2. 常數 & config（補樂透 / random 相關設定）

   * `src/consts/annual-party.ts`

     * `getLotteryType(network)`
     * `getAnnualPartyConfig(network)` 內增加 `randomObjectId`（如果 Step 3 已加就沿用）。

3. Hooks

   * `src/hooks/use-lottery.ts`

     * `useCurrentLottery(activity: Activity | null)`：讀取目前 Activity 綁定的 Lottery。
   * `src/hooks/use-lottery-operations.ts`

     * `useLotteryOperations()`：包 `createLottery / joinLottery / executeLottery` 三個 mutation。

---

## 5-3 型別：Lottery & LotteryView

檔案：`src/types/annual-party.ts`

### 5-3-1 基礎 Lottery 型別

對應 Move：

```move
public struct Lottery has key {
    id: UID,
    activity_id: ID,
    status: LotteryStatus,

    pot_coin: Coin<IOTA>,

    participants: vector<address>,
    winner: option::Option<address>,
}
```

TS 型別：

```ts
export type LotteryStatus = "OPEN" | "DRAWN" | "CLOSED";

export interface Lottery {
  id: string;           // objectId
  activityId: string;
  status: LotteryStatus;

  potAmount: bigint;    // pot_coin.value 映射成 bigint
  participants: string[];
  winner: string | null;
}
```

### 5-3-2 前端 View Model：LotteryView

為了 UI 好用，加一個 view model：

```ts
export interface LotteryView {
  lottery: Lottery | null;

  // derived
  isOpen: boolean;
  isDrawn: boolean;
  isClosed: boolean;
  participantCount: number;
}
```

### 5-3-3 mapping helper

同檔案或 `src/mappers/annual-party.ts` 中新增：

```ts
export const mapLotteryFromObject = (obj: any): Lottery => {
  // 依 IOTA Object 實際結構調整
  // 假設：
  //  obj.data.objectId => string
  //  const fields = obj.data.content.fields;

  const fields = obj.data.content.fields;

  return {
    id: obj.data.objectId,
    activityId: fields.activity_id,           // string
    status: fields.status,                    // "OPEN" | "DRAWN" | "CLOSED"
    potAmount: BigInt(fields.pot_coin.fields.value),
    participants: fields.participants,        // string[]
    winner: fields.winner.fields
      ? (fields.winner.fields.some_addr as string) // 依 Option struct 實際 shape 調整
      : null,
  };
};
```

> 這裡 field 名稱要依實際 on-chain JSON 調整，Codex 可以先用 `client.getObject()` 看一次再填正確。

---

## 5-4 常數：Lottery type & Random object

檔案：`src/consts/annual-party.ts`

### 5-4-1 Lottery Type 字串

```ts
import { Network } from "@iota/dapp-kit";
import { getAnnualPartyConfig } from "./annual-party-config"; // 假設 Step 3 已有

export const getLotteryType = (network: Network | undefined) => {
  const { packageId } = getAnnualPartyConfig(network);
  return `${packageId}::annual_party::Lottery`;
};
```

### 5-4-2 隨機數 object id

在 `getAnnualPartyConfig` 裡，增加一個 field：

```ts
export interface AnnualPartyConfig {
  packageId: string;
  activityInitCap: string;   // 如果有的話
  randomObjectId: string;    // ⬅️ 新增，用於需要 &Random 的 entry function
  // ...其他
}
```

實際 config：

```ts
export const ANNUAL_PARTY: Record<Network, AnnualPartyConfig> = {
  "testnet": {
    packageId: "0x4357...",
    activityInitCap: "0x...",    // 依實際情況
    randomObjectId: "0x8",       // 比照 workshop attackBoss 的 random object
  },
  // ...
};
```

> `randomObjectId` 就是鏈上那顆 `iota::random::Random` 的物件 ID，之後 `execute_lottery` 要用 `tx.object(randomObjectId)` 傳進去。

---

## 5-5 Hook：useCurrentLottery

檔案：`src/hooks/use-lottery.ts`

### 5-5-1 目標

* 依據當前的 `Activity`，讀取其綁定的 Lottery：

  * `activity.lottery_id == None` → 回傳 `null`。
  * 有 ID 時透過 client.getObject(id) 取得 Lottery 詳細資訊。
* 組裝為 `LotteryView`，並用 React Query 管理 cache / loading / error。

### 5-5-2 Signature

```ts
import { UseQueryResult, useQuery } from "@tanstack/react-query";
import { LotteryView, Lottery } from "@/types/annual-party";
import { Activity } from "@/types/annual-party";

export const useCurrentLottery = (
  activity: Activity | null
): UseQueryResult<LotteryView | null> => { ... };
```

### 5-5-3 實作規格

1. 取出 context：

```ts
const client = useIotaClient();
const { network } = useIotaClientContext();
```

2. 解析 lotteryId：

* 假設 `activity.lotteryId: string | null` 已在 `Activity` 型別中（Step 3 的 mapping）。
* 若 `!activity || !activity.lotteryId` → 直接 return null。

3. React Query：

```ts
const lotteryId = activity?.lotteryId ?? null;
const enabled = !!lotteryId;

return useQuery<LotteryView | null>({
  queryKey: ["lottery", network, lotteryId],
  enabled,
  queryFn: async () => {
    if (!lotteryId) return null;

    const res = await client.getObject({
      id: lotteryId,
      options: {
        showContent: true,
      },
    });

    if (!res.data || res.data.content === null) {
      return null;
    }

    const lottery: Lottery = mapLotteryFromObject(res);

    const view: LotteryView = {
      lottery,
      isOpen: lottery.status === "OPEN",
      isDrawn: lottery.status === "DRAWN",
      isClosed: lottery.status === "CLOSED",
      participantCount: lottery.participants.length,
    };

    return view;
  },
});
```

---

## 5-6 Hook：useLotteryOperations

檔案：`src/hooks/use-lottery-operations.ts`

### 5-6-1 目標

將三個 entry function 包成 mutation：

* `create_lottery(activity_id: ID, activity: &mut Activity, ctx: &mut TxContext)`
* `join_lottery(activity_id: ID, lottery_id: ID, activity: &mut Activity, lottery: &mut Lottery, amount: u64, ctx: &mut TxContext)`
* `execute_lottery(activity_id: ID, lottery_id: ID, activity: &mut Activity, lottery: &mut Lottery, rand: &Random, client_seed: u64, ctx: &mut TxContext)`

### 5-6-2 共用架構

```ts
import {
  useCurrentAccount,
  useIotaClient,
  useIotaClientContext,
  useSignAndExecuteTransaction,
} from "@iota/dapp-kit";
import { Transaction } from "@iota/iota-sdk/transactions";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { getAnnualPartyConfig } from "@/consts/annual-party";

export const useLotteryOperations = () => {
  const client = useIotaClient();
  const { network } = useIotaClientContext();
  const currentAccount = useCurrentAccount();
  const currentAddress = currentAccount?.address ?? "";
  const queryClient = useQueryClient();

  const { mutateAsync: signAndExecuteTransaction, isPending } =
    useSignAndExecuteTransaction();

  const { packageId, randomObjectId } = getAnnualPartyConfig(network);
  const MODULE = "annual_party";

  const getTarget = (fn: string) =>
    `${packageId}::${MODULE}::${fn}`;

  // ...下面定義三個 async function

  return {
    createLottery,
    joinLottery,
    executeLottery,
    isPending,
  };
};
```

---

### 5-6-3 createLottery（Organizer）

對應 Move：

```move
public entry fun create_lottery(
    activity_id: ID,
    activity: &mut Activity,
    ctx: &mut TxContext,
)
```

TS Signature：

```ts
const createLottery = async (params: {
  activityId: string;
  activityObjectId: string;
}) => { ... };
```

實作規格：

1. 基本檢查：

```ts
if (!currentAddress) {
  throw new Error("Wallet not connected");
}
```

2. 建立 tx：

```ts
const tx = new Transaction();

tx.moveCall({
  target: getTarget("create_lottery"),
  arguments: [
    tx.pure(params.activityId),          // ID
    tx.object(params.activityObjectId),  // &mut Activity shared object
  ],
});
```

3. 簽名與等待：

```ts
const result = await signAndExecuteTransaction({ transaction: tx });
await client.waitForTransaction({ digest: result.digest });
```

4. 成功後處理：

```ts
toast.success("Lottery created");

queryClient.invalidateQueries({ queryKey: ["activity", network, params.activityId] });
queryClient.invalidateQueries({ queryKey: ["lottery", network] });
```

5. 失敗時：

```ts
} catch (error) {
  if (error instanceof Error) {
    toast.error(`Failed to create lottery: ${error.message}`);
  } else {
    toast.error("Failed to create lottery");
  }
}
```

---

### 5-6-4 joinLottery（Participant）

對應 Move：

```move
public entry fun join_lottery(
    activity_id: ID,
    lottery_id: ID,
    activity: &mut Activity,
    lottery: &mut Lottery,
    amount: u64,
    ctx: &mut TxContext,
)
```

TS Signature：

```ts
const joinLottery = async (params: {
  activityId: string;
  activityObjectId: string;
  lotteryId: string;
  lotteryObjectId: string;
  amount: bigint;   // IOTA 最小單位
}) => { ... };
```

實作規格：

1. 檢查錢包：

```ts
if (!currentAddress) {
  throw new Error("Wallet not connected");
}
if (params.amount <= 0n) {
  throw new Error("Amount must be greater than 0");
}
```

2. 建立 tx：

> 目前合約 `join_lottery` 只吃 `amount: u64`，沒有 Coin 參數，所以這裡先直接傳數字。
> 未來若合約改成真的 withdraw IOTA 再改成和 workshop 一樣 `getPaymentCoin()` 流程。

```ts
const tx = new Transaction();

tx.moveCall({
  target: getTarget("join_lottery"),
  arguments: [
    tx.pure(params.activityId),           // ID
    tx.pure(params.lotteryId),            // ID
    tx.object(params.activityObjectId),   // &mut Activity
    tx.object(params.lotteryObjectId),    // &mut Lottery
    tx.pure.u64(params.amount),          // amount: u64
  ],
});
```

3. 簽名 / 等待：

```ts
const result = await signAndExecuteTransaction({ transaction: tx });
await client.waitForTransaction({ digest: result.digest });
```

4. 成功後：

```ts
toast.success("Joined lottery");

queryClient.invalidateQueries({ queryKey: ["activity", network, params.activityId] });
queryClient.invalidateQueries({ queryKey: ["lottery", network, params.lotteryId] });
```

5. 失敗時 toast error。

---

### 5-6-5 executeLottery（Organizer）

對應 Move：

```move
public entry fun execute_lottery(
    activity_id: ID,
    lottery_id: ID,
    activity: &mut Activity,
    lottery: &mut Lottery,
    rand: &Random,
    client_seed: u64,
    ctx: &mut TxContext,
)
```

TS Signature：

```ts
const executeLottery = async (params: {
  activityId: string;
  activityObjectId: string;
  lotteryId: string;
  lotteryObjectId: string;
  clientSeed?: bigint; // optional, for debug
}) => { ... };
```

實作規格：

1. clientSeed：

```ts
const seed = params.clientSeed ?? BigInt(Date.now());
```

2. 檢查：

```ts
if (!currentAddress) {
  throw new Error("Wallet not connected");
}
```

3. 建立 tx：

```ts
const tx = new Transaction();

tx.moveCall({
  target: getTarget("execute_lottery"),
  arguments: [
    tx.pure(params.activityId),
    tx.pure(params.lotteryId),
    tx.object(params.activityObjectId),
    tx.object(params.lotteryObjectId),
    tx.object(randomObjectId),     // &Random 物件
    tx.pure.u64(seed),
  ],
});
```

4. 簽名 / 等待：

```ts
const result = await signAndExecuteTransaction({ transaction: tx });
await client.waitForTransaction({ digest: result.digest });
```

5. 成功後：

```ts
toast.success("Lottery executed");

queryClient.invalidateQueries({ queryKey: ["activity", network, params.activityId] });
queryClient.invalidateQueries({ queryKey: ["lottery", network, params.lotteryId] });
```

6. 失敗時一樣 toast error。

---

## 5-7 未來 UI 會怎麼呼叫（給 Codex 的 context）

之後在某個 **Activity 詳細頁（Organizer/Participant 共用）** 可以這樣用：

```tsx
const { data: activity } = useActivityQuery(activityId);
const { data: lotteryView } = useCurrentLottery(activity ?? null);

const {
  createLottery,
  joinLottery,
  executeLottery,
  isPending,
} = useLotteryOperations();

// Organizer UI
// - 若 activity.organizer === currentAddress && !lotteryView?.lottery -> 顯示「建立樂透」按鈕
// - 若 lotteryView?.isOpen && lotteryView.participantCount > 0 -> 顯示「執行樂透」按鈕

// Participant UI
// - 若 lotteryView?.isOpen -> 顯示「參加樂透」金額輸入 + 按鈕（呼叫 joinLottery）
```
