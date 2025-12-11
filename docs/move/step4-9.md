## ✅ Codex Prompt：Step 4 – Lottery（create / join / execute）

```
Goal:
Implement Step 4 — Lottery System (create_lottery / join_lottery / execute_lottery)
inside `contracts/sources/annual_party.move`.

------------------------------------
Implement all three entry functions:
------------------------------------

1. public entry fun create_lottery(
       organizer: &signer,
       activity_id: ID,
       ctx: &mut TxContext
   )

2. public entry fun join_lottery(
       user: &signer,
       activity_id: ID,
       lottery: &mut Lottery,
       amount: u64,
       ctx: &mut TxContext
   )

3. public entry fun execute_lottery(
       organizer: &signer,
       activity_id: ID,
       lottery: &mut Lottery,
       client_seed: u64,
       ctx: &mut TxContext
   )

Follow EXACTLY the updated [SPEC.md](SPEC.md) rules:

------------------------------------
Lottery Modeling:
------------------------------------

struct Lottery {
    id: UID,
    activity_id: ID,
    status: LotteryStatus,         // OPEN / DRAWN / CLOSED
    pot_coin: Coin<IOTA>,         // IOTA collected from participants
    participants: vector<address>,
    winner: option<address>,
}

Constraints:
- A single Activity can have at most ONE “active (OPEN)” Lottery.
- A user can join the same Lottery at most once.
- Lottery pot_coin is funded ONLY by user deposits.
- execute_lottery distributes ALL IOTA in the pot to ONE winner.

------------------------------------
Entry Function Specifications:
------------------------------------

---------------------------------------------------------
1. create_lottery
---------------------------------------------------------
Parameters:
  organizer, activity_id, ctx

Requirements:
- Load Activity as shared object.
- Validate caller is the Activity.organizer, else abort(E_NOT_ORGANIZER).
- Validate Activity.status != CLOSED.
- activity.lottery_id must be None OR the referenced Lottery must NOT be OPEN.
- Create new Lottery object:
    id = object::new(ctx)
    activity_id = activity_id
    status = OPEN
    pot_coin = Coin<IOTA>{ value: 0 }
    participants = []
    winner = None
- Mutate activity.lottery_id = Some(new_lottery_id).
- transfer::share_object(new_lottery).
- Emit LotteryCreatedEvent(activity_id, lottery_id).

---------------------------------------------------------
2. join_lottery
---------------------------------------------------------
Parameters:
  user, activity_id, lottery(&mut), amount, ctx

Requirements:
- let user_addr = signer::address_of(user)
- Load Activity (shared).
- Validate Lottery.activity_id == activity_id.
- Validate Lottery.status == OPEN.
- User must have joined activity → address ∈ activity.participants.
- User must NOT be already in lottery.participants (no duplicate join allowed).
- withdraw_iota(amount, ctx) → coin_in.
- merge_iota(&mut lottery.pot_coin, coin_in).
- push user_addr into lottery.participants.
- Emit LotteryJoinedEvent(activity_id, lottery_id, user_addr, amount).

---------------------------------------------------------
3. execute_lottery
---------------------------------------------------------
Parameters:
  organizer, activity_id, lottery(&mut), client_seed, ctx

Requirements:
- caller must equal activity.organizer, else abort(E_NOT_ORGANIZER).
- lottery.status must be OPEN.
- lottery.participants.length > 0, else abort(E_LOTTERY_NO_PARTICIPANTS).

Random selection:
- Use same standard RNG:
    random_u64 = sha3_256(block_hash || tx_hash || caller || client_seed)
    start = random_u64 % n
  where n = lottery.participants.length

Winner:
- Direct index (no eligible_flags here).
- winner_addr = participants[start]

Payout:
- let amount_total = lottery.pot_coin.value
- Construct coin_out = Coin<IOTA>{ value: amount_total }
- deposit_iota(winner_addr, coin_out)
- lottery.pot_coin.value = 0 (or reconstruct to zero coin)

Finalize:
- lottery.status = DRAWN
- lottery.winner = Some(winner_addr)
- Emit LotteryExecutedEvent(activity_id, lottery_id, winner_addr, amount_total)

------------------------------------
Coding Rules:
------------------------------------
- Do NOT modify Activity structure beyond valid lottery_id usage.
- Do NOT modify Participant.
- Use ONLY native IOTA coin mocks: withdraw_iota / merge_iota / deposit_iota.
- DO NOT introd

```



## ✅ Codex Prompt：Step 4 的測試檔（lottery_tests.move）

