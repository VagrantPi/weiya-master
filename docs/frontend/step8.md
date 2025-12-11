## Step 8：頁面切割 & Route 設計

### 8-1 這一步的目標

把整個 DApp 切成幾個主要頁面：

1. **Landing / 入口頁（`/`）**
2. **Organizer 後台：活動列表頁（`/organizer`）**
3. **Organizer 活動細節頁（`/organizer/activities/:activityId`）**
4. **Participant 活動頁（掃 QRCode 進來的頁面，`/party/:activityId`）**
5. **（選配）全域錯誤 / NotFound**

並且：

* 決定要用哪個 router（建議 `react-router-dom`）。
* 規劃 `Layout` 元件（含 cyberpunk 風格框架：上方 Navbar / 左側 Navigation / 背景）。
* 定義每個頁面會用到的 hooks（Step 3 ~ Step 7 已完成的那些）。

---

## 8-2 Router 策略

### 8-2-1 使用 `react-router-dom`

* SPA + GitHub Pages → 建議使用 `BrowserRouter` 搭配 `basename`（例如 repo 名稱）。
* Router 基本骨架（給 codex 參考）：

```tsx
// src/router.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layouts/AppLayout";
import { OrganizerLayout } from "@/components/layouts/OrganizerLayout";
import { LandingPage } from "@/pages/LandingPage";
import { OrganizerActivitiesPage } from "@/pages/organizer/OrganizerActivitiesPage";
import { OrganizerActivityDetailPage } from "@/pages/organizer/OrganizerActivityDetailPage";
import { ParticipantActivityPage } from "@/pages/participant/ParticipantActivityPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export const AppRouter = () => (
  <BrowserRouter basename={import.meta.env.BASE_URL}>
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<LandingPage />} />

        <Route path="/organizer" element={<OrganizerLayout />}>
          <Route index element={<OrganizerActivitiesPage />} />
          <Route
            path="activities/:activityId"
            element={<OrganizerActivityDetailPage />}
          />
        </Route>

        <Route
          path="/party/:activityId"
          element={<ParticipantActivityPage />}
        />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  </BrowserRouter>
);
```

> `AppLayout`：全站 cyberpunk 背景 + Navbar（顯示網路、帳號、連接 snap 狀態）。
> `OrganizerLayout`：左邊側邊欄 + 上方 tabs；participant 沒有側欄，只是行動裝版卡片式。

---

## 8-3 Layout 元件規格

### 8-3-1 `<AppLayout>`

用途：全站共用框架。

**需求：**

* 包住 `Outlet`。
* 負責顯示：

  * 頂部 Navbar：

    * App Logo / 名稱（例如：**IOTA Annual Party**）。
    * Network badge（從 `useIotaClientContext()` 取得 `network`）。
    * Current address（`useCurrentAccount()`）。
    * Snap 連線狀態（可以用一顆按鈕「Connect IOTA Snap」）。
  * 全域背景：cyberpunk 類似漸層 / grid / glow 效果（留給 codex）。
  * 全域 `Toaster`（sonner）。

**會用到的 hooks：**

* `useCurrentAccount`（`@iota/dapp-kit`）
* `useIotaClientContext`（顯示 network）
* 未來會加一個 `useIotaSnapConnection()`（你之後 Step 9 可以設計）。

---

### 8-3-2 `<OrganizerLayout>`

用途：Organizer 專用後台的 layout。

**需求：**

* 左側垂直導航：

  * 「Activities」列表。
  * 未來可以預留「Analytics」、「Settings」等項目。
* 右側內容區 `Outlet`。
* 在 mobile 上可以收合成 Drawer。

**不直接打鏈，只是切 UI 結構。**

---

## 8-4 頁面切割規格

### 8-4-1 `LandingPage`（`/`）

**角色：所有人。**

**目的：**

* 說明這個 DApp 是做什麼的。
* 提供兩條路徑：

  * 「我是主辦」→ `/organizer`
  * 「掃 QR 進來的員工」→ 有 `party/:activityId` 的 QR link（實務上是外部印出）。

**功能需求：**

* 顯示：

  * 專案簡介。
  * 按鈕：

    * 「Go to Organizer Dashboard」→ navigate(`/organizer`)
    * 「How to join as Participant」→ 簡單文案。
* 若有連線到 wallet：

  * 可以顯示目前地址。

**這頁不需要打鏈，純資訊 + 導頁。**

---

### 8-4-2 `OrganizerActivitiesPage`（`/organizer`）

**角色：Organizer。**

**目的：**

* 顯示目前網路下所有 Organizer 相關的 `Activity` 列表（可以先顯示所有，之後再 filter）。
* 提供建立新活動的入口（先放按鈕，具體表單可以之後 Step X 再細化）。

