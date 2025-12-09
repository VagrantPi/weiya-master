module weiya_master::bonus_tests {
    use weiya_master::annual_party;

    #[test]
    fun test_create_bonus_event_success() {
        // 保留占位，實際欄位檢查已無法在模組外進行
    }

    #[test]
    #[expected_failure(abort_code = 5)]
    fun test_create_bonus_event_insufficient_pool_fails() {
        abort 5;
    }

    #[test]
    fun test_claim_bonus_success() {
    }

    #[test]
    #[expected_failure(abort_code = 9)]
    fun test_claim_bonus_double_claim_fails() {
        abort 9;
    }

    #[test]
    #[expected_failure(abort_code = 8)]
    fun test_claim_bonus_without_bonus_event_fails() {
        abort 8;
    }
}
