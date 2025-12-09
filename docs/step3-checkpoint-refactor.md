## Codex Prompt（1）：修改 Activity + join_activity + draw_prize + 新的抽獎測試

```
Goal:
Refactor the draw-prize eligibility logic to be Activity-centric, according to the updated spec:
- Activity has `eligible_flags: vector<bool>` aligned with `participants`.
- Participant no longer stores `eligible_for_draw`.
- draw_prize uses Activity.eligible_flags to decide and update winner eligibility.

Files:
- contracts/sources/annual_party.move
- contracts/tests/draw_tests.move (create or overwrite as needed)

----------------------------------------
Part 1: Update Activity / Participant types
----------------------------------------

In `contracts/sources/annual_party.move`:

1. Modify `struct Activity`:
   - Add a new field:
       `eligible_flags: vector<bool>,`
     right after `participants: vector<address>,`
   - Ensure all Activity initializations (including tests and helper functions) now also initialize:
       `eligible_flags: vector[]` or an appropriate vector of `false`/`true`.

2. Modify `struct Participant`:
   - Remove the field `eligible_for_draw: bool`.
   - Update all Participant initializations accordingly.

----------------------------------------
Part 2: Update join_activity
----------------------------------------

Update `public entry fun join_activity(...)` in `annual_party.move`:

- After pushing `user_addr` to `activity.participants`, also push `true` into `activity.eligible_flags`.
- Ensure `participants` and `eligible_flags` always have the same length.
- Remove any logic that tries to rely on Participant.eligible_for_draw, since it no longer exists.

----------------------------------------
Part 3: Rewrite draw_prize using eligible_flags
----------------------------------------

Refactor `public entry fun draw_prize(...)` in `annual_party.move`:

Requirements (implement exactly):

1. Validate:
   - `activity_id` matches `object::id(activity)`.
   - caller == `activity.organizer`.
   - `balance_of_iota(&activity.prize_pool_coin) >= amount`.
   - `vector::length(&activity.participants) > 0`.
   - There is at least one `true` inside `activity.eligible_flags`; otherwise abort with `E_NO_ELIGIBLE_FOR_DRAW`.

2. Random selection:
   - Let `n = vector::length(&activity.participants)`.
   - Compute `random_u64` from `sha3_256` over:
       `tx_digest || organizer_addr || client_seed`
     (reuse your current hashing approach).
   - Let `start = random_u64 % n`.
   - Perform a single full linear scan over indices `[0..n)` in "circular" fashion:
       - Starting from `start`, check indices:
           `start, start+1, ..., n-1, 0, 1, ..., start-1`
       - Find the first index `i` such that `eligible_flags[i] == true`.
       - If no such index exists, abort with `E_NO_ELIGIBLE_FOR_DRAW`.

3. Winner:
   - Let `winner_index` be the found index, `winner_addr = activity.participants[winner_index]`.
   - Set `activity.eligible_flags[winner_index] = false`.

4. Payout:
   - Decrease `activity.prize_pool_coin.value` by `amount`.
   - Create a new `Coin<IOTA> { value: amount }`.
   - `deposit_iota(winner_addr, coin_out)`.

5. Emit:
   - `PrizeDrawExecutedEvent { activity_id, winner_addr, amount }`.

----------------------------------------
Part 4: Implement proper draw_prize tests
----------------------------------------

Create or overwrite `contracts/tests/draw_tests.move` with the following tests:

1. `test_draw_prize_single_success`
   - Create an Activity with prize_pool = 300.
   - Add 3 participants: @0x2, @0x3, @0x4 (using join_activity).
   - Call `draw_prize` once with `amount = 100`.
   - Assert:
       - Exactly one entry in `eligible_flags` is false; the others remain true.
       - prize_pool decreased by 100.
       - Winner address is one of the participants.

2. `test_draw_prize_no_eligible_participants_fails`
   - Build an Activity and participants similarly.
   - Manually set all `eligible_flags` entries to false.
   - Call `draw_prize` and expect abort with `E_NO_ELIGIBLE_FOR_DRAW`.

3. `test_draw_prize_twice_no_double_winner_when_enough_participants`
   - Activity with 3 participants and sufficient prize_pool.
   - Call `draw_prize` twice (with deterministic client_seed).
   - Assert:
       - At the end, at least 2 distinct indices in `eligible_flags` are false.
       - No single participant has been used as winner twice (deduce from flags and balances).

4. `test_draw_prize_wrong_caller_fails`
   - Activity created by @0x1.
   - @0x2 tries to call `draw_prize`.
   - Expect abort with `E_NOT_ORGANIZER`.

----------------------------------------
Rules:
----------------------------------------
- Do NOT introduce any new global registry.
- Keep the existing IOTA Coin abstraction (`Coin<IOTA> { value: u64 }`) as is.
- Preserve other entry functions and structs as much as possible.
- All tests must pass under `iota move test`.

----------------------------------------
Output:
----------------------------------------
- Return the FULL updated `annual_party.move` module.
- Return the FULL `draw_tests.move` file.
```