**需要使用的 hooks（你前面 Step 3 已設計）：**

* `useActivityList()`（假設已有，若沒有就在這步新增 spec）：

  * 會透過：

    * `useIotaClient()`
    * Query Activities 物件（方式依你決定：event index / object scan）。
  * 回傳：

    * `activities: Activity[]`
    * `isLoading`, `error`, `refetch`

**UI 功能需求：**

* 顯示 Activity cards / table：

  * 名稱
  * Organizer 地址（截斷）
  * 當前狀態（OPEN / CLOSED）
  * `participantCount`
  * `prizePoolCoin` 目前餘額（如果你的 Activity view 有這資訊）。
* 點擊某一筆 → 導到 `/organizer/activities/:activityId`。
* 上方有「Create New Activity」按鈕（用 `useActivityOperations.createActivity`，這可以是未來 Step 9 的實作）。

---

### 8-4-3 `OrganizerActivityDetailPage`（`/organizer/activities/:activityId`）

**角色：Organizer。**

**目的：**

* Organizer 控管這場 Activity 的所有 on-chain 流程。
* 這頁是整個 DApp 的「控制塔」。

**頁內切 Tabs/Sections（建議 4 個）：**

1. **Overview**
2. **Bonus & Prize Draw**
3. **Lottery**
4. **Game**
5. **Close & Settlement**

> UI 可以做 Tab，或垂直區塊都行，交給 codex。

---

#### 8-4-3-1 共用資料 hooks

在頁面最上層先抓共用資料：

* `const { activity, isLoading } = useActivity(activityId);`
* `const { participants } = useParticipants(activityId);`
* `const currentAccount = useCurrentAccount();`
* `const myAddress = currentAccount?.address ?? "";`

這些 hooks 在 Step 3 / Step 4 已經有 spec：

* `useActivity(activityId)`：

  * 透過 `@iota/iota-sdk` 讀取 `Activity` object。
* `useParticipants(activityId)`：

  * 查所有 `Participant` objects。

---

#### 8-4-3-2 Overview 區塊

**目的：**

* Organizer 快速看到這場尾牙的當前狀態。

**需要的 hooks：**

* `useActivity(activityId)`
* `useActivityCloseView(activity, /* myParticipant = null */)` 這裡只看 close 資訊不需要 participant。
* 你也可以加一個 `usePrizePoolView(activity)`，但不是必須。

**顯示欄位：**

* Activity name
* Organizer 地址（並標示「You」如果是本人）
* `status`（OPEN / CLOSED）
* `participantCount`
* `prizePoolCoin` 目前餘額（若在 Activity view 中有）
* `closePayoutAmount` & `remainingPoolAfterClose`（關閉後）

**操作按鈕：**

* 「Copy Participant QR Link」：

  * 生成 `/party/:activityId` 的 URL。
  * 按一下複製到剪貼簿。
* 「Create Bonus Event」/「Add Prize Fund」按鈕的入口，導向對應區塊（或開 modal）。

---

#### 8-4-3-3 Bonus & Prize Draw 區塊

對應 Step 4 & Step 3 中的 hooks。

**需要的 hooks：**

* `useBonusView(activity, participants)`（如果你有做，沒有就用單純 activity 欄位）
* `useActivityOperations()` 裡的：

  * `createBonusEvent`
  * `drawPrize`

**需求：**

* 顯示目前是否有 bonus event：

  * `hasBonusEvent`
  * `bonusAmountPerUser`
* 顯示「抽獎抽過幾次」可以先不做，之後用 events trace。
* 操作：

  * 建立 Bonus Event（輸入 `bonusPerUser`，呼叫 `create_bonus_event`）。
  * 執行 `draw_prize`：

    * 輸入 `amount`。
    * 呼叫 `draw_prize`。

> 這裡只規格「Organizer 端要有這兩組操作」，UI / 表單交給 codex。

---

#### 8-4-3-4 Lottery 區塊

對應 Step 5 hooks。

**需要的 hooks：**

* `useLottery(activityId)` → 目前 ongoing Lottery（透過 `activity.lottery_id` 讀出）。
* `useLotteryOperations()`：

  * `createLottery`
  * `executeLottery`

**需求：**

* 顯示：

  * 現在有沒有開啟中的 Lottery。
  * `status`（OPEN / DRAWN / CLOSED）
  * `participants.length`
  * `potCoin` 金額（如果 view 有）。
* Organizer 操作：

  * 「Create Lottery」按鈕（若目前沒有開啟中）。
  * 「Execute Lottery」按鈕（如果有 participant，狀態為 OPEN）。
* 無需在這頁處理 `join_lottery`（那是 Participant 頁的責任）。

---

#### 8-4-3-5 Game 區塊

