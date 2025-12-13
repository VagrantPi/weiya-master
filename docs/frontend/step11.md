## Step 11：Activity 詳細頁 – 整合 Bonus / Lottery / Game / Close flows

### 🎯 這一步的目標

在 `ActivityDetailPage` 上，讓 Organizer / Participant 能做這些事：

* 看到該活動的完整資訊（名稱、狀態、獎金池、參加人數…）
* Participant：

  * join 活動
  * 領取參加獎（Bonus）
  * 參與 Lottery（join / 看結果）
  * 玩四選一 Game（submit choice / 領獎）
  * 活動關閉後領取 close reward
* Organizer：

  * 建立 Bonus event
  * 建立 / 執行 Lottery
  * 建立 / 揭露 Game 答案
  * 關閉活動
  * 領回未被 claim 的剩餘獎金

UI/UX 由 codex 發揮，這一步只定義檔案結構、要呼叫哪些 hooks、每個 panel 的行為與 enable 條件。

---

## 11.1 檔案結構

新增 / 擴充以下檔案：

1. `src/pages/ActivityDetailPage.tsx`
2. `src/components/activity/ActivityHeader.tsx`
3. `src/components/activity/ActivityBonusPanel.tsx`
4. `src/components/activity/ActivityLotteryPanel.tsx`
5. `src/components/activity/ActivityGamePanel.tsx`
6. `src/components/activity/ActivityClosePanel.tsx`

> 路由（Step 8 已定義）：
> `/activities/:id` → `ActivityDetailPage`

---

## 11.2 會用到的 hooks（前幾步已規劃）

在 `ActivityDetailPage` 會用到：

* `useWallet()`（Step 9）

  * `currentAddress`
  * `isConnected`
  * `network`
* `useActivityDetail(activityId)`（Step 3）

  * 回傳 `activity` 詳細資訊：

    ```ts
    interface ActivityDetailView {
      id: string;
      organizer: string;
      name: string;
      status: "OPEN" | "CLOSED";
      prizePoolAmount: string; // or bigint
      participantCount: number;
      hasBonusEvent: boolean;
      bonusAmountPerUser: string;
      closePayoutAmount: string;
      remainingPoolAfterClose: string;
      lotteryId?: string | null;
      currentGameId?: string | null;
    }
    ```
* `useParticipantStatus(activityId)`（Step 4）

  * 判斷目前使用者在此活動的 Participant 狀態：

    ```ts
    interface ParticipantStatus {
      isJoined: boolean;
      participantObjectId?: string;
      hasClaimedBonus: boolean;
      hasClaimedCloseReward: boolean;
    }
    ```
* `useActivityOperations()`（Step 3）

  * `joinActivity()`
  * 之後可能還有 `addPrizeFund()`（這頁可以先不做 UI）。
* `useBonusOperations(activityId)`（Step 4）

  * `createBonusEvent(bonusPerUser: bigint)`
  * `claimBonus(participantObjectId: string)`
  * loading 狀態：

    ```ts
    { isCreatingBonus, isClaimingBonus }
    ```
* `useLotteryQuery(activityId)` / `useLotteryOperations(activityId)`（Step 5）

  * `useLotteryQuery`：

    ```ts
    interface LotteryView {
      id: string;
      status: "OPEN" | "DRAWN" | "CLOSED";
      potAmount: string;
      participantsCount: number;
      hasJoinedCurrentUser: boolean;
      winnerAddr?: string | null;
    }
    ```
  * `useLotteryOperations`：

    * `createLottery()`
    * `joinLottery(amount: bigint)`
    * `executeLottery()`
* `useGameQuery(activityId)` / `useGameOperations(activityId)`（Step 6）

  * `useGameQuery`：

    ```ts
    interface GameView {
      id: string;
      status: "OPEN" | "ANSWER_REVEALED" | "CLOSED";
      question: string;
      options: string[]; // length 4
      rewardAmount: string;
      rewardMode: "SINGLE" | "AVERAGE";
      correctOption?: number | null; // 1~4
      totalCorrect: number;
      hasSubmittedByCurrentUser: boolean;
      // for current user
      currentUserChoice?: number | null;
      currentUserIsCorrect?: boolean | null;
      currentUserHasClaimedReward?: boolean | null;
    }
    ```
  * `useGameOperations`：

    * `createGame(params)`
    * `submitChoice(choice: number)`
    * `revealGameAnswer(correctOption: number)`
    * `claimGameReward(participationObjectId?: string)`
      （或在 hook 內自己找該 user 的 Participation）
* `useCloseOperations(activityId)`（Step 7）

  * `closeActivity()`
  * `claimCloseReward(participantObjectId: string)`
  * `withdrawRemainingAfterClose()`

---

## 11.3 `ActivityDetailPage` – 標準流程

