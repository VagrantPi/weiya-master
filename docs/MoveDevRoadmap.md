很好，這題目已經大了，我先幫你「拆工」拆得非常明確，你只要照 Step 一步一步做、每一步都搭配 `iota move test`，就能把整份合約穩穩建完。

下面這份是 **「整體開發 Roadmap」＋「每個階段要實作的功能＋測試」**
這一輪**先不寫任何實作 code**，只對齊拆解方式，你覺得 OK 我們再從 Step 1 開始用 Codex 帶你實作。

---

## 🧱 前提假設（跟你目前環境對齊）

* 專案是用：`iota move new contracts` 建出來的
  → 結構大概是：

  ```txt
  contracts/
    Move.toml
    sources/
      annual_party.move  ← 你要主力寫這支
    tests/
      ...                ← 每個 step 我會指定要新增哪些 test 檔
  ```

* 測試指令：

  * 全部跑： `iota move test`
  * 之後也可以用 `iota move test -f <filter>` 跑單檔 / 單測試（看 IOTA CLI 支援程度）

* 規格版本：**SPEC（原生 IOTA coin）**

---

## 🔁 整體階段拆解總覽

我會分成 **8 大 Step**，每一 Step 底下再拆「小功能 + 對應測試」，每個 Step 完成後都跑一次 `iota move test`，確保不堆積技術債：

1. **Step 0 – 基礎骨架 & 型別宣告**
2. **Step 1 – Activity 基本生命週期（create / join / 加碼）+ 測試**
3. **Step 2 – 參加獎 Bonus（建立 + 領取）+ 測試**
4. **Step 3 – 單次抽獎 draw_prize + 測試**
5. **Step 4 – Lottery（建立 / 參與 / 開獎）+ 測試**
6. **Step 5 – 四選一遊戲 Game（建立 / 作答 / 公布答案 / 領獎）+ 測試**
7. **Step 6 – 活動關閉 & 收尾（close / claim / withdraw）+ 測試**
8. **Step 7 – 雜項、錯誤碼整理、邊界條件補測**

下面詳細拆解。

---

## 🪜 Step 0：基礎骨架 & 型別宣告（無邏輯）

**目標：**

* 把整個 module 的基本「外型」建好：

  * enums
  * structs
  * events
  * error code 常數
* 先不寫任何 entry function 邏輯（只宣告）

### 0-1：annual_party.move 基礎架構

在 `sources/annual_party.move` 完成：

* `module <addr>::annual_party { ... }`
* `use` 需要的 std / iota module（先保守，之後 Codex 會補）
* 宣告：

  * `ActivityStatus / LotteryStatus / GameStatus / GameRewardMode`
  * `Activity / Participant / Lottery / Game / GameParticipation`（按照 SPEC）
  * event structs（同 SPEC）

### 0-2：錯誤碼定義

在 module 裡建立一個錯誤碼區域：

* e.g.：

  ```move
  const E_NOT_ORGANIZER: u64 = 1;
  const E_ACTIVITY_CLOSED: u64 = 2;
  const E_ALREADY_JOINED: u64 = 3;
  const E_INSUFFICIENT_PRIZE_POOL: u64 = 4;
  ...
  ```

> 先列出會用到的錯誤碼，之後每一步直接沿用。

### 0-3：測試

可以先寫一個超小的「型別 smoke test」在 `tests/structs_smoke_tests.move`：

* 測試檔只做一件事：

  * 建立一個假的 `Activity` / `Participant`／`Lottery`／`Game`／`GameParticipation`（不用 publish），確保型別都編得過。

指令：

```bash
cd contracts
iota move test
```

---

## 🪜 Step 1：Activity 基本生命週期 + 測試

**這一步只做 Activity 相關的：**

* `create_activity`
* `join_activity`
* `add_prize_fund`

### 1-1：實作功能

在 `annual_party.move` 實作：

1. `public entry fun create_activity(organizer: &signer, name: String, initial_amount: u64)`

   * withdraw organizer 的 IOTA → `prize_pool_coin`
   * new `Activity`，status = OPEN
   * participants = []
   * 透過 IOTA 的 shared object API 發布（Codex 會幫你寫）

