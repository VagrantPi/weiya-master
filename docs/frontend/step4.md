## Step 4：Participant & Bonus flows hooks

### 4-1 這一步要做到什麼？

這一關解決的事情是「**員工身分 + 參加獎 + 活動關閉後分紅**」的完整 hooks 層：

1. **Participant 狀態讀取**

   * 取得「目前錢包在某個 Activity 底下的 Participant 狀態」
   * 暫時 **只做「我自己」的 Participant**，Organizer 要看全員名單之後再拆（可能走 indexer / event）。

2. **Bonus Flow**

   * Organizer：`create_bonus_event`
   * Participant：`claim_bonus`

3. **Close Reward Flow**

   * Participant：`claim_close_reward`

4. 一樣全部透過：

   * `@iota/dapp-kit` (`useIotaClient`, `useCurrentAccount`, `useIotaClientContext`, `useSignAndExecuteTransaction`)
   * `@iota/iota-sdk/transactions` 的 `Transaction`
   * `toast` 用 `sonner`

---

## 4-2 新增/更新檔案

這一步會動到這些檔案：

1. **型別補完**

   * ✅ 已有：`src/types/annual-party.ts`（Step 3 已建）
   * ➕ 這裡要在裡面加上 Participant 相關型別。

2. **Participant Query Hooks**

   * 新增：`src/hooks/use-participant.ts`
   * 主要 export：

     * `useMyParticipant(activityId: string | null)`

3. **Bonus & Close Reward Operations**

   * 新增：`src/hooks/use-bonus-operations.ts`
   * 主要 export：

     * `useBonusOperations()`

> 之後 UI（例如「我的票券/獎勵」頁）就可以直接用這兩個 hooks 搭 Activity 的 hooks。

---

## 4-3 型別：Participant & Bonus 狀態

檔案：`src/types/annual-party.ts`

在原本的 `Activity` 型別後面，加上：

```ts
export interface Participant {
  id: string;
  activityId: string;
  owner: string;

  joined: boolean;
  hasClaimedBonus: boolean;
  hasClaimedCloseReward: boolean;
}

/**
 * 前端對「我在某活動中的狀態」的 view model
 * 方便 UI 直接用 flags 判斷能不能按按鈕
 */
export interface MyParticipantState {
  participant: Participant | null;
  participantObjectId: string | null;

  // derived flags
  canClaimBonus: boolean;
  canClaimCloseReward: boolean;
}
```

同檔案或另外一支 `mappers.ts` 裡面，加一個 mapping helper：

```ts
export const mapParticipantFromObject = (obj: any): Participant => {
  // 依據 IOTA client 回傳的 object 結構來 parse：
  // const fields = obj.data.content.fields;
  // 然後對應：
  // - id: obj.data.objectId
  // - activityId: fields.activity_id
  // - owner: fields.owner
  // - joined: fields.joined
  // - hasClaimedBonus: fields.has_claimed_bonus
  // - hasClaimedCloseReward: fields.has_claimed_close_reward
};
```

`MyParticipantState` 的組裝則會在 hook 裡做（看 Activity & Participant 過來算 flag）。

---

## 4-4 常數：Participant struct type

在 `src/consts/annual-party.ts` 補上 Participant type helper：

```ts
export const getParticipantType = (network: Network | undefined) => {
  const { packageId } = getAnnualPartyConfig(network);
  return `${packageId}::annual_party::Participant`;
};
```

之後 query 會用到 `StructType: getParticipantType(network)` 來 filter。

---

## 4-5 Hook：useMyParticipant

檔案：`src/hooks/use-participant.ts`

### 4-5-1 目標

* 依據「目前連接的錢包地址 + 傳入的 `activityId`」找到自己的 Participant object。
* 回傳 `MyParticipantState`，並且自動幫你算好：

  * 是否已 join
  * 是否可以領參加獎
  * 是否可以領 close reward

### 4-5-2 Signature

```ts
import { UseQueryResult } from "@tanstack/react-query";
import { MyParticipantState } from "@/types/annual-party";

export const useMyParticipant = (
  activityId: string | null
): UseQueryResult<MyParticipantState | null> => { ... };
```

### 4-5-3 行為規格

1. 使用 context：

```ts
const client = useIotaClient();
const { network } = useIotaClientContext();
const currentAccount = useCurrentAccount();
const currentAddress = currentAccount?.address ?? "";
const participantType = getParticipantType(network);
```

2. Query key 與 enabled：