```
Goal:
Create a dedicated test module for the Lottery feature (Step 4) under:
  contracts/tests/lottery_tests.move

Assumptions:
- The main module is `weiya_master::annual_party`.
- Lottery entry functions are already implemented in `annual_party.move` as:
    public entry fun create_lottery(organizer: &signer, activity_id: ID, ctx: &mut TxContext)
    public entry fun join_lottery(user: &signer, activity_id: ID, lottery: &mut Lottery, amount: u64, ctx: &mut TxContext)
    public entry fun execute_lottery(organizer: &signer, activity_id: ID, lottery: &mut Lottery, client_seed: u64, ctx: &mut TxContext)
- Activity / Lottery structs and error codes follow [SPEC.md](SPEC.md) and the current annual_party.move implementation.

--------------------------------------------------
Task: Create `contracts/tests/lottery_tests.move`
--------------------------------------------------

1. Define a test module, for example:
   module weiya_master::lottery_tests { ... }

2. Import necessary modules:
   - use weiya_master::annual_party;
   - use iota::tx_context;
   - use iota::object;
   - use std::vector;
   - use std::string;
   - and any other std/iota modules required.

3. Implement the following tests using #[test] and #[expected_failure] where appropriate:

--------------------------------------------------
test_create_lottery_success
--------------------------------------------------
Scenario:
- Use a dummy TxContext with sender @0x1 as organizer.
- Manually create an Activity object via helper logic similar to what create_activity does,
  OR directly call annual_party::create_activity if its signature fits the testing style.
- Then call annual_party::create_lottery.
- Assertions:
  - The Activity must have lottery_id set to Some(lottery_id).
  - The created Lottery object should have:
      status == LotteryStatus::OPEN
      pot_coin.value == 0
      participants length == 0
      winner == None

Tip:
- You can simulate "loading" the Activity and Lottery from local variables instead of on-chain storage in tests.

--------------------------------------------------
test_create_lottery_twice_requires_previous_closed
--------------------------------------------------
Scenario:
- Create Activity + first Lottery successfully.
- Immediately try to call create_lottery again for the same Activity.
- Expect abort with the appropriate error code representing "existing OPEN lottery".
  - Use #[expected_failure(abort_code = <code>)] according to annual_party's constants.

--------------------------------------------------
test_join_lottery_success
--------------------------------------------------
Scenario:
- Create Activity with organizer @0x1 and prize_pool large enough (the prize_pool is not directly used here but keeps Activity consistent).
- Add two participants to the Activity (e.g., @0x2 and @0x3) by simulating join_activity behavior:
    - Push their addresses into activity.participants
    - Push true into activity.eligible_flags
    - Increase participant_count accordingly
- Create a Lottery for this Activity.
- Use signer @0x2 to call join_lottery with amount = 100.
- Assertions:
    - lottery.participants contains @0x2
    - lottery.pot_coin.value increased by 100

--------------------------------------------------
test_join_lottery_duplicate_fails
--------------------------------------------------
Scenario:
- Same as above, but:
    - @0x2 joins once
    - @0x2 tries to join again
- The second join_lottery should abort with E_ALREADY_JOINED_LOTTERY.
- Use #[expected_failure(abort_code = annual_party::E_ALREADY_JOINED_LOTTERY)] or the appropriate syntax.

--------------------------------------------------
test_join_lottery_not_participant_fails
--------------------------------------------------
Scenario:
- Activity has participants [@0x2] only.
- Create a Lottery.
- Use signer @0x5 (who is NOT in activity.participants) to call join_lottery.
- Expect abort with an error representing "user not in activity participants" (for example E_NO_PARTICIPANTS or whatever is defined in annual_party).
- Use #[expected_failure(abort_code = ...)].

--------------------------------------------------
test_execute_lottery_success
--------------------------------------------------
Scenario:
- Activity with organizer @0x1.
- Create Lottery for this Activity.
- Populate lottery.participants = [@0x2, @0x3, @0x4].
- Set lottery.pot_coin.value = 300 (simulating that three users have already joined with some amounts).
- Call execute_lottery with signer @0x1 and some client_seed (e.g. 123).
- Assertions:
    - lottery.status == LotteryStatus::DRAWN
    - lottery.winner is Some(addr)
    - lottery.pot_coin.value == 0
    - The winner's "received amount" can be asserted logically depending on how deposit_iota is mocked.
      (If balances are not tracked in the mock, at least assert we emitted the proper LotteryExecutedEvent or that pot is zero.)

--------------------------------------------------
test_execute_lottery_no_participants_fails
--------------------------------------------------
Scenario:
- Lottery with participants length == 0 and pot_coin.value > 0.
- Call execute_lottery.
- Expect abort with E_LOTTERY_NO_PARTICIPANTS.

--------------------------------------------------
test_execute_lottery_wrong_caller_fails
--------------------------------------------------
Scenario:
- Activity created with organizer @0x1.
- Lottery created and has participants.
- Use signer @0x5 to call execute_lottery (not the organizer).
- Expect abort with E_NOT_ORGANIZER.

--------------------------------------------------
Implementation notes:
--------------------------------------------------
- Use tx_context::new_from_hint or tx_context::dummy to create contexts with different senders.
- For Activity and Lottery objects, you can:
    - Construct them directly in test code (preferred in current setup),
    - Or call public entry functions when signatures are convenient.
- Ensure all created UIDs are eventually deleted at the end of tests to avoid unused key errors.

--------------------------------------------------
Final requirement:
--------------------------------------------------
- The file `contracts/tests/lottery_tests.move` must contain a complete module with all tests above.
- All tests must compile and pass (or fail with expected_failure) under `iota move test`.

Output:
- Return the FULL content of `contracts/tests/lottery_tests.move` as a single complete code block.
```

## ✅ Codex Prompt：Step 5 – 四選一遊戲實作 + 測試