2. `public entry fun join_activity(user: &signer, activity_id: ID)`

   * 讀 Activity（shared）
   * 檢查 status == OPEN
   * 檢查尚未 join（沒有 Participant object / 沒在 participants vector 中）
   * 建立 Participant object（owner = user）
   * `activity.participant_count += 1`
   * 同步在 `activity.eligible_flags` push true（代表該地址目前可參與抽獎）。
   * `participants.push(user_addr)`
   * emit `ParticipantJoined`

3. `public entry fun add_prize_fund(organizer: &signer, activity_id: ID, amount: u64)`

   * 檢查 caller 是 organizer
   * withdraw caller 的 IOTA → `coin`
   * merge 到 `activity.prize_pool_coin`
   * emit `PrizePoolIncreased`

> 🎯 這一步不碰 Bonus / Lottery / Game，只玩 Activity & Participant。

### 1-2：測試

新檔案：`tests/activity_tests.move`

測試案例：

1. `test_create_activity_success`

   * 使用 @0x1 當 organizer
   * 呼叫 `create_activity`，initial_amount = 1000
   * 讀出 Activity：

     * organizer address 正確
     * name 正確
     * status == OPEN
     * prize_pool_coin 內金額 == 1000
     * participant_count == 0
2. `test_join_activity_success`

   * 同活動，使用 @0x2 當員工
   * 呼叫 `join_activity`
   * 驗證：

     * participant_count == 1
     * participants vector 長度 == 1，且內容為 @0x2
     * 有對應的 Participant object，`joined == true`
3. `test_join_activity_double_join_fails`

   * @0x2 連續兩次 join，第二次應該 abort（用錯誤碼檢查）
4. `test_add_prize_fund_success`

   * 建立活動 initial_amount = 1000
   * @0x1 再 `add_prize_fund(..., 500)`
   * 驗證 prize_pool == 1500
5. `test_add_prize_fund_wrong_caller_fails`

   * 非 organizer 呼叫 `add_prize_fund`，應 abort with E_NOT_ORGANIZER

每次修改完：

```bash
iota move test
```

---

## 🪜 Step 2：參加獎 Bonus（建立 + 領取）+ 測試

### 2-1：實作功能

在 `annual_party.move` 新增：

1. `public entry fun create_bonus_event(organizer, activity_id, bonus_per_user: u64)`

   * 檢查 caller 是 organizer
   * 檢查 `!activity.has_bonus_event`
   * 檢查 `participant_count > 0`
   * 計算 `required = bonus_per_user * participant_count`
   * 確保 `prize_pool_coin` 餘額 ≥ required
   * 設：

     * `has_bonus_event = true`
     * `bonus_amount_per_user = bonus_per_user`
   * **不先扣錢**（扣款在 claim 時）
   * emit `BonusEventCreated`

2. `public entry fun claim_bonus(user, activity_id)`

   * 找此 user 的 Participant
   * 檢查：

     * `joined == true`
     * `!has_claimed_bonus`
     * `activity.has_bonus_event == true`
   * 從 `prize_pool_coin` split 出 `bonus_amount_per_user` → `coin_out`
   * `participant.has_claimed_bonus = true`
   * deposit 給 user
   * emit `BonusClaimed`

### 2-2：測試

新檔：`tests/bonus_tests.move`

測試：

1. `test_create_bonus_event_success`

   * 建立活動 + 3 位員工 join
   * prize_pool 足夠
   * 呼叫 `create_bonus_event(activity, 10)`
   * 驗證：

     * `has_bonus_event == true`
     * `bonus_amount_per_user == 10`

2. `test_create_bonus_event_insufficient_pool_fails`

   * 例如 prize_pool = 10，participants = 3，bonus_per_user = 5 → required=15
   * 應 abort with E_INSUFFICIENT_PRIZE_POOL

3. `test_claim_bonus_success`

   * 建立活動 + 2 位員工 + bonus_event
   * 員工 A 呼叫 `claim_bonus`
   * 驗證：

     * A 的 `has_claimed_bonus == true`
     * 活動 prize_pool 被減掉 1 個 bonus
     * A 的 IOTA balance 增加（視測試框架可見程度）

4. `test_claim_bonus_double_claim_fails`

   * A 重複 claim 第二次 abort（用錯誤碼）

