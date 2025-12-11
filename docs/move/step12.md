請根據上面模組撰寫「Edge cases 測試」，重點是 failure path & 邊界條件。
請建立一個新的測試模組，例如：

module weiya_master::annual_party_edge_tests {
    use std::string;
    use iota::tx_context;
    use iota::random;
    use weiya_master::annual_party;

    /* 測試內容放這裡 */
}

基本原則：
- 每個 entry fun 至少要有 1 個成功測試 + 若干個失敗測試。
- 失敗測試請用 `#[expected_failure(abort_code = ...)]` 明確檢查 abort code。
- 測試裡可以寫小的 helper 函式，例如：
  - 建立 organizer context + activity
  - 幫 activity 加入多位 participants
  - 幫 activity 預先建立 bonus / lottery / game 等等
- 使用固定的測試帳號，例如 @0x1 作為 organizer，@0x2/@0x3/@0x4 當 participants。
- `Random` / `TxContext` 請沿用專案裡既有測試的慣用建立方式（若不存在，請自己實作合乎 IOTA SVM 測試慣例的 helper）。

請具體實作以下類型的 edge case 測試案例（每一項都寫成獨立 #[test]）：

1. Activity / join / add prize fund
   - `create_activity` 正常建立（包含 initial_amount = 0 的情況）。
   - 非 organizer 無法呼叫 `add_prize_fund`（期望 E_NOT_ORGANIZER）。
   - `join_activity` 成功加入第一位 participant。
   - 同一地址第二次 `join_activity` 必須失敗（E_ALREADY_JOINED_ACTIVITY）。
   - 活動關閉後呼叫 `join_activity` 必須失敗（先 close_activity，再 join，期望 E_ACTIVITY_CLOSED）。

2. Bonus（create_bonus_event / claim_bonus）
   - 還沒有任何 participant 時呼叫 `create_bonus_event` 必須失敗（E_NO_PARTICIPANTS）。
   - 獎金池不足以支付 `bonus_per_user * participant_count` 時必須失敗（E_INSUFFICIENT_PRIZE_POOL）。
   - 非 organizer 呼叫 `create_bonus_event` 必須失敗（E_NOT_ORGANIZER）。
   - 已經建立過一次 `create_bonus_event` 後第二次呼叫必須失敗（E_BONUS_ALREADY_CREATED）。
   - 成功建立 bonus 後，某個 participant 成功 `claim_bonus`，檢查：
     - participant.has_claimed_bonus 被設為 true
     - 活動獎金池有正確扣除 amount。
   - 同一 participant 第二次 `claim_bonus` 必須失敗（E_BONUS_ALREADY_CLAIMED）。
   - 尚未建立 bonus 就呼叫 `claim_bonus` 必須失敗（E_BONUS_NOT_AVAILABLE）。
   - 非該 Participant owner / 不屬於此 activity 的 participant 呼叫 `claim_bonus` 必須失敗（E_NO_PARTICIPANTS）。

3. Lottery（create_lottery / join_lottery / execute_lottery）
   - 非 organizer 呼叫 `create_lottery` 必須失敗（E_NOT_ORGANIZER）。
   - 活動已 CLOSED 時不能再 `create_lottery`（E_ACTIVITY_CLOSED）。
   - 已存在開啟中的 lottery_id 時再呼叫 `create_lottery` 必須失敗（E_LOTTERY_NOT_OPEN）。
   - `join_lottery` 時：
     - 未先 join_activity 的地址不得加入（E_NO_PARTICIPANTS）。
     - 同一地址第二次 join 相同 lottery 必須失敗（E_ALREADY_JOINED_LOTTERY）。
   - 修改測試讓 lottery.status != OPEN（例如手動改成 DRAWN），再呼叫 join_lottery 須失敗（E_LOTTERY_NOT_OPEN）。
   - `execute_lottery`：
     - 無 participants 時必須失敗（E_LOTTERY_NO_PARTICIPANTS）。
     - 非 organizer 執行必須失敗（E_NOT_ORGANIZER）。
     - 成功執行後：
       - pot_coin.value == 0
       - winner 有值
       - activity.lottery_id 被 reset 為 None（確保下一輪可再 create_lottery）。

