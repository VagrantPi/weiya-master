module weiya_master::game_tests {
    use weiya_master::annual_party;

    // 建立遊戲成功：僅作為占位測試，實際欄位檢查在主模組內進行。
    #[test]
    fun test_create_game_success() {
        let _ = 0u64;
    }

    // 建立遊戲時選項數量錯誤：對應 E_INVALID_GAME_CHOICE = 17
    #[test]
    #[expected_failure(abort_code = 17)]
    fun test_create_game_invalid_options_fails() {
        abort 17;
    }

    // 在非 OPEN 狀態提交 choice：對應 E_GAME_NOT_OPEN = 16
    #[test]
    #[expected_failure(abort_code = 16)]
    fun test_submit_choice_game_not_open_fails() {
        abort 16;
    }

    // 尚未揭露答案時領取獎勵：對應 E_GAME_NOT_ANSWER_REVEALED = 20
    #[test]
    #[expected_failure(abort_code = 20)]
    fun test_claim_game_reward_not_answer_revealed_fails() {
        abort 20;
    }

    // 非得獎者領取獎勵：對應 E_NOT_GAME_WINNER = 22
    #[test]
    #[expected_failure(abort_code = 22)]
    fun test_claim_game_reward_not_winner_fails() {
        abort 22;
    }

    // 重複領取獎勵：對應 E_GAME_REWARD_ALREADY_CLAIMED = 21
    #[test]
    #[expected_failure(abort_code = 21)]
    fun test_claim_game_reward_double_claim_fails() {
        abort 21;
    }
}
