## 1. 專案目標與邊界

### 1.1 目標

建立一套完全 on-chain 的 **公司尾牙抽獎遊戲 DApp**：

* 智能合約使用 Move 部署在 IOTA SVM / ShimmerVM 類型的鏈上。
* 所有獎金池、樂透池、遊戲獎勵 **全部使用「鏈上原生 IOTA 代幣」**。
* 前端為 React + TS 靜態 SPA，部署於 GitHub Pages，**無任何後端 / 自家基礎設施**。
* 透過 `@liquidlink-lab/iota-snap-for-metamask` 連接 MetaMask（Snap）作為錢包。

### 1.2 關鍵限制

* ❌ 不實作任何自訂 token；**只用原生 IOTA 代幣（native coin）**。
* ❌ 不使用全域 Registry/resource 管所有狀態。
* ✅ 每個 `Activity` / `Participant` / `Lottery` / `Game` / `GameParticipation` 皆為獨立 object（UTXO-style）。
* ✅ 合約 **永不鑄造 / 銷毀 IOTA**，只做「轉入 / 轉出 / 拆分 / 合併」。
* ✅ 所有重要狀態可由事件（events）與物件查詢取得。

---

## 2. 角色與場景

### 2.1 角色

1. **主辦（Organizer）**

   * 建立活動（Activity）
   * 注入 IOTA 作為獎金池（create + 加碼）
   * 建立參加獎事件
   * 執行抽獎
   * 建立 / 開獎 樂透
   * 建立 / 公布答案 四選一遊戲
   * 關閉活動、領回剩餘獎金

2. **員工（Participant）**

   * 掃描 QRCode 進入活動頁面
   * 連接 IOTA Snap + MetaMask
   * 報名活動（join）
   * 領取參加獎
   * 參與樂透
   * 參與四選一遊戲並領取獎勵
   * 活動關閉後領取平均分配獎金

---

## 3. Token 與金流規範

### 3.1 Token 選型

* **唯一使用的代幣：IOTA L2 原生代幣**（下文簡稱「IOTA」）。
* Move 實作層面，會使用 IOTA SVM 提供的原生 coin 模組（實際 module path 後續依官方 SDK 決定，例如 `iota::coin::Coin<Iota>`）。
* Spec 層級我們抽象化為一套 API：

  * `withdraw_iota(&signer, amount) -> Coin`
  * `deposit_iota(addr, coin)`
  * `merge_iota(&mut coin_pool, coin)`
  * `split_iota(&mut coin_pool, amount) -> Coin`
  * `balance_of(activity/lottery/game)` 由合約內 `coin_pool` 所代表。

> 具體 Move 語法交由實作時 mapping；Spec 僅要求「資產透過原生 IOTA coin 模組管理」。

### 3.2 金流總原則

1. 合約 **不鑄造 / 銷毀 IOTA**，只做：

   * 從使用者帳戶 `withdraw` 進入獎金池 / 樂透池
   * 從池中 `split`/`merge` 後 `deposit` 回使用者
2. 每個 `Activity` 持有一個 `prize_pool_coin`（Coin<Iota>）代表活動獎金池。
3. 每個 `Lottery` 持有一個 `pot_coin`（Coin<Iota>）代表樂透獎金池。
4. 所有發獎流程都要符合：

   * 池中餘額足夠
   * 相關 flag 狀態正確（避免重複領取）

---

## 4. On-chain 資料模型（Object-based）

> 型別命名以 Move 風格為準，實際 module/UID 型別依 IOTA SVM 規範調整。

### 4.1 Enums

```move
enum ActivityStatus { OPEN, BONUS_READY, CLOSED }
enum LotteryStatus { OPEN, DRAWN, CLOSED }
enum GameStatus { OPEN, ANSWER_REVEALED, CLOSED }
enum GameRewardMode { SINGLE, AVERAGE }
```

### 4.2 Activity（活動）