```ts
const enabled =
  !!activityId && !!currentAddress && !!participantType;

queryKey = ["my-participant", network, currentAddress, activityId];
```

3. Query function（邏輯）：

> 這邊只抓「目前錢包持有的 Participant」，因為 Participant object 是由員工自己持有。

大致流程：

```ts
const res = await client.getOwnedObjects({
  owner: currentAddress,
  filter: {
    StructType: participantType,
  },
  options: {
    showContent: true,
  },
});

// 這裡依照 IOTA SDK 實際結構調整
const objects = res.data ?? [];

const participants = objects
  .map(mapParticipantFromObject)
  .filter((p) => p.activityId === activityId);

const participant = participants[0] ?? null;
const participantObjectId = participant ? participant.id : null;

// 這裡需要 Activity 的資訊來算 canClaimX，先只返回 participant & id；
// MyParticipantState 的 flags 會在這支 hook內部補齊（需要把 Activity 傳進來的版本，也可以做成 useMyParticipant(activity) 的 overload）
```

為了符合「這一支 hook 自己就能算 flags」，建議在 Signature 再加上 `activity: Activity | null`：

#### 改版後 Signature（推薦用這版）：

```ts
import { Activity } from "@/types/annual-party";

export const useMyParticipant = (
  activityId: string | null,
  activity: Activity | null
): UseQueryResult<MyParticipantState | null> => { ... };
```

然後在 query function 裡面用 `activity` 來算 derived flags：

```ts
const canClaimBonus =
  !!participant &&
  participant.joined &&
  !participant.hasClaimedBonus &&
  activity?.hasBonusEvent === true;

const canClaimCloseReward =
  !!participant &&
  participant.joined &&
  !participant.hasClaimedCloseReward &&
  activity?.status === "CLOSED" &&
  (activity?.closePayoutAmount ?? 0n) > 0n;

return {
  participant,
  participantObjectId,
  canClaimBonus,
  canClaimCloseReward,
};
```

4. 若 `enabled === false`，直接回傳 `null`。

---

## 4-6 Hook：useBonusOperations

檔案：`src/hooks/use-bonus-operations.ts`

### 4-6-1 目標

包住所有「參加獎 & 活動關閉分紅」相關 mutation：

* Organizer：

  * `createBonusEvent`
* Participant：

  * `claimBonus`
  * `claimCloseReward`

### 4-6-2 共用前置

跟 Step 3 一樣的模式：

```ts
import {
  useCurrentAccount,
  useIotaClient,
  useIotaClientContext,
  useSignAndExecuteTransaction,
} from "@iota/dapp-kit";
import { Transaction } from "@iota/iota-sdk/transactions";
import { toast } from "sonner";
import { getAnnualPartyConfig } from "@/consts/annual-party";
import { useQueryClient } from "@tanstack/react-query";

export const useBonusOperations = () => {
  const client = useIotaClient();
  const currentAccount = useCurrentAccount();
  const currentAddress = currentAccount?.address ?? "";
  const { network } = useIotaClientContext();
  const queryClient = useQueryClient();

  const { mutateAsync: signAndExecuteTransaction, isPending } =
    useSignAndExecuteTransaction();

  const { packageId } = getAnnualPartyConfig(network);
  const MODULE = "annual_party";

  const getTarget = (fn: string) =>
    `${packageId}::${MODULE}::${fn}`;

  // ...底下定義三個 operation

  return {
    createBonusEvent,
    claimBonus,
    claimCloseReward,
    isPending,
  };
};
```

> 和 Step 3 的 `useActivityOperations` 統一風格。

---

### 4-6-3 createBonusEvent（Organizer）

對應 Move：

```move
public entry fun create_bonus_event(
  activity_id: ID,
  activity: &mut Activity,
  bonus_per_user: u64,
  ctx: &mut TxContext,
)
```

Signature：

```ts
const createBonusEvent = async (params: {
  activityId: string;
  activityObjectId: string;
  bonusPerUser: bigint; // IOTA 最小單位
}) => { ... };
```

行為規格：

1. 檢查：

```ts
if (!currentAddress) {
  throw new Error("Wallet not connected");
}
```

2. 建立 tx：

```ts
const tx = new Transaction();

tx.moveCall({
  target: getTarget("create_bonus_event"),
  arguments: [
    tx.pure(params.activityId),            // ID
    tx.object(params.activityObjectId),    // &mut Activity
    tx.pure.u64(params.bonusPerUser),      // u64
  ],
});
```

