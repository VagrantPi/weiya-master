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