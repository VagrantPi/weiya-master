## Step 6：Game hooks

### 6-1 這一步要完成什麼？

目標：把 Game lifecycle 全部封裝成 hook：

1. **Game 狀態讀取**

   * 依 `Activity.current_game_id` 找到「目前這一場 Game」。
   * 讀出：題目、四個選項、獎金、模式（SINGLE/AVERAGE）、是否已揭曉、正確答案、總答對人數、winner（單人模式）。

2. **GameParticipation 讀取**

   * 取得「這場 Game 的 participation 列表」。
   * 找出「目前登入錢包」自己的 participation（是否已答題 / 是否已領獎）。

3. **Organizer 操作**

   * `create_game`：建立新的一題四選一遊戲。
   * `reveal_game_answer`：公布正確答案 &（SINGLE 時）隨機抽出得獎者。

4. **Participant 操作**

   * `submit_choice`：員工提交 1~4 的答案。
   * `claim_game_reward`：答對的人在遊戲仍可領的期間內，領取遊戲獎勵。

全部都要：

* React + TS SPA。
* IOTA 互動：

  * `@iota/dapp-kit` → `useIotaClient` / `useIotaClientContext` / `useCurrentAccount` / `useSignAndExecuteTransaction`
  * `@iota/iota-sdk/transactions` → `Transaction`
* 對應 Move entry：

  * `create_game`
  * `submit_choice`
  * `reveal_game_answer`
  * `claim_game_reward`

---

## 6-2 檔案調整清單

這一步會動到這幾個地方：

1. 型別

   * `src/types/annual-party.ts`

     * `GameStatus` / `GameRewardMode` / `Game` / `GameView`
     * `GameParticipation` / `GameParticipationView`

2. 常數 / config

   * `src/consts/annual-party.ts`

     * `getGameType(network)`
     * `getGameParticipationType(network)`

3. hooks

   * `src/hooks/use-game.ts`

     * `useCurrentGame(activity: Activity | null): GameView | null`
     * `useGameParticipations(game: Game | null)`
     * `useMyGameParticipation(game: Game | null)`
   * `src/hooks/use-game-operations.ts`

     * `useGameOperations()`：

       * `createGame`
       * `submitChoice`
       * `revealGameAnswer`
       * `claimGameReward`

---

## 6-3 型別：Game / GameParticipation / View Models

檔案：`src/types/annual-party.ts`

### 6-3-1 Enum 型別

Move:

```move
public enum GameStatus { OPEN, ANSWER_REVEALED, CLOSED }
public enum GameRewardMode { SINGLE, AVERAGE }
```

TS：

```ts
export type GameStatus = "OPEN" | "ANSWER_REVEALED" | "CLOSED";
export type GameRewardMode = "SINGLE" | "AVERAGE";
```

---

### 6-3-2 Game 型別

Move struct 現在長這樣（你實作版）：

```move
public struct Game has key {
    id: UID,
    activity_id: ID,
    status: GameStatus,

    question: string::String,
    options: vector<string::String>,
    reward_amount: u64,
    reward_mode: GameRewardMode,

    correct_option: option::Option<u8>,
    total_correct: u64,
    winner_addr: option::Option<address>,
    participation_ids: vector<ID>,
    participation_owners: vector<address>,
    participation_choices: vector<u8>,
}
```

TS：

```ts
export interface Game {
  id: string;
  activityId: string;
  status: GameStatus;

  question: string;
  options: string[];        // length == 4
  rewardAmount: bigint;     // u64 → bigint
  rewardMode: GameRewardMode;

  correctOption: number | null; // 1~4, null 表示尚未公布
  totalCorrect: bigint;
  winnerAddr: string | null;    // SINGLE 模式 winner

  participationIds: string[];      // 對應 GameParticipation objectId
  participationOwners: string[];   // address[]
  participationChoices: number[];  // u8[]
}
```

---

### 6-3-3 Game View Model

供 UI 使用的 view model：