> 目前合約 `withdraw_iota` 還是 stub，所以這裡不用指定 IOTA coin object，只傳 amount 即可。未來如果合約改成真的從 organizer 帳戶 withdraw IOTA，再改成類似 workshop `getPaymentCoin` 流程。

3. 簽名 & 執行：

```ts
const result = await signAndExecuteTransaction({ transaction: tx });
await client.waitForTransaction({ digest: result.digest });
```

4. 成功後：

```ts
toast.success("Bonus event created");
queryClient.invalidateQueries({ queryKey: ["activity", network, params.activityId] });
queryClient.invalidateQueries({ queryKey: ["activities", network] });
```

5. 失敗時在 catch block：

```ts
} catch (error) {
  if (error instanceof Error) {
    toast.error(`Failed to create bonus event: ${error.message}`);
  } else {
    toast.error("Failed to create bonus event");
  }
}
```

---

### 4-6-4 claimBonus（Participant）

對應 Move：

```move
public entry fun claim_bonus(
  activity_id: ID,
  activity: &mut Activity,
  participant: &mut Participant,
  ctx: &mut TxContext,
)
```

Signature：

```ts
const claimBonus = async (params: {
  activityId: string;
  activityObjectId: string;
  participantObjectId: string;
}) => { ... };
```

行為規格：

1. 檢查：

```ts
if (!currentAddress) {
  throw new Error("Wallet not connected");
}
```

2. 建立 tx：

```ts
const tx = new Transaction();

tx.moveCall({
  target: getTarget("claim_bonus"),
  arguments: [
    tx.pure(params.activityId),
    tx.object(params.activityObjectId),
    tx.object(params.participantObjectId),
  ],
});
```

> 權限相關的檢查（是不是這個 participant 的 owner）合約已經有做：
> `if (participant.owner != caller) abort E_NO_PARTICIPANTS;`

3. 簽名 & 等待：

```ts
const result = await signAndExecuteTransaction({ transaction: tx });
await client.waitForTransaction({ digest: result.digest });
```

4. 成功後：

```ts
toast.success("Bonus claimed");
queryClient.invalidateQueries({ queryKey: ["activity", network, params.activityId] });
queryClient.invalidateQueries({ queryKey: ["my-participant", network] });
```

> `["my-participant", network]` 的 key 實作時要與 `useMyParticipant` 一致（可用 partial key + `invalidateQueries({ queryKey: ["my-participant"] })` 來偷懶）。

5. 失敗時一樣 toast error。

---

### 4-6-5 claimCloseReward（Participant）

對應 Move：

```move
public entry fun claim_close_reward(
  activity_id: ID,
  activity: &mut Activity,
  participant: &mut Participant,
  ctx: &mut TxContext,
)
```

Signature：

```ts
const claimCloseReward = async (params: {
  activityId: string;
  activityObjectId: string;
  participantObjectId: string;
}) => { ... };
```

行為規格幾乎與 `claimBonus` 一樣，只是 target 不同：

```ts
tx.moveCall({
  target: getTarget("claim_close_reward"),
  arguments: [
    tx.pure(params.activityId),
    tx.object(params.activityObjectId),
    tx.object(params.participantObjectId),
  ],
});
```

成功後文案：

```ts
toast.success("Close reward claimed");
```

invalidate：

```ts
queryClient.invalidateQueries({ queryKey: ["activity", network, params.activityId] });
queryClient.invalidateQueries({ queryKey: ["my-participant", network] });
```

---

## 4-7 未來 UI 會怎麼用這些 hooks（給 Codex 的 context）

之後在 Activity Detail 頁會大概長這樣（概念上）：

```tsx
const { data: activity } = useActivityQuery(activityId);
const { data: myParticipantState } = useMyParticipant(activityId, activity ?? null);
const { createBonusEvent, claimBonus, claimCloseReward, isPending } =
  useBonusOperations();

// 活動 Organizer 看得到：建立參加獎的表單
// if (activity.organizer === currentAddress) show <CreateBonusForm />

// Participant:
// - 若 myParticipantState?.canClaimBonus -> 顯示「領取參加獎」按鈕
// - 若 myParticipantState?.canClaimCloseReward -> 顯示「領取尾牙分紅」按鈕
```

> 真正的 UI / cyberpunk 風格 / component 拆分會留到下一個「Page + UI Step」再細拆。這一步只要讓 Codex 把 hooks & operations 寫好即可。
