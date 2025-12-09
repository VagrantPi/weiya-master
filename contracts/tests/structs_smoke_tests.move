module weiya_master::structs_smoke_tests {
    use weiya_master::annual_party;
    use iota::tx_context;

    #[test]
    fun structs_and_enums_compile() {
        // 建立測試用 TxContext，呼叫主模組內的 smoke 函式以在記憶體中組裝所有型別
        let mut ctx = tx_context::dummy();
        annual_party::structs_and_enums_smoke(&mut ctx);
    }
}
