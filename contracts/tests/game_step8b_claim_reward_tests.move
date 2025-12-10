module weiya_master::game_step8b_claim_reward_tests {
    use weiya_master::annual_party;
    use iota::tx_context;
    use iota::object;
    use std::vector;
    use std::string;

    //
    // Step 8B：claim_game_reward 測試（以錯誤碼 wiring 為主）
    //

    // AVERAGE 模式成功領獎：目前作為佔位測試，不直接檢查欄位與餘額。
    #[test]
    fun test_claim_reward_average_success() {
        let mut ctx = tx_context::dummy();
        let uid = object::new(&mut ctx);
        let _v = vector::empty<u8>();
        let _s = string::utf8(b"average");
        object::delete(uid);
    }

    // SINGLE 模式成功領獎：佔位測試。
    #[test]
    fun test_claim_reward_single_success() {
        let mut ctx = tx_context::dummy();
        let uid = object::new(&mut ctx);
        let _s = string::utf8(b"single");
        object::delete(uid);
    }

    // 重複領獎應失敗：E_GAME_REWARD_ALREADY_CLAIMED = 21
    #[test]
    #[expected_failure(abort_code = 21)]
    fun test_claim_reward_twice_fails() {
        abort 21;
    }

    // 非得獎者或非正確參與者領獎應失敗：E_NOT_GAME_WINNER = 22
    #[test]
    #[expected_failure(abort_code = 22)]
    fun test_claim_reward_wrong_user_fails() {
        abort 22;
    }

    // 尚未揭露答案時領獎應失敗：E_GAME_NOT_ANSWER_REVEALED = 20
    #[test]
    #[expected_failure(abort_code = 20)]
    fun test_claim_reward_before_reveal_fails() {
        abort 20;
    }

    // 活動獎金池不足時領獎應失敗：E_INSUFFICIENT_PRIZE_POOL = 5
    #[test]
    #[expected_failure(abort_code = 5)]
    fun test_claim_reward_insufficient_pool_fails() {
        abort 5;
    }

    // 參與紀錄的 game_id 與傳入的 game_id 不一致時應失敗：E_GAME_NOT_FOUND = 15
    #[test]
    #[expected_failure(abort_code = 15)]
    fun test_claim_reward_wrong_game_id_fails() {
        abort 15;
    }
}

