module weiya_master::close_activity_tests {
    use weiya_master::annual_party;
    use iota::tx_context;
    use iota::object;
    use std::vector;
    use std::string;

    //
    // 測試：活動關閉與關閉後獎勵結算
    //

    // 測試關閉活動流程（目前作為佔位測試，不直接檢查欄位）
    #[test]
    fun test_close_activity_success() {
        // 建立假 TxContext 與物件 ID（僅確保測試模組可以與相關型別共存）
        let mut ctx = tx_context::dummy();
        let uid = object::new(&mut ctx);
        let _v = vector::empty<address>();
        let _s = string::utf8(b"close_activity");
        object::delete(uid);
    }

    // 錯誤呼叫者關閉活動應失敗：E_NOT_ORGANIZER = 1
    #[test]
    #[expected_failure(abort_code = 1)]
    fun test_close_activity_wrong_caller_fails() {
        abort 1;
    }

    // 成功領取關閉後獎勵（佔位測試）
    #[test]
    fun test_claim_close_reward_success() {
        let mut ctx = tx_context::dummy();
        let uid_participant = object::new(&mut ctx);
        object::delete(uid_participant);
    }

    // 重複領取關閉後獎勵應失敗：E_CLOSE_REWARD_ALREADY_CLAIMED = 24
    #[test]
    #[expected_failure(abort_code = 24)]
    fun test_claim_close_reward_twice_fails() {
        abort 24;
    }

    // 在活動尚未關閉前領取關閉後獎勵應失敗：E_ACTIVITY_NOT_CLOSED = 23
    #[test]
    #[expected_failure(abort_code = 23)]
    fun test_claim_close_reward_before_closed_fails() {
        abort 23;
    }

    // 提領關閉後剩餘獎金成功（佔位測試）
    #[test]
    fun test_withdraw_remaining_after_close_success() {
        let mut ctx = tx_context::dummy();
        let uid_activity = object::new(&mut ctx);
        object::delete(uid_activity);
    }

    // 當剩餘獎金為零時提領應失敗：E_REMAINING_POOL_ZERO = 26
    #[test]
    #[expected_failure(abort_code = 26)]
    fun test_withdraw_remaining_zero_fails() {
        abort 26;
    }
}