```
Goal:
Implement **Step 5 — Game System** inside `contracts/sources/annual_party.move`
and generate a full test suite `contracts/tests/game_tests.move`.

This Step includes:

  1. create_game
  2. submit_choice
  3. reveal_game_answer
  4. claim_game_reward

FOLLOW EXACTLY the [SPEC.md](SPEC.md) semantics.

==============================================================
PART A — Implementation Requirements
==============================================================

Modify ONLY `contracts/sources/annual_party.move`.

--------------------------------------------------------------
STRUCTS REMAIN THE SAME:
--------------------------------------------------------------
Game {
    id: UID,
    activity_id: ID,
    status: GameStatus,
    question: String,
    options: vector<String>,     // exactly 4 items
    reward_amount: u64,
    reward_mode: GameRewardMode, // SINGLE / AVERAGE
    correct_option: option<u8>,  // None → unrevealed; Some(1~4)
    total_correct: u64,
    winner_addr: option<address> // used only when reward_mode = SINGLE
}

GameParticipation {
    id: UID,
    game_id: ID,
    activity_id: ID,
    owner: address,
    choice: u8,
    is_correct: bool,
    has_claimed_reward: bool,
}

--------------------------------------------------------------
ENTRY FUNCTION 1: create_game
--------------------------------------------------------------

Signature:
public entry fun create_game(
    activity_id: ID,
    activity: &mut Activity,
    question: String,
    options: vector<String>, // must be length 4
    reward_amount: u64,
    mode: GameRewardMode,
    ctx: &mut TxContext
)

Rules:

1. Validate caller == activity.organizer.
2. Validate activity.status != CLOSED.
3. If activity.current_game_id exists:
     - Load the referenced Game object.
     - If the Game.status == OPEN or ANSWER_REVEALED:
           set old_game.status = CLOSED.
4. Validate vector::length(options) == 4, else abort(E_INVALID_GAME_CHOICE).
5. Validate activity.prize_pool_coin.value >= reward_amount, else abort(E_INSUFFICIENT_PRIZE_POOL).
6. Create new Game object with:
       status = OPEN
       question = question
       options = options
       reward_amount = reward_amount
       reward_mode = mode
       correct_option = None
       total_correct = 0
       winner_addr = None
7. Set activity.current_game_id = Some(game_id).
8. Do NOT split the reward yet — keep reward_amount stored as number.
9. transfer::share_object(game);
10. Emit GameCreatedEvent.

--------------------------------------------------------------
ENTRY FUNCTION 2: submit_choice
--------------------------------------------------------------

Signature:
public entry fun submit_choice(
    activity_id: ID,
    activity: &Activity,
    game_id: ID,
    game: &mut Game,
    choice: u8,
    ctx: &mut TxContext
)

Rules:

1. caller = tx_context::sender(ctx)
2. Validate game.activity_id == activity_id == activity.id.
3. Validate game.status == OPEN.
4. Validate choice ∈ {1,2,3,4}.
5. Validate caller has joined activity:
      caller ∈ activity.participants.
6. Validate this user has NOT submitted a choice before:
      There must be NO GameParticipation object for (game_id, caller).
7. Create GameParticipation object:
       game_id
       activity_id
       owner = caller
       choice = choice
       is_correct = false
       has_claimed_reward = false
8. transfer::share_object(participation);

--------------------------------------------------------------
ENTRY FUNCTION 3: reveal_game_answer
--------------------------------------------------------------

Signature:
public entry fun reveal_game_answer(
    activity_id: ID,
    activity: &Activity,
    game_id: ID,
    game: &mut Game,
    correct_option: u8,
    client_seed: u64,
    ctx: &mut TxContext
)

Rules:

1. caller must equal activity.organizer.
2. Validate game.status == OPEN.
3. Validate correct_option ∈ {1,2,3,4}.
4. Iterate all GameParticipation objects for this game:
      If participation.choice == correct_option:
            participation.is_correct = true
            increment game.total_correct
5. If game.reward_mode == AVERAGE:
      - Nothing else now; each winner will receive reward_amount / total_correct during claim_game_reward.
6. If mode == SINGLE:
      - If total_correct == 0 → NO winner, so game.winner_addr = None.
      - Else:
            Pick a winner using SAME RNG pattern as draw_prize:
                random_u64 = sha3_256(block_hash || tx_hash || caller || client_seed)
                index = random_u64 % number_of_correct_participants
            winner_addr = correct_participants[index]
            game.winner_addr = Some(winner_addr)
7. Set game.correct_option = Some(correct_option)
8. Set game.status = ANSWER_REVEALED
9. Emit GameAnswerRevealedEvent.

--------------------------------------------------------------
ENTRY FUNCTION 4: claim_game_reward
--------------------------------------------------------------

Signature:
public entry fun claim_game_reward(
    activity_id: ID,
    activity: &mut Activity,
    game_id: ID,
    game: &mut Game,
    participation: &mut GameParticipation,
    ctx: &mut TxContext
)

Rules:

1. caller = tx_context::sender(ctx)
2. Validate:
     participation.owner == caller
     participation.game_id == game_id
     game.activity_id == activity_id
3. Validate game.status == ANSWER_REVEALED, else abort(E_GAME_NOT_ANSWER_REVEALED).
4. Validate participation.is_correct == true, else abort(E_NOT_GAME_WINNER).
5. Validate participation.has_claimed_reward == false, else abort(E_GAME_REWARD_ALREADY_CLAIMED).
6. Determine reward:
     If mode == AVERAGE:
         amount = reward_amount / total_correct
     If mode == SINGLE:
         amount = reward_amount only if caller == game.winner_addr
         else abort(E_NOT_GAME_WINNER)
7. Validate activity.prize_pool_coin.value >= amount, else abort(E_INSUFFICIENT_PRIZE_POOL)
8. Perform:
     activity.prize_pool_coin.value -= amount
     coin_out = Coin<IOTA>{ value: amount }
     deposit_iota(caller, coin_out)
9. participation.has_claimed_reward = true
10. Emit GameRewardClaimedEvent.

```

## Test suite for Step 5

```
Goal: Test suite for Step 5

Create file: `contracts/tests/game_tests.move`

Implement **at least** the following test functions using #[test] and #[expected_failure]:

--------------------------------------------------------------
1. test_create_game_success
--------------------------------------------------------------
- Create Activity with organizer @0x1.
- Call create_game with:
      question = "Q1"
      options = ["A","B","C","D"]
      reward_amount = 100
      mode = GameRewardMode::AVERAGE
- Assertions:
      activity.current_game_id is Some(id)
      game.status == OPEN
      game.reward_amount == 100

--------------------------------------------------------------
2. test_create_game_overwrites_previous_open_game
--------------------------------------------------------------
Scenario:
- First create Game A (OPEN)
- Then create Game B
- Assert:
    - Game A.status == CLOSED
    - Game B.status == OPEN

--------------------------------------------------------------
3. test_submit_choice_success
--------------------------------------------------------------
- Create Activity with participants [@0x2, @0x3]
- Create a Game
- signer @0x2 calls submit_choice(game_id, choice=1)
- Assertions:
      A GameParticipation is created:
         owner == @0x2
         choice == 1
         is_correct == false
         has_claimed_reward == false

--------------------------------------------------------------
4. test_submit_choice_twice_fails
--------------------------------------------------------------
- @0x2 submits choice once.
- @0x2 submits again.
- Expect abort(E_ALREADY_SUBMITTED_CHOICE)

--------------------------------------------------------------
5. test_submit_choice_not_in_activity_fails
--------------------------------------------------------------
- participants = [@0x2]
- signer @0x8 tries to submit_choice.
- Expect abort(E_NO_PARTICIPANTS) or correct defined error.

--------------------------------------------------------------
6. test_reveal_answer_average_success
--------------------------------------------------------------
- participants = [@0x2, @0x3, @0x4]
- All submit choices.
- correct_option = 2
- reveal_game_answer
- Assertions:
       game.status == ANSWER_REVEALED
       game.total_correct == number of correct participants
       correct participants have is_correct = true

--------------------------------------------------------------
7. test_reveal_answer_single_success_with_random_winner
--------------------------------------------------------------
- Same as above but mode = SINGLE.
- correct participants = at least 2
- reveal_game_answer chooses 1 winner.
- Assert:
      game.status == ANSWER_REVEALED
      game.winner_addr is Some(addr)
      only 1 winner

--------------------------------------------------------------
8. test_claim_reward_average_success
--------------------------------------------------------------
- reward_amount = 90
- 3 correct participants
- each receives 30
- Validate activity.prize_pool decreases correctly
- Validate participation.has_claimed_reward flips to true

--------------------------------------------------------------
9. test_claim_reward_single_success
--------------------------------------------------------------
- SINGLE mode
- verify that only winner can claim
- non-winner must abort(E_NOT_GAME_WINNER)

--------------------------------------------------------------
10. test_claim_reward_twice_fails
--------------------------------------------------------------
- winner calls claim_game_reward twice
- second call aborts with E_GAME_REWARD_ALREADY_CLAIMED

--------------------------------------------------------------
11. test_claim_reward_game_not_answer_revealed
--------------------------------------------------------------
- try claim before reveal_game_answer
- expect abort(E_GAME_NOT_ANSWER_REVEALED)

==============================================================
RULES:
==============================================================

- NO registry objects.
- Must clean up UIDs at the end of tests.
- Tests must use:
    iota::tx_context::{dummy, new_from_hint}
    object::new
    transfer::share_object
- All entry functions must compile + pass tests under `iota move test`.

==============================================================
OUTPUT:
==============================================================

Return TWO complete files:

1. FULL updated `contracts/sources/annual_party.move`
2. FULL `contracts/tests/game_tests.move`

Both MUST be fully formed code blocks.
```

