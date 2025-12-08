# 一、專案概述

## 1.1 目標

實作一套「公司尾牙抽獎遊戲」系統，**僅使用前端 + Move 智能合約，無任何後端 server**。
所有活動邏輯（報名、獎金池、參加獎、抽獎、樂透、四選一遊戲、活動關閉）皆在鏈上執行，達成：

* 抽獎公平、公正、可驗證
* 活動過程透明、可追溯
* 工作坊參與者能專注在前端與 Move 合約開發

## 1.2 範圍

本版本功能範圍：

* 活動建立 / 報名簽到（掃 QRCode）
* 主委加碼（補獎金池）
* 參加獎（一次性事件，員工各自 claim）
* 單次抽獎（隨機抽一位，不可重複中獎）
* 樂透（每人每場一次，獎金獨得）
* 四選一遊戲（多場、單場只能有一個進行中）
* 活動關閉（平均分配剩餘獎金，由員工 claim；之後主辦可提領未被領取的餘額）

---

# 二、角色與情境

## 2.1 角色定義

1. **主辦（Organizer）**

   * 建立活動
   * 主委加碼（增加獎金池）
   * 建立參加獎事件
   * 執行單次抽獎
   * 建立 / 開獎樂透
   * 建立 / 開獎 四選一遊戲
   * 關閉活動 / 提領剩餘獎金

2. **員工（Participant）**

   * 掃描活動 QRCode，進入前端頁面
   * 連接錢包，報名活動
   * 領取參加獎
   * 參與樂透
   * 參與四選一遊戲並 claim 獎金
   * 查看抽獎 / 樂透結果
   * 活動關閉後 claim 平均分配獎金

---

# 三、系統架構概觀

## 3.1 組成

1. **Move 智能合約**

   * 提供活動 / 抽獎 / 樂透 / 四選一遊戲 / 關閉流程的 on-chain 邏輯
   * 採用 Object-based 模型（Activity / Participant / Lottery / Game ...）
   * 提供 entry functions 給前端呼叫
   * 發出事件（event）供前端輪詢解析

2. **前端 Web App（純前端）**

   * 建議使用任意前端框架（React / Vue 皆可）
   * 通過錢包 SDK 與 Move 合約互動
   * 根據使用者當前地址判斷其角色（是否 organizer）
   * 每隔固定時間 polling 合約狀態 / 事件，更新頁面

3. **錢包**

   * 管理私鑰與簽名
   * 發送 Move 交易
   * 查詢鏈上狀態（由前端透過 SDK 呼叫）

## 3.2 信任模型

* 所有關鍵狀態（活動 / 參與者 / 獎金池 / 中獎結果）皆由合約記錄，公開可驗證。
* 主辦方具備活動管理權限，但在合約規則限制下，無法任意竄改獎金或抽獎結果。
* 沒有中心化後端，前端只做顯示與交易發送。

---

# 四、On-chain 資料模型

以下為推薦物件 / enum 設計，實作時命名可微調。

## 4.1 Enum 類型

```text
enum ActivityStatus {
    OPEN,           // 活動建立，開放報名
    BONUS_READY,    // 參加獎事件已建立，可讓員工 claim
    CLOSED          // 活動已關閉，不再允許報名 / 新遊戲 / 新樂透
}

enum LotteryStatus {
    OPEN,
    DRAWN,          // 已開獎，但資料保留
    CLOSED          // （可選，可不使用）
}

enum GameStatus {
    OPEN,           // 已建立，員工可選擇
    ANSWER_REVEALED,// 主辦已公布答案，員工可 claim
    CLOSED          // 已結束（可能因新遊戲開啟或活動關閉）
}

enum GameRewardMode {
    SINGLE,         // 隨機從答對者中抽一人
    AVERAGE         // 答對者平分獎金
}
```

## 4.2 Activity（活動）