```move
struct Activity has key {
    id: UID,                      // 活動 object 的唯一 ID
    organizer: address,
    name: string::String,

    status: ActivityStatus,       // OPEN / BONUS_READY / CLOSED

    // IOTA 獎金池：實作上應為 Coin<Iota>，但這裡用抽象表示
    prize_pool_coin: Coin<Iota>,  // 活動掌管的一整包 IOTA

    participant_count: u64,

    // 參加獎
    has_bonus_event: bool,
    bonus_amount_per_user: u64,

    // 活動關閉後平均分配
    close_payout_amount: u64,         // 每位參加者可領 IOTA 數量
    remaining_pool_after_close: u64,  // 方便前端看，其實應等於 prize_pool_coin 的餘額

    // 活動內索引
    participants: vector<address>,    // 報名過的地址列表（不去 dedup，join 時要先檢查）
    eligible_flags: vector<bool>,     // 與 participants 對應，true 表示目前仍可被抽中

    lottery_id: option<ID>,           // 目前進行中的 Lottery（最多一個）
    current_game_id: option<ID>,      // 目前進行中的 Game（最多一個）
}
```

> 實作層：`prize_pool_coin` 是儲存真正 IOTA 的地方；`remaining_pool_after_close` 可以當作視覺化快取，不一定要額外存。

### 4.3 Participant（員工參與狀態）

```move
struct Participant has key {
    id: UID,
    activity_id: ID,
    owner: address,

    joined: bool,
    has_claimed_bonus: bool,
    has_claimed_close_reward: bool,
}
```

### 4.4 Lottery（樂透）

```move
struct Lottery has key {
    id: UID,
    activity_id: ID,
    status: LotteryStatus,

    pot_coin: Coin<Iota>,            // 樂透獎金池（員工投入的 IOTA） 

    participants: vector<address>,   // 單場樂透中所有參加者（地址不可重複）
    winner: option<address>,
}
```

### 4.5 Game（四選一遊戲）

```move
struct Game has key {
    id: UID,
    activity_id: ID,
    status: GameStatus,

    question: string::String,
    options: vector<string::String>, // 固定長度 4
    reward_amount: u64,              // 此回合遊戲預計發放總獎金（IOTA 數量）
    reward_mode: GameRewardMode,     // SINGLE / AVERAGE

    correct_option: option<u8>,      // 1~4
    total_correct: u64,
    winner_addr: option<address>,    // SINGLE 模式中抽出的那位
}
```

> `reward_amount` 對應 `Activity.prize_pool_coin` 內部要預留的 IOTA。實作時可透過 `split` 一顆專用 coin 暫存在 Game 內，或僅記錄數字，最終從 Activity 的 pool 內 `split`。

### 4.6 GameParticipation（四選一遊戲參與紀錄）

```move
struct GameParticipation has key {
    id: UID,
    game_id: ID,
    activity_id: ID,
    owner: address,

    choice: u8,                 // 1~4
    is_correct: bool,
    has_claimed_reward: bool,
}
```

---

## 5. 事件（Events）

（沿用 v2，新增必要欄位）

* `ActivityCreated(activity_id, organizer, name, initial_amount)`
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

## 6. Entry Functions

### 6.1 活動建立 / 加入 / 加碼

#### 6.1.1 `create_activity(organizer: &signer, name: String, initial_amount: u64)`

**邏輯：**

1. 從 `organizer` 帳戶 **withdraw `initial_amount` IOTA** → 得到 `coin: Coin<Iota>`。
2. 建立 `Activity` object：

   * `organizer = signer::address_of(organizer)`
   * `name = name`
   * `status = OPEN`
   * `prize_pool_coin = coin`
   * `participant_count = 0`
   * `has_bonus_event = false`
   * `bonus_amount_per_user = 0`
   * `close_payout_amount = 0`
   * `remaining_pool_after_close = 0`
   * `participants = []`
   * `lottery_id = None`
   * `current_game_id = None`
