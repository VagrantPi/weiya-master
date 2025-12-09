module weiya_master::structs_smoke_tests {
    use weiya_master::annual_party;

    // 這個函式僅用來引用所有型別與 enum，確保它們在編譯期存在
    fun use_all_types(
        _a: annual_party::ActivityStatus,
        _b: annual_party::LotteryStatus,
        _c: annual_party::GameStatus,
        _d: annual_party::GameRewardMode,
        _act: &annual_party::Activity,
        _p: &annual_party::Participant,
        _l: &annual_party::Lottery,
        _g: &annual_party::Game,
        _gp: &annual_party::GameParticipation,
    ) {
    }

    #[test]
    fun structs_and_enums_compile() {
        // 這個測試不需要在執行期建立實例，僅需通過型別檢查
    }
}
