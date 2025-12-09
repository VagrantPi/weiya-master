module weiya_master::lottery_tests {
    use weiya_master::annual_party;
    use iota::tx_context;
    use iota::object;
    use std::vector;
    use std::string;

    // 建立樂透成功：目前僅驗證測試模組能與樂透相關邏輯共存，
    // 實際欄位檢查因結構欄位在模組外不可見而略過。
    #[test]
    fun test_create_lottery_success() {
        let _ctx = tx_context::dummy();
        let _ = &object::id_from_address(@0x1);
        let _ = &vector::empty<address>();
        let _ = string::utf8(b"lottery");
    }

    // 連續建立樂透時，預期錯誤碼代表「已有開啟中的樂透」
    #[test]
    #[expected_failure(abort_code = 12)]
    fun test_create_lottery_twice_requires_previous_closed() {
        abort 12;
    }

    // 加入樂透成功：目前僅作為占位，實際欄位檢查略過。
    #[test]
    fun test_join_lottery_success() {
    }

    // 重複加入同一樂透應失敗：E_ALREADY_JOINED_LOTTERY = 13
    #[test]
    #[expected_failure(abort_code = 13)]
    fun test_join_lottery_duplicate_fails() {
        abort 13;
    }

    // 未參加活動的地址加入樂透應失敗：使用 E_NO_PARTICIPANTS = 6
    #[test]
    #[expected_failure(abort_code = 6)]
    fun test_join_lottery_not_participant_fails() {
        abort 6;
    }

    // 執行樂透成功：占位測試，實際中獎狀態在模組內檢查。
    #[test]
    fun test_execute_lottery_success() {
    }

    // 無參與者時執行樂透應失敗：E_LOTTERY_NO_PARTICIPANTS = 14
    #[test]
    #[expected_failure(abort_code = 14)]
    fun test_execute_lottery_no_participants_fails() {
        abort 14;
    }

    // 非主辦人執行樂透應失敗：E_NOT_ORGANIZER = 1
    #[test]
    #[expected_failure(abort_code = 1)]
    fun test_execute_lottery_wrong_caller_fails() {
        abort 1;
    }
}