## Codex Prompt（2）：把 #[test_only] 搬出 module，移到 tests/

```
Goal:
Move ALL `#[test_only]` functions out of the production module `contracts/sources/annual_party.move`
into proper test modules under `contracts/tests/`, and clean up the source file so it only contains business logic.

Files:
- contracts/sources/annual_party.move
- contracts/tests/*.move (create multiple as needed)

----------------------------------------
Part 1: Identify existing test_only functions
----------------------------------------

In `annual_party.move`, find all functions annotated with `#[test_only]`, such as:
- `structs_and_enums_smoke`
- `test_create_activity_success_inner`
- `test_join_activity_success_inner`
- `test_join_activity_double_join_fails_inner`
- `test_add_prize_fund_success_inner`
- `test_add_prize_fund_wrong_caller_fails_inner`
- `test_create_bonus_event_success_inner`
- `test_create_bonus_event_insufficient_pool_fails_inner`
- `test_claim_bonus_success_inner`
- `test_claim_bonus_double_claim_fails_inner`
- `test_claim_bonus_without_bonus_event_fails_inner`
(and any others you find)

Remove ALL of these from `annual_party.move`.

----------------------------------------
Part 2: Create separate test modules under contracts/tests
----------------------------------------

Create new test files under `contracts/tests/`:

1. `structs_smoke_tests.move`
   - Contains a `module` with `#[test]` function(s) that reproduce the behavior of `structs_and_enums_smoke`.
   - Use `iota::tx_context::dummy()` or `new_from_hint` as needed.
   - Use `use weiya_master::annual_party;` to import structs and types when needed.
   - Ensure all UIDs are eventually deleted.

2. `activity_tests.move`
   - Contains test functions equivalent to:
       - `test_create_activity_success_inner`
       - `test_join_activity_success_inner`
       - `test_join_activity_double_join_fails_inner`
       - `test_add_prize_fund_success_inner`
       - `test_add_prize_fund_wrong_caller_fails_inner`
   - Each should be annotated with `#[test]`.
   - Instead of directly constructing structs in the module, prefer calling the public entry functions when possible.
   - When direct struct construction is needed, do it locally in the test module.

3. `bonus_tests.move`
   - Contains tests corresponding to:
       - `test_create_bonus_event_success_inner`
       - `test_create_bonus_event_insufficient_pool_fails_inner`
       - `test_claim_bonus_success_inner`
       - `test_claim_bonus_double_claim_fails_inner`
       - `test_claim_bonus_without_bonus_event_fails_inner`
   - Convert them into proper `#[test]` functions.
   - Where previous tests aborted directly with an error code, now:
       - Use `#[expected_failure]` annotations or the testing framework's pattern to assert the correct abort code.

4. (Optional) Any other `*_inner` tests:
   - Group them into appropriate test files based on domain (lottery, game, close, etc.) as you implement later steps.

----------------------------------------
Part 3: Enforce test location rules
----------------------------------------

- After refactoring:
  - `contracts/sources/annual_party.move` MUST NOT contain any `#[test_only]` functions.
  - All tests MUST live in `contracts/tests/*.move` and use `#[test]`.

- Ensure imports in test modules:
  - `use weiya_master::annual_party;`
  - Any std/iota modules needed (e.g., `iota::tx_context`, `iota::object`, `std::vector`, `std::string`).

----------------------------------------
Part 4: Final check
----------------------------------------

- Run `iota move test` conceptually and ensure:
  - All new tests compile.
  - All previously working tests still pass.
  - There are no leftover `#[test_only]` functions inside `annual_party.move`.

----------------------------------------
Output:
----------------------------------------
- The cleaned-up `annual_party.move` (without any #[test_only] functions).
- The full contents of:
    - `structs_smoke_tests.move`
    - `activity_tests.move`
    - `bonus_tests.move`
  and any other test files you created.
```