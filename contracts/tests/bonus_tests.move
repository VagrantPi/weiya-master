module weiya_master::bonus_tests {
    use weiya_master::annual_party;

    #[test]
    fun test_create_bonus_event_success() {
        annual_party::test_create_bonus_event_success_inner();
    }

    #[test]
    #[expected_failure(abort_code = annual_party::E_INSUFFICIENT_PRIZE_POOL)]
    fun test_create_bonus_event_insufficient_pool_fails() {
        annual_party::test_create_bonus_event_insufficient_pool_fails_inner();
    }

    #[test]
    fun test_claim_bonus_success() {
        annual_party::test_claim_bonus_success_inner();
    }

    #[test]
    #[expected_failure(abort_code = annual_party::E_BONUS_ALREADY_CLAIMED)]
    fun test_claim_bonus_double_claim_fails() {
        annual_party::test_claim_bonus_double_claim_fails_inner();
    }

    #[test]
    #[expected_failure(abort_code = annual_party::E_BONUS_NOT_AVAILABLE)]
    fun test_claim_bonus_without_bonus_event_fails() {
        annual_party::test_claim_bonus_without_bonus_event_fails_inner();
    }
}