4. Game（create_game / submit_choice / reveal_game_answer / claim_game_reward）
   - create_game：
     - 非 organizer 呼叫必須失敗（E_NOT_ORGANIZER）。
     - 活動已 CLOSED 時呼叫必須失敗（E_ACTIVITY_CLOSED）。
     - options 長度不是 4 必須失敗（E_INVALID_GAME_CHOICE）。
     - reward_amount > prize_pool_coin.value 必須失敗（E_INSUFFICIENT_PRIZE_POOL）。
     - 正常建立後，activity.current_game_id 為 Some(game_id)。

   - submit_choice：
     - 未加入活動的地址 submit_choice 必須失敗（E_NO_PARTICIPANTS）。
     - choice 不在 [1,4] 範圍必須失敗（E_INVALID_GAME_CHOICE）。
     - 同一使用者對同一 game 第二次 submit 必須失敗（E_ALREADY_SUBMITTED_CHOICE）。
     - game.status != OPEN（例如 ANSWER_REVEALED）時 submit 必須失敗（E_GAME_NOT_OPEN）。

   - reveal_game_answer（AVERAGE mode）：
     - 非 organizer 呼叫必須失敗（E_NOT_ORGANIZER）。
     - correct_option 不在 [1,4] 必須失敗（E_INVALID_GAME_CHOICE）。
     - 在一個有多位參與者的遊戲裡：
       - 有些人選對、有些人選錯，呼叫 reveal_game_answer 後：
         - game.total_correct 等於實際答對人數。
         - reward_mode = AVERAGE 時，winner_addr 應該為 None。

   - reveal_game_answer（SINGLE mode）：
     - 當沒有任何人答對時，呼叫 reveal_game_answer：
       - game.total_correct = 0
       - game.winner_addr = None
     - 當至少一人答對時：
       - game.total_correct > 0
       - game.winner_addr 為某一位答對者的地址（可在 correct_addrs 裡檢查）。

   - claim_game_reward（AVERAGE）：
     - 在 ANSWER_REVEALED 之前 claim 必須失敗（E_GAME_NOT_ANSWER_REVEALED）。
     - 使用錯誤 activity_id / 不屬於此 game 的 participation 必須失敗（E_GAME_NOT_FOUND 或 E_NOT_GAME_WINNER）。
     - 沒有在 Game.participation_ids 裡的 participation 必須失敗（E_GAME_NOT_FOUND）。
     - 答錯的人 claim 必須失敗（E_NOT_GAME_WINNER）。
     - 答對的人成功 claim：
       - 取得的金額為 reward_amount / total_correct。
       - activity.prize_pool_coin.value 正確扣減。
       - participation.has_claimed_reward 被設定為 true。
     - 同一 participation 第二次 claim 必須失敗（E_GAME_REWARD_ALREADY_CLAIMED）。
     - 手動把 activity.prize_pool_coin.value 改小到不足時，答對者 claim 必須失敗（E_INSUFFICIENT_PRIZE_POOL）。

   - claim_game_reward（SINGLE）：
     - 僅 winner_addr 可以成功 claim，其他答對的人 claim 必須失敗（E_NOT_GAME_WINNER）。
     - winner 第一次成功 claim 後：
       - game.status 被設為 CLOSED。
       - prize_pool_coin 正確扣減。
     - winner 第二次 claim 必須失敗（E_GAME_REWARD_ALREADY_CLAIMED 或 E_GAME_NOT_ANSWER_REVEALED，依實際路徑）。
     - 建立新 Game 後，舊 Game 即使曾 ANSWER_REVEALED，其 participation 在 claim_game_reward 時，必須因為 activity.current_game_id 指向新遊戲而失敗（E_GAME_NOT_ANSWER_REVEALED）。

5. close_activity / claim_close_reward / withdraw_remaining_after_close
   - close_activity：
     - 非 organizer 呼叫必須失敗（E_NOT_ORGANIZER）。
     - 已經 CLOSED 再呼叫一次必須失敗（E_ACTIVITY_CLOSED）。
     - 有多位 participants 時：
       - close_payout_amount = total / participant_count（整數除法）。
       - remaining_pool_after_close = total。
     - 沒有任何 participant 時：
       - close_payout_amount = 0。
       - remaining_pool_after_close = total。
       - 之後只能由 organizer withdraw_remaining_after_close，任何 participant claim_close_reward 都應失敗（E_CLOSE_PAYOUT_ZERO）。

   - claim_close_reward：
     - 活動未 CLOSED 時必須失敗（E_ACTIVITY_NOT_CLOSED）。
     - close_payout_amount == 0 時必須失敗（E_CLOSE_PAYOUT_ZERO）。
     - 錯誤 activity_id / owner != caller / !joined 均應失敗（E_NO_PARTICIPANTS）。
     - 正常情況下：
       - 每個 participant 可成功 claim 一次。
       - 第二次 claim 必須失敗（E_CLOSE_REWARD_ALREADY_CLAIMED）。
       - 每次 claim 後：
         - activity.prize_pool_coin.value 減少 close_payout_amount。
         - activity.remaining_pool_after_close 也同步扣減。

   - withdraw_remaining_after_close：
     - 非 organizer 呼叫必須失敗（E_NOT_ORGANIZER）。
     - 活動未 CLOSED 時必須失敗（E_ACTIVITY_NOT_CLOSED）。
     - remaining_pool 為 0 時必須失敗（E_REMAINING_POOL_ZERO）。
     - 正常情況：
       - organizer 成功 withdraw 後，prize_pool_coin.value = 0，remaining_pool_after_close = 0。
       - 第二次 withdraw 必須失敗（E_REMAINING_POOL_ZERO）。

6. draw_prize
   - 非 organizer 呼叫 draw_prize 必須失敗（E_NOT_ORGANIZER）。
   - 當獎金池餘額 < amount 時必須失敗（E_INSUFFICIENT_PRIZE_POOL）。
   - 沒有任何 participant 時必須失敗（E_NO_ELIGIBLE_FOR_DRAW）。
   - 有 participants 但全部 eligible_flags = false 時必須失敗（E_NO_ELIGIBLE_FOR_DRAW）。
   - 正常情況：
     - 多位 participants & eligible_flags 全為 true 時：
       - 成功抽獎後，中獎者的 eligible_flags[index] 被設為 false。
       - prize_pool_coin.value 正確扣減 amount。
     - 重複呼叫 draw_prize，直到所有人都被抽過一次，再呼叫必須因為沒有 eligible 而失敗（E_NO_ELIGIBLE_FOR_DRAW）。

請實際寫出上述所有測試案例的完整 Move 測試程式碼，包含：
- 測試模組宣告
- 測試 helper 函式（建立 activity、加入 participants、建立 game/lottery 等）
- 每一個 #[test] / #[expected_failure] 函式具體呼叫對應 entry fun，並用 assert! 驗證 state（例如 coin 值、flag、status、option 是否為 Some/None）。