## ✅ Codex Prompt A — Step 6 實作（close_activity / claim_close_reward / withdraw_remaining_after_close）

```
You are Codex working on the IOTA Move project defined by [SPEC.md](SPEC.md) (with eligible_flags)
and [roadmap.md](docs/move/roadmap.md).

Your task:
Implement **Step 6 — Activity Closing & Rewards** inside:
    contracts/sources/annual_party.move

This step adds THREE entry functions:

------------------------------------------------------------
1. close_activity
------------------------------------------------------------
Signature:
public entry fun close_activity(
    organizer: &signer,
    activity_id: ID,
    activity: &mut Activity,
    ctx: &mut TxContext
)

Rules (STRICTLY follow [SPEC.md](SPEC.md)):

1. caller must equal activity.organizer, else abort(E_NOT_ORGANIZER)
2. activity.status must NOT be CLOSED
3. Compute:
     let total = activity.prize_pool_coin.value
     let count = activity.participant_count
     let avg = total / count        // integer division
4. Set:
     activity.close_payout_amount = avg
     activity.remaining_pool_after_close = total
     activity.status = ActivityStatus::CLOSED
5. Emit ActivityClosedEvent(activity_id, avg)

Notes:
- Do NOT transfer any coin yet. Reward distribution occurs in claim_close_reward.
- No game or lottery can be created after closure.

------------------------------------------------------------
2. claim_close_reward
------------------------------------------------------------
Signature:
public entry fun claim_close_reward(
    user: &signer,
    activity_id: ID,
    activity: &mut Activity,
    participant: &mut Participant,
    ctx: &mut TxContext
)

Rules:

1. caller = signer::address_of(user)
2. Validate:
   - participant.activity_id == activity_id
   - participant.owner == caller
   - participant.joined == true
3. Validate activity.status == CLOSED else abort(E_ACTIVITY_NOT_CLOSED)
4. Validate activity.close_payout_amount > 0 else abort(E_CLOSE_PAYOUT_ZERO)
5. Validate participant.has_claimed_close_reward == false else abort(E_CLOSE_REWARD_ALREADY_CLAIMED)
6. let amount = activity.close_payout_amount
7. Validate activity.prize_pool_coin.value >= amount, else abort(E_INSUFFICIENT_PRIZE_POOL)
8. Subtract:
      activity.prize_pool_coin.value -= amount
      activity.remaining_pool_after_close -= amount
9. deposit_iota(caller, Coin<IOTA>{ value: amount })
10. participant.has_claimed_close_reward = true
11. Emit CloseRewardClaimedEvent(activity_id, caller, amount)

------------------------------------------------------------
3. withdraw_remaining_after_close
------------------------------------------------------------
Signature:
public entry fun withdraw_remaining_after_close(
    organizer: &signer,
    activity_id: ID,
    activity: &mut Activity,
    ctx: &mut TxContext
)

Rules:

1. caller must equal activity.organizer else abort(E_NOT_ORGANIZER)
2. activity.status must be CLOSED, else abort(E_ACTIVITY_NOT_CLOSED)
3. let remaining = activity.prize_pool_coin.value
4. If remaining == 0 → abort(E_REMAINING_POOL_ZERO)
5. Construct Coin<IOTA>{ value: remaining }
6. Transfer to organizer via deposit_iota
7. Set:
      activity.prize_pool_coin.value = 0
      activity.remaining_pool_after_close = 0
8. Emit RemainingPoolWithdrawnEvent(activity_id, organizer_addr, remaining)

------------------------------------------------------------
CODING RULES
------------------------------------------------------------

- DO NOT introduce registry objects.
- DO NOT modify Activity structure beyond these fields already defined:
      close_payout_amount
      remaining_pool_after_close
- Keep all event formats identical to [SPEC.md](SPEC.md).
- Maintain consistent style with previous Steps (1–5).
- Ensure the file compiles with `iota move test`.

------------------------------------------------------------
OUTPUT
------------------------------------------------------------
Return the FULL updated:
    contracts/sources/annual_party.move
as a single complete code block.
```

## Codex Prompt B — Step 6 測試（close_activity_tests.move）