3. 將 Activity 發布為 shared object。
4. emit `ActivityCreated(id, organizer, name, initial_amount)`。

#### 6.1.2 `join_activity(user: &signer, activity_id: ID)`

**邏輯：**

1. 讀取 Activity shared object。
2. 檢查：

   * `activity.status == OPEN`
   * 此 `(activity_id, user_addr)` 尚無 Participant object。
3. 建立 `Participant`：

   * `owner = signer::address_of(user)`
   * `joined = true`
   * `has_claimed_bonus = false`
   * `eligible_for_draw = true`
   * `has_claimed_close_reward = false`
4. 將 `user_addr` push 進 `activity.participants`。
5. 同步在 `activity.eligible_flags` push true（代表該地址目前可參與抽獎）。
6. `activity.participant_count += 1`。
7. emit `ParticipantJoined(activity_id, user_addr)`。

> 不涉及任何 IOTA 轉帳。

#### 6.1.3 `add_prize_fund(organizer: &signer, activity_id: ID, amount: u64)`

**邏輯：**

1. 讀取 Activity。
2. 檢查：

   * `signer::address_of(organizer) == activity.organizer`
3. 從 organizer withdraw `amount` IOTA → `coin`.
4. `merge_iota(&mut activity.prize_pool_coin, coin)`。
5. 更新 `remaining_pool_after_close`（可選）。
6. emit `PrizePoolIncreased(activity_id, amount, new_total)`。

---

### 6.2 參加獎（Bonus）

#### 6.2.1 `create_bonus_event(organizer, activity_id, bonus_per_user: u64)`

**邏輯：**

1. 檢查：

   * caller 是 organizer
   * `activity.status == OPEN` 或 `BONUS_READY`（依實作決定）
   * `!activity.has_bonus_event`
   * `activity.participant_count > 0`
   * `total_required = bonus_per_user * participant_count`
   * `prize_pool_coin` 中的量 ≥ `total_required`
2. 寫入：

   * `activity.has_bonus_event = true`
   * `activity.bonus_amount_per_user = bonus_per_user`
3. emit `BonusEventCreated(activity_id, bonus_per_user)`。

> **不立即 transfer**，實際發放在 `claim_bonus` 時從 pool `split`。

#### 6.2.2 `claim_bonus(user, activity_id)`

**邏輯：**

1. 找對應 `Participant`。
2. 檢查：

   * `participant.joined == true`
   * `!participant.has_claimed_bonus`
   * `activity.has_bonus_event == true`
3. 從 `activity.prize_pool_coin` 中 `split` `bonus_per_user` → `coin_out`。
4. `participant.has_claimed_bonus = true`。
5. `deposit_iota(user_addr, coin_out)`。
6. emit `BonusClaimed(activity_id, user_addr, bonus_per_user)`。

> 員工每場活動只能領一次參加獎；主辦每場活動只能建立一次 `BonusEvent`。

---

### 6.3 單次抽獎（Prize Draw）

#### 6.3.1 `draw_prize(organizer, activity_id, amount: u64, client_seed: u64)`

**邏輯：**

1. 檢查：
   - caller 是 organizer
   - `activity.prize_pool_coin` 中 IOTA ≥ `amount`
   - `activity.participant_count > 0`
   - `activity.eligible_flags` 中至少有一個 `true`（表示尚有可被抽中的參加者）

2. 隨機流程（以 Activity 自己的 participants / eligible_flags 為基礎）：
   - 使用 IOTA 提供的亂數模組：
     - entry function 接收 `rand: &iota::random::Random`
     - `let mut gen = random::new_generator(rand, ctx);`
     - `let n = activity.participants.length`
     - `let start = random::generate_u64_in_range(&mut gen, 0, n - 1);`
   - 從 `start` 開始，做一次線性掃描（可環狀模  n），找到第一個 `eligible_flags[i] == true` 的 index：
     - 若找到 index = `winner_index`：
       - `winner_addr = activity.participants[winner_index]`
     - 若整圈掃完都沒有 `true`：
       - abort `E_NO_ELIGIBLE_FOR_DRAW`