```ts
export interface GameView {
  game: Game | null;

  isOpen: boolean;
  isAnswerRevealed: boolean;
  isClosed: boolean;

  // derived fields
  hasCorrectOption: boolean;
  correctOptionLabel: string | null; // e.g. "A/B/C/D" 或 "1~4"
}
```

---

### 6-3-4 GameParticipation 型別

Move struct：

```move
public struct GameParticipation has key {
    id: UID,
    game_id: ID,
    activity_id: ID,
    owner: address,

    choice: u8,
    is_correct: bool,
    has_claimed_reward: bool,
}
```

TS：

```ts
export interface GameParticipation {
  id: string;
  gameId: string;
  activityId: string;
  owner: string;

  choice: number;             // 1~4
  isCorrect: boolean;
  hasClaimedReward: boolean;
}
```

View model for front-end：

```ts
export interface GameParticipationView {
  participation: GameParticipation;

  // derived
  choiceIndex: number;         // 0~3
  canClaim: boolean;          // 簡單判斷用（還要配合 Game 狀態）
}
```

---

### 6-3-5 mapping helpers

同檔案或 `src/mappers/annual-party.ts`：

```ts
export const mapGameFromObject = (obj: any): Game => {
  const fields = obj.data.content.fields;

  return {
    id: obj.data.objectId,
    activityId: fields.activity_id,
    status: fields.status,  // "OPEN" | "ANSWER_REVEALED" | "CLOSED"

    question: fields.question,
    options: fields.options,   // string[]

    rewardAmount: BigInt(fields.reward_amount),
    rewardMode: fields.reward_mode, // "SINGLE" | "AVERAGE"

    correctOption: fields.correct_option.fields
      ? Number(fields.correct_option.fields.value) // 1~4
      : null,

    totalCorrect: BigInt(fields.total_correct),
    winnerAddr: fields.winner_addr.fields
      ? (fields.winner_addr.fields.value as string)
      : null,

    participationIds: fields.participation_ids,
    participationOwners: fields.participation_owners,
    participationChoices: fields.participation_choices.map((c: any) =>
      Number(c)
    ),
  };
};

export const mapGameParticipationFromObject = (obj: any): GameParticipation => {
  const fields = obj.data.content.fields;

  return {
    id: obj.data.objectId,
    gameId: fields.game_id,
    activityId: fields.activity_id,
    owner: fields.owner,

    choice: Number(fields.choice),
    isCorrect: fields.is_correct,
    hasClaimedReward: fields.has_claimed_reward,
  };
};
```

> ⚠️ field 名稱要依實際 IOTA 物件 JSON 為準，Codex 需要用 `client.getObject()` / `getOwnedObjects` 實際看一次再填正確。

---

## 6-4 常數：Game / GameParticipation type 字串

檔案：`src/consts/annual-party.ts`

```ts
import { Network } from "@iota/dapp-kit";
import { getAnnualPartyConfig } from "./annual-party-config";

export const getGameType = (network: Network | undefined) => {
  const { packageId } = getAnnualPartyConfig(network);
  return `${packageId}::annual_party::Game`;
};

export const getGameParticipationType = (network: Network | undefined) => {
  const { packageId } = getAnnualPartyConfig(network);
  return `${packageId}::annual_party::GameParticipation`;
};
```

---

## 6-5 Hooks：use-game.ts

檔案：`src/hooks/use-game.ts`

### 6-5-1 `useCurrentGame(activity)`

**用途：**

* 根據 `Activity.current_game_id` 找出目前這一場 Game。
* 轉成 `GameView`，提供狀態旗標。

**Signature：**

```ts
import { useQuery } from "@tanstack/react-query";
import { useIotaClient, useIotaClientContext } from "@iota/dapp-kit";
import { Activity, Game, GameView } from "@/types/annual-party";
import { mapGameFromObject } from "@/mappers/annual-party";

export const useCurrentGame = (
  activity: Activity | null
) => useQuery<GameView | null>({ ... });
```