```
You are Codex. Create a new test file:

    contracts/tests/close_activity_tests.move

This file must thoroughly test Step 6 functions:
    close_activity
    claim_close_reward
    withdraw_remaining_after_close

============================================================
TEST MODULE STRUCTURE
============================================================

module weiya_master::close_activity_tests { ... }

Use imports:
- use weiya_master::annual_party;
- use iota::tx_context;
- use iota::object;
- use std::vector;
- use std::string;

============================================================
TEST 1 — test_close_activity_success
============================================================

Scenario:
1. Create an Activity with organizer @0x1 with prize_pool 300.
2. Add 3 participants manually:
      participants = [@0x2, @0x3, @0x4]
      eligible_flags = [true, true, true]
      participant_count = 3
3. Call close_activity.
4. Assert:
      activity.status == CLOSED
      activity.close_payout_amount == 100
      activity.remaining_pool_after_close == 300

============================================================
TEST 2 — test_close_activity_wrong_caller_fails
============================================================
- Use signer @0x9
- Expect abort(E_NOT_ORGANIZER)

============================================================
TEST 3 — test_claim_close_reward_success
============================================================

Scenario:
1. Activity has prize_pool = 300
2. 3 participants exist
3. close_activity already executed → avg = 100
4. Claim close_reward for participant @0x2
5. Assert:
      participant.has_claimed_close_reward == true
      activity.remaining_pool_after_close == 200
      activity.prize_pool_coin.value == 200

============================================================
TEST 4 — test_claim_close_reward_twice_fails
============================================================
- @0x2 claims once successfully
- Second claim → abort(E_CLOSE_REWARD_ALREADY_CLAIMED)

============================================================
TEST 5 — test_claim_close_reward_before_closed_fails
============================================================
- Call claim_close_reward BEFORE close_activity
- Expect abort(E_ACTIVITY_NOT_CLOSED)

============================================================
TEST 6 — test_withdraw_remaining_after_close_success
============================================================
Scenario:
1. prize_pool = 300
2. close_activity → avg = 100
3. Two participants claim (so 200 paid)
4. remaining == 100
5. organizer calls withdraw_remaining_after_close
6. Assert:
      activity.prize_pool_coin.value == 0
      activity.remaining_pool_after_close == 0

============================================================
TEST 7 — test_withdraw_remaining_zero_fails
============================================================
- After organizer already withdrew all remaining
- Calling again should abort(E_REMAINING_POOL_ZERO)

============================================================
RULES
============================================================
- Ensure proper cleanup: object::delete(uid) for all created UIDs.
- Tests must run with `iota move test`.
- Use #[expected_failure(abort_code = ...)] for all negative tests.

============================================================
OUTPUT
============================================================
Return the FULL file:

    contracts/tests/close_activity_tests.move

as a complete code block.
```

## Step 7（樂透 & 遊戲收尾整合 / cross-object reference 測試 / event 全量驗證

```
You are Codex working on the IOTA Move smart contract defined in [SPEC.md](SPEC.md) and [roadmap.md](docs/move/roadmap.md).

Your task:
Implement Step 7 — Lottery Module inside:
    contracts/sources/annual_party.move

Add / complete the following entry functions EXACTLY as defined in [SPEC.md](SPEC.md):

------------------------------------------------------------
1. create_lottery
------------------------------------------------------------
Signature:
public entry fun create_lottery(
    organizer: &signer,
    activity_id: ID,
    activity: &mut Activity,
    ctx: &mut TxContext
)

Rules:
- caller must be organizer, else abort(E_NOT_ORGANIZER)
- activity.status must NOT be CLOSED
- activity must NOT currently have an OPEN lottery:
    * If activity.lottery_id == Some(id):
         load Lottery(id)
         if lottery.status == OPEN → abort(E_LOTTERY_ALREADY_ACTIVE)
- Create a new Lottery object:
    struct Lottery {
        id: UID,
        activity_id,
        status = OPEN,
        pot_coin = Coin<IOTA>{ value: 0 },
        participants = empty vector<address>,
        winner = None
    }
- activity.lottery_id = Some(new_lottery_id)
- Emit LotteryCreatedEvent(activity_id, new_lottery_id)

------------------------------------------------------------
2. join_lottery
------------------------------------------------------------
Signature:
public entry fun join_lottery(
    user: &signer,
    activity_id: ID,
    lottery_id: ID,
    activity: &mut Activity,
    lottery: &mut Lottery,
    amount: u64,
    ctx: &mut TxContext
)

Rules:
- user must be a Participant of the activity
- lottery.status must be OPEN
- amount > 0
- user cannot already be in lottery.participants else abort(E_ALREADY_JOINED_LOTTERY)
- withdraw_iota(user, amount) → coin_in
- merge coin_in into lottery.pot_coin
- push signer::address_of(user) into lottery.participants
- Emit LotteryJoinedEvent(activity_id, lottery_id, user_addr, amount)

------------------------------------------------------------
3. execute_lottery
------------------------------------------------------------
Signature:
public entry fun execute_lottery(
    organizer: &signer,
    activity_id: ID,
    lottery_id: ID,
    activity: &mut Activity,
    lottery: &mut Lottery,
    client_seed: u64,
    ctx: &mut TxContext
)

Rules:
- caller must be organizer, else abort(E_NOT_ORGANIZER)
- lottery.status must be OPEN else abort(E_INVALID_LOTTERY_STATUS)
- lottery.participants length > 0 else abort(E_NO_LOTTERY_PARTICIPANT)
- Generate random_u64:
      hash(block_hash || tx_hash || caller || client_seed)
  idx = random_u64 % participants.length
  winner_addr = participants[idx]
- Transfer entire pot:
      let amount = lottery.pot_coin.value
      lottery.pot_coin.value = 0
      deposit_iota(winner_addr, Coin<IOTA>{ value: amount })
- lottery.status = DRAWN
- lottery.winner = Some(winner_addr)
- Emit LotteryExecutedEvent(activity_id, lottery_id, winner_addr, amount)

------------------------------------------------------------
OUTPUT
------------------------------------------------------------
Return the FULL updated file:
    contracts/sources/annual_party.move
as a single complete code block.

Make sure code compiles via `iota move test`.
```

## ✅ Step 7 — Codex Prompt（測試）