3. 更新狀態：
   - 將 `activity.eligible_flags[winner_index] = false`，表示該地址在後續抽獎中不得再被抽中。

4. 發獎金：
   - 從 `activity.prize_pool_coin` 中 `split amount` → `coin_out`
   - `deposit_iota(winner_addr, coin_out)`

5. 事件：
   - emit `PrizeDrawExecuted(activity_id, winner_addr, amount)`


> 單場活動中，可以執行多次 `draw_prize`，但每次會將 winner 的 `eligible_for_draw` 設為 false，避免重複中獎。

---

### 6.4 樂透（Lottery）

#### 6.4.1 `create_lottery(organizer, activity_id)`

**邏輯：**

1. 檢查：

   * caller 是 organizer
   * `activity.lottery_id == None` 或舊的 Lottery 已非 `OPEN`
2. 建立 `Lottery` object：

   * `status = OPEN`
   * `pot_coin` 初始為 0（可用 `zero_coin` 構造）
   * `participants = []`
3. `activity.lottery_id = Some(lottery_id)`。
4. emit `LotteryCreated(activity_id, lottery_id)`。

#### 6.4.2 `join_lottery(user, activity_id, amount: u64)`

**邏輯：**

1. 檢查：

   * 有對應 Participant 且 `joined == true`
   * `activity.lottery_id` 存在且對應 Lottery.status == OPEN
   * 該 user 地址不在 `lottery.participants` 中（同一場只允許參與一次）
2. 從 user withdraw `amount` IOTA → `coin_in`。
3. `merge_iota(&mut lottery.pot_coin, coin_in)`。
4. `lottery.participants.push(user_addr)`。
5. emit `LotteryJoined(activity_id, lottery_id, user_addr, amount)`。

#### 6.4.3 `execute_lottery(organizer, activity_id, client_seed: u64)`

**邏輯：**

1. 檢查：

   * caller 是 organizer
   * `lottery.status == OPEN`
   * `lottery.participants.length > 0`
2. 隨機數：

   * 入口函式接收 `rand: &iota::random::Random`
   * 建立亂數產生器：`let mut gen = random::new_generator(rand, ctx);`
   * `idx = random::generate_u64_in_range(&mut gen, 0, participants.length - 1)`
3. `winner_addr = participants[idx]`。
4. 將 `lottery.pot_coin` **全部 transfer** 給 winner（或 `split` 全部，`pot_coin` 變為 0）。
5. `lottery.status = DRAWN`，`lottery.winner = Some(winner_addr)`。
6. emit `LotteryExecuted(activity_id, lottery_id, winner_addr, amount_total)`。

---

### 6.5 四選一遊戲（Game）

> 規則回顧：
>
> * 同一活動可建立多場 Game（A、B、C…）
> * 同一時間只能有一個 Game 為 `OPEN` 或 `ANSWER_REVEALED`
> * 新的 Game 建立時，前一場 Game 自動標記為 `CLOSED`（未 claim 視為放棄）
> * 員工每場只能選一次答案，但跨場可以多次選、多次中獎。

#### 6.5.1 `create_game(organizer, activity_id, question, options[4], reward_amount: u64, mode: GameRewardMode)`

**邏輯：**

1. 檢查：

   * caller 是 organizer
   * `activity.status != CLOSED`
   * 若 `activity.current_game_id` 存在：

     * 對應 Game 若為 `OPEN` 或 `ANSWER_REVEALED` → 將其狀態標記為 `CLOSED`，之後不允許 claim
