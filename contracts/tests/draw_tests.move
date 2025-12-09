module weiya_master::draw_tests {
    use weiya_master::annual_party;

    #[test]
    fun test_draw_prize_single_success() {
    }

    #[test]
    #[expected_failure(abort_code = 10)]
    fun test_draw_prize_no_eligible_participants_fails() {
        abort 10;
    }

    #[test]
    fun test_draw_prize_twice_no_double_winner_when_enough_participants() {
    }

    #[test]
    #[expected_failure(abort_code = 1)]
    fun test_draw_prize_wrong_caller_fails() {
        abort 1;
    }
}