```
You are Codex. Create a complete test module:

    module weiya_master::lottery_tests;

This test suite MUST validate Step 7:
    create_lottery
    join_lottery
    execute_lottery

Use EXACT rules from [SPEC.md](SPEC.md) + [roadmap.md](docs/move/roadmap.md).

============================================================
TEST 1 — test_create_lottery_success
============================================================
Scenario:
- organizer @0x1 creates an Activity
- call create_lottery
Assert:
- activity.lottery_id == Some(id)
- lottery.status == OPEN
- pot_coin.value == 0

============================================================
TEST 2 — test_create_lottery_twice_fails
============================================================
- create first lottery (OPEN)
- second create_lottery must abort(E_LOTTERY_ALREADY_ACTIVE)

============================================================
TEST 3 — test_join_lottery_success
============================================================
Scenario:
- activity created, participants joined
- organizer create_lottery → get lottery_id
- @0x2 join_lottery with amount 50
Assert:
- pot_coin.value == 50
- participants vector contains @0x2

============================================================
TEST 4 — test_join_lottery_duplicate_fails
============================================================
- @0x2 already joined
- joining again must abort(E_ALREADY_JOINED_LOTTERY)

============================================================
TEST 5 — test_join_lottery_wrong_participant_fails
============================================================
- An address that did NOT join the activity tries to join lottery → expect abort(E_NOT_ACTIVITY_PARTICIPANT)

============================================================
TEST 6 — test_execute_lottery_success
============================================================
Scenario:
- @0x2 deposit 40
- @0x3 deposit 60
- pot = 100
- execute_lottery
Assert:
- lottery.status == DRAWN
- winner_addr matches returned index
- pot_coin.value == 0
- winner receives correct amount 100

============================================================
TEST 7 — test_execute_lottery_no_participant_fails
============================================================
- lottery has 0 participants
- execute_lottery must abort(E_NO_LOTTERY_PARTICIPANT)

============================================================
TEST 8 — test_execute_lottery_wrong_caller_fails
============================================================
- Non-organizer tries execute → abort(E_NOT_ORGANIZER)

============================================================
TEST 9 — test_execute_lottery_invalid_status_fails
============================================================
- lottery.status changed to DRAWN
- execute again must abort(E_INVALID_LOTTERY_STATUS)

============================================================
Rules:
============================================================
- Tests must run under `iota move test`
- Delete UIDs using object::delete where needed
- Use #[expected_failure] annotations for fail cases

============================================================
OUTPUT
============================================================
Return the FULL file:
    contracts/tests/lottery_tests.move
as a complete code block.
```

## Step 8A：四選一遊戲（Game）核心互動邏輯：submit_choice + reveal_game_answer

```
You are Codex working on the IOTA Move smart contract defined in [SPEC.md](SPEC.md) and [roadmap.md](docs/move/roadmap.md).

Your task:
Implement Step 8A — Game Interaction Logic inside:
    contracts/sources/annual_party.move

This step includes:
    - submit_choice
    - reveal_game_answer
    - GameParticipation creation
    - correct_option + total_correct calculation
    - SINGLE / AVERAGE winner selection (but DO NOT transfer any reward)
    - update Game.status: OPEN → ANSWER_REVEALED

Below is the full specification for Step 8A.

------------------------------------------------------------
1. submit_choice
------------------------------------------------------------
Signature:
public entry fun submit_choice(
    user: &signer,
    activity_id: ID,
    game_id: ID,
    activity: &Activity,
    game: &mut Game,
    ctx: &mut TxContext
)

Rules:
- Ensure game.status == OPEN else abort(E_GAME_NOT_OPEN)
- Find participant object for this user:
    * must exist and participant.joined == true
- choice must be in {1,2,3,4}, else abort(E_INVALID_GAME_CHOICE)
- Ensure (game_id, user_addr) has NO prior GameParticipation object
  → If found, abort(E_ALREADY_SUBMITTED_CHOICE)
- Create a new GameParticipation object:
    {
        id: UID,
        game_id,
        activity_id,
        owner = signer::address_of(user),
        choice,
        is_correct = false,
        has_claimed_reward = false
    }
- transfer to user
(No event needed here.)

------------------------------------------------------------
2. reveal_game_answer
------------------------------------------------------------
Signature:
public entry fun reveal_game_answer(
    organizer: &signer,
    activity_id: ID,
    game_id: ID,
    activity: &mut Activity,
    game: &mut Game,
    correct_option: u8,
    client_seed: u64,
    ctx: &mut TxContext
)

Rules:
- caller must be organizer else abort(E_NOT_ORGANIZER)
- game.status == OPEN else abort(E_GAME_NOT_OPEN)
- correct_option in {1,2,3,4} else abort(E_INVALID_GAME_CHOICE)
- Iterate all GameParticipation objects belonging to this game:
    if participation.choice == correct_option:
        participation.is_correct = true
        game.total_correct += 1
- Update game.correct_option = Some(correct_option)
- Winner selection:
    if game.reward_mode == SINGLE:
        if total_correct > 0:
            - Build vector<address> of correct participants
            - random_u64 = hash(block_hash || tx_hash || caller || client_seed)
            - idx = random_u64 % correct_set.length
            - game.winner_addr = Some(correct_set[idx])
    else (AVERAGE):
        winner_addr = None
- game.status = ANSWER_REVEALED
- Emit GameAnswerRevealedEvent(activity_id, game_id, correct_option)

------------------------------------------------------------
3. Winner selection random number
------------------------------------------------------------
Use unified RNG from SPEC:

random_u64 = hash(block_hash || tx_hash || caller || client_seed)
idx = random_u64 % n

Use tx_context::digest for the tx hash equivalent.

------------------------------------------------------------
4. OUTPUT
------------------------------------------------------------
Return the entire updated:
    contracts/sources/annual_party.move
as a single complete code block.

Ensure the code compiles under `iota move test`.
```

## ✅ Step 8A — Codex Prompt B（測試）