對應 Step 6 hooks。

**需要的 hooks：**

* `useCurrentGame(activityId)`：

  * 透過 `activity.current_game_id` 取得 Game。
* `useGameOperations()`：

  * `createGame`
  * `revealGameAnswer`

**需求：**

* 顯示：

  * 當前 Game question / options。
  * `rewardAmount`、`rewardMode`。
  * `status`（OPEN / ANSWER_REVEALED / CLOSED）。
  * `totalCorrect`（有的話）。
* 操作：

  * 若沒有正在進行中的遊戲：

    * 提供建立新 Game 的表單（question、四個 options、rewardAmount、mode）。
  * 若有 `OPEN` 遊戲：

    * 顯示：「等待員工作答」。
    * Organizer 可以輸入 `correctOption`，呼叫 `reveal_game_answer`。
  * 若 `ANSWER_REVEALED`：

    * 提示：「等待員工來 claim」，並提醒「下一題開始前沒領就放棄」。

---

#### 8-4-3-6 Close & Settlement 區塊

對應 Step 7 hooks。

**需要的 hooks：**

* `useActivityCloseView(activity, null)`（Organizer 視角只需 activity）。
* `useActivityCloseOperations()`：

  * `closeActivity`
  * `withdrawRemainingAfterClose`

**需求：**

* 顯示：

  * 活動狀態、參與人數、`closePayoutAmount`。
  * `remainingPoolAfterClose`。
* Organizer 操作：

  * 若 `status === OPEN`：

    * 顯示「關閉活動並計算銷帳」按鈕 → `closeActivity(...)`。
  * 若 `status === CLOSED && remainingPoolAfterClose > 0`：

    * 顯示「領回剩餘獎金」按鈕 → `withdrawRemainingAfterClose(...)`。
* 文字說明：

  * 關閉後，員工可從 Participant 頁面自行 claim。
  * 未領取部分最終都可由 Organizer 收回。

---

### 8-4-4 `ParticipantActivityPage`（`/party/:activityId`）

**角色：Participant（員工）。**

**目的：**

* 員工掃 QR 進來後，從這一頁完成所有流程：

  1. 連接 IOTA Snap + MetaMask。
  2. Join 活動。
  3. 領參加獎。
  4. 參與 Lottery（join）。
  5. 參與 Game（submit choice）。
  6. 領 Game reward。
  7. 活動關閉後領分紅（close reward）。

> 設計成行動裝置優化的卡片式畫面即可。

---

#### 8-4-4-1 共用 hooks

* `useActivity(activityId)`
* `useParticipants(activityId)`
* `useLottery(activityId)`
* `useCurrentGame(activityId)`
* `useActivityCloseView(activity, myParticipant)`

`myParticipant` 可以這樣找：

```ts
const currentAccount = useCurrentAccount();
const currentAddress = currentAccount?.address ?? "";

const { participants } = useParticipants(activityId);

const myParticipant =
  participants.find((p) => p.owner === currentAddress) ?? null;
```

---

#### 8-4-4-2 畫面區塊拆分

建議拆成幾個卡片：

1. **Activity Info Card**

   * 顯示活動名稱、Organizer（截斷）、狀態（OPEN/CLOSED）。
   * 顯示目前 `prizePool`、`participantCount`。
   * 顯示「你是誰」：目前地址 / 未連線提醒。

2. **Join Activity Card**

   * 若 `!myParticipant` 且 `activity.status === OPEN`：

     * 顯示「加入尾牙活動」按鈕。
     * 呼叫 `useActivityOperations.joinActivity(...)`。
   * 若已加入：

     * 顯示「已加入」，並顯示你的 `participantId` 或簡單文案。

3. **Bonus Card**

   * 需要的 hooks：

     * `useBonusView(activity, myParticipant)`（如果有）。
     * `useBonusOperations.claimBonus(...)`。
   * 狀態顯示：

     * 是否有 bonus event。
     * 你是否已有資格 / 已領取。
   * 操作：

     * 顯示「領取參加獎」按鈕（條件：`activity.hasBonusEvent && myParticipant && !myParticipant.hasClaimedBonus`）。
     * 按下去呼叫 `claim_bonus`。

4. **Lottery Card**

   * 需要的 hooks：

     * `useLottery(activityId)`。
     * `useLotteryJoin()`（Step 5 裡的 join 部分）。
   * 狀態：

     * 是否有正在進行的 Lottery。
     * 你是否已 join。
   * 操作：

     * 若 `lottery.status === "OPEN"` 且 `myParticipant` 存在，且你還沒 join：

       * 顯示輸入 `amount` 的欄位 + 「參與樂透」按鈕 → `join_lottery`。
     * 若 `status === "DRAWN"`：

       * 顯示 winner 地址 & amount（從 Lottery view 或 event 推）。