`src/pages/ActivityDetailPage.tsx`

### 11.3.1 基本載入流程

1. 從 route 取得 `activityId`：

   ```ts
   const { id: activityId } = useParams<{ id: string }>();
   ```

2. 呼叫 hooks：

   ```ts
   const { currentAddress, isConnected } = useWallet();
   const { activity, isLoading: isActivityLoading, refetch: refetchActivity } =
     useActivityDetail(activityId);

   const {
     status: participantStatus,
     isLoading: isParticipantLoading,
     refetch: refetchParticipant,
   } = useParticipantStatus(activityId);

   const lotteryQuery = useLotteryQuery(activityId);
   const gameQuery = useGameQuery(activityId);

   const bonusOps = useBonusOperations(activityId);
   const lotteryOps = useLotteryOperations(activityId);
   const gameOps = useGameOperations(activityId);
   const closeOps = useCloseOperations(activityId);
   const activityOps = useActivityOperations();
   ```

3. 判斷角色：

   ```ts
   const isOrganizer =
     isConnected &&
     activity?.organizer.toLowerCase() === currentAddress.toLowerCase();
   ```

4. loading / error：

   * `isActivityLoading` → 顯示 skeleton。
   * activity 為 `null` → 顯示「找不到活動」。

5. 把資料分發給下列 components：

   ```tsx
   <AppLayout>
     <ActivityHeader
       activity={activity}
       isOrganizer={isOrganizer}
       participantStatus={participantStatus}
       onJoin={...}
       // maybe onRefresh
     />

     <div className="grid ...">
       <ActivityBonusPanel ... />
       <ActivityLotteryPanel ... />
       <ActivityGamePanel ... />
       <ActivityClosePanel ... />
     </div>
   </AppLayout>
   ```

---

## 11.4 `ActivityHeader` – 活動資訊 + Join 按鈕

`src/components/activity/ActivityHeader.tsx`

### 11.4.1 Props

```ts
interface ActivityHeaderProps {
  activity: ActivityDetailView;
  participantStatus: ParticipantStatus;
  isOrganizer: boolean;
  isJoining: boolean;
  onJoin: () => Promise<void>;
}
```

### 11.4.2 行為需求

* 顯示：

  * 活動名稱
  * Organizer 地址（如果是本人，標註 `You are organizer`）
  * Activity 狀態 badge（OPEN / CLOSED）
  * 獎金池餘額 `prizePoolAmount`
  * 參加人數 `participantCount`
  * hasBonusEvent / closePayoutAmount 等 summary
* Participant join 行為：

  * 若 `!isOrganizer && !participantStatus.isJoined && activity.status === "OPEN"`：

    * 顯示「加入活動」按鈕
    * 按下時呼叫 `onJoin()` → 由 `ActivityDetailPage` 呼叫 `activityOps.joinActivity(activityId)`，成功後 `refetchActivity` + `refetchParticipant`
  * 若已加入：

    * 顯示 badge：「已加入活動」。
* 若活動已 CLOSED：

  * 可在 header 顯示簡短提示：「活動已關閉，可領取結算獎金（若尚未領取）」。

---

## 11.5 `ActivityBonusPanel` – 參加獎

`src/components/activity/ActivityBonusPanel.tsx`

### 11.5.1 Props

```ts
interface ActivityBonusPanelProps {
  activity: ActivityDetailView;
  participantStatus: ParticipantStatus;
  isOrganizer: boolean;
  bonusOps: {
    createBonusEvent: (bonusPerUser: bigint) => Promise<void>;
    claimBonus: (participantObjectId: string) => Promise<void>;
    isCreatingBonus: boolean;
    isClaimingBonus: boolean;
  };
  onRefresh: () => Promise<void>; // refetch activity + participant
}
```

### 11.5.2 Organizer 流程

Organizer 看到：

* 若 `activity.status === "OPEN"` 且 `!activity.hasBonusEvent` 且 `activity.participantCount > 0`：

  * 顯示一個表單（輸入 `bonusPerUser`）。
  * 按下「建立參加獎事件」：

    * 呼叫 `bonusOps.createBonusEvent`
    * 成功後 `onRefresh()`
* 若 `hasBonusEvent === true`：

  * 顯示「每人參加獎：X IOTA」的資訊（read-only）。

### 11.5.3 Participant 流程

Participant 看到：

* 一個卡片標題：「參加獎 Bonus」。
* 條件：

  * **可領取**：

    * `activity.hasBonusEvent === true`
    * `participantStatus.isJoined === true`
    * `participantStatus.hasClaimedBonus === false`
    * `activity.status` 不必一定 OPEN，只要 pool 還足夠即可（合約那邊有檢查）。
  * **按鈕行為**：

    * 顯示「領取參加獎」按鈕：

      * 按下時呼叫 `bonusOps.claimBonus(participantObjectId)`。
      * 成功後 `onRefresh()`
  * 已領過：

    * 顯示「已領取參加獎」標籤 / icon。