```text
object Activity {
    id: ActivityId
    organizer: address
    name: string

    status: ActivityStatus
    prize_pool: u64                // 活動獎金池
    participant_count: u64         // 報名人數（已 join 的數量）

    has_bonus_event: bool          // 是否已建立參加獎事件（每活動只能一次）
    bonus_amount_per_user: u64     // 每人參加獎金額
    close_payout_amount: u64       // 活動關閉後，每人可領平分金額（0 表示尚未結算）
    remaining_pool_after_close: u64// 關閉後剩餘未被認領的獎金

    lottery_id: option<LotteryId>  // 當前進行中的樂透（最多一個）
    current_game_id: option<GameId>// 當前進行中的四選一遊戲（最多一個）
}
```

## 4.3 Participant（員工參加紀錄）

每位員工在每個 Activity 有一個 Participant object：

```text
object Participant {
    id: ParticipantId
    activity_id: ActivityId
    owner: address

    joined: bool                    // 已報名
    has_claimed_bonus: bool         // 是否已領取參加獎
    eligible_for_draw: bool         // 是否具抽獎資格（被抽中过後會變 false）
    has_claimed_close_reward: bool  // 是否已在關閉後領取平分獎金
}
```

> 備註：
>
> * 一場活動中，**單次抽獎**不允許同一地址重複中獎 → 用 `eligible_for_draw` 控制。
> * 四選一遊戲中可多次中獎（跨遊戲），不走這個 flag。

## 4.4 Lottery（樂透）

```text
object Lottery {
    id: LotteryId
    activity_id: ActivityId
    status: LotteryStatus

    pot_amount: u64                 // 樂透獎金池
    participants: vector<address>   // 樂透參與者地址列表
    winner: option<address>
}
```

規則：

* 一場 Activity 同一時間最多只有一個 `status = OPEN` 的 `Lottery`。
* 同一地址在 **同一場 Lottery 中只能參與一次**。
* 同一 Activity 可開啟多場 Lottery，只要前一場已 DRAWN/CLOSED。

## 4.5 Game（四選一遊戲）

```text
object Game {
    id: GameId
    activity_id: ActivityId

    status: GameStatus

    question: string
    options: vector<string>         // 長度固定為 4
    reward_amount: u64
    reward_mode: GameRewardMode     // SINGLE / AVERAGE

    correct_option: option<u8>      // 1~4，未公布前為 None
    total_correct: u64              // 答對人數（公布答案時計算）
    winner_addr: option<address>    // 若為 SINGLE 模式，記錄唯一得獎者
}
```

### GameParticipation（四選一遊戲參與紀錄）

為避免在 Game 內塞過大 vector，建議每位參與者在每場 Game 建立一個 participation object：

```text
object GameParticipation {
    id: GameParticipationId
    game_id: GameId
    activity_id: ActivityId
    owner: address

    choice: u8                      // 1~4
    is_correct: bool                // 公布答案後存入
    has_claimed_reward: bool
}
```

規則：

* 每位員工在每場 Game 只能有一個 GameParticipation：

  * `submit_choice` 時若該 address 已有紀錄則拒絕。
* 同一 Activity 可有多場 Game（A、B、C ...），但**同一時間只允許一個 Game 處於 OPEN / ANSWER_REVEALED 狀態**。
* 員工若在某場 Game 中選對，且在該場 Game 開啟期間有 claim → 可以拿到 reward。
* 若主辦建立下一場 Game（B）時，前一場 Game（A）的 `status` 被設成 `CLOSED`；
  **之後不得再 claim A 的獎金**。

---

# 五、事件（Events）

供前端 polling 使用：

* `ActivityCreated(activity_id, organizer, name, initial_pool)`
* `ParticipantJoined(activity_id, participant_addr)`
* `PrizePoolIncreased(activity_id, amount, new_total)`
* `BonusEventCreated(activity_id, bonus_amount_per_user)`
* `BonusClaimed(activity_id, participant_addr, amount)`
* `PrizeDrawExecuted(activity_id, winner_addr, amount)`
* `LotteryCreated(activity_id, lottery_id)`
* `LotteryJoined(activity_id, lottery_id, participant_addr, amount)`
* `LotteryExecuted(activity_id, lottery_id, winner_addr, amount)`
* `GameCreated(activity_id, game_id, reward_amount, reward_mode)`
* `GameAnswerRevealed(activity_id, game_id, correct_option)`
* `GameRewardClaimed(activity_id, game_id, participant_addr, amount)`
* `ActivityClosed(activity_id, close_payout_amount)`
* `CloseRewardClaimed(activity_id, participant_addr, amount)`
* `RemainingPoolWithdrawn(activity_id, organizer, amount)`

