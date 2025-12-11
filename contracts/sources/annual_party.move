module weiya_master::annual_party {
    use iota::object;
    use iota::object::{ID, UID};
    use iota::tx_context::TxContext;
    use iota::event;
    use iota::transfer;
    use iota::random::{Self as random, Random};
    use std::bcs;
    use std::hash;
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
        eligible_flags: vector<bool>,
        lottery_id: option::Option<ID>,
        current_game_id: option::Option<ID>,
    }

    public struct Participant has key {
        id: UID,
        activity_id: ID,
        owner: address,

        joined: bool,
        has_claimed_bonus: bool,
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
        participation_ids: vector<ID>,
        participation_owners: vector<address>,
        participation_choices: vector<u8>,
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
            eligible_flags: vector[],
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
            has_claimed_close_reward: false,
        };

        transfer::transfer(participant, user_addr);

        vector::push_back(&mut activity.participants, user_addr);
        vector::push_back(&mut activity.eligible_flags, true);
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

    //
    // 入口函式：參加獎 / 單次抽獎
    //

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

    //
    // 入口函式：樂透系統
    //

    public entry fun create_lottery(
        activity_id: ID,
        activity: &mut Activity,
        ctx: &mut TxContext,
    ) {
        let organizer_addr = iota::tx_context::sender(ctx);
        let actual_id = object::id(activity);

        // 確認傳入的 Activity ID
        assert!(activity_id == actual_id, E_ACTIVITY_NOT_OPEN);

        // 僅 organizer 可建立樂透
        if (organizer_addr != activity.organizer) {
            abort E_NOT_ORGANIZER;
        };

        // 活動不可已關閉
        if (activity.status == ActivityStatus::CLOSED) {
            abort E_ACTIVITY_CLOSED;
        };

        // 單一活動同時間僅允許一個開啟中的樂透。
        // 目前僅透過 lottery_id 儲存 ID，無法載入並檢查舊 Lottery 的狀態，
        // 因此當已有 lottery_id 時視為已有活動中的樂透。
        if (!option::is_none(&activity.lottery_id)) {
            abort E_LOTTERY_NOT_OPEN;
        };

        let lottery = Lottery {
            id: object::new(ctx),
            activity_id,
            status: LotteryStatus::OPEN,
            pot_coin: Coin<IOTA> { value: 0 },
            participants: vector[],
            winner: option::none<address>(),
        };

        let lottery_id = object::id(&lottery);

        activity.lottery_id = option::some<ID>(lottery_id);

        transfer::share_object(lottery);

        event::emit(LotteryCreatedEvent {
            activity_id,
            lottery_id,
        });
    }

    public entry fun join_lottery(
        activity_id: ID,
        lottery_id: ID,
        activity: &mut Activity,
        lottery: &mut Lottery,
        amount: u64,
        ctx: &mut TxContext,
    ) {
        let user_addr = iota::tx_context::sender(ctx);

        let actual_activity_id = object::id(activity);
        assert!(activity_id == actual_activity_id, E_ACTIVITY_NOT_OPEN);

        let actual_lottery_id = object::id(lottery);
        assert!(lottery_id == actual_lottery_id, E_LOTTERY_NOT_FOUND);

        // 樂透必須隸屬於此活動
        if (lottery.activity_id != activity_id) {
            abort E_LOTTERY_NOT_FOUND;
        };

        // 樂透狀態必須為開啟
        if (lottery.status != LotteryStatus::OPEN) {
            abort E_LOTTERY_NOT_OPEN;
        };

        // 使用者必須已加入活動
        if (!vector::contains(&activity.participants, &user_addr)) {
            abort E_NO_PARTICIPANTS;
        };

        // 不可重複加入同一樂透
        if (vector::contains(&lottery.participants, &user_addr)) {
            abort E_ALREADY_JOINED_LOTTERY;
        };

        let coin_in = withdraw_iota(amount, ctx);
        merge_iota(&mut lottery.pot_coin, coin_in);

        vector::push_back(&mut lottery.participants, user_addr);

        event::emit(LotteryJoinedEvent {
            activity_id,
            lottery_id,
            participant_addr: user_addr,
            amount,
        });
    }

    public entry fun execute_lottery(
        activity_id: ID,
        lottery_id: ID,
        activity: &mut Activity,
        lottery: &mut Lottery,
        rand: &Random,
        client_seed: u64,
        ctx: &mut TxContext,
    ) {
        let organizer_addr = iota::tx_context::sender(ctx);

        let actual_activity_id = object::id(activity);
        assert!(activity_id == actual_activity_id, E_ACTIVITY_NOT_OPEN);

        let actual_lottery_id = object::id(lottery);
        assert!(lottery_id == actual_lottery_id, E_LOTTERY_NOT_FOUND);

        // 僅 organizer 可執行樂透
        if (organizer_addr != activity.organizer) {
            abort E_NOT_ORGANIZER;
        };

        // 樂透必須隸屬於此活動
        if (lottery.activity_id != activity_id) {
            abort E_LOTTERY_NOT_FOUND;
        };

        // 樂透必須為開啟狀態
        if (lottery.status != LotteryStatus::OPEN) {
            abort E_LOTTERY_NOT_OPEN;
        };

        let n = vector::length(&lottery.participants);
        if (n == 0) {
            abort E_LOTTERY_NO_PARTICIPANTS;
        };

        // 使用 IOTA random 模組產生亂數（client_seed 僅作為 API 相容保留參數）
        let mut gen = random::new_generator(rand, ctx);
        let start = random::generate_u64_in_range(&mut gen, 0, (n - 1));

        let winner_addr = lottery.participants[start];

        // 將樂透彩池全部發放給中獎者
        let amount_total = lottery.pot_coin.value;
        let coin_out = Coin<IOTA> { value: amount_total };
        lottery.pot_coin.value = 0;

        deposit_iota(winner_addr, coin_out);

        lottery.status = LotteryStatus::DRAWN;
        lottery.winner = option::some<address>(winner_addr);

        event::emit(LotteryExecutedEvent {
            activity_id,
            lottery_id,
            winner_addr,
            amount: amount_total,
        });
    }

    //
    // 入口函式：四選一遊戲系統
    //

    public entry fun create_game(
        activity_id: ID,
        activity: &mut Activity,
        question: string::String,
        options: vector<string::String>,
        reward_amount: u64,
        mode_code: u8,
        ctx: &mut TxContext,
    ) {
        let caller = iota::tx_context::sender(ctx);
        let actual_id = object::id(activity);

        // 確認 Activity ID
        assert!(activity_id == actual_id, E_ACTIVITY_NOT_OPEN);

        // 僅主辦人可建立遊戲
        if (caller != activity.organizer) {
            abort E_NOT_ORGANIZER;
        };

        // 活動不可已關閉
        if (activity.status == ActivityStatus::CLOSED) {
            abort E_ACTIVITY_CLOSED;
        };

        // 若已有舊遊戲，規格要求須關閉舊遊戲。
        // 目前僅透過 ID 儲存，不具備由 ID 載入 Game 物件的索引能力，
        // 因此無法在此處更新舊 Game 的 status，日後若引入索引結構再補強。

        // 必須剛好有 4 個選項
        if (vector::length(&options) != 4) {
            abort E_INVALID_GAME_CHOICE;
        };

        // 獎金池需足以支付 reward_amount（此處僅檢查數值，不先預扣）
        if (activity.prize_pool_coin.value < reward_amount) {
            abort E_INSUFFICIENT_PRIZE_POOL;
        };

        // 以 u8 編碼 reward_mode：0 -> SINGLE，其餘視為 AVERAGE
        let mode = if (mode_code == 0) {
            GameRewardMode::SINGLE
        } else {
            GameRewardMode::AVERAGE
        };

        let game = Game {
            id: object::new(ctx),
            activity_id,
            status: GameStatus::OPEN,
            question: copy question,
            options,
            reward_amount,
            reward_mode: mode,
            correct_option: option::none<u8>(),
            total_correct: 0,
            winner_addr: option::none<address>(),
             participation_ids: vector[],
             participation_owners: vector[],
             participation_choices: vector[],
        };

        let game_id = object::id(&game);
        activity.current_game_id = option::some<ID>(game_id);

        transfer::share_object(game);

        event::emit(GameCreatedEvent {
            activity_id,
            game_id,
            reward_amount,
            reward_mode: mode,
        });
    }

    public entry fun submit_choice(
        activity_id: ID,
        activity: &Activity,
        game_id: ID,
        game: &mut Game,
        choice: u8,
        ctx: &mut TxContext,
    ) {
        let caller = iota::tx_context::sender(ctx);

        let actual_activity_id = object::id(activity);
        assert!(activity_id == actual_activity_id, E_ACTIVITY_NOT_OPEN);

        let actual_game_id = object::id(game);
        assert!(game_id == actual_game_id, E_GAME_NOT_FOUND);

        // 遊戲必須隸屬於此活動
        if (game.activity_id != activity_id) {
            abort E_GAME_NOT_FOUND;
        };

        // 遊戲狀態必須為開啟
        if (game.status != GameStatus::OPEN) {
            abort E_GAME_NOT_OPEN;
        };

        // 選項必須介於 1~4
        if (choice < 1 || choice > 4) {
            abort E_INVALID_GAME_CHOICE;
        };

        // 使用者必須已加入活動
        if (!vector::contains(&activity.participants, &caller)) {
            abort E_NO_PARTICIPANTS;
        };

        // 檢查是否已經提交過 choice：若 participation_owners 中已包含 caller 則不允許重複提交
        let mut i = 0;
        let owners_len = vector::length(&game.participation_owners);
        while (i < owners_len) {
            if (game.participation_owners[i] == caller) {
                abort E_ALREADY_SUBMITTED_CHOICE;
            };
            i = i + 1;
        };

        let participation = GameParticipation {
            id: object::new(ctx),
            game_id,
            activity_id,
            owner: caller,
            choice,
            is_correct: false,
            has_claimed_reward: false,
        };

        let participation_id = object::id(&participation);
        vector::push_back(&mut game.participation_ids, participation_id);
        vector::push_back(&mut game.participation_owners, caller);
        vector::push_back(&mut game.participation_choices, choice);

        transfer::share_object(participation);
    }

    public entry fun reveal_game_answer(
        activity_id: ID,
        activity: &Activity,
        game_id: ID,
        game: &mut Game,
        correct_option: u8,
        client_seed: u64,
        ctx: &mut TxContext,
    ) {
        let caller = iota::tx_context::sender(ctx);

        let actual_activity_id = object::id(activity);
        assert!(activity_id == actual_activity_id, E_ACTIVITY_NOT_OPEN);

        let actual_game_id = object::id(game);
        assert!(game_id == actual_game_id, E_GAME_NOT_FOUND);

        // 僅主辦人可揭露答案
        if (caller != activity.organizer) {
            abort E_NOT_ORGANIZER;
        };

        if (game.activity_id != activity_id) {
            abort E_GAME_NOT_FOUND;
        };

        if (game.status != GameStatus::OPEN) {
            abort E_GAME_NOT_OPEN;
        };

        if (correct_option < 1 || correct_option > 4) {
            abort E_INVALID_GAME_CHOICE;
        };

        // 根據所有 participation_choices 重新計算 total_correct，並收集答對者地址
        game.total_correct = 0;
        let mut correct_addrs = vector::empty<address>();
        let len = vector::length(&game.participation_choices);
        let mut i = 0;
        while (i < len) {
            if (game.participation_choices[i] == correct_option) {
                game.total_correct = game.total_correct + 1;
                let addr = game.participation_owners[i];
                vector::push_back(&mut correct_addrs, addr);
            };
            i = i + 1;
        };

        // SINGLE 模式：在所有答對者中隨機選出一位 winner_addr
        if (game.reward_mode == GameRewardMode::SINGLE) {
            if (game.total_correct > 0) {
                let correct_len = vector::length(&correct_addrs);

                // 使用 tx_digest + caller + client_seed 組合雜湊產生亂數索引
                let tx_digest_ref = iota::tx_context::digest(ctx);
                let mut data = bcs::to_bytes(tx_digest_ref);
                let mut sender_bytes = bcs::to_bytes(&caller);
                let mut seed_bytes = bcs::to_bytes(&client_seed);
                vector::append(&mut data, sender_bytes);
                vector::append(&mut data, seed_bytes);

                let hash_bytes = hash::sha3_256(data);

                let mut k: u64 = 0;
                let mut random_u64: u64 = 0;
                while (k < 8) {
                    random_u64 =
                        (random_u64 << 8) + (hash_bytes[k] as u64);
                    k = k + 1;
                };

                let winner_index = random_u64 % correct_len;
                let winner_addr = correct_addrs[winner_index];
                game.winner_addr = option::some<address>(winner_addr);
            } else {
                // 若無任何答對者則不設定 winner_addr（維持 None）
                game.winner_addr = option::none<address>();
            };
        } else {
            // AVERAGE 模式不設定 winner_addr，由每位答對者個別領獎
            game.winner_addr = option::none<address>();
        };

        game.correct_option = option::some<u8>(correct_option);
        game.status = GameStatus::ANSWER_REVEALED;

        event::emit(GameAnswerRevealedEvent {
            activity_id,
            game_id,
            correct_option,
        });
    }

    public entry fun claim_game_reward(
        activity_id: ID,
        activity: &mut Activity,
        game_id: ID,
        game: &mut Game,
        participation: &mut GameParticipation,
        ctx: &mut TxContext,
    ) {
        let caller = iota::tx_context::sender(ctx);

        let actual_activity_id = object::id(activity);
        assert!(activity_id == actual_activity_id, E_ACTIVITY_NOT_OPEN);

        // 參與紀錄與遊戲 / 呼叫者關聯檢查
        if (participation.owner != caller) {
            abort E_NOT_GAME_WINNER;
        };
        if (participation.game_id != game_id) {
            abort E_GAME_NOT_FOUND;
        };
        if (game.activity_id != activity_id) {
            abort E_GAME_NOT_FOUND;
        };

        // 遊戲必須已揭露答案
        if (game.status != GameStatus::ANSWER_REVEALED) {
            abort E_GAME_NOT_ANSWER_REVEALED;
        };

        // 參與紀錄不得重複領取
        if (participation.has_claimed_reward) {
            abort E_GAME_REWARD_ALREADY_CLAIMED;
        };

        // 確認此 participation 確實屬於該 Game（透過 participation_ids 檢查）
        let pid = object::id(participation);
        let mut found = false;
        let mut idx: u64 = 0;
        let ids_len = vector::length(&game.participation_ids);
        while (idx < ids_len) {
            if (game.participation_ids[idx] == pid) {
                found = true;
                break;
            };
            idx = idx + 1;
        };
        if (!found) {
            abort E_GAME_NOT_FOUND;
        };

        // 重新檢查是否答對：choice 必須等於 correct_option
        if (!option::is_some<u8>(&game.correct_option)) {
            abort E_GAME_NOT_ANSWER_REVEALED;
        };
        let correct_ref = option::borrow<u8>(&game.correct_option);
        let correct_value = *correct_ref;
        if (participation.choice != correct_value) {
            abort E_NOT_GAME_WINNER;
        };
        participation.is_correct = true;

        let mut amount = 0;
        if (game.reward_mode == GameRewardMode::AVERAGE) {
            // AVERAGE 模式：依 total_correct 均分獎金
            let total = game.total_correct;
            if (total == 0) {
                abort E_NOT_GAME_WINNER;
            };
            amount = game.reward_amount / total;
        } else {
            // SINGLE 模式：僅 winner_addr 可領取全額
            if (!option::is_some<address>(&game.winner_addr)) {
                abort E_NOT_GAME_WINNER;
            };
            let winner_ref = option::borrow<address>(&game.winner_addr);
            if (*winner_ref != caller) {
                abort E_NOT_GAME_WINNER;
            };
            amount = game.reward_amount;
        };

        // 檢查活動獎金池餘額
        if (activity.prize_pool_coin.value < amount) {
            abort E_INSUFFICIENT_PRIZE_POOL;
        };

        activity.prize_pool_coin.value = activity.prize_pool_coin.value - amount;
        let coin_out = Coin<IOTA> { value: amount };

        // 更新參與紀錄領獎狀態
        participation.has_claimed_reward = true;

        deposit_iota(caller, coin_out);

        // SINGLE 模式：得獎者領取後即可關閉遊戲。
        // AVERAGE 模式理論上需在所有答對者皆領取後才關閉，
        // 但目前缺乏 Participation 索引，無法在此檢查是否「全部已領」，
        // 因此僅在 SINGLE 模式做自動關閉，AVERAGE 模式維持 ANSWER_REVEALED。
        if (game.reward_mode == GameRewardMode::SINGLE) {
            game.status = GameStatus::CLOSED;
        };

        event::emit(GameRewardClaimedEvent {
            activity_id,
            game_id,
            participant_addr: caller,
            amount,
        });
    }

    //
    // 入口函式：活動關閉與結算
    //

    public entry fun close_activity(
        activity_id: ID,
        activity: &mut Activity,
        ctx: &mut TxContext,
    ) {
        let caller = iota::tx_context::sender(ctx);
        let actual_id = object::id(activity);

        // 確認 Activity ID
        assert!(activity_id == actual_id, E_ACTIVITY_NOT_OPEN);

        // 僅 organizer 可關閉活動
        if (caller != activity.organizer) {
            abort E_NOT_ORGANIZER;
        };

        // 活動不得已是 CLOSED
        if (activity.status == ActivityStatus::CLOSED) {
            abort E_ACTIVITY_CLOSED;
        };

        let total = activity.prize_pool_coin.value;
        let count = activity.participant_count;
        let avg = total / count;

        activity.close_payout_amount = avg;
        activity.remaining_pool_after_close = total;
        activity.status = ActivityStatus::CLOSED;

        event::emit(ActivityClosedEvent {
            activity_id,
            close_payout_amount: avg,
        });
    }

    public entry fun claim_close_reward(
        activity_id: ID,
        activity: &mut Activity,
        participant: &mut Participant,
        ctx: &mut TxContext,
    ) {
        let caller = iota::tx_context::sender(ctx);
        let actual_id = object::id(activity);

        // 確認 Activity ID
        assert!(activity_id == actual_id, E_ACTIVITY_NOT_OPEN);

        // 參與者必須屬於此活動且為呼叫者本人
        if (participant.activity_id != activity_id) {
            abort E_NO_PARTICIPANTS;
        };
        if (participant.owner != caller) {
            abort E_NO_PARTICIPANTS;
        };
        if (!participant.joined) {
            abort E_NO_PARTICIPANTS;
        };

        if (activity.status != ActivityStatus::CLOSED) {
            abort E_ACTIVITY_NOT_CLOSED;
        };
        if (activity.close_payout_amount == 0) {
            abort E_CLOSE_PAYOUT_ZERO;
        };
        if (participant.has_claimed_close_reward) {
            abort E_CLOSE_REWARD_ALREADY_CLAIMED;
        };

        let amount = activity.close_payout_amount;
        if (activity.prize_pool_coin.value < amount) {
            abort E_INSUFFICIENT_PRIZE_POOL;
        };

        activity.prize_pool_coin.value = activity.prize_pool_coin.value - amount;
        activity.remaining_pool_after_close =
            activity.remaining_pool_after_close - amount;

        let coin_out = Coin<IOTA> { value: amount };

        participant.has_claimed_close_reward = true;

        deposit_iota(caller, coin_out);

        event::emit(CloseRewardClaimedEvent {
            activity_id,
            participant_addr: caller,
            amount,
        });
    }

    public entry fun withdraw_remaining_after_close(
        activity_id: ID,
        activity: &mut Activity,
        ctx: &mut TxContext,
    ) {
        let caller = iota::tx_context::sender(ctx);
        let actual_id = object::id(activity);

        // 確認 Activity ID
        assert!(activity_id == actual_id, E_ACTIVITY_NOT_OPEN);

        if (caller != activity.organizer) {
            abort E_NOT_ORGANIZER;
        };
        if (activity.status != ActivityStatus::CLOSED) {
            abort E_ACTIVITY_NOT_CLOSED;
        };

        let remaining = activity.prize_pool_coin.value;
        if (remaining == 0) {
            abort E_REMAINING_POOL_ZERO;
        };

        let coin_out = Coin<IOTA> { value: remaining };

        activity.prize_pool_coin.value = 0;
        activity.remaining_pool_after_close = 0;

        deposit_iota(caller, coin_out);

        event::emit(RemainingPoolWithdrawnEvent {
            activity_id,
            organizer: caller,
            amount: remaining,
        });
    }

    public entry fun draw_prize(
        activity_id: ID,
        activity: &mut Activity,
        rand: &Random,
        amount: u64,
        client_seed: u64,
        ctx: &mut TxContext,
    ) {
        let organizer_addr = iota::tx_context::sender(ctx);
        let actual_id = object::id(activity);

        // 確認 Activity ID 是否正確
        assert!(activity_id == actual_id, E_ACTIVITY_NOT_OPEN);

        // 僅 organizer 可呼叫
        if (organizer_addr != activity.organizer) {
            abort E_NOT_ORGANIZER;
        };

        // 獎金池餘額檢查
        if (balance_of_iota(&activity.prize_pool_coin) < amount) {
            abort E_INSUFFICIENT_PRIZE_POOL;
        };

        let n = vector::length(&activity.participants);
        if (n == 0) {
            abort E_NO_ELIGIBLE_FOR_DRAW;
        };

        // 至少需要一位仍然可抽獎的參加者
        let mut i = 0;
        let mut has_eligible = false;
        while (i < n) {
            if (activity.eligible_flags[i]) {
                has_eligible = true;
            };
            i = i + 1;
        };
        if (!has_eligible) {
            abort E_NO_ELIGIBLE_FOR_DRAW;
        };

        // 使用 IOTA random 模組產生亂數（client_seed 僅作為 API 相容保留參數）
        let mut gen = random::new_generator(rand, ctx);
        let start = random::generate_u64_in_range(&mut gen, 0, (n - 1));

        // 以圓形線性掃描方式尋找第一個 eligible_flags 為 true 的索引
        let mut offset = 0;
        let mut winner_index = 0;
        let mut found = false;
        while (offset < n) {
            let idx = (start + offset) % n;
            if (activity.eligible_flags[idx]) {
                winner_index = idx;
                found = true;
                break;
            };
            offset = offset + 1;
        };
        if (!found) {
            abort E_NO_ELIGIBLE_FOR_DRAW;
        };

        let winner_addr = activity.participants[winner_index];

        // 將中獎者標記為不可再次抽獎
        let winner_flag_ref = vector::borrow_mut<bool>(&mut activity.eligible_flags, winner_index);
        *winner_flag_ref = false;

        // 從獎金池分出 prize
        activity.prize_pool_coin.value = activity.prize_pool_coin.value - amount;
        let coin_out = Coin<IOTA> { value: amount };

        deposit_iota(winner_addr, coin_out);

        event::emit(PrizeDrawExecutedEvent {
            activity_id,
            winner_addr,
            amount,
        });
    }
}