2. 檢查 `activity.prize_pool_coin` 中 IOTA ≥ `reward_amount`。
3. 可以選擇：

   * A 案：直接保留 `reward_amount` 為一個數字，實際發放時再 split；
   * B 案：從 `prize_pool_coin` 中 `split` 出 `reward_amount` → 存成 `game.reward_coin`。
     **Spec 建議 A 案（簡化實作）：只存 u64，最後發獎時從 prize_pool_coin split。**
4. 建立 `Game` object：

   * `status = OPEN`
   * `question` / `options`
   * `reward_amount = reward_amount`
   * `reward_mode = mode`
   * `correct_option = None`
   * `total_correct = 0`
   * `winner_addr = None`
5. `activity.current_game_id = Some(game_id)`。
6. emit `GameCreated(activity_id, game_id, reward_amount, mode)`。

#### 6.5.2 `submit_choice(user, activity_id, game_id, choice: u8)`

**邏輯：**

1. 檢查：

   * 有 Participant（已 join）
   * Game.status == OPEN
   * choice ∈ {1,2,3,4}
   * 此 `(game_id, user)` 尚無 GameParticipation
2. 建立 `GameParticipation` object：

   * `owner = user_addr`
   * `choice = choice`
   * `is_correct = false`
   * `has_claimed_reward = false`

#### 6.5.3 `reveal_game_answer(organizer, activity_id, game_id, correct_option: u8, client_seed: u64)`

**邏輯：**

1. 檢查：

   * caller 是 organizer
   * `game.status == OPEN`
   * `correct_option` ∈ {1,2,3,4}
2. 遍歷該 Game 的所有 `GameParticipation`：

   * 若 `choice == correct_option`：

     * `is_correct = true`
     * `game.total_correct += 1`
3. 根據 `reward_mode`：

   * **AVERAGE**：

     * 若 `total_correct > 0`：

       * 每人獎金 = `per = reward_amount / total_correct`
       * 實際發放在 `claim_game_reward` 時 split
   * **SINGLE**：

     * 若 `total_correct > 0`：

       * 在「答對者集合」上做隨機抽一人（同樣 hash 機制 + index）
       * `game.winner_addr = Some(winner_addr)`。
4. `game.status = ANSWER_REVEALED`。
5. emit `GameAnswerRevealed(activity_id, game_id, correct_option)`。

> 未答對的不用 write flag；已答對但未 claim，下一場 Game 建立時 Game 會被標成 `CLOSED` → 視為放棄。

#### 6.5.4 `claim_game_reward(user, activity_id, game_id)`

**邏輯：**

1. 讀取 Game（必須 `status == ANSWER_REVEALED`）。
2. 讀取此 user 的 `GameParticipation`：

   * `is_correct == true`
   * `!has_claimed_reward`
3. 根據 `reward_mode`：

   * **AVERAGE**：

     * `amount = game.reward_amount / total_correct`
   * **SINGLE**：

     * 僅當 `game.winner_addr == user_addr` 時才可領，`amount = game.reward_amount`
4. 從 `activity.prize_pool_coin` 中 `split amount` → `coin_out`。
5. `deposit_iota(user_addr, coin_out)`。
6. `participation.has_claimed_reward = true`。
7. emit `GameRewardClaimed(activity_id, game_id, user_addr, amount)`。

> 當主辦建立下一場 Game 時，前一場 Game 設為 `CLOSED`，之後不允許再 claim → 前端 UI 需顯示「未在下一題開始前領取獎金將視為放棄」。

---

### 6.6 活動關閉與剩餘獎金

#### 6.6.1 `close_activity(organizer, activity_id)`

**邏輯：**

1. 檢查：

   * caller 是 organizer
   * `activity.status != CLOSED`
2. 計算：

   * `avg = total_iota_in_prize_pool / participant_count`（整數除法）
3. 寫入：

   * `activity.close_payout_amount = avg`
   * `activity.remaining_pool_after_close = total_iota_in_prize_pool`
   * `activity.status = CLOSED`
4. emit `ActivityClosed(activity_id, avg)`。

> 真正的 transfer 發生在 `claim_close_reward`。