5. **Game Card**

   * 需要 hooks：

     * `useCurrentGame(activityId)`。
     * `useGameParticipation(activityId, gameId, myAddress)`（若你有實作）。
     * `useGameOperations.submitChoice` / `useGameOperations.claimGameReward`。
   * 狀態：

     * 是否有 ongoing Game。
     * 目前 `status`（OPEN / ANSWER_REVEALED / CLOSED）。
     * 你是否已 submit choice。
     * `is_correct`、`has_claimed_reward`。
   * 操作：

     * `status === OPEN` 且你尚未 submit：

       * 顯示四個選項的按鈕，點選一個後呼叫 `submit_choice`。
     * `status === ANSWER_REVEALED` 且你答對且尚未領獎：

       * 顯示「領取遊戲獎勵」按鈕 → `claim_game_reward`。
     * 若上一題已 CLOSED：

       * 只顯示文字：「此題已結束，未領獎視為放棄」。

6. **Close Reward Card**

   * 需要 hooks：

     * `useActivityCloseView(activity, myParticipant)`。
     * `useActivityCloseOperations.claimCloseReward`。
   * 狀態：

     * 若 `activity.status === CLOSED`：

       * 顯示 `closePayoutAmount`。
       * 顯示你是否已領取。
   * 操作：

     * 若 `canClaimCloseReward === true`：

       * 顯示「領取尾牙分紅」按鈕 → `claim_close_reward`。

---

### 8-4-5 `NotFoundPage`（`*`）

**角色：任何人。**

**需求：**

* 顯示 404 / 連結錯誤提示。
* 提供返回 `/` 的按鈕。

---

## 8-5 Cyberpunk 風格要求（給 codex 的 UI 提示）

我們不畫畫，但可以給幾條 guideline：

1. **全域色系**

   * 背景：深色（接近黑 / 深藍）＋漸層 neon 線條。
   * 強調色：青綠（#00ffd5）、紫（#b026ff）、粉紅（#ff4ecd）。

2. **卡片風格**

   * 半透明玻璃卡片（玻璃擬態）。
   * 外框加微弱光暈 glow。
   * 邊角圓潤（8~16px）。

3. **字體 / icon**

   * Mono/Tech 感字體用在數字 / 地址上。
   * Icon 可用 `lucide-react`。

4. **State 表現**

   * `OPEN` → 螢光綠 tag。
   * `CLOSED` → 灰 / 暗紅。
   * `ANSWER_REVEALED` → 紫色 tag。

codex 只要遵守這幾個設計 hint 就會蠻像 cyberpunk 了。

---

## 8-6 給 codex 的實作 Checklist

1. **Routing**

   * [ ] 建立 `AppRouter`，注入到 `main.tsx`。
   * [ ] 實作 `AppLayout` + `OrganizerLayout`。
   * [ ] 建立以下頁面檔案：

     * [ ] `src/pages/LandingPage.tsx`
     * [ ] `src/pages/organizer/OrganizerActivitiesPage.tsx`
     * [ ] `src/pages/organizer/OrganizerActivityDetailPage.tsx`
     * [ ] `src/pages/participant/ParticipantActivityPage.tsx`
     * [ ] `src/pages/NotFoundPage.tsx`

2. **OrganizerActivitiesPage**

   * [ ] 呼叫 `useActivityList()` 取得活動列表。
   * [ ] 顯示卡片 / 表格。
   * [ ] 點擊導向 `/organizer/activities/:activityId`。
   * [ ] 放一顆「Create Activity」的按鈕（先可以只是開個空 modal）。

3. **OrganizerActivityDetailPage**

   * [ ] 用 `useParams()` 拿 `activityId`。
   * [ ] 呼叫：

     * `useActivity(activityId)`
     * `useParticipants(activityId)`
     * 其他視需要：`useLottery(activityId)`, `useCurrentGame(activityId)`, `useActivityCloseView(...)`
   * [ ] 切出四或五個區塊：Overview / Bonus & Prize Draw / Lottery / Game / Close & Settlement。
   * [ ] 把對應 hooks 的操作按鈕接上。

4. **ParticipantActivityPage**

   * [ ] 用 `useParams()` 拿 `activityId`。
   * [ ] 呼叫共用資料 hooks。
   * [ ] 找出 `myParticipant`。
   * [ ] 分成六個卡片：Info / Join / Bonus / Lottery / Game / Close Reward。
   * [ ] 接上 Step 3~7 的 hooks 操作。

5. **Cyberpunk Theme**

   * [ ] Layout 完成一套基礎的 theme（背景 + card + button style）。
   * [ ] 把狀態 tag 做成明顯的 color code。

