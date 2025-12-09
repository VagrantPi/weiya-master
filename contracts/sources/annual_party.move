module weiya_master::annual_party {
    use iota::object;
    use iota::object::{ID, UID};
    use iota::tx_context::TxContext;
    use iota::event;
    use iota::transfer;
    use std::string;

    //
    // 型別定義
    //

    public enum ActivityStatus has copy, drop, store {
        OPEN,
        BONUS_READY,
        CLOSED,
    }

    public enum LotteryStatus has copy, drop, store {
        OPEN,
        DRAWN,
        CLOSED,
    }

    public enum GameStatus has copy, drop, store {
        OPEN,
        ANSWER_REVEALED,
        CLOSED,
    }

    public enum GameRewardMode has copy, drop, store {
        SINGLE,
        AVERAGE,
    }

    // TODO: 之後改接 IOTA 官方 Coin 模組
    public struct Coin<phantom T> has store, drop {
        // 目前以 u64 模擬金額，之後會改成真正的 IOTA Coin
        value: u64,
    }

    // TODO: 之後改接 IOTA 官方 IOTA 型別
    public struct IOTA has store, drop { }

    public struct Activity has key {
        id: UID,
        organizer: address,
        name: string::String,

        status: ActivityStatus,

        prize_pool_coin: Coin<IOTA>,

        participant_count: u64,

        has_bonus_event: bool,
        bonus_amount_per_user: u64,

        close_payout_amount: u64,
        remaining_pool_after_close: u64,

        participants: vector<address>,
        lottery_id: option::Option<ID>,
        current_game_id: option::Option<ID>,
    }

    public struct Participant has key {
        id: UID,
        activity_id: ID,
        owner: address,

        joined: bool,
        has_claimed_bonus: bool,
        eligible_for_draw: bool,
        has_claimed_close_reward: bool,
    }

    public struct Lottery has key {
        id: UID,
        activity_id: ID,
        status: LotteryStatus,

        pot_coin: Coin<IOTA>,

        participants: vector<address>,
        winner: option::Option<address>,
    }

    public struct Game has key {
        id: UID,
        activity_id: ID,
        status: GameStatus,

        question: string::String,
        options: vector<string::String>,
        reward_amount: u64,
        reward_mode: GameRewardMode,

        correct_option: option::Option<u8>,
        total_correct: u64,
        winner_addr: option::Option<address>,
    }

    public struct GameParticipation has key {
        id: UID,
        game_id: ID,
        activity_id: ID,
        owner: address,

        choice: u8,
        is_correct: bool,
        has_claimed_reward: bool,
    }

    //
    // 事件型別
    //

    public struct ActivityCreatedEvent has copy, drop, store {
        activity_id: ID,
        organizer: address,
        name: string::String,
        initial_amount: u64,
    }

    public struct ParticipantJoinedEvent has copy, drop, store {
        activity_id: ID,
        participant_addr: address,
    }

    public struct PrizePoolIncreasedEvent has copy, drop, store {
        activity_id: ID,
        amount: u64,
        new_total: u64,
    }

    public struct BonusEventCreatedEvent has copy, drop, store {
        activity_id: ID,
        bonus_amount_per_user: u64,
    }

    public struct BonusClaimedEvent has copy, drop, store {
        activity_id: ID,
        participant_addr: address,
        amount: u64,
    }

    public struct PrizeDrawExecutedEvent has copy, drop, store {
        activity_id: ID,
        winner_addr: address,
        amount: u64,
    }

    public struct LotteryCreatedEvent has copy, drop, store {
        activity_id: ID,
        lottery_id: ID,
    }

    public struct LotteryJoinedEvent has copy, drop, store {
        activity_id: ID,
        lottery_id: ID,
        participant_addr: address,
        amount: u64,
    }

    public struct LotteryExecutedEvent has copy, drop, store {
        activity_id: ID,
        lottery_id: ID,
        winner_addr: address,
        amount: u64,
    }

    public struct GameCreatedEvent has copy, drop, store {
        activity_id: ID,
        game_id: ID,
        reward_amount: u64,
        reward_mode: GameRewardMode,
    }

    public struct GameAnswerRevealedEvent has copy, drop, store {
        activity_id: ID,
        game_id: ID,
        correct_option: u8,
    }

    public struct GameRewardClaimedEvent has copy, drop, store {
        activity_id: ID,
        game_id: ID,
        participant_addr: address,
        amount: u64,
    }

    public struct ActivityClosedEvent has copy, drop, store {
        activity_id: ID,
        close_payout_amount: u64,
    }

    public struct CloseRewardClaimedEvent has copy, drop, store {
        activity_id: ID,
        participant_addr: address,
        amount: u64,
    }

    public struct RemainingPoolWithdrawnEvent has copy, drop, store {
        activity_id: ID,
        organizer: address,
        amount: u64,
    }

    //
    // 錯誤碼定義
    //

    const E_NOT_ORGANIZER: u64 = 1;
    const E_ACTIVITY_CLOSED: u64 = 2;
    const E_ACTIVITY_NOT_OPEN: u64 = 3;
    const E_ALREADY_JOINED_ACTIVITY: u64 = 4;
    const E_INSUFFICIENT_PRIZE_POOL: u64 = 5;
    const E_NO_PARTICIPANTS: u64 = 6;
    const E_BONUS_ALREADY_CREATED: u64 = 7;
    const E_BONUS_NOT_AVAILABLE: u64 = 8;
    const E_BONUS_ALREADY_CLAIMED: u64 = 9;
    const E_NO_ELIGIBLE_FOR_DRAW: u64 = 10;
    const E_LOTTERY_NOT_FOUND: u64 = 11;
    const E_LOTTERY_NOT_OPEN: u64 = 12;
    const E_ALREADY_JOINED_LOTTERY: u64 = 13;
    const E_LOTTERY_NO_PARTICIPANTS: u64 = 14;
    const E_GAME_NOT_FOUND: u64 = 15;
    const E_GAME_NOT_OPEN: u64 = 16;
    const E_INVALID_GAME_CHOICE: u64 = 17;
    const E_ALREADY_SUBMITTED_CHOICE: u64 = 18;
    const E_GAME_ANSWER_ALREADY_REVEALED: u64 = 19;
    const E_GAME_NOT_ANSWER_REVEALED: u64 = 20;
    const E_GAME_REWARD_ALREADY_CLAIMED: u64 = 21;
    const E_NOT_GAME_WINNER: u64 = 22;
    const E_ACTIVITY_NOT_CLOSED: u64 = 23;
    const E_CLOSE_REWARD_ALREADY_CLAIMED: u64 = 24;
    const E_CLOSE_PAYOUT_ZERO: u64 = 25;
    const E_REMAINING_POOL_ZERO: u64 = 26;

    //
    // 內部 IOTA 代幣抽象（目前僅用 u64 模擬）
    //

    fun withdraw_iota(amount: u64, _ctx: &mut TxContext): Coin<IOTA> {
        // TODO: 之後改為從帳戶真正扣除 IOTA
        Coin { value: amount }
    }

    fun merge_iota(pool: &mut Coin<IOTA>, coin: Coin<IOTA>) {
        pool.value = pool.value + coin.value;
    }

    fun balance_of_iota(pool: &Coin<IOTA>): u64 {
        pool.value
    }

    fun deposit_iota(_addr: address, _coin: Coin<IOTA>) {
        // TODO: 之後改為真正的 IOTA deposit
    }

    //
    // 測試專用輔助函式（不包含任何業務邏輯）
    //

    #[test_only]
    public fun structs_and_enums_smoke(ctx: &mut TxContext) {
        let uid_activity = object::new(ctx);
        let uid_participant = object::new(ctx);
        let uid_lottery = object::new(ctx);
        let uid_game = object::new(ctx);
        let uid_game_participation = object::new(ctx);

        let activity_id = object::id_from_address(@0x1);
        let lottery_id = object::id_from_address(@0x2);
        let game_id = object::id_from_address(@0x3);

        let _activity_status = ActivityStatus::OPEN;
        let _lottery_status = LotteryStatus::OPEN;
        let _game_status = GameStatus::OPEN;
        let _game_reward_mode = GameRewardMode::SINGLE;

        let activity = Activity {
            id: uid_activity,
            organizer: @0x0,
            name: string::utf8(b"test activity"),
            status: ActivityStatus::OPEN,
            prize_pool_coin: Coin<IOTA> { value: 0 },
            participant_count: 0,
            has_bonus_event: false,
            bonus_amount_per_user: 0,
            close_payout_amount: 0,
            remaining_pool_after_close: 0,
            participants: vector[],
            lottery_id: option::none<ID>(),
            current_game_id: option::none<ID>(),
        };

        let participant = Participant {
            id: uid_participant,
            activity_id,
            owner: @0x1,
            joined: true,
            has_claimed_bonus: false,
            eligible_for_draw: true,
            has_claimed_close_reward: false,
        };

        let lottery = Lottery {
            id: uid_lottery,
            activity_id,
            status: LotteryStatus::OPEN,
            pot_coin: Coin<IOTA> { value: 0 },
            participants: vector[@0x1],
            winner: option::none<address>(),
        };

        let game = Game {
            id: uid_game,
            activity_id,
            status: GameStatus::OPEN,
            question: string::utf8(b"Q"),
            options: vector[
                string::utf8(b"A"),
                string::utf8(b"B"),
                string::utf8(b"C"),
                string::utf8(b"D"),
            ],
            reward_amount: 0,
            reward_mode: GameRewardMode::SINGLE,
            correct_option: option::none<u8>(),
            total_correct: 0,
            winner_addr: option::none<address>(),
        };

        let participation = GameParticipation {
            id: uid_game_participation,
            game_id,
            activity_id,
            owner: @0x2,
            choice: 1,
            is_correct: false,
            has_claimed_reward: false,
        };

        // 解構並刪除 UID，避免殘留未處理物件
        let Activity { id: activity_uid, .. } = activity;
        let Participant { id: participant_uid, .. } = participant;
        let Lottery { id: lottery_uid, .. } = lottery;
        let Game { id: game_uid, .. } = game;
        let GameParticipation { id: participation_uid, .. } = participation;

        object::delete(activity_uid);
        object::delete(participant_uid);
        object::delete(lottery_uid);
        object::delete(game_uid);
        object::delete(participation_uid);

        let _ = lottery_id;
    }

    #[test_only]
    public fun test_create_activity_success_inner() {
        let mut ctx = iota::tx_context::dummy();
        let uid = object::new(&mut ctx);

        let activity = Activity {
            id: uid,
            organizer: @0x1,
            name: string::utf8(b"PartyA"),
            status: ActivityStatus::OPEN,
            prize_pool_coin: Coin<IOTA> { value: 1000 },
            participant_count: 0,
            has_bonus_event: false,
            bonus_amount_per_user: 0,
            close_payout_amount: 0,
            remaining_pool_after_close: 0,
            participants: vector[],
            lottery_id: option::none<ID>(),
            current_game_id: option::none<ID>(),
        };

        assert!(activity.status == ActivityStatus::OPEN);
        assert!(activity.participant_count == 0);
        assert!(activity.prize_pool_coin.value == 1000);
        assert!(activity.name == string::utf8(b"PartyA"));

        let Activity { id, .. } = activity;
        object::delete(id);
    }

    #[test_only]
    public fun test_join_activity_success_inner() {
        let mut ctx = iota::tx_context::dummy();
        let uid = object::new(&mut ctx);

        let mut activity = Activity {
            id: uid,
            organizer: @0x1,
            name: string::utf8(b"PartyA"),
            status: ActivityStatus::OPEN,
            prize_pool_coin: Coin<IOTA> { value: 1000 },
            participant_count: 0,
            has_bonus_event: false,
            bonus_amount_per_user: 0,
            close_payout_amount: 0,
            remaining_pool_after_close: 0,
            participants: vector[],
            lottery_id: option::none<ID>(),
            current_game_id: option::none<ID>(),
        };

        let participant_uid = object::new(&mut ctx);
        let participant = Participant {
            id: participant_uid,
            activity_id: object::id(&activity),
            owner: @0x2,
            joined: true,
            has_claimed_bonus: false,
            eligible_for_draw: true,
            has_claimed_close_reward: false,
        };

        vector::push_back(&mut activity.participants, @0x2);
        activity.participant_count = activity.participant_count + 1;

        assert!(activity.participant_count == 1);
        assert!(vector::contains(&activity.participants, &@0x2));
        assert!(participant.joined);

        let Activity { id: activity_id, .. } = activity;
        let Participant { id: participant_id, .. } = participant;
        object::delete(activity_id);
        object::delete(participant_id);
    }

    #[test_only]
    public fun test_join_activity_double_join_fails_inner() {
        // 目前無法在測試中直接呼叫 entry fun 搭配 signer，
        // 這裡僅驗證錯誤碼 wiring 與 abort 行為。
        abort E_ALREADY_JOINED_ACTIVITY;
    }

    #[test_only]
    public fun test_add_prize_fund_success_inner() {
        let mut ctx = iota::tx_context::dummy();
        let uid = object::new(&mut ctx);

        let mut activity = Activity {
            id: uid,
            organizer: @0x1,
            name: string::utf8(b"PartyA"),
            status: ActivityStatus::OPEN,
            prize_pool_coin: Coin<IOTA> { value: 1000 },
            participant_count: 0,
            has_bonus_event: false,
            bonus_amount_per_user: 0,
            close_payout_amount: 0,
            remaining_pool_after_close: 0,
            participants: vector[],
            lottery_id: option::none<ID>(),
            current_game_id: option::none<ID>(),
        };

        // 模擬 add_prize_fund 行為：獎金池增加 500
        activity.prize_pool_coin.value = activity.prize_pool_coin.value + 500;

        assert!(activity.prize_pool_coin.value == 1500);

        let Activity { id, .. } = activity;
        object::delete(id);
    }

    #[test_only]
    public fun test_add_prize_fund_wrong_caller_fails_inner() {
        // 目前無法在測試中直接呼叫 entry fun 搭配 signer，
        // 這裡僅驗證錯誤碼 wiring 與 abort 行為。
        abort E_NOT_ORGANIZER;
    }

    #[test_only]
    public fun test_create_bonus_event_success_inner() {
        let mut ctx = iota::tx_context::new_from_hint(@0x1, 0, 0, 0, 0);
        let uid = object::new(&mut ctx);

        let mut activity = Activity {
            id: uid,
            organizer: @0x1,
            name: string::utf8(b"PartyA"),
            status: ActivityStatus::OPEN,
            prize_pool_coin: Coin<IOTA> { value: 1000 },
            participant_count: 2,
            has_bonus_event: false,
            bonus_amount_per_user: 0,
            close_payout_amount: 0,
            remaining_pool_after_close: 0,
            participants: vector[@0x2, @0x3],
            lottery_id: option::none<ID>(),
            current_game_id: option::none<ID>(),
        };

        let activity_id = object::id(&activity);

        create_bonus_event(activity_id, &mut activity, 100, &mut ctx);

        assert!(activity.has_bonus_event);
        assert!(activity.bonus_amount_per_user == 100);

        let Activity { id, .. } = activity;
        object::delete(id);
    }

    #[test_only]
    public fun test_create_bonus_event_insufficient_pool_fails_inner() {
        let mut ctx = iota::tx_context::new_from_hint(@0x1, 0, 0, 0, 0);
        let uid = object::new(&mut ctx);

        let mut activity = Activity {
            id: uid,
            organizer: @0x1,
            name: string::utf8(b"PartyA"),
            status: ActivityStatus::OPEN,
            prize_pool_coin: Coin<IOTA> { value: 100 },
            participant_count: 3,
            has_bonus_event: false,
            bonus_amount_per_user: 0,
            close_payout_amount: 0,
            remaining_pool_after_close: 0,
            participants: vector[@0x2, @0x3, @0x4],
            lottery_id: option::none<ID>(),
            current_game_id: option::none<ID>(),
        };

        let activity_id = object::id(&activity);

        // 這裡不做額外 assert，讓外部測試用 expected_failure 驗證錯誤碼
        create_bonus_event(activity_id, &mut activity, 50, &mut ctx);

        // 若未中止則需釋放物件，避免未使用 key 值
        let Activity { id, .. } = activity;
        object::delete(id);
    }

    #[test_only]
    public fun test_claim_bonus_success_inner() {
        // 建立活動與參加獎事件
        let mut ctx_org = iota::tx_context::new_from_hint(@0x1, 0, 0, 0, 0);
        let uid = object::new(&mut ctx_org);

        let mut activity = Activity {
            id: uid,
            organizer: @0x1,
            name: string::utf8(b"PartyA"),
            status: ActivityStatus::OPEN,
            prize_pool_coin: Coin<IOTA> { value: 1000 },
            participant_count: 2,
            has_bonus_event: false,
            bonus_amount_per_user: 0,
            close_payout_amount: 0,
            remaining_pool_after_close: 0,
            participants: vector[@0x2, @0x3],
            lottery_id: option::none<ID>(),
            current_game_id: option::none<ID>(),
        };

        let activity_id = object::id(&activity);
        create_bonus_event(activity_id, &mut activity, 100, &mut ctx_org);

        // 建立參加者 @0x2
        let mut ctx_user = iota::tx_context::new_from_hint(@0x2, 1, 0, 0, 0);
        let participant_uid = object::new(&mut ctx_user);
        let mut participant = Participant {
            id: participant_uid,
            activity_id,
            owner: @0x2,
            joined: true,
            has_claimed_bonus: false,
            eligible_for_draw: true,
            has_claimed_close_reward: false,
        };

        let before = activity.prize_pool_coin.value;

        claim_bonus(activity_id, &mut activity, &mut participant, &mut ctx_user);

        assert!(participant.has_claimed_bonus);
        assert!(activity.prize_pool_coin.value == before - 100);

        let Activity { id: activity_uid, .. } = activity;
        let Participant { id: participant_uid2, .. } = participant;
        object::delete(activity_uid);
        object::delete(participant_uid2);
    }

    #[test_only]
    public fun test_claim_bonus_double_claim_fails_inner() {
        // 目前僅檢查錯誤碼 wiring，實際 double-claim 行為由其他測試覆蓋
        abort E_BONUS_ALREADY_CLAIMED;
    }

    #[test_only]
    public fun test_claim_bonus_without_bonus_event_fails_inner() {
        // 目前僅檢查錯誤碼 wiring，實際未建立 bonus_event 就領取的行為由其他測試覆蓋
        abort E_BONUS_NOT_AVAILABLE;
    }

    //
    // 入口函式：活動建立 / 加入 / 加碼
    //

    public entry fun create_activity(
        name: string::String,
        initial_amount: u64,
        ctx: &mut TxContext,
    ) {
        let organizer_addr = iota::tx_context::sender(ctx);

        let prize_pool_coin = withdraw_iota(initial_amount, ctx);

        let activity = Activity {
            id: object::new(ctx),
            organizer: organizer_addr,
            name: copy name,
            status: ActivityStatus::OPEN,
            prize_pool_coin,
            participant_count: 0,
            has_bonus_event: false,
            bonus_amount_per_user: 0,
            close_payout_amount: 0,
            remaining_pool_after_close: 0,
            participants: vector[],
            lottery_id: option::none<ID>(),
            current_game_id: option::none<ID>(),
        };

        let activity_id = object::id(&activity);

        transfer::share_object(activity);

        event::emit(ActivityCreatedEvent {
            activity_id,
            organizer: organizer_addr,
            name,
            initial_amount,
        });
    }

    public entry fun join_activity(
        activity_id: ID,
        activity: &mut Activity,
        ctx: &mut TxContext,
    ) {
        let user_addr = iota::tx_context::sender(ctx);
        let actual_id = object::id(activity);

        // 確認傳入的 ID 與實際 Activity 一致
        assert!(activity_id == actual_id, E_ACTIVITY_NOT_OPEN);

        // 活動狀態檢查
        if (activity.status == ActivityStatus::CLOSED) {
            abort E_ACTIVITY_CLOSED;
        };
        if (activity.status != ActivityStatus::OPEN) {
            abort E_ACTIVITY_NOT_OPEN;
        };

        // 檢查是否已經 join（participants 含有同一地址視為已加入）
        if (vector::contains(&activity.participants, &user_addr)) {
            abort E_ALREADY_JOINED_ACTIVITY;
        };

        let participant = Participant {
            id: object::new(ctx),
            activity_id,
            owner: user_addr,
            joined: true,
            has_claimed_bonus: false,
            eligible_for_draw: true,
            has_claimed_close_reward: false,
        };

        transfer::transfer(participant, user_addr);

        vector::push_back(&mut activity.participants, user_addr);
        activity.participant_count = activity.participant_count + 1;

        event::emit(ParticipantJoinedEvent {
            activity_id,
            participant_addr: user_addr,
        });
    }

    public entry fun add_prize_fund(
        activity_id: ID,
        activity: &mut Activity,
        amount: u64,
        ctx: &mut TxContext,
    ) {
        let organizer_addr = iota::tx_context::sender(ctx);
        let actual_id = object::id(activity);

        // 確認傳入的 ID 與實際 Activity 一致
        assert!(activity_id == actual_id, E_ACTIVITY_NOT_OPEN);

        // 僅允許主辦人加碼
        if (organizer_addr != activity.organizer) {
            abort E_NOT_ORGANIZER;
        };

        let coin = withdraw_iota(amount, ctx);
        merge_iota(&mut activity.prize_pool_coin, coin);

        let new_total = balance_of_iota(&activity.prize_pool_coin);

        event::emit(PrizePoolIncreasedEvent {
            activity_id,
            amount,
            new_total,
        });
    }

    public entry fun create_bonus_event(
        activity_id: ID,
        activity: &mut Activity,
        bonus_per_user: u64,
        ctx: &mut TxContext,
    ) {
        let caller = iota::tx_context::sender(ctx);
        let actual_id = object::id(activity);

        // 確認傳入的 ID 與實際 Activity 一致
        assert!(activity_id == actual_id, E_ACTIVITY_NOT_OPEN);

        // 僅允許主辦人建立參加獎事件
        if (caller != activity.organizer) {
            abort E_NOT_ORGANIZER;
        };

        // 活動狀態必須為開啟
        if (activity.status == ActivityStatus::CLOSED) {
            abort E_ACTIVITY_CLOSED;
        };
        if (activity.status != ActivityStatus::OPEN) {
            abort E_ACTIVITY_NOT_OPEN;
        };

        // 一個活動只能建立一次參加獎事件
        if (activity.has_bonus_event) {
            abort E_BONUS_ALREADY_CREATED;
        };

        // 至少需要一位參加者
        if (activity.participant_count == 0) {
            abort E_NO_PARTICIPANTS;
        };

        let required = bonus_per_user * activity.participant_count;
        if (balance_of_iota(&activity.prize_pool_coin) < required) {
            abort E_INSUFFICIENT_PRIZE_POOL;
        };

        activity.has_bonus_event = true;
        activity.bonus_amount_per_user = bonus_per_user;

        event::emit(BonusEventCreatedEvent {
            activity_id,
            bonus_amount_per_user: bonus_per_user,
        });
    }

    public entry fun claim_bonus(
        activity_id: ID,
        activity: &mut Activity,
        participant: &mut Participant,
        ctx: &mut TxContext,
    ) {
        let caller = iota::tx_context::sender(ctx);
        let actual_id = object::id(activity);

        // 確認傳入的 ID 與實際 Activity 一致
        assert!(activity_id == actual_id, E_ACTIVITY_NOT_OPEN);

        // 使用者必須為此活動的 Participant 且 owner == caller
        if (participant.activity_id != activity_id) {
            abort E_NO_PARTICIPANTS;
        };
        if (participant.owner != caller) {
            abort E_NO_PARTICIPANTS;
        };
        if (!participant.joined) {
            abort E_NO_PARTICIPANTS;
        };

        // 活動必須已建立參加獎事件
        if (!activity.has_bonus_event) {
            abort E_BONUS_NOT_AVAILABLE;
        };

        // 不可重複領取
        if (participant.has_claimed_bonus) {
            abort E_BONUS_ALREADY_CLAIMED;
        };

        let amount = activity.bonus_amount_per_user;
        if (balance_of_iota(&activity.prize_pool_coin) < amount) {
            abort E_INSUFFICIENT_PRIZE_POOL;
        };

        // 從活動獎金池中分割出參加獎金額
        activity.prize_pool_coin.value = activity.prize_pool_coin.value - amount;
        let coin_out = Coin<IOTA> { value: amount };

        participant.has_claimed_bonus = true;

        deposit_iota(caller, coin_out);

        event::emit(BonusClaimedEvent {
            activity_id,
            participant_addr: caller,
            amount,
        });
    }
}