---

# 六、合約介面設計（Move entry functions）

以下為 Logical API，實作時可合併 / 微調命名。

## 6.1 活動建立與查詢

### create_activity(name: string, initial_pool: u64)

* caller：主辦
* 行為：

  * 建立 Activity object
  * `status = OPEN`
  * `prize_pool = initial_pool`（交易需附帶 token）
  * 觸發 `ActivityCreated`

### get_activity(activity_id) -> ActivityView

* read-only，用於前端顯示活動資訊。

---

## 6.2 報名簽到

### join_activity(activity_id)

* caller：員工
* 檢查：

  * `activity.status == OPEN`
  * 此 address 在該活動尚無 Participant object
* 行為：

  * 建立 Participant object：

    * `joined = true`
    * `eligible_for_draw = true`
    * `has_claimed_bonus = false`
    * `has_claimed_close_reward = false`
  * `activity.participant_count += 1`
  * 發 `ParticipantJoined`

---

## 6.3 主委加碼

### add_prize_fund(activity_id, amount: u64)

* caller：必須為 `activity.organizer`
* 行為：

  * 交易附帶 `amount`
  * `activity.prize_pool += amount`
  * 發 `PrizePoolIncreased`

---

## 6.4 參加獎

### create_bonus_event(activity_id, bonus_amount_per_user: u64)

* caller：organizer
* 檢查：

  * `activity.status` 為 OPEN 或 BONUS_READY（可視流程，但不應 CLOSED）
  * `activity.has_bonus_event == false`
  * `activity.prize_pool >= bonus_amount_per_user * activity.participant_count`
* 行為：

  * `activity.has_bonus_event = true`
  * `activity.bonus_amount_per_user = bonus_amount_per_user`
  * 發 `BonusEventCreated`

> 規則：**主辦每場活動只能建立一次參加獎事件。**

### claim_bonus(activity_id)

* caller：員工
* 檢查：

  * 有對應 Participant，且 `joined == true`
  * `activity.has_bonus_event == true`
  * `participant.has_claimed_bonus == false`
  * `activity.prize_pool >= bonus_amount_per_user`
* 行為：

  * `participant.has_claimed_bonus = true`
  * `activity.prize_pool -= bonus_amount_per_user`
  * 對 caller 發送 `bonus_amount_per_user`
  * 發 `BonusClaimed`

> 規則：**員工每場活動只能 claim 一次參加獎。**

---

## 6.5 單次抽獎

### draw_prize(activity_id, amount: u64, client_seed: u64)

* caller：organizer
* 檢查：

  * `activity.prize_pool >= amount`
  * 至少有一位 `Participant.eligible_for_draw == true`
* 隨機數生成：

  * `random = hash(block_hash || tx_hash || caller || client_seed)`
  * `idx = random % eligible_participant_count`
* 行為：

  * 取出 `winner_addr`
  * `activity.prize_pool -= amount`
  * 對 `winner_addr` 發送 `amount`
  * 將該 winner 的 `eligible_for_draw = false`（避免同一地址重複中獎）
  * 發 `PrizeDrawExecuted`

> 規則：**同一活動中，單次抽獎不會重複選到已中獎的人。**

---

## 6.6 樂透

### create_lottery(activity_id)

* caller：organizer
* 檢查：

  * `activity.lottery_id == None` 或前一個 Lottery 已 `status != OPEN`
* 行為：

  * 建立 Lottery object：

    * `status = OPEN`
    * `pot_amount = 0`
    * `participants = []`
  * `activity.lottery_id = Some(lottery_id)`
  * 發 `LotteryCreated`

