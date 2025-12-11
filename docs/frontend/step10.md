## Step 10：Activity 主畫面整合

> 讓 Organizer / Participant 能在同一頁看到「錢包狀態 + 活動列表 + 建立活動入口」

### 🎯 這一步的目標

1. 做出一個主頁（`ActivityHomePage`）：

   * 上方顯示錢包連線狀態（MetaMask + IOTA Snap）。
   * 中間顯示活動列表（依使用者身份分區：我建立的 / 我參加的 / 全部活動）。
   * 右側或下方有「建立新活動」區塊（Organizer 行為）。
2. 只使用 **既有 hooks** 與 context：

   * `useWallet`（Step 9）
   * `useActivitiesQuery` + `useActivityOperations`（Step 3）
   * `ConnectWalletButton`（Step 9）
3. 不在這一步處理「Bonus / Lottery / Game / Close Reward 的細頁操作」，只要能導到對應的詳細頁 route。

---

## 10.1 檔案與結構

請新增 / 調整以下檔案：

1. `src/pages/ActivityHomePage.tsx`
2. `src/components/layout/AppLayout.tsx`（若在 Step 8 已建，可直接擴充）
3. `src/components/activity/ActivityList.tsx`
4. `src/components/activity/ActivityCard.tsx`
5. `src/components/activity/CreateActivityPanel.tsx`
6. （可能已有）`src/components/wallet/ConnectWalletButton.tsx`

> 路由部分：
>
> * `/activities` → 使用 `ActivityHomePage`
> * `/` → redirect 到 `/activities`（Step 8 已定義，這邊只確認會用）

---

## 10.2 資料來源 & hooks 依賴

### 10.2.1 使用的 hooks

1. `useWallet()`（Step 9）

   * 需要的欄位：

     * `currentAddress`
     * `isConnected` / `isReady`
     * `network`
     * `snapStatus`
2. `useActivitiesQuery()`（Step 3 設計）

   * `const { data, isLoading, refetch } = useActivitiesQuery();`

   * `data` 應為 `ActivityView[]` 類型，例如：

     ```ts
     export interface ActivityView {
       id: string;
       organizer: string;
       name: string;
       status: "OPEN" | "CLOSED";
       prizePoolAmount: string;      // or bigint
       participantCount: number;
       hasBonusEvent: boolean;
       closePayoutAmount: string;
     }
     ```

   * 若之前設計還沒有 `ActivityView`，請在這一步補上。
3. `useActivityOperations()`（Step 3）

   * 至少要有：

     ```ts
     const {
       createActivity,
       isCreating,
       // addPrizeFund, ...（這頁可以先不用 UI）
     } = useActivityOperations();
     ```

---

## 10.3 `AppLayout` – 頂部 Navigation + Cyberpunk 風格

### 10.3.1 結構

`src/components/layout/AppLayout.tsx`：

* Header（固定在頂部）：

  * 左側：App Logo / 名稱（例如：`IOTA Annual Party`）

    * 副標：`Cyber Tailwind年會抽獎系統` 之類，可交給 codex 發揮。
  * 中間：目前網路（`devnet / testnet`）badge。
  * 右側：

    * `ConnectWalletButton`
    * 顯示簡短地址（e.g. `0x472d...571f9`），已連線才顯示。

* Main 區塊：

  * 背景：cyberpunk 風格（深色 + 霓虹 gradient，交給 codex 用 Tailwind/自訂 CSS 做）。
  * 內容寬度約 `max-w-6xl` 水平置中，上下留白。

### 10.3.2 功能要求

* `AppLayout` 接受 `children`，包在 `main` 內。
* 在 `ActivityHomePage` 等頁面外層使用 `<AppLayout>` 包起來。

---

## 10.4 `ActivityHomePage` – 主畫面 Layout 與邏輯

`src/pages/ActivityHomePage.tsx`

### 10.4.1 Layout

建議分成三個主要區塊：

1. **Wallet Status Panel（上方）**
2. **Activity Tabs + List（左側/中間）**
3. **Create Activity Panel（右側 or 下方）**

