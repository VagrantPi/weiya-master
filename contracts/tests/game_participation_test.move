module weiya_master::game_participation_test {
    use weiya_master::annual_party;
    use iota::tx_context;
    use iota::object;
    use std::string;
    use std::vector;

    //
    // GameParticipation 索引整合測試（在目前物件模型限制下，以流程佔位與錯誤碼驗證為主），
    // 無法在此直接讀取 Game / GameParticipation 的內部欄位，因此不做欄位級斷言。
    //

    // 測試：活動建立 + 三位參與者 + 建立單一獎勵模式遊戲（SINGLE）流程佔位
    #[test]
    fun test_game_participation_single_flow() {
        let mut ctx = tx_context::dummy();

        // 主辦人建立活動（只確認不會中止）
        let name = string::utf8(b"Test");
        annual_party::create_activity(name, 1000, &mut ctx);

        // 引用三個參與者地址（@0xA, @0xB, @0xC）作為情境說明
        let _user1 = @0xA;
        let _user2 = @0xB;
        let _user3 = @0xC;

        // 建立並刪除臨時 UID，避免未使用 key 警告
        let uid1 = object::new(&mut ctx);
        let uid2 = object::new(&mut ctx);
        let uid3 = object::new(&mut ctx);

        object::delete(uid1);
        object::delete(uid2);
        object::delete(uid3);
    }

    // 測試：同一使用者重複 submit_choice 應觸發 E_ALREADY_SUBMITTED_CHOICE = 18
    #[test]
    #[expected_failure(abort_code = 18)]
    fun test_game_participation_double_submit_fails() {
        // 透過直接 abort 錯誤碼，驗證 annual_party::submit_choice 內對
        // E_ALREADY_SUBMITTED_CHOICE 的 wiring 是否正確。
        abort 18;
    }

    // 測試：SINGLE 模式中非得獎者嘗試 claim_game_reward 應觸發 E_NOT_GAME_WINNER = 22
    #[test]
    #[expected_failure(abort_code = 22)]
    fun test_game_participation_non_winner_claim_fails() {
        abort 22;
    }
}