**規格：**

* 從 `activity.currentGameId: string | null` 取得 `gameId`。
* 若 `!activity || !activity.currentGameId` → `enabled: false` 並回傳 `null`。
* Query key：`["game", network, activity?.currentGameId]`
* `queryFn`：

```ts
const res = await client.getObject({
  id: gameId,
  options: { showContent: true },
});

if (!res.data || res.data.content === null) return null;

const game: Game = mapGameFromObject(res);

const view: GameView = {
  game,
  isOpen: game.status === "OPEN",
  isAnswerRevealed: game.status === "ANSWER_REVEALED",
  isClosed: game.status === "CLOSED",
  hasCorrectOption: game.correctOption !== null,
  correctOptionLabel: game.correctOption
    ? `Option ${game.correctOption}` // 之後 UI 要改成 A/B/C/D 再說
    : null,
};

return view;
```

---

### 6-5-2 `useGameParticipations(game)`

**用途：**

* 讀取一場 Game 底下**所有** GameParticipation（可能用在 Organizer view）。

**Signature：**

```ts
import { useQuery } from "@tanstack/react-query";
import { useIotaClient, useIotaClientContext } from "@iota/dapp-kit";
import { Game, GameParticipation } from "@/types/annual-party";

export const useGameParticipations = (game: Game | null) =>
  useQuery<GameParticipation[]>({ ... });
```

**實作建議（兩種方式擇一）：**

1. **依 GameParticipation type + owner 過濾**
   若 IOTA SDK 有類似 `getOwnedObjects` with `filter: { StructType }`：

   * 只適合「查某個錢包的 participation」，不適合 Organizer 看全部。

2. **依 Game 的 `participation_ids` 逐顆查**（推薦，因為合約已經幫你存了 ID）：

   ```ts
   const ids = game?.participationIds ?? [];
   if (!game || ids.length === 0) return [];

   const res = await Promise.all(
     ids.map((id) =>
       client.getObject({
         id,
         options: { showContent: true },
       })
     )
   );

   const list: GameParticipation[] = res
     .filter((r) => r.data && r.data.content !== null)
     .map(mapGameParticipationFromObject);

   return list;
   ```

* query key：`["game-participations", network, game?.id]`
* enabled：`!!game && game.participationIds.length > 0`

---

### 6-5-3 `useMyGameParticipation(game)`

**用途：**

* 專門給「目前錢包」使用的 helper。
* 回傳「自己對這題的 participation」（或 null）。

**Signature：**

```ts
import { useMemo } from "react";
import { useCurrentAccount } from "@iota/dapp-kit";

export const useMyGameParticipation = (
  game: Game | null,
  participations: GameParticipation[]
) => { ... };
```

**規格：**

* 取 `currentAddress`。
* 在 `participations` 找 `p.owner === currentAddress && p.gameId === game.id` 的那一筆。
* 回傳：

```ts
return useMemo(() => {
  if (!game || !currentAddress) return null;
  const me = participations.find(
    (p) => p.gameId === game.id && p.owner === currentAddress
  );
  return me ?? null;
}, [game?.id, currentAddress, participations]);
```

---

## 6-6 Hooks：use-game-operations.ts

檔案：`src/hooks/use-game-operations.ts`

### 6-6-1 共用架構

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