可以用 CSS Grid 或 flex 做出「左列表 + 右表單」的版型，例如：

```text
[ WalletStatusPanel (full width) ]
[ ActivityList (2/3) | CreateActivityPanel (1/3) ]
```

### 10.4.2 Wallet Status Panel

**需求：**

* 使用 `useWallet()`：

  * 如未連線（`!isConnected`）：

    * 顯示一個醒目的「請先連接 IOTA Snap」提示 + `ConnectWalletButton`。
    * 可以加上一些文案：「連線後才能建立 / 參與活動」。
  * 如已連線：

    * 顯示：

      * 當前地址（截斷）
      * 網路名稱（`network`）
      * Snap 狀態（例如小綠點 icon + `IOTA Snap Connected`）
* 風格：

  * 霓虹外框 card（交給 codex，重點是要跟整體 cyberpunk 題材一致）

> 這一區只負責「展示錢包狀態」，不做交易。

---

## 10.5 活動列表區：ActivityList + ActivityCard

### 10.5.1 Activity 分類邏輯

在 `ActivityHomePage` 內：

1. 取得全部活動：

   ```ts
   const { data: activities, isLoading, refetch } = useActivitiesQuery();
   const { currentAddress, isConnected } = useWallet();
   ```

2. 分類成三組：

   ```ts
   const myOrganizedActivities = activities.filter(
     (a) => a.organizer.toLowerCase() === currentAddress.toLowerCase()
   );

   // 這裡暫時先不做「我參加的」，後續可透過 useMyParticipants + mapping 實作
   const allActivities = activities;
   ```

3. 頁面上用 Tabs 表示：

   * Tab 1：**全部活動**
   * Tab 2：**我建立的**
   * Tab 3：**我參加的**（先留空 or 之後補：依 Step 4 的 Participant hook 實作）

> Tabs 由 codex 自由使用 UI library 或自刻，這一步只定義資料切換邏輯。

### 10.5.2 `ActivityList` Component

`src/components/activity/ActivityList.tsx`

**Props：**

```ts
interface ActivityListProps {
  activities: ActivityView[];
  currentAddress: string;
  isLoading: boolean;
  onRefresh: () => void;
}
```

**行為：**

* `isLoading` 時：顯示 loading skeleton / spinner。
* 無活動時：顯示「目前沒有活動」提示（可加「請向 Organizer 索取活動 QRCode」之類文案）。
* 有活動時：以 card list 形式渲染，每一筆使用 `ActivityCard`。

### 10.5.3 `ActivityCard` Component

`src/components/activity/ActivityCard.tsx`

**Props：**

```ts
interface ActivityCardProps {
  activity: ActivityView;
  currentAddress: string;
  onOpenDetail: (activityId: string) => void;
}
```

**UI 元素需求：**

* 標題：`activity.name`
* Organizer 標籤：

  * 如果 `activity.organizer === currentAddress` → 顯示 badge：「You are organizer」
  * 否則顯示 organizer 縮短地址。
* 狀態 badge：

  * `OPEN` → 亮色（霓虹綠 / 青色）
  * `CLOSED` → 暗色（灰 / 暗紅）
* 顯示資訊：

  * 獎金池餘額：`activity.prizePoolAmount`（字串或格式後的數字）
  * 參加人數：`activity.participantCount`
  * 參加獎：`activity.hasBonusEvent ? "已開啟" : "尚未開啟"`
* 行為按鈕：

  * **「進入活動」**：

    * `onClick` → 呼叫 `onOpenDetail(activity.id)`。
    * `ActivityHomePage` 內部會用 `useNavigate()` 導向 `/activities/:id`。
  * （Optional）如果是 Organizer 且 `status === OPEN`，可以先放兩個小按鈕但不一定要開功能：

    * 「加碼獎金」→ 之後 Step N 再接上 `addPrizeFund`.
    * 「快速關閉」→ 導到 detail 頁的 close 區塊（目前可先不實作 click）。

---

## 10.6 建立活動區：CreateActivityPanel

`src/components/activity/CreateActivityPanel.tsx`