### join_lottery(activity_id, amount: u64)

* caller：員工
* 檢查：

  * 有 Participant，已 `joined == true`
  * 當前 Lottery `status == OPEN`
  * 該地址尚未在 `lottery.participants` 中（同一場只能參加一次）
* 行為：

  * 交易附帶 `amount`
  * `lottery.pot_amount += amount`
  * `lottery.participants.push(caller)`
  * 發 `LotteryJoined`

### execute_lottery(activity_id, client_seed: u64)

* caller：organizer
* 檢查：

  * `lottery.status == OPEN`
  * `lottery.participants.length > 0`
* 隨機數：

  * `random = hash(block_hash || tx_hash || caller || client_seed)`
  * `idx = random % participants.length`
* 行為：

  * `winner_addr = participants[idx]`
  * 發送 `lottery.pot_amount` 給 winner
  * `lottery.status = DRAWN`
  * `lottery.winner = Some(winner_addr)`
  * 發 `LotteryExecuted`

> 規則：
>
> * 同一場 Lottery 中，一個地址只能投入一次。
> * 活動期間可以多次建立 Lottery（前一場結束後再開新的一場）。

---

## 6.7 四選一遊戲

### create_game(activity_id, question, options[4], reward_amount: u64, reward_mode: GameRewardMode)

* caller：organizer
* 檢查：

  * `activity.status != CLOSED`
  * `activity.current_game_id == None` 或前一場 Game 已 `status == CLOSED`
  * `activity.prize_pool >= reward_amount`
  * options 長度為 4
* 行為：

  * 建立 Game object：

    * `status = OPEN`
    * `question`, `options`, `reward_amount`, `reward_mode`
    * `correct_option = None`
    * `total_correct = 0`
    * `winner_addr = None`
  * `activity.current_game_id = Some(game_id)`
  * 預先凍結 `reward_amount` 在獎金池中（邏輯上可視為保留）
* 事件：

  * `GameCreated(activity_id, game_id, reward_amount, reward_mode)`

> 規則：
>
> * 同一場活動中可重複建立多場 Game（A, B, C...），但**同一時間僅允許一場 Game 為 OPEN / ANSWER_REVEALED**。
> * 新建 Game 時，若有舊 Game `status == ANSWER_REVEALED`，合約需將其自動標記為 `CLOSED`，停止允許 claim。

### submit_choice(activity_id, game_id, choice: u8)

* caller：員工
* 檢查：

  * 有 Participant，且 `joined == true`
  * `game.status == OPEN`
  * choice 在 1~4
  * 此 address 在此 game 尚未有 GameParticipation
* 行為：

  * 建立 GameParticipation：

    * `owner = caller`
    * `choice = choice`
    * `is_correct = false`（暫存）
    * `has_claimed_reward = false`

### reveal_game_answer(activity_id, game_id, correct_option: u8, client_seed: u64)

* caller：organizer
* 檢查：

  * `game.status == OPEN`
  * `correct_option` 在 1~4
* 行為：

  * 設 `game.correct_option = Some(correct_option)`
  * 遍歷該 Game 的 Participation：

    * 若 `choice == correct_option`，則 `is_correct = true` 並計數 `total_correct += 1`
  * 根據 `reward_mode`：

    * **AVERAGE**：

      * 若 `total_correct > 0`：

        * 每人獎金 = `per = reward_amount / total_correct`
        * 不另行隨機
      * 若 `total_correct == 0`：整筆 reward_amount 可保留在 prize_pool 或退回 organizer（視設計，可簡化為保留在活動獎金池）
    * **SINGLE**：

      * 若 `total_correct > 0`：

        * 使用 `hash(block_hash || tx_hash || caller || client_seed)` 從答對者中選出一位 winner
        * `game.winner_addr = Some(winner_addr)`
      * 若 `total_correct == 0`：

        * 同上，可保留 reward_amount 在獎金池
  * 將 `game.status = ANSWER_REVEALED`
  * 發 `GameAnswerRevealed(activity_id, game_id, correct_option)`