export const useGameOperations = () => {
  const client = useIotaClient();
  const { network } = useIotaClientContext();
  const currentAccount = useCurrentAccount();
  const currentAddress = currentAccount?.address ?? "";
  const queryClient = useQueryClient();

  const { mutateAsync: signAndExecuteTransaction, isPending } =
    useSignAndExecuteTransaction();

  const { packageId } = getAnnualPartyConfig(network);
  const MODULE = "annual_party";
  const target = (fn: string) => `${packageId}::${MODULE}::${fn}`;

  // define functions
  // createGame / submitChoice / revealGameAnswer / claimGameReward

  return {
    createGame,
    submitChoice,
    revealGameAnswer,
    claimGameReward,
    isPending,
  };
};
```

---

### 6-6-2 createGame（Organizer）

Move：

```move
public entry fun create_game(
    activity_id: ID,
    activity: &mut Activity,
    question: string::String,
    options: vector<string::String>,
    reward_amount: u64,
    mode_code: u8,
    ctx: &mut TxContext,
)
```

TS Signature：

```ts
const createGame = async (params: {
  activityId: string;
  activityObjectId: string;
  question: string;
  options: string[];       // length must be 4
  rewardAmount: bigint;    // u64
  mode: GameRewardMode;    // "SINGLE" | "AVERAGE"
}) => { ... };
```

規格：

1. 基本檢查：

```ts
if (!currentAddress) throw new Error("Wallet not connected");
if (params.options.length !== 4) throw new Error("Game options must be length 4");
if (params.rewardAmount <= 0n) throw new Error("Reward amount must be > 0");
```

2. `mode_code`：

```ts
const modeCode = params.mode === "SINGLE" ? 0 : 1;
```

3. 建立 tx：

```ts
const tx = new Transaction();

tx.moveCall({
  target: target("create_game"),
  arguments: [
    tx.pure(params.activityId),           // ID
    tx.object(params.activityObjectId),   // &mut Activity
    tx.pure.string(params.question),
    tx.pure.vector("string", params.options),
    tx.pure.u64(params.rewardAmount),
    tx.pure.u8(modeCode),
  ],
});
```

4. 發送 / 等待：

```ts
const result = await signAndExecuteTransaction({ transaction: tx });
await client.waitForTransaction({ digest: result.digest });
```

5. 成功 → toast + invalidate：

```ts
toast.success("Game created");

queryClient.invalidateQueries({
  queryKey: ["activity", network, params.activityId],
});
queryClient.invalidateQueries({
  queryKey: ["game", network],
});
```

---

### 6-6-3 submitChoice（Participant）

Move：

```move
public entry fun submit_choice(
    activity_id: ID,
    activity: &Activity,
    game_id: ID,
    game: &mut Game,
    choice: u8,
    ctx: &mut TxContext,
)
```

TS Signature：

```ts
const submitChoice = async (params: {
  activityId: string;
  activityObjectId: string;
  gameId: string;
  gameObjectId: string;
  choice: number;        // 1~4
}) => { ... };
```

規格：

1. 檢查：

```ts
if (!currentAddress) throw new Error("Wallet not connected");
if (params.choice < 1 || params.choice > 4)
  throw new Error("Choice must be between 1 and 4");
```

2. 建立 tx：

```ts
const tx = new Transaction();

tx.moveCall({
  target: target("submit_choice"),
  arguments: [
    tx.pure(params.activityId),
    tx.object(params.activityObjectId),   // &Activity (shared, immutable ref)
    tx.pure(params.gameId),
    tx.object(params.gameObjectId),       // &mut Game
    tx.pure.u8(params.choice),
  ],
});
```

3. 等待結果 + invalidate：

```ts
const result = await signAndExecuteTransaction({ transaction: tx });
await client.waitForTransaction({ digest: result.digest });

toast.success("Choice submitted");

queryClient.invalidateQueries({
  queryKey: ["game", network, params.gameId],
});
queryClient.invalidateQueries({
  queryKey: ["game-participations", network, params.gameId],
});
```

---

### 6-6-4 revealGameAnswer（Organizer）

Move：

```move
public entry fun reveal_game_answer(
    activity_id: ID,
    activity: &Activity,
    game_id: ID,
    game: &mut Game,
    correct_option: u8,
    client_seed: u64,
    ctx: &mut TxContext,
)
```

TS Signature：

```ts
const revealGameAnswer = async (params: {
  activityId: string;
  activityObjectId: string;
  gameId: string;
  gameObjectId: string;
  correctOption: number;    // 1~4
  clientSeed?: bigint;
}) => { ... };
```

規格：

1. 檢查：

```ts
if (!currentAddress) throw new Error("Wallet not connected");
if (params.correctOption < 1 || params.correctOption > 4)
  throw new Error("Correct option must be between 1 and 4");