5. `test_claim_bonus_without_bonus_event_fails`

   * 沒有呼叫 `create_bonus_event` 就 claim → abort

---

## 🪜 Step 3：單次抽獎 draw_prize + 測試

### 3-1：實作功能

`public entry fun draw_prize(organizer, activity_id, amount: u64, client_seed: u64)`

邏輯：

* 檢查：

  * caller 是 organizer
  * prize_pool_coin ≥ amount
  * 至少有一位 participant 的 `eligible_for_draw == true`
* random：

  * 用 `hash(block_hash || tx_hash || caller || client_seed)` 產生 u64
  * 對 `activity.participants.length` 取 mod → index
  * 找到 `winner_addr`
  * 找對應 Participant，若 `eligible_for_draw == false`：

    * 可以簡單 linear 掃下一個 index（模擬 re-roll，workshop ok）
* 標記：

  * `participant.eligible_for_draw = false`
* 資金：

  * 從 `prize_pool_coin` split amount → `coin_out`
  * deposit 給 winner
* emit `PrizeDrawExecuted`

### 3-2：測試

檔：`tests/draw_tests.move`

1. `test_draw_prize_success`

   * 3 位員工加入活動，皆 `eligible_for_draw == true`
   * prize_pool 足夠，random seed 固定
   * 呼叫 `draw_prize(..., amount=100, client_seed=1)`
   * 驗證：

     * 有一位 Participant 的 `eligible_for_draw == false`
     * prize_pool 減少 100
     * 那位 winner 的餘額增加

2. `test_draw_prize_not_enough_pool_fails`

   * amount > prize_pool → abort

3. `test_draw_prize_no_eligible_participant_fails`

   * 所有 participant `eligible_for_draw == false` → abort

---

## 🪜 Step 4：Lottery（建立 / 參與 / 開獎）+ 測試

這一段比較有關聯性，適合合併在同一步完成。

### 4-1：實作功能

1. `public entry fun create_lottery(organizer, activity_id)`

   * 檢查 caller 是 organizer
   * 檢查 `activity.lottery_id` 為 None 或對應 Lottery.status != OPEN
   * 建立 `Lottery` object：

     * `status = OPEN`
     * `pot_coin` 為 0 coin
     * `participants = []`
   * `activity.lottery_id = Some(lottery_id)`
   * emit `LotteryCreated`

2. `public entry fun join_lottery(user, activity_id, amount: u64)`

   * 確定 user 已 join Activity
   * 取得當前 Lottery（activity.lottery_id）
   * 檢查 `status == OPEN`
   * 確保 user_addr 不在 lottery.participants 中
   * withdraw user 的 IOTA → coin_in
   * merge 到 `lottery.pot_coin`
   * push user_addr 至 participants
   * emit `LotteryJoined`

3. `public entry fun execute_lottery(organizer, activity_id, client_seed: u64)`

   * 檢查 caller == organizer
   * lottery.status == OPEN
   * participants.length > 0
   * random index 選 winner_addr
   * 將整顆 `lottery.pot_coin` 給 winner（split all & deposit）
   * `lottery.status = DRAWN`
   * `lottery.winner = Some(winner_addr)`
   * emit `LotteryExecuted`

### 4-2：測試

檔：`tests/lottery_tests.move`

1. `test_create_lottery_success`
2. `test_join_lottery_success`
3. `test_join_lottery_twice_fails`
4. `test_execute_lottery_success`
5. `test_execute_lottery_no_participant_fails`

---

## 🪜 Step 5：四選一遊戲 Game + 測試

分成四個 entry：

* `create_game`
* `submit_choice`
* `reveal_game_answer`
* `claim_game_reward`

### 5-1：實作功能

1. `create_game(organizer, activity_id, question, options[4], reward_amount, mode)`

   * 若 `activity.current_game_id` 有值：

     * 將舊 Game 設為 `CLOSED`
   * 檢查 `prize_pool_coin` ≥ `reward_amount`
   * 建 Game：

     * status = OPEN
     * 設 question / options / reward_amount / reward_mode
   * `activity.current_game_id = Some(game_id)`
   * emit `GameCreated`