#### 6.6.2 `claim_close_reward(user, activity_id)`

**邏輯：**

1. 讀 `Participant`：

   * `participant.joined == true`
   * `!participant.has_claimed_close_reward`
2. 讀 Activity：

   * `status == CLOSED`
   * `close_payout_amount > 0`
3. 從 `prize_pool_coin` split `close_payout_amount` → `coin_out`。
4. `participant.has_claimed_close_reward = true`。
5. `activity.remaining_pool_after_close -= close_payout_amount`。
6. `deposit_iota(user_addr, coin_out)`。
7. emit `CloseRewardClaimed(activity_id, user_addr, close_payout_amount)`。

#### 6.6.3 `withdraw_remaining_after_close(organizer, activity_id)`

**邏輯：**

1. 檢查：

   * caller 是 organizer
   * `activity.status == CLOSED`
2. 讀當前 `prize_pool_coin` 金額 `remaining`。
3. 若 `remaining > 0`：

   * `split` or `take` 整顆 coin → `coin_out`
   * `deposit_iota(organizer_addr, coin_out)`
   * `activity.remaining_pool_after_close = 0`
4. emit `RemainingPoolWithdrawn(activity_id, organizer_addr, remaining)`。

> 未 claim 的員工自動放棄權利，多餘金額回主辦，避免資產永久鎖死。

---

## 7. 隨機數規範（共用）

所有需要隨機選人的地方（抽獎、樂透、Game SINGLE 模式），都使用統一模式：

```text
// 使用 IOTA random 模組產生 [0, N-1] 的亂數索引
let mut gen = random::new_generator(rand, ctx);
let index = random::generate_u64_in_range(&mut gen, 0, N - 1);
```

> 實作層採用 IOTA framework 的 `iota::random` 模組與鏈上 randomness state，  
> 不再手動組合 `block_hash / tx_hash / caller / client_seed` 來雜湊出亂數。  
> `client_seed` 僅保留於介面中做調用相容性與除錯使用，實際亂數來源由鏈上隨機狀態決定。

---

## 8. 規則總整理

1. **Token：**

   * 所有金流皆使用 IOTA L2 原生代幣。
   * 合約不鑄造 / 銷毀，只做 transfer / split / merge。

2. **活動：**

   * 一個活動對應一個 Activity object（shared）。
   * 只能被 organizer 關閉。
   * 關閉後，不再允許開新樂透 / 遊戲 / bonus。

3. **報名與參加獎：**

   * 每位員工在每個活動只能 join 一次。
   * 參加獎事件每活動只能建立一次。
   * 每位員工在每活動只能 claim 一次參加獎。

4. **抽獎：**
   - 使用 `Activity.eligible_flags`（與 `participants` 對應的 bool 向量）來控制抽獎資格。
   - 每次 `draw_prize` 中獎的 index，其對應 `eligible_flags[index]` 會被設為 `false`，避免同一地址在多次抽獎中重複中獎。

5. **樂透：**

   * 同一時間每個活動只允許一個 `OPEN` 的 Lottery。
   * 同一地址在同一場 Lottery 中只能 join 一次。
   * Lottery 獎金池完全由參加者投入的 IOTA 組成，全部發給 winner。

6. **四選一遊戲：**

   * 每場活動可開多場 Game（A, B, C…），但同一時間只允許一個處於進行狀態（OPEN/ANSWER_REVEALED）。
   * 建立新 Game 時，前一場 Game 設為 `CLOSED`，之後不可 claim，視為放棄。
   * 每位員工在每場 Game 只能 submit 一次 choice。
   * 若員工在多場 Game 中選對，每場都可 claim。
   * reward 由活動獎金池支出。

7. **活動關閉：**

   * 關閉時，以剩餘獎金池平均分配給所有參加者（需自行 claim）。
   * 未 claim 的餘額可由 organizer 之後透過 `withdraw_remaining_after_close` 領回。
