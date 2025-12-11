## Step 7：Activity 關閉 & Close Reward hooks

這一步的目標：
把「活動結算」相關流程全部包成 hooks，包含：

1. Organizer：

   * `close_activity`：關閉活動、計算每人可領金額。
   * `withdraw_remaining_after_close`：收回沒人來領的剩餘獎金。

2. Participant：

   * `claim_close_reward`：活動關閉後，員工來領「平均分配獎金」。

3. 查詢：

   * Activity 的關閉資訊（是否已關閉、每人可領多少、剩餘池子）。
   * 自己是否已領過 close reward。

---

## 7-1 這一步要完成什麼？

### 功能面

1. **狀態查詢**

   * `activity.status` 是否為 `CLOSED`。
   * `activity.close_payout_amount` 每位參加者可領多少 IOTA。
   * `activity.remaining_pool_after_close` 剩餘獎金池（主要給 Organizer 看）。
   * `participant.has_claimed_close_reward` 自己有沒有領過。

2. **Organizer 操作 hooks**

   * `closeActivity(activityId, activityObjectId)`
     → 呼叫 Move `close_activity`。
   * `withdrawRemainingAfterClose(activityId, activityObjectId)`
     → 呼叫 Move `withdraw_remaining_after_close`。

3. **Participant 操作 hook**

   * `claimCloseReward(activityId, activityObjectId, participantObjectId)`
     → 呼叫 Move `claim_close_reward`。

4. **React Query 整合**

   * 操作成功後，要 invalidate：

     * `["activity", network, activityId]`
     * `["participants", network, activityId]`
     * 以及任何依賴 Activity 狀態的 hook（你前面 Step 3/4/5/6 設的 key）。

---

## 7-2 型別補強（Activity / Participant View）

> 大部分你在 Step 3 / Step 4 應該都已有，這邊整理成「Close 專用 view」給 Codex 用。

檔案：`src/types/annual-party.ts`

### 7-2-1 Activity Close View

```ts
import { Activity, Participant } from "./annual-party";

export interface ActivityCloseView {
  activity: Activity | null;
  myParticipant: Participant | null;

  // 狀態 flag
  isClosed: boolean;
  canClose: boolean;          // Organizer 視角（比如 participantCount > 0）
  canWithdrawRemaining: boolean;

  // 數值
  closePayoutAmount: bigint;          // 每人可領
  remainingPoolAfterClose: bigint;    // pool 的剩餘量（視覺化用）

  // 參加者視角
  canClaimCloseReward: boolean;   // 我可以領？
  hasClaimedCloseReward: boolean;
}
```

> `Activity` 裡應該已經有：
>
> * `status: "OPEN" | "CLOSED"`
> * `closePayoutAmount: bigint`
> * `remainingPoolAfterClose: bigint`
>   `Participant` 裡有：`hasClaimedCloseReward: boolean`

---

## 7-3 常數與 config：entry function 目標

延續前面 Step 3~6 的寫法。

檔案：`src/consts/annual-party.ts`

```ts
import { Network } from "@iota/dapp-kit";
import { getAnnualPartyConfig } from "./annual-party-config";

export const getAnnualPartyModuleTarget = (network: Network | undefined) => {
  const { packageId } = getAnnualPartyConfig(network);
  return {
    packageId,
    module: "annual_party",
    fn: (name: string) => `${packageId}::annual_party::${name}`,
  };
};
```

之後所有 hooks 都用：

```ts
const { fn } = getAnnualPartyModuleTarget(network);
tx.moveCall({ target: fn("close_activity"), ... });
```

---

## 7-4 Hook：useActivityCloseView

檔案：`src/hooks/use-activity-close-view.ts`

### 7-4-1 用途

* 把 `Activity` + `myParticipant` → 整理成 `ActivityCloseView`，讓 UI 好寫。

### 7-4-2 Signature

