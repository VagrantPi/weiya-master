## ✅ Codex Prompt：Step 0（型別骨架）

```
You are Codex working on a Move project created with `iota move new contracts`.

Goal:
Implement Step 0 of [MoveDevRoadmap.md](docs/MoveDevRoadmap.md)  by generating the full type skeleton for the Annual Party DApp based on [SPEC.md](SPEC.md)  and [AGENTS.md](AGENTS.md) .

Instructions:
- Edit `contracts/sources/annual_party.move`
- Do NOT implement any entry logic yet.
- Only create:
  - enums:
      ActivityStatus, LotteryStatus, GameStatus, GameRewardMode
  - structs:
      Activity, Participant, Lottery, Game, GameParticipation
  - event structs (according to SPEC.md)
  - error codes (constants)
- Follow the object-based IOTA Move model:
  - Activity is a shared object (key)
  - All others are owned objects (key)
  - Use UID for all objects
- Include placeholder fields for original IOTA coin handling:
    prize_pool_coin: Coin<IOTA>
    pot_coin: Coin<IOTA>
- Ensure all fields match SPEC.md exactly.

Output:
- The entire updated `annual_party.move` file as a complete code block.
- After generating code, verify all structs compile, but do not add any functions yet.
```

## ✅ Codex Prompt：Step 0 測試（型別 smoke test）

```
Create a new test file at `contracts/tests/structs_smoke_tests.move`.

Goal:
Implement a minimal smoke test to ensure all structs and enums defined in Step 0 compile.

Requirements:
- Import the annual_party module
- Instantiate dummy values of:
    ActivityStatus
    LotteryStatus
    GameStatus
    GameRewardMode
    Activity
    Participant
    Lottery
    Game
    GameParticipation
- Do NOT publish objects. Only construct them in memory.
- The test should pass with `iota move test`.

Output:
- The entire `structs_smoke_tests.move` file as a complete code block.
```

## ✅ Codex Prompt：Step 1（create_activity / join_activity / add_prize_fund）

```
Proceed with Step 1 of [MoveDevRoadmap.md](docs/MoveDevRoadmap.md).

Task:
Implement the following entry functions inside `contracts/sources/annual_party.move`:

1. public entry fun create_activity(
        organizer: &signer,
        name: String,
        initial_amount: u64
   )
   - Withdraw initial_amount of IOTA from organizer.
   - Initialize Activity fields exactly as defined in SPEC.md.
   - Create a shared Activity object.
   - Set status = OPEN.
   - participants = empty vector.
   - participant_count = 0.
   - Store initial IOTA coins into activity.prize_pool_coin.
   - Emit ActivityCreated.

2. public entry fun join_activity(
        user: &signer,
        activity_id: ID
   )
   - Load shared Activity.
   - Abort if status != OPEN.
   - Abort if the user already joined (check Participant existence OR user in participants vector).
   - Create a Participant object owned by the user.
   - Push user address into activity.participants.
   - Increase participant_count by 1.
   - Emit ParticipantJoined.

3. public entry fun add_prize_fund(
        organizer: &signer,
        activity_id: ID,
        amount: u64
   )
   - Only organizer may call.
   - Withdraw `amount` of IOTA.
   - Merge the withdrawn coins into activity.prize_pool_coin.
   - Emit PrizePoolIncreased.

Rules:
- Follow object-based design (no registry).
- Follow [SPEC.md](SPEC.md) field names exactly.
- Follow error codes defined in Step 0.
- Write clean, fully compilable Move code.

Output:
- Provide the FULL updated `annual_party.move` module as a complete code block.
```

## ✅ Codex Prompt：Step 1 測試 Test Suite

```
Create test file: `contracts/tests/activity_tests.move`.

Implement the following tests:

1. test_create_activity_success
   - organizer @0x1
   - create_activity("PartyA", 1000)
   - Assert:
        status == OPEN
        participant_count == 0
        prize_pool_coin == 1000
        name == "PartyA"

2. test_join_activity_success
   - organizer @0x1 creates activity
   - user @0x2 joins
   - assert:
        participant_count == 1
        participants contains @0x2
        Participant object exists

3. test_join_activity_double_join_fails
   - user @0x2 attempts to join twice → abort with the correct error code

4. test_add_prize_fund_success
   - organizer adds additional 500 IOTA
   - assert prize_pool updates correctly

5. test_add_prize_fund_wrong_caller_fails
   - @0x2 attempts to call add_prize_fund → abort with E_NOT_ORGANIZER

Requirements:
- Use Move testing’s built-in signers (@0x1, @0x2).
- Verify object fields precisely.
- Tests must pass with `iota move test`.

Output:
- Provide complete contents of `activity_tests.move` as a full code block.
```