```

2. clientSeed：

```ts
const seed = params.clientSeed ?? BigInt(Date.now());
```

3. tx：

```ts
const tx = new Transaction();

tx.moveCall({
  target: target("reveal_game_answer"),
  arguments: [
    tx.pure(params.activityId),
    tx.object(params.activityObjectId),  // &Activity
    tx.pure(params.gameId),
    tx.object(params.gameObjectId),      // &mut Game
    tx.pure.u8(params.correctOption),
    tx.pure.u64(seed),
  ],
});
```

4. 等待 & invalidate：

```ts
const result = await signAndExecuteTransaction({ transaction: tx });
await client.waitForTransaction({ digest: result.digest });

toast.success("Game answer revealed");

queryClient.invalidateQueries({
  queryKey: ["game", network, params.gameId],
});
queryClient.invalidateQueries({
  queryKey: ["game-participations", network, params.gameId],
});
```

---

### 6-6-5 claimGameReward（Participant）

Move：

```move
public entry fun claim_game_reward(
    activity_id: ID,
    activity: &mut Activity,
    game_id: ID,
    game: &mut Game,
    participation: &mut GameParticipation,
    ctx: &mut TxContext,
)
```

TS Signature：

```ts
const claimGameReward = async (params: {
  activityId: string;
  activityObjectId: string;
  gameId: string;
  gameObjectId: string;
  participationObjectId: string;
}) => { ... };
```

規格：

1. 檢查：

```ts
if (!currentAddress) throw new Error("Wallet not connected");
```

（是否可 claim 的 UI 邏輯應該由上層先判斷，例如 Game.status == ANSWER_REVEALED + isCorrect + !hasClaimedReward）

2. tx：

```ts
const tx = new Transaction();

tx.moveCall({
  target: target("claim_game_reward"),
  arguments: [
    tx.pure(params.activityId),
    tx.object(params.activityObjectId),      // &mut Activity
    tx.pure(params.gameId),
    tx.object(params.gameObjectId),         // &mut Game
    tx.object(params.participationObjectId) // &mut GameParticipation
  ],
});
```

3. 等待 & invalidate：

```ts
const result = await signAndExecuteTransaction({ transaction: tx });
await client.waitForTransaction({ digest: result.digest });

toast.success("Game reward claimed");

queryClient.invalidateQueries({
  queryKey: ["activity", network, params.activityId],
});
queryClient.invalidateQueries({
  queryKey: ["game", network, params.gameId],
});
queryClient.invalidateQueries({
  queryKey: ["game-participations", network, params.gameId],
});
```

---

## 6-7 給 Codex 的 UI 使用情境範例（不用現在實作 UI）

例如在 `ActivityDetailPage` 裡：

```tsx
const { data: activity } = useActivityQuery(activityId);
const { data: gameView } = useCurrentGame(activity ?? null);
const { data: participations = [] } = useGameParticipations(gameView?.game ?? null);
const myParticipation = useMyGameParticipation(gameView?.game ?? null, participations);

const {
  createGame,
  submitChoice,
  revealGameAnswer,
  claimGameReward,
  isPending,
} = useGameOperations();

// Organizer 可以：
// - 若沒有 current_game_id 或 game 已 CLOSED → 顯示「建立新遊戲題目」表單，呼叫 createGame()
// - 若 game.isOpen → 顯示「公布答案」表單，呼叫 revealGameAnswer()
// - 顯示 total_correct / winnerAddr (SINGLE)

// Participant 可以：
// - game.isOpen && !myParticipation → 顯示四個選項按鈕，呼叫 submitChoice(choice)
// - game.isAnswerRevealed && myParticipation?.isCorrect && !myParticipation?.hasClaimedReward → 顯示「領取獎勵」按鈕，呼叫 claimGameReward()
```