### 10.6.1 Props & hook

在 `ActivityHomePage` 中：

```ts
const { createActivity, isCreating } = useActivityOperations();
const { isConnected } = useWallet();
```

將以下 props 傳入 `CreateActivityPanel`：

```ts
<CreateActivityPanel
  disabled={!isConnected}
  onCreate={async (name, initialAmount) => {
    await createActivity({ name, initialAmount });
    await refetch(); // 刷新活動列表
  }}
  isCreating={isCreating}
/>
```

### 10.6.2 `CreateActivityPanel` 行為需求

**Props：**

```ts
interface CreateActivityPanelProps {
  disabled: boolean;
  isCreating: boolean;
  onCreate: (name: string, initialAmount: bigint | number) => Promise<void>;
}
```

**內容：**

* Panel 標題：`建立新活動` / `Create New Activity`
* 說明文字：簡短一句，說明：

  * 會從目前帳戶 withdraw IOTA 作為獎金池。
  * 之後可以再加碼。
* 表單欄位：

  1. `name`（活動名稱，必填）
  2. `initialAmount`（初始獎金池 IOTA 數量，必填、>0）
* 驗證：

  * `name` 不可空白。
  * `initialAmount` 必須為正整數。
* Disabled 條件：

  * 未連線錢包 (`disabled === true`) → 整個 panel 半透明 + Button disabled + 顯示提示文字：「請先連接錢包」。
  * `isCreating === true` → Button 顯示 loading。
* 提交：

  * `onSubmit` 時呼叫 `await onCreate(name, parsedAmount)`。
  * 若成功：清空表單，顯示 toast（可以用 `sonner`）。
  * 若失敗：顯示錯誤訊息（從 `Error.message` 取）。

> 這裡不處理 `getCoins` 等細節，全部交給 `useActivityOperations().createActivity` 內部跟 IOTA SDK 互動。

---

## 10.7 Routing 整合

在 Step 8 的 route 定義中，確認：

* `/activities` → element：`<ActivityHomePage />`
* `/activities/:id/*` → 對應後續 detail 頁（例如 Step 11, 12… 才實作）。
* `/` → redirect 到 `/activities`。

在 `ActivityHomePage` 中：

```ts
const navigate = useNavigate();

const handleOpenDetail = (id: string) => {
  navigate(`/activities/${id}`);
};
```

把 `handleOpenDetail` 傳到 `ActivityList` → `ActivityCard`。

---

## 10.8 Cyberpunk 風格需求（給 codex 的 UI 提示）

雖然具體 CSS 交給 codex，但這一步要給一些明確方向：

1. 背景：

   * 漸層背景：深藍 / 深紫為底，搭配霓虹粉 / 青色線性漸層。
2. 卡片：

   * 圓角 + 微光外框（box-shadow/outline）。
   * hover 時外框顏色變亮 + 輕微縮放。
3. 狀態 badge：

   * `OPEN`：亮綠 / 青色 neon。
   * `CLOSED`：暗紅 / 暗灰。
4. 按鈕：

   * 有邊框 glow、hover 時會有 scanline 或簡易動畫。
5. 字體：

   * 標題可用偏未來感字型（若 CDN 可用），否則用加粗 + letter-spacing。

---

## 10.9 Step 10 完成條件（Definition of Done）

* [ ] `/activities` 主畫面可正常載入：

  * [ ] 未連線錢包時，顯示「請連接 IOTA Snap」+ Connect 按鈕；
  * [ ] 已連線時，顯示地址 / 網路資訊。
* [ ] `useActivitiesQuery` 取得結果後，列表會顯示活動卡片。
* [ ] 我建立的活動會正確標出「You are organizer」或類似標籤。
* [ ] 點擊「進入活動」會導到 `/activities/:id` 對應頁（即使該頁暫時只有 placeholder）。
* [ ] 「建立新活動」表單可以成功送出交易（由 `useActivityOperations` 實作），成功後列表會更新。
* [ ] 未連線時「建立活動」 panel 會鎖定並提示使用者先連線。