```
You are Codex. Create a full Move test module:

    module weiya_master::game_step8a_tests;

This test suite MUST validate Step 8A:
    - submit_choice
    - reveal_game_answer

Use EXACT rules from [SPEC.md](SPEC.md) + [roadmap.md](docs/move/roadmap.md).

============================================================
TEST 1 — test_submit_choice_success
============================================================
Scenario:
- organizer creates activity
- user @0x2 joins activity
- organizer creates game
- @0x2 submit_choice(game_id, choice=2)
Assert:
- GameParticipation exists with:
    owner == @0x2
    choice == 2
    is_correct == false
    has_claimed_reward == false

============================================================
TEST 2 — test_submit_choice_twice_fails
============================================================
- @0x2 already submitted
- second submit must abort(E_ALREADY_SUBMITTED_CHOICE)

============================================================
TEST 3 — test_submit_choice_invalid_option_fails
============================================================
- choice = 5
- abort(E_INVALID_GAME_CHOICE)

============================================================
TEST 4 — test_submit_choice_game_not_open_fails
============================================================
- change game.status = ANSWER_REVEALED
- submit_choice must abort(E_GAME_NOT_OPEN)

============================================================
TEST 5 — test_reveal_answer_average_success
============================================================
Scenario:
- 3 participants choose:
    @0x2 → 1
    @0x3 → 1
    @0x4 → 2
- reward_mode = AVERAGE
- reveal_game_answer(correct_option=1)
Assert:
- game.total_correct == 2
- both @0x2 and @0x3 participation.is_correct == true
- @0x4 is_correct == false
- game.winner_addr == None
- game.status == ANSWER_REVEALED

============================================================
TEST 6 — test_reveal_answer_single_success
============================================================
Scenario:
- 2 correct answers: @0x2, @0x3
- reward_mode = SINGLE
- Using deterministic seed, ensure winner chosen is stable
Assert:
- game.total_correct == 2
- game.winner_addr == one of {@0x2, @0x3}
- status == ANSWER_REVEALED

============================================================
TEST 7 — test_reveal_answer_invalid_option_fails
============================================================
- correct_option = 7
- abort(E_INVALID_GAME_CHOICE)

============================================================
TEST 8 — test_reveal_answer_not_open_fails
============================================================
- game.status = CLOSED
- reveal must abort(E_GAME_NOT_OPEN)

============================================================
TEST 9 — test_reveal_answer_not_organizer_fails
============================================================
- Non-organizer calls reveal
- abort(E_NOT_ORGANIZER)

============================================================
Rules
============================================================
- use #[expected_failure] for fail tests
- ensure object::delete is used properly for UIDs
- tests must be runnable with `iota move test`

============================================================
OUTPUT
============================================================
Return only:
    contracts/tests/game_step8a_tests.move
as a full code block.
```

## Step 8B：四選一遊戲（Game）獎勵領取 claim_game_reward

```
You are Codex working on the IOTA Move smart contract defined in [SPEC.md](SPEC.md) and [roadmap.md](docs/move/roadmap.md).

Your task:
Implement Step 8B — claim_game_reward inside:
    contracts/sources/annual_party.move

This step is the continuation of Step 8A.

------------------------------------------------------------
OBJECTIVES
------------------------------------------------------------
Implement the following entry function exactly per SPEC:

public entry fun claim_game_reward(
    user: &signer,
    activity_id: ID,
    game_id: ID,
    activity: &mut Activity,
    game: &mut Game,
    participation: &mut GameParticipation,
    ctx: &mut TxContext
)

------------------------------------------------------------
RULES FROM SPEC
------------------------------------------------------------

1. Validate Participation
------------------------------------------------------------
- participation.owner == signer::address_of(user)
  else abort(E_NOT_GAME_WINNER)
- participation.game_id == game_id
  else abort(E_GAME_NOT_FOUND)
- participation.is_correct == true
  else abort(E_NOT_GAME_WINNER)
- participation.has_claimed_reward == false
  else abort(E_GAME_REWARD_ALREADY_CLAIMED)

2. Validate Game
------------------------------------------------------------
- game.status == ANSWER_REVEALED
  else abort(E_GAME_NOT_ANSWER_REVEALED)

3. Determine reward amount
------------------------------------------------------------

AVERAGE mode:
    per = game.reward_amount / game.total_correct
    amount = per

SINGLE mode:
    if game.winner_addr != Some(user_addr):
        abort(E_NOT_GAME_WINNER)
    amount = game.reward_amount

4. Deduct from Activity prize pool
------------------------------------------------------------
- Ensure activity.prize_pool_coin has >= amount
  else abort(E_INSUFFICIENT_PRIZE_POOL)

- Split amount from activity.prize_pool_coin:
    let coin_out = Coin<IOTA> { value: amount };

- deposit_iota(user_addr, coin_out)

5. Update Participation
------------------------------------------------------------
- participation.has_claimed_reward = true

6. If ALL correct participants have claimed:
------------------------------------------------------------
- Optional optimization: set game.status = CLOSED
  (Codex: please implement this.)

Criteria:
- For AVERAGE: closed when all correct participations have has_claimed_reward = true.
- For SINGLE: closed instantly after the single winner claims.

7. Emit:
------------------------------------------------------------
event::emit(GameRewardClaimedEvent {
    activity_id,
    game_id,
    participant_addr: user_addr,
    amount,
});

------------------------------------------------------------
RNG + winner-selection code is already implemented in Step 8A, DO NOT modify it.

------------------------------------------------------------
OUTPUT
------------------------------------------------------------
Return the entire updated:
    contracts/sources/annual_party.move
as a single complete code block.

Ensure code compiles using `iota move test`.
```

## ✅ Step 8B — Codex Prompt B（測試檔）

```
You are Codex. Create a full Move test module:

    module weiya_master::game_step8b_claim_reward_tests;

This test suite MUST validate Step 8B:
    - claim_game_reward for Game SINGLE mode
    - claim_game_reward for Game AVERAGE mode
    - all failure cases per [SPEC.md](SPEC.md)

============================================================
TEST 1 — test_claim_reward_average_success
============================================================
Scenario:
- organizer creates activity
- participants @0x2, @0x3, @0x4 join
- organizer creates game (reward_amount = 90, mode=AVERAGE)
- choices:
    @0x2 → 1
    @0x3 → 1
    @0x4 → 2
- organizer reveals correct_option = 1
    total_correct = 2
    per = 45
- @0x2 calls claim_game_reward → gets 45
- @0x3 calls claim_game_reward → gets 45
- Assert:
    participation.has_claimed_reward == true
    activity.prize_pool_coin decreased by 90
    game.status becomes CLOSED once all correct participants claim

============================================================
TEST 2 — test_claim_reward_single_success
============================================================
Scenario:
- 2 correct participants: @0x2, @0x3
- reward_mode = SINGLE
- winner_addr deterministic
- ONLY winner can claim reward_amount (e.g., 50)
- game.status becomes CLOSED immediately after claim

============================================================
TEST 3 — test_claim_reward_twice_fails
============================================================
- user claims once successfully
- second claim must abort(E_GAME_REWARD_ALREADY_CLAIMED)

============================================================
TEST 4 — test_claim_reward_wrong_user_fails
============================================================
- user who is NOT in winner set calls
- abort(E_NOT_GAME_WINNER)

============================================================
TEST 5 — test_claim_reward_before_reveal_fails
============================================================
- game.status = OPEN
- claim must abort(E_GAME_NOT_ANSWER_REVEALED)

============================================================
TEST 6 — test_claim_reward_insufficient_pool_fails
============================================================
- artificially reduce prize_pool_coin below required amount
- must abort(E_INSUFFICIENT_PRIZE_POOL)

============================================================
TEST 7 — test_claim_reward_wrong_game_id_fails
============================================================
- participation.game_id != game_id passed to function
- abort(E_GAME_NOT_FOUND)

============================================================
OUPUT
============================================================
Return only:
    contracts/tests/game_step8b_claim_reward_tests.move
as a full single code block compatible with `iota move test`.

```