## ✅ Codex Prompt：Step 2 – Bonus Event（create_bonus_event / claim_bonus）

```
You are Codex working on the Move project described in [SPEC.md](SPEC.md) and [MoveDevRoadmap.md](docs/MoveDevRoadmap.md) .

Goal:
Implement Step 2 of the roadmap:
- Bonus Event creation
- Bonus claiming
- Corresponding tests

Files involved:
- contracts/sources/annual_party.move
- contracts/tests/bonus_tests.move

------------------------------------
Implement in annual_party.move:
------------------------------------

Add or complete the following entry functions exactly as defined in [SPEC.md](SPEC.md) :

1. public entry fun create_bonus_event(
        organizer: &signer,
        activity_id: ID,
        bonus_per_user: u64
   )

Requirements:
- Only the organizer may call.
- activity.status must be OPEN (or ACCEPTABLE according to your previous Step 1 structure).
- activity.has_bonus_event must be false.
- participant_count must be > 0.
- required = bonus_per_user * participant_count.
- activity.prize_pool_coin must contain >= required.
- DOES NOT withdraw any coins now.
- Only updates:
     activity.has_bonus_event = true;
     activity.bonus_amount_per_user = bonus_per_user;
- Emit BonusEventCreated(activity_id, bonus_per_user).

2. public entry fun claim_bonus(
        user: &signer,
        activity_id: ID
   )

Requirements:
- user must have already joined the activity.
- activity.has_bonus_event must be true.
- participant.has_claimed_bonus must be false.
- Split `bonus_amount_per_user` from activity.prize_pool_coin.
- Deposit the split coin to the user.
- participant.has_claimed_bonus = true.
- Emit BonusClaimed(activity_id, user_address, bonus_amount_per_user).

------------------------------------
Rules:
------------------------------------
- Use IOTA native coin handling as described in [SPEC.md](SPEC.md) .
- Use error codes from Step 0 for all abort conditions.
- The updated module must compile cleanly with iota move test.
- Preserve existing Step 0/1 code; do NOT remove previous functions.

------------------------------------
Output:
------------------------------------
Return the FULL updated `annual_party.move` file in one complete code block.
```

## ✅ Codex Prompt：Step 2 – Bonus Tests

```
Create a new file: `contracts/tests/bonus_tests.move`.

Implement the following tests, fully matching the behavior in [SPEC.md](SPEC.md) .

1. test_create_bonus_event_success
   - organizer @0x1 creates activity with prize_pool = 1000.
   - @0x2, @0x3 join the activity.
   - call create_bonus_event(activity_id, 100).
   - assert:
        activity.has_bonus_event == true
        activity.bonus_amount_per_user == 100

2. test_create_bonus_event_insufficient_pool_fails
   - prize_pool only has 100.
   - 3 participants join.
   - bonus_per_user = 50 → required = 150.
   - create_bonus_event must abort with E_INSUFFICIENT_PRIZE_POOL.

3. test_claim_bonus_success
   - activity with 2 participants.
   - bonus_per_user = 100.
   - @0x2 calls claim_bonus.
   - assert:
        participant.has_claimed_bonus == true
        prize_pool_coin reduced by exactly 100
        user @0x2 receives 100 IOTA

4. test_claim_bonus_double_claim_fails
   - @0x2 claims first time OK.
   - second claim must abort with correct error code.

5. test_claim_bonus_without_bonus_event_fails
   - no create_bonus_event was called.
   - claim_bonus should abort.

------------------------------------
Rules:
------------------------------------
- Use Move test signers (@0x1, @0x2, @0x3).
- Validate object fields precisely.
- Tests must pass under `iota move test`.

------------------------------------
Output:
------------------------------------
Return the FULL file `bonus_tests.move` in one complete code block.
```

## ✅ Codex Prompt：Step 3 – 實作 draw_prize（抽獎）

