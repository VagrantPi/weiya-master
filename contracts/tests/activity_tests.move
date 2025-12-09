module weiya_master::activity_tests {
    use weiya_master::annual_party;

    #[test]
    fun test_create_activity_success() {
        annual_party::test_create_activity_success_inner();
    }

    #[test]
    fun test_join_activity_success() {
        annual_party::test_join_activity_success_inner();
    }

    #[test]
    #[expected_failure(abort_code = annual_party::E_ALREADY_JOINED_ACTIVITY)]
    fun test_join_activity_double_join_fails() {
        annual_party::test_join_activity_double_join_fails_inner();
    }

    #[test]
    fun test_add_prize_fund_success() {
        annual_party::test_add_prize_fund_success_inner();
    }

    #[test]
    #[expected_failure(abort_code = annual_party::E_NOT_ORGANIZER)]
    fun test_add_prize_fund_wrong_caller_fails() {
        annual_party::test_add_prize_fund_wrong_caller_fails_inner();
    }
}