2. `submit_choice(user, activity_id, game_id, choice)`

   * 檢查 Game.status == OPEN
   * choice 在 1..=4
   * user 已 join 活動
   * 尚未有同一 `(game_id, user)` 的 participation
   * 建 `GameParticipation`（is_correct=false）

3. `reveal_game_answer(organizer, activity_id, game_id, correct_option, client_seed)`

   * caller 是 organizer
   * game.status == OPEN
   * correct_option 1..=4
   * 遍歷該 game 的 participations，標記 `is_correct=true` + `total_correct++`
   * 若 `reward_mode == SINGLE`：

     * 在答對者集合中 random 抽一人 → `winner_addr`
   * game.status = ANSWER_REVEALED
   * emit `GameAnswerRevealed`

4. `claim_game_reward(user, activity_id, game_id)`

   * game.status == ANSWER_REVEALED
   * 找 participation：

     * `is_correct == true`
     * `!has_claimed_reward`
   * 若 `reward_mode == AVERAGE`：

     * amount = `reward_amount / total_correct`
   * 若 `SINGLE`：

     * 只有 `game.winner_addr == user` 才能領；amount = reward_amount
   * 從 `activity.prize_pool_coin` split amount → deposit 給 user
   * `participation.has_claimed_reward = true`
   * emit `GameRewardClaimed`

### 5-2：測試

檔：`tests/game_tests.move`

測試至少包含：

1. `test_create_game_replaces_previous`
2. `test_submit_choice_once_success`
3. `test_submit_choice_twice_fails`
4. `test_reveal_game_answer_average_mode`
5. `test_reveal_game_answer_single_mode`
6. `test_claim_game_reward_average_success`
7. `test_claim_game_reward_single_success`
8. `test_claim_game_reward_double_claim_fails`
9. `test_claim_game_reward_wrong_answer_fails`

---

## 🪜 Step 6：活動關閉 + 收尾 + 測試

### 6-1：實作功能

1. `close_activity(organizer, activity_id)`

   * caller == organizer
   * status != CLOSED
   * `avg = total_pool / participant_count`
   * `activity.close_payout_amount = avg`
   * `activity.remaining_pool_after_close = total_pool`
   * `activity.status = CLOSED`
   * emit `ActivityClosed`

2. `claim_close_reward(user, activity_id)`

   * 讀 Participant：

     * `joined == true`
     * `!has_claimed_close_reward`
   * 活動 status == CLOSED
   * `amount = close_payout_amount`（若為 0 可直接 abort）
   * 從 prize_pool split amount → deposit 給 user
   * `participant.has_claimed_close_reward = true`
   * `activity.remaining_pool_after_close -= amount`
   * emit `CloseRewardClaimed`

3. `withdraw_remaining_after_close(organizer, activity_id)`

   * caller == organizer
   * status == CLOSED
   * 若 prize_pool 剩餘金額 > 0：

     * 抽出全部 → deposit 給 organizer
     * `remaining_pool_after_close = 0`
   * emit `RemainingPoolWithdrawn`

### 6-2：測試

檔：`tests/close_tests.move`

1. `test_close_activity_success`
2. `test_claim_close_reward_success`
3. `test_claim_close_reward_double_fails`
4. `test_withdraw_remaining_after_close_success`
5. `test_withdraw_remaining_before_close_fails`

---

## 🪜 Step 7：邊界條件、錯誤碼驗證、Refactor

最後一階段是清尾巴：

* 檢查所有 `abort` 的路徑是否都有對應錯誤碼。
* 對容易踩雷的情境補測試，例如：

  * 在 CLOSED 活動上呼叫抽獎 / 設 Game / 開 Lottery → 都要 abort。
  * 未 join 的員工試圖參與任何遊戲 / 樂透 / 領獎 → abort。
  * 重複使用 `client_seed` 不會壞掉（只是 random 可重現）。

可以集中一個檔：`tests/edge_cases_tests.move`。

---

## ✅ 總結

我幫你拆成了：

* 8 大 Step，從 **型別 → Activity → Bonus → 抽獎 → Lottery → Game → Close → Edge cases**
* 每個 Step 都明確指定要改：

  * **哪一個 entry function**
  * **哪一個 tests 檔**
  * **至少哪些測試案例**