* 若未 join 活動 → 顯示「請先加入活動才能領取」。

---

## 11.6 `ActivityLotteryPanel` – Lottery 相關操作

`src/components/activity/ActivityLotteryPanel.tsx`

### 11.6.1 Props

```ts
interface ActivityLotteryPanelProps {
  activity: ActivityDetailView;
  lottery: LotteryView | null;
  isOrganizer: boolean;
  isConnected: boolean;
  lotteryOps: {
    createLottery: () => Promise<void>;
    joinLottery: (amount: bigint) => Promise<void>;
    executeLottery: () => Promise<void>;
    isCreating: boolean;
    isJoining: boolean;
    isExecuting: boolean;
  };
  participantStatus: ParticipantStatus;
  onRefresh: () => Promise<void>;
}
```

### 11.6.2 Organizer 行為

* 顯示當前 Lottery 狀態（如果 `lottery` 為 null → 無活動中的 Lottery）：

  * `status: OPEN / DRAWN / CLOSED`
  * `potAmount`
  * `participantsCount`
  * 若接到 winner 地址 → 顯示。
* 操作：

  * 若 `activity.status === "OPEN"`：

    * 若沒有 `lottery` 或 `lottery.status !== "OPEN"`：

      * 顯示「建立樂透」按鈕 → `lotteryOps.createLottery` → 成功後 `onRefresh()`
    * 若 `lottery.status === "OPEN"` 且 `participantsCount > 0`：

      * 顯示「開出樂透」按鈕 → `lotteryOps.executeLottery` → 成功後 `onRefresh()`
* 若 `activity.status === "CLOSED"`：

  * lottery 區塊只 read-only 顯示結果，不再允許建立 / join / execute。

### 11.6.3 Participant 行為

* 若 `lottery != null && lottery.status === "OPEN"`：

  * 且 `participantStatus.isJoined === true`
  * 且 `lottery.hasJoinedCurrentUser === false`：

    * 顯示輸入框 `amount` + 「參加樂透」按鈕：

      * 按下呼叫 `lotteryOps.joinLottery(amount)`。
      * 成功後 `onRefresh()`
* 若已加入：顯示「已參加本次樂透」提示。
* 若 `lottery.status === "DRAWN"`：

  * 若 `lottery.winnerAddr === currentAddress` → 顯示「🎉 你中獎了」。
  * 否則顯示「本輪已開獎」。

---

## 11.7 `ActivityGamePanel` – 四選一 Game 流程

`src/components/activity/ActivityGamePanel.tsx`

### 11.7.1 Props

```ts
interface ActivityGamePanelProps {
  activity: ActivityDetailView;
  game: GameView | null;
  isOrganizer: boolean;
  participantStatus: ParticipantStatus;
  gameOps: {
    createGame: (params: {
      question: string;
      options: string[]; // length 4
      rewardAmount: bigint;
      mode: "SINGLE" | "AVERAGE";
    }) => Promise<void>;
    submitChoice: (choice: number) => Promise<void>;
    revealGameAnswer: (correctOption: number) => Promise<void>;
    claimGameReward: () => Promise<void>; // hook 內自己找當前 user 的 participation
    isCreating: boolean;
    isSubmitting: boolean;
    isRevealing: boolean;
    isClaiming: boolean;
  };
  onRefresh: () => Promise<void>;
}
```

### 11.7.2 Organizer 部分

1. 顯示當前 game 概況（`game` 可以為 null）：

   * question / options
   * rewardAmount / rewardMode
   * status
   * totalCorrect / correctOption / winner_addr (若有)

2. 建立新 Game：

   * 條件：

     * `activity.status !== "CLOSED"`
   * 表單欄位：

     * question
     * 4 個 options
     * rewardAmount
     * rewardMode（SINGLE / AVERAGE）
   * 按下「建立新 Game」：

     * 呼叫 `gameOps.createGame(...)`
     * 成功後 `onRefresh()`
   * 建立新 Game 時，舊 Game 視為 CLOSED（邏輯在合約 / hooks，這裡只要 UI 顯示「前一題獎勵若未領取視為放棄」之類提示）。

3. 揭露答案：

   * 只有當前 `game` 存在且 `game.status === "OPEN"` 時顯示。
   * Organizer 輸入 `correctOption` (1~4)。
   * 按「揭露答案」：

     * 呼叫 `gameOps.revealGameAnswer(correctOption)`
     * 成功後 `onRefresh()`

### 11.7.3 Participant 部分