```ts
import { useMemo } from "react";
import { ActivityCloseView, Activity, Participant } from "@/types/annual-party";

export const useActivityCloseView = (
  activity: Activity | null,
  myParticipant: Participant | null
): ActivityCloseView => {
  return useMemo(() => {
    if (!activity) {
      return {
        activity: null,
        myParticipant: null,
        isClosed: false,
        canClose: false,
        canWithdrawRemaining: false,
        closePayoutAmount: 0n,
        remainingPoolAfterClose: 0n,
        canClaimCloseReward: false,
        hasClaimedCloseReward: false,
      };
    }

    const isClosed = activity.status === "CLOSED";
    const closePayoutAmount = activity.closePayoutAmount ?? 0n;
    const remainingPoolAfterClose = activity.remainingPoolAfterClose ?? 0n;

    const hasClaimedCloseReward = !!myParticipant?.hasClaimedCloseReward;

    const canClaimCloseReward =
      isClosed &&
      closePayoutAmount > 0n &&
      !!myParticipant &&
      !myParticipant.hasClaimedCloseReward;

    // Organizer 視角：這邊只做基本判斷，真正「是不是 Organizer」交給上層判斷地址是否相等
    const canClose = !isClosed && activity.participantCount > 0n;
    const canWithdrawRemaining = isClosed && remainingPoolAfterClose > 0n;

    return {
      activity,
      myParticipant,
      isClosed,
      canClose,
      canWithdrawRemaining,
      closePayoutAmount,
      remainingPoolAfterClose,
      canClaimCloseReward,
      hasClaimedCloseReward,
    };
  }, [activity, myParticipant]);
};
```

> Organizer / Participant 判斷是否本人，要在 UI 或更上層 hook 用「`activity.organizer === currentAddress`」去判。

---

## 7-5 Hook：useActivityCloseOperations

檔案：`src/hooks/use-activity-close-operations.ts`

### 7-5-1 基本骨架

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

import { getAnnualPartyModuleTarget } from "@/consts/annual-party";