> 規則：
>
> * 員工「每場遊戲」最多選一次。
> * 員工若在多場遊戲中選對，每場都可以 claim。
> * 若主辦在建立下一場 Game 前，未 claim 的員工視為放棄該場獎金。

### claim_game_reward(activity_id, game_id)

* caller：員工
* 檢查：

  * `game.status == ANSWER_REVEALED`
  * 對應 `GameParticipation` 存在且：

    * `is_correct == true`
    * `has_claimed_reward == false`
  * 並依 `reward_mode` 決定領取條件：

    * **AVERAGE**：

      * 每個 `is_correct == true` 的人都可領 `per = reward_amount / total_correct`
    * **SINGLE**：

      * 僅當 `game.winner_addr == caller` 時可領 `amount = reward_amount`
* 行為：

  * `GameParticipation.has_claimed_reward = true`
  * `activity.prize_pool -= 實際發出的金額`
  * 發送對應 amount 給 caller
  * 發 `GameRewardClaimed`

> 規則：
>
> * 每個 participation 在單場 Game 中最多 claim 一次。
> * **建立下一場 Game 時，前一場 Game 狀態會被設為 CLOSED；此後不允許再 claim 前一場的 reward。**
>   （前端 UI 需明顯提醒：「本題未在下題開始前 claim 則視為放棄」）

---

## 6.8 關閉活動與剩餘獎金處理

### close_activity(activity_id)

* caller：organizer
* 檢查：

  * `activity.status != CLOSED`
* 行為：

  * 計算 `avg = activity.prize_pool / activity.participant_count`（整數除法）
  * `activity.close_payout_amount = avg`
  * `activity.remaining_pool_after_close = activity.prize_pool`
  * `activity.status = CLOSED`
  * 不立即轉帳，由員工自行 claim：

    * 每位員工最多可領 `avg`
  * 發 `ActivityClosed(activity_id, avg)`

### claim_close_reward(activity_id)

* caller：員工
* 檢查：

  * 有 Participant
  * `activity.status == CLOSED`
  * `participant.has_claimed_close_reward == false`
  * `activity.remaining_pool_after_close >= activity.close_payout_amount`
* 行為：

  * `participant.has_claimed_close_reward = true`
  * `activity.remaining_pool_after_close -= activity.close_payout_amount`
  * 發送 `activity.close_payout_amount` 給 caller
  * 發 `CloseRewardClaimed`

### withdraw_remaining_after_close(activity_id)

* caller：organizer
* 檢查：

  * `activity.status == CLOSED`
  * `activity.remaining_pool_after_close > 0`
* 行為：

  * 將 `remaining_pool_after_close` 全部轉給 organizer
  * 設 `activity.remaining_pool_after_close = 0`
  * 發 `RemainingPoolWithdrawn`

> 規則：
>
> * 關閉活動後，員工可在任何時間 claim 平分獎金。
> * 不 claim 的餘額可在之後由主辦提領，避免資金永久卡住。

---

# 七、隨機數設計

## 7.1 需求

* 不引入額外 VRF / Oracle
* 不依賴中心化服務
* 不可被主辦預先完全預測

## 7.2 實作方式（建議）

所有需要 randomness 的地方（單次抽獎 / Lottery / Game SINGLE 模式）使用相同策略：

```text
random_u64 = hash(block_hash || tx_hash || caller || client_seed)
index = random_u64 % N
```

* `block_hash`：當前交易被打包進的區塊 hash（主辦無法掌控）
* `tx_hash`：此筆交易 hash
* `caller`：主辦 address
* `client_seed`：主辦傳入的隨機數字（可由前端產生）

這樣：

* 主辦無法完全預測結果（區塊 / tx hash 不可控）
* 結果可在事後公開驗證（所有輸入都上鏈）

---

# 八、前端設計與 Polling 策略

## 8.1 前端頁面角色

### 主辦頁面

* 顯示：

  * 活動名稱 / organizer address
  * 獎金池金額
  * 報名人數
  * 當前 Lottery / Game 狀態