* **提交答案：**

  * 條件：

    * `game` 存在
    * `game.status === "OPEN"`
    * `participantStatus.isJoined === true`
    * `game.hasSubmittedByCurrentUser === false`
  * UI：

    * 顯示 4 個選項按鈕（1~4）。
    * 按某個選項 → `gameOps.submitChoice(choice)` → 成功後 `onRefresh()`。

* **等待揭露答案：**

  * 若 `game.status === "OPEN"` 且 `hasSubmittedByCurrentUser === true`：

    * 顯示「已作答，請等待主辦揭露答案」。

* **揭露後領獎：**

  * 若 `game.status === "ANSWER_REVEALED"`：

    * 顯示：

      * 正解：`correctOption`
      * 使用者選擇：`currentUserChoice`
      * 對 / 錯：`currentUserIsCorrect`
    * 領獎條件：

      * `currentUserIsCorrect === true`
      * `!currentUserHasClaimedReward`
    * 按鈕：

      * 「領取遊戲獎金」 → `gameOps.claimGameReward()` → 成功後 `onRefresh()`
    * 若已領過 → 顯示「已領取」。

---

## 11.8 `ActivityClosePanel` – 關閉活動 & Close Reward

`src/components/activity/ActivityClosePanel.tsx`

### 11.8.1 Props

```ts
interface ActivityClosePanelProps {
  activity: ActivityDetailView;
  isOrganizer: boolean;
  participantStatus: ParticipantStatus;
  closeOps: {
    closeActivity: () => Promise<void>;
    claimCloseReward: (participantObjectId: string) => Promise<void>;
    withdrawRemainingAfterClose: () => Promise<void>;
    isClosing: boolean;
    isClaiming: boolean;
    isWithdrawing: boolean;
  };
  onRefresh: () => Promise<void>;
}
```

### 11.8.2 Organizer 視角

* 顯示：

  * 活動狀態
  * `closePayoutAmount`
  * `remainingPoolAfterClose`
* 操作：

  * 若 `activity.status === "OPEN"`：

    * 顯示「關閉活動並計算平均獎金」按鈕：

      * 呼叫 `closeOps.closeActivity()`
      * 成功後 `onRefresh()`
  * 若 `activity.status === "CLOSED"`：

    * 顯示「剩餘獎金：XXX IOTA」
    * 若 `remainingPoolAfterClose > 0`：

      * 顯示「領回剩餘獎金」按鈕：

        * 呼叫 `closeOps.withdrawRemainingAfterClose()`
        * 成功後 `onRefresh()`

### 11.8.3 Participant 視角

* 若 `activity.status === "CLOSED"` 且 `participantStatus.isJoined === true`：

  * 顯示 `closePayoutAmount`：

    * 若 `closePayoutAmount > 0` 且 `!participantStatus.hasClaimedCloseReward`：

      * 顯示「領取活動結算獎金」 → 呼叫 `closeOps.claimCloseReward(participantObjectId)` → 成功後 `onRefresh()`
    * 若已領過 → 顯示「已領取結算獎金」。
  * 若 `closePayoutAmount === 0`：

    * 顯示「本活動無結算獎金」。

---

## 11.9 Cyberpunk 風格（給 codex 的 UX 提示）

* 整個詳細頁可視為「活動控制台」：

  * Header：像是大型螢幕顯示活動資訊。
  * 下方四個 Panel（Bonus / Lottery / Game / Close）用卡片 + neon 邊框排成 2x2 grid。
* 每個 Panel 的狀態可用顏色表達：

  * READY / ACTIVE → 亮綠 / 青色
  * NEED ACTION → 亮粉 / 黃色點狀提示
  * DISABLED / CLOSED → 暗灰 / 去色
* 短字說明：讓不熟 Move 的使用者也看得懂「這個區塊在幹嘛」。

---

## 11.10 Step 11 完成條件（Definition of Done）

* [ ] `/activities/:id` 可載入特定活動詳細資訊。
* [ ] Header 能顯示活動名稱、Organizer、狀態、獎金池、參加數。
* [ ] Participant 可以：

  * [ ] join 活動（OPEN 時）
  * [ ] 在 Bonus 開啟後，領一次參加獎
  * [ ] 在 Lottery 開啟時參加樂透
  * [ ] 在 Game OPEN 時選答案，在 ANSWER_REVEALED 後（若答對）領獎
  * [ ] 在活動 CLOSED 後領 close reward（若有）
* [ ] Organizer 可以：

  * [ ] 建立 Bonus event
  * [ ] 建立 Lottery、開獎
  * [ ] 建立 Game、揭露答案
  * [ ] 關閉活動
  * [ ] 領回剩餘獎金
* [ ] 所有動作按鈕都有 disable / loading state，錯誤由 hooks 內統一用 toast 呈現。
* [ ] 所有區塊在「錢包未連線」時會顯示適當提示並禁用互動。