export const useActivityCloseOperations = () => {
  const client = useIotaClient();
  const { network } = useIotaClientContext();
  const currentAccount = useCurrentAccount();
  const currentAddress = currentAccount?.address ?? "";
  const queryClient = useQueryClient();

  const { fn } = getAnnualPartyModuleTarget(network);

  const { mutateAsync: signAndExecuteTransaction, isPending } =
    useSignAndExecuteTransaction();

  // closeActivity / claimCloseReward / withdrawRemainingAfterClose

  return {
    closeActivity,
    claimCloseReward,
    withdrawRemainingAfterClose,
    isPending,
  };
};
```

---

### 7-5-2 closeActivity（Organizer）

Move Spec：

```move
public entry fun close_activity(
    activity_id: ID,
    activity: &mut Activity,
    ctx: &mut TxContext,
)
```

TS Signature：

```ts
const closeActivity = async (params: {
  activityId: string;
  activityObjectId: string;
}) => { ... };
```

實作規格：

```ts
const closeActivity = async (params: {
  activityId: string;
  activityObjectId: string;
}) => {
  if (!currentAddress) {
    toast.error("Wallet not connected");
    return;
  }

  try {
    const tx = new Transaction();

    tx.moveCall({
      target: fn("close_activity"),
      arguments: [
        tx.pure(params.activityId),        // ID
        tx.object(params.activityObjectId) // &mut Activity (shared object)
      ],
    });

    const result = await signAndExecuteTransaction({ transaction: tx });
    await client.waitForTransaction({ digest: result.digest });

    toast.success("Activity closed");

    queryClient.invalidateQueries({
      queryKey: ["activity", network, params.activityId],
    });
    // 若你 Activity list 有額外 query，也一起 invalidate
  } catch (error) {
    if (error instanceof Error) {
      toast.error(`Failed to close activity: ${error.message}`);
    }
    throw error;
  }
};
```

> 要求：這個 function 在 UI 使用時，應該只讓 `currentAddress === activity.organizer` 的人可以按。

---

### 7-5-3 claimCloseReward（Participant）

Move Spec：

```move
public entry fun claim_close_reward(
    activity_id: ID,
    activity: &mut Activity,
    participant: &mut Participant,
    ctx: &mut TxContext,
)
```

TS Signature：

```ts
const claimCloseReward = async (params: {
  activityId: string;
  activityObjectId: string;
  participantObjectId: string;
}) => { ... };
```

實作規格：

```ts
const claimCloseReward = async (params: {
  activityId: string;
  activityObjectId: string;
  participantObjectId: string;
}) => {
  if (!currentAddress) {
    toast.error("Wallet not connected");
    return;
  }

  try {
    const tx = new Transaction();

    tx.moveCall({
      target: fn("claim_close_reward"),
      arguments: [
        tx.pure(params.activityId),
        tx.object(params.activityObjectId),     // &mut Activity
        tx.object(params.participantObjectId),  // &mut Participant
      ],
    });

    const result = await signAndExecuteTransaction({ transaction: tx });
    await client.waitForTransaction({ digest: result.digest });

    toast.success("Close reward claimed");

    queryClient.invalidateQueries({
      queryKey: ["activity", network, params.activityId],
    });
    queryClient.invalidateQueries({
      queryKey: ["participants", network, params.activityId],
    });
  } catch (error) {
    if (error instanceof Error) {
      toast.error(`Failed to claim close reward: ${error.message}`);
    }
    throw error;
  }
};
```

> UI 端要用 `ActivityCloseView.canClaimCloseReward` 來判斷 button 是否可按。

---

### 7-5-4 withdrawRemainingAfterClose（Organizer）

Move Spec：

```move
public entry fun withdraw_remaining_after_close(
    activity_id: ID,
    activity: &mut Activity,
    ctx: &mut TxContext,
)
```

TS Signature：

```ts
const withdrawRemainingAfterClose = async (params: {
  activityId: string;
  activityObjectId: string;
}) => { ... };
```

實作規格：

```ts
const withdrawRemainingAfterClose = async (params: {
  activityId: string;
  activityObjectId: string;
}) => {
  if (!currentAddress) {
    toast.error("Wallet not connected");
    return;
  }

  try {
    const tx = new Transaction();

    tx.moveCall({
      target: fn("withdraw_remaining_after_close"),
      arguments: [
        tx.pure(params.activityId),
        tx.object(params.activityObjectId), // &mut Activity
      ],
    });

    const result = await signAndExecuteTransaction({ transaction: tx });
    await client.waitForTransaction({ digest: result.digest });

    toast.success("Remaining pool withdrawn");

    queryClient.invalidateQueries({
      queryKey: ["activity", network, params.activityId],
    });
  } catch (error) {
    if (error instanceof Error) {
      toast.error(`Failed to withdraw remaining pool: ${error.message}`);
    }
    throw error;
  }
};
```

> 一樣要限制只有 `activity.organizer` 可以觸發，而且前端可搭配 `ActivityCloseView.canWithdrawRemaining` 控制。

---

## 7-6 UI 使用情境（給 Codex 的 wire）

假設有一個 `ActivityDetailPage`：

```tsx
const { data: activity } = useActivity(activityId);
const { data: participants = [] } = useParticipants(activityId);
const currentAccount = useCurrentAccount();
const currentAddress = currentAccount?.address ?? "";

const myParticipant = participants.find(
  (p) => p.owner === currentAddress
) ?? null;

const closeView = useActivityCloseView(activity ?? null, myParticipant);

const {
  closeActivity,
  claimCloseReward,
  withdrawRemainingAfterClose,
  isPending,
} = useActivityCloseOperations();

const isOrganizer =
  !!activity && activity.organizer.toLowerCase() === currentAddress?.toLowerCase();
```

### Organizer UI

* 若 `!closeView.isClosed` 且 `isOrganizer && closeView.canClose`：

  * 顯示「關閉活動 & 計算平均分配」按鈕 → `closeActivity({ activityId, activityObjectId })`
* 若 `closeView.isClosed && isOrganizer && closeView.canWithdrawRemaining`：

  * 顯示「領回剩餘獎金」按鈕 → `withdrawRemainingAfterClose(...)`
* 顯示：

  * `closeView.closePayoutAmount`（每位參加者理論上可領的金額）
  * `closeView.remainingPoolAfterClose`（目前 pool 剩下多少）

### Participant UI

* 若 `closeView.isClosed`：

  * 顯示「可以領 / 已領」的狀態：

    * 若 `closeView.canClaimCloseReward` → 顯示「領取尾牙分紅」按鈕 → `claimCloseReward(...)`
    * 若 `closeView.hasClaimedCloseReward` → 顯示「已領取」
    * 否則顯示「尚未領取，但可能無資格 / 未報名該活動」之類訊息。