* 操作按鈕：

  * 顯示活動 QRCode（含 `activity_id`）
  * 主委加碼（輸入金額 → add_prize_fund）
  * 建立參加獎（輸入每人金額 → create_bonus_event）
  * 抽獎（輸入金額 + seed → draw_prize）
  * 建立樂透 / 開獎樂透（create_lottery / execute_lottery）
  * 建立四選一遊戲（create_game）
  * 四選一遊戲公布答案（reveal_game_answer）
  * 關閉活動（close_activity）
  * 關閉後提領剩餘獎金（withdraw_remaining_after_close）

### 員工頁面

* 初始（未 join）：顯示「請連接錢包並加入活動」，提供 join 按鈕。
* 已 join，等待活動：顯示「已加入，等待活動開始」。
* 參加獎：若 `has_bonus_event == true` 且 `has_claimed_bonus == false` → 顯示「領取參加獎」按鈕。
* 抽獎：顯示最近一次 `PrizeDrawExecuted` 事件結果（是否中獎）。
* 樂透：

  * 若 Lottery OPEN 且尚未參加 → 顯示「輸入金額參與樂透」。
  * 若已參加 → 顯示等待開獎 / 開獎結果。
* 四選一遊戲：

  * 若有 `current_game.status == OPEN` 且尚未 submit_choice → 顯示題目與四個選項。
  * 若已選 => 顯示「已選擇：XXX，等待公布答案」。
  * 若 `status == ANSWER_REVEALED`：

    * 若該場 GameParticipation `is_correct == true` 且尚未 claim → 顯示「領取獎金」按鈕。
    * 顯示提醒：「新一場遊戲建立後，未領取獎金將視為放棄。」
* 活動關閉：

  * 若 `status == CLOSED` 且尚未 claim close reward → 顯示「領取活動尾聲獎金」。
  * 已領則顯示「活動已結束」。

## 8.2 Polling 策略

前端每 3～5 秒輪詢：

* `get_activity(activity_id)`
* 目前使用者的 `Participant`（若存在）
* 當前 `Lottery`（若 `activity.lottery_id` 存在）
* 當前 `Game`（若 `activity.current_game_id` 存在）
* 可選：最近 N 筆相關事件（用於顯示歷史紀錄）

---

# 九、商業規則總整理

1. 一場活動只能建立一次參加獎事件。
2. 員工一場活動中：

   * 只可 join 一次；
   * 只可 claim 一次參加獎；
   * 在單次抽獎中，若中獎，之後抽獎不得再次中獎（透過 `eligible_for_draw` 控制）。
3. 樂透：

   * 每場 Lottery 中，每位員工只能 join 一次；
   * 活動期間可有多場 Lottery（前一場結束再開新場）。
4. 四選一遊戲：

   * 同一活動中可建立多場 Game（A、B、C...）；
   * **同一時間只能有一場 Game 為進行中（OPEN 或 ANSWER_REVEALED）**；
   * 每場 Game 中，每位員工只能選擇一次；
   * 員工若在多場 Game 中選對，每場都能 claim 獎金；
   * 建立新 Game 時，前一場 Game 自動設為 CLOSED，之後不允許 claim 該場 Game 的獎金。
5. 活動關閉：

   * 剩餘獎金平均分配給所有參加者（需 claim）；
   * 未被 claim 的餘額將保留給主辦後續提領。

---

# 十、開發拆解建議（簡略）

可視實際人力調整：

1. **Move 合約開發**

   * Phase 1：Activity / Participant / Bonus / Prize Draw / 加碼 / 關閉
   * Phase 2：Lottery
   * Phase 3：Game（四選一）
2. **前端開發**

   * Phase 1：登入 / 角色判斷 / 報名 / 基本資訊展示
   * Phase 2：參加獎 / 抽獎 / 加碼 / 關閉流程
   * Phase 3：Lottery UI
   * Phase 4：Game（四選一）UI
3. **整合與測試**

   * 小規模 end-to-end 測試（3～5 帳號，完整走完活動流程）