```
You are Codex working on the Move project defined by [SPEC.md](SPEC.md) and [MoveDevRoadmap.md](docs/MoveDevRoadmap.md) .

Goal:
Implement Step 3 — draw_prize — inside `contracts/sources/annual_party.move`

------------------------------------
Implement the following entry function:
------------------------------------

public entry fun draw_prize(
    organizer: &signer,
    activity_id: ID,
    amount: u64,
    client_seed: u64
)

Function requirements (follow [SPEC.md](SPEC.md) EXACTLY):

1. Organizer-only
   - signer::address_of(organizer) must equal activity.organizer
   - Otherwise abort(E_NOT_ORGANIZER)

2. Activity & participant validation
   - Load Activity as shared object.
   - activity.prize_pool_coin must contain >= amount.
   - There must be at least one participant with eligible_for_draw == true.
   - Use the Activity.participants vector as the candidate pool.

3. Random selection (simplified deterministic hash model)
   - Compute:
       random_u64 = hash(block_hash || tx_hash || signer_addr || client_seed)
       idx = random_u64 % participants.length
   - If the selected participant's eligible flag is false:
       - Perform a simple linear scan forward (wrapping around with modulo)
       - Choose the first participant whose eligible_for_draw == true.
       - If none exist → abort(E_NO_ELIGIBLE_FOR_DRAW)

4. Winner handling
   - Let winner_addr = participants[idx]
   - Load the corresponding Participant object.
   - Set participant.eligible_for_draw = false

5. Payout
   - Split `amount` out of activity.prize_pool_coin
   - Deposit the split coins into winner_addr

6. Event
   - Emit PrizeDrawExecuted(activity_id, winner_addr, amount)

------------------------------------
Coding rules:
------------------------------------
- DO NOT break Step 0/1/2 functions.
- Use the SAME field names as in [SPEC.md](SPEC.md) .
- Do NOT redesign data structures.
- Use existing error constants.
- Fully compile under `iota move test`.

------------------------------------
Output:
------------------------------------
Return the FULL updated `annual_party.move` module as ONE complete code block.
```

## ✅ Codex Prompt：Step 3 – Test Suite（抽獎）

```
Create new test file: `contracts/tests/draw_tests.move`.

Implement ALL the following tests exactly:

--------------------------------------------------
1. test_draw_prize_success
--------------------------------------------------
Scenario:
- @0x1 organizer creates activity with initial_amount = 500.
- @0x2, @0x3, @0x4 join the activity.
- All participants should have eligible_for_draw == true.
- Organizer calls draw_prize(activity_id, 100, client_seed=1).

Assertions:
- Exactly ONE participant becomes eligible_for_draw == false.
- prize_pool_coin decreases by exactly 100.
- Winner's balance increases by 100.
- Event PrizeDrawExecuted is emitted.

--------------------------------------------------
2. test_draw_prize_no_eligible_participants_fails
--------------------------------------------------
Scenario:
- Organizer creates activity.
- Two participants join.
- Manually set BOTH participant.eligible_for_draw = false.
- draw_prize should abort with E_NO_ELIGIBLE_FOR_DRAW.

--------------------------------------------------
3. test_draw_prize_insufficient_pool_fails
--------------------------------------------------
Scenario:
- Prize pool = 50
- draw_prize(..., amount=100) should abort with E_INSUFFICIENT_PRIZE_POOL

--------------------------------------------------
4. test_draw_prize_wrong_caller_fails
--------------------------------------------------
Scenario:
- @0x2 tries to call draw_prize on an activity created by @0x1.
- Must abort with E_NOT_ORGANIZER.

--------------------------------------------------
5. test_draw_prize_linear_scan_selects_next_eligible
--------------------------------------------------
Scenario:
- Participants: [@0x2, @0x3, @0x4]
- Suppose the random index chosen is @0x2
- Set @0x2.eligible_for_draw = false beforehand
- draw_prize should select @0x3 as winner (the next eligible)
- Validate payout and Eligible flag changes.

--------------------------------------------------
Rules:
--------------------------------------------------
- Use Move test signers @0x1, @0x2, @0x3, @0x4.
- Follow object-based model exactly.
- Tests MUST pass `iota move test`.

--------------------------------------------------
Output:
--------------------------------------------------
Return the FULL contents of `draw_tests.move` as one complete code block.

```
