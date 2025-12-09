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