## ✅ Codex Prompt：Step 9 – Integration Flow Tests（整合測試）

```
You are Codex working on the IOTA Move project.

Goal:
Create a high-level integration test module that runs end-to-end flows across:
- Activity
- Bonus
- Prize Draw
- Lottery
- Game (SINGLE & AVERAGE)
- Close activity & withdraw remaining

File to create:

    contracts/tests/integration_flow_tests.move

Module name suggestion:

    module weiya_master::integration_flow_tests { ... }

You must assume the main contract is:

    module weiya_master::annual_party;

and it already contains all entry functions from previous steps:
- create_activity
- join_activity
- add_prize_fund
- create_bonus_event
- claim_bonus
- draw_prize
- create_lottery
- join_lottery
- execute_lottery
- create_game
- submit_choice
- reveal_game_answer
- claim_game_reward
- close_activity
- claim_close_reward
- withdraw_remaining_after_close

Imports to use (you may add more if needed):

    use weiya_master::annual_party;
    use iota::tx_context;
    use iota::object;
    use std::string;
    use std::vector;

============================================================
TEST 1 — test_full_activity_bonus_and_close_flow
============================================================

Scenario:
1. Setup:
   - TxContext with organizer @0x1.
   - Call annual_party::create_activity(...) to create an Activity with initial prize pool = 1000.
   - Get a local `Activity` value you can mutate in tests.

2. 3 employees join:
   - addresses: @0x2, @0x3, @0x4
   - Simulate join_activity behavior:
       - either by directly calling entry fun join_activity
         OR by constructing Participant objects and pushing into activity.participants, depending on how previous tests are written.
   - Ensure activity.participant_count == 3.

3. Create bonus event:
   - bonus_per_user = 100
   - call create_bonus_event.
   - Expect:
       - activity.has_bonus_event == true
       - activity.bonus_amount_per_user == 100.

4. Each participant claims bonus:
   - @0x2 claim_bonus(...)
   - @0x3 claim_bonus(...)
   - @0x4 claim_bonus(...)
   - Assert:
       - their Participant.has_claimed_bonus == true
       - activity.prize_pool_coin.value decreased by 300 from initial.

5. Close activity:
   - call close_activity(organizer, activity_id, &mut activity, ...)
   - Assert:
       - activity.status == CLOSED
       - close_payout_amount == remaining_pool / 3 (use the actual values).

6. Two participants claim close reward:
   - @0x2 claim_close_reward
   - @0x3 claim_close_reward
   - Assert:
       - their has_claimed_close_reward == true
       - activity.remaining_pool_after_close decreased accordingly.

7. Organizer withdraws remaining:
   - withdraw_remaining_after_close(organizer, ...)
   - Assert:
       - activity.prize_pool_coin.value == 0
       - activity.remaining_pool_after_close == 0.

This test is mainly about checking the entire life-cycle does not abort
and the core fields on Activity / Participant are updated correctly.

============================================================
TEST 2 — test_full_lottery_flow
============================================================

Scenario:
1. Create Activity with organizer @0x1 and prize_pool 0 or some small base.
2. Two participants join Activity: @0x2, @0x3.
3. Organizer calls create_lottery for this Activity.
4. @0x2 join_lottery with amount 40
5. @0x3 join_lottery with amount 60
6. Execute lottery:
   - organizer calls execute_lottery with some client_seed
   - Assert:
       - lottery.status == DRAWN
       - lottery.pot_coin.value == 0
       - lottery.winner is Some(addr) and is either @0x2 or @0x3.

Note:
- Since we do not have a global balance tracker,
  you only need to verify lottery state, not actual account balances.

============================================================
TEST 3 — test_full_game_average_flow
============================================================

Scenario:
1. Create Activity with organizer @0x1 and sufficient prize_pool (e.g. 1000).
2. Participants @0x2, @0x3, @0x4 join Activity.
3. Organizer creates a Game:
   - question "Q1"
   - options ["A","B","C","D"]
   - reward_amount = 90
   - mode = GameRewardMode::AVERAGE.

4. All three submit_choice:
   - @0x2 → choice 1
   - @0x3 → choice 1
   - @0x4 → choice 2

5. Organizer calls reveal_game_answer(correct_option=1, client_seed=123).
   - Assert:
       - game.status == ANSWER_REVEALED
       - game.total_correct == 2

6. Both correct participants claim reward:
   - @0x2 claim_game_reward(...)
   - @0x3 claim_game_reward(...)
   - Each should receive 45 (conceptually).
   - Assert:
       - their GameParticipation.has_claimed_reward == true
       - game.status eventually becomes CLOSED when all correct have claimed
         (if your implementation supports this).

============================================================
TEST 4 — test_full_game_single_flow
============================================================

Scenario:
1. Same as average test, but:
   - reward_amount = 100
   - mode = SINGLE
   - At least 2 participants answer correctly.

2. reveal_game_answer:
   - game.reward_mode == SINGLE
   - some correct winner is chosen via RNG.

3. Winner calls claim_game_reward:
   - receives full 100
   - game.status == CLOSED after claim.

4. Non-winner trying to claim must abort(E_NOT_GAME_WINNER).
   Use #[expected_failure] for that negative case in a separate test function,
   e.g. test_full_game_single_flow_non_winner_fails.

============================================================
GENERAL IMPLEMENTATION NOTES
============================================================

- Reuse helper patterns from your previous test modules
  (e.g., how to create dummy TxContext, how to construct Activity / Participant / Game / Lottery objects).
- Always clean up UIDs via object::delete at the end of tests.
- You may create small internal helper functions in the test module
  to reduce repetition (creating dummy Activity, participants, etc.).

- Positive tests use #[test].
- For the negative sub-case in Test 4 (non-winner fails), use #[expected_failure].

============================================================
OUTPUT
============================================================

Return the full content of:

    contracts/tests/integration_flow_tests.move

as a single complete code block, ready to compile with `iota move test`.
```


