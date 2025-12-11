
我幫你把目前合約跟 SPEC v3 對起來，看起來主要有「可以修得更貼 spec」的地方大概是這三塊：

1. Lottery 多輪開獎：SPEC 要求「同一時間只能有一個 OPEN 的 Lottery，但可以一輪一輪開」，現在 activity.lottery_id 一旦有值就卡死，沒辦法在第一輪開完後再開第二輪。
2. Game 舊場不能在新場開始後 claim：SPEC 說「沒在下一場開始前領就視為放棄」，現在 claim_game_reward 只檢查 game.status == ANSWER_REVEALED，沒有跟 activity.current_game_id 對齊。
3. close_activity 在沒參加者時的行為：SPEC 說是「平均分配給所有參加者」，但現在如果 participant_count == 0 會直接整數除以 0，跑起來會炸掉，行為不明確。


## 實作

You are Codex working on [annual_party.move](contracts/sources/annual_party.move) (module `weiya_master::annual_party`).

Goal:
Align the Move contract implementation with the high-level spec in three places:

1. Lottery should support multiple rounds per Activity, but at most ONE open at a time.
2. Game rewards from "old games" must not be claimable after a new game has started.
3. `close_activity` must behave well when there are zero participants (no division by zero).

Please perform the following concrete changes:

====================================================
(1) Lottery: allow multiple rounds per Activity
====================================================

Current behavior:
- `Activity.lottery_id: option<ID>` is set in `create_lottery`.
- `create_lottery` aborts with `E_LOTTERY_NOT_OPEN` whenever `lottery_id` is not None.
- `execute_lottery` does NOT reset `activity.lottery_id`.

This means once a Lottery is created, the Activity can never open a second Lottery,
even after the lottery has been executed.

Desired behavior (per spec):
- For each Activity, at most one Lottery can be OPEN at a time.
- After `execute_lottery` finishes (Lottery is DRAWN), the organizer should be able
  to create a new Lottery for the same Activity (next "round").

Implementation change:

1) In `execute_lottery`, at the very end of the function (after emitting `LotteryExecutedEvent`),
   reset the Activity's `lottery_id` to None:

   - Only if the `activity.lottery_id` equals the `lottery_id` we just executed,
     set `activity.lottery_id = option::none<ID>()`.

   Something like (in pseudocode):

```

let stored = &activity.lottery_id;
if (option::is_some<ID>(stored)) {
let stored_id_ref = option::borrow<ID>(stored);
if (*stored_id_ref == lottery_id) {
activity.lottery_id = option::none<ID>();
};
};

```

Adjust to concrete Move syntax.

2) Keep the `create_lottery` guard:

```

if (!option::is_none(&activity.lottery_id)) {
abort E_LOTTERY_NOT_OPEN;
};

```

But now, once `execute_lottery` finishes and resets `lottery_id` to None,
the organizer can open the next round.

3) Update the zh-tw comments above `create_lottery` to reflect that
"同一時間只能有一個開啟中的樂透，但一輪開完後可以再開下一輪".


====================================================
(2) Game: prevent claiming rewards from old games
====================================================

Current behavior:
- `Activity.current_game_id: option<ID>` is set whenever `create_game` is called.
- The spec says: when a new Game is created in the same Activity, the previous Game
is considered "closed for claiming" (late claims are considered forfeited).
- However, `claim_game_reward` only checks:
 - game.status == ANSWER_REVEALED
 - correct choice, winner_addr rules, etc.
It does NOT check whether this Game is still the "current" game of the Activity.

Desired behavior:
- For a given Activity:
- Only the Game referenced by `activity.current_game_id` is claimable.
- If a new Game is created, any older Game must no longer accept claim_game_reward.
- This matches the spec rule "未在下一題開始前領取獎金將視為放棄".

Implementation change:

1) In `claim_game_reward`, after verifying the Activity ID and ownership,
add a check that the `game` being claimed is the current game of this Activity
(or at least: not older than the current one).

Specifically:

- If `activity.current_game_id` is Some(id):
    - If `id != object::id(game)`, then this Game is no longer current.
    - Abort with a suitable error.
      You can re-use `E_GAME_NOT_ANSWER_REVEALED` for this case
      (treated as "not in a valid claiming window"),
      or introduce a new error code like `E_GAME_CLOSED_FOR_CLAIM` if you prefer.
- If `activity.current_game_id` is None`, you may treat it as:
    - no active game → no claim allowed (also abort).

2) Add a short zh-tw comment explaining that:

- `activity.current_game_id` is the "only game that can still be claimed".
- Once a new Game is created and `current_game_id` is updated,
  any older Game will fail `claim_game_reward` and the reward is considered forfeited.

Do NOT introduce any global table. Only use the existing `activity.current_game_id`
and `object::id(game)` to enforce this rule.


====================================================
(3) close_activity: handle zero participants gracefully
====================================================

Current behavior:

```

let total = activity.prize_pool_coin.value;
let count = activity.participant_count;
let avg = total / count;

```

If `count == 0`, this will cause a division-by-zero at runtime.

Desired behavior (per spec intent):

- If there are no participants, `close_activity` should still succeed:
  - The Activity becomes CLOSED.
  - `close_payout_amount` should be 0.
  - All the prize pool remains as `remaining_pool_after_close` and can later
    be withdrawn by the organizer via `withdraw_remaining_after_close`.
- There is simply no one to claim, but the Activity can be closed safely.

Implementation change:

1) In `close_activity`, before computing `avg`, branch on `participant_count`:

   - If `count == 0`:
       - Set `activity.close_payout_amount = 0;`
       - Set `activity.remaining_pool_after_close = total;`
       - Set `activity.status = ActivityStatus::CLOSED;`
       - Emit `ActivityClosedEvent` with `close_payout_amount = 0;`
       - Return.

   - Else:
       - Keep the existing logic:
           - `avg = total / count;`
           - etc.

2) Add a short zh-tw comment clarifying that:
   - "當沒有任何 participant 時，關閉活動會將 close_payout_amount 設為 0，
      由 organizer 之後透過 withdraw_remaining_after_close 領回全部獎金。"

After making these changes, return the full updated content of [annual_party.move](contracts/sources/annual_party.move).

---

## 🧪 給 Codex：補測試的 Prompt（行為測試）

這個是給 Codex 新增 / 修改測試檔用的。你可以讓它改現有 `tests/*.move` 或新增一個專門檔案。

```text
You are Codex. We have updated [annual_party.move](contracts/sources/annual_party.move) to:

- allow multiple lottery rounds per Activity by resetting `activity.lottery_id`
  in `execute_lottery`,
- block claiming rewards from old games once a new game is created
  (using `activity.current_game_id`),
- handle `close_activity` when there are zero participants.

Now add tests to validate these behaviors.

Create or update a test file, for example:

    spec_alignment_tests.move

Inside this file, add the following test functions with #[test] and
#[expected_failure] as appropriate.

=====================================================
1) test_lottery_multi_rounds_per_activity()
=====================================================

Scenario:

- Set up a dummy TxContext and an Activity with an organizer @0x1.
- Call `create_activity` (if easier, you can construct an Activity directly).
- Organizer calls `create_lottery` -> first lottery L1 is created.
- Before executing L1, a second call to `create_lottery` must FAIL with E_LOTTERY_NOT_OPEN.

- Then:
  - Execute L1 with `execute_lottery` (you can mock a simple Lottery with one participant).
  - After `execute_lottery`:
      - `activity.lottery_id` must be None (or effectively treated as no active lottery).
  - Now a new call to `create_lottery` MUST SUCCEED and create a second lottery L2.

Assertions:

- Second `create_lottery` before execution of L1 must be marked #[expected_failure]
  with `E_LOTTERY_NOT_OPEN`.
- After executing L1, `create_lottery` must succeed (no abort), and event or state
  should show a new lottery_id different from L1.


=====================================================
2) test_game_old_round_cannot_claim_after_new_game()
=====================================================

Scenario:

- Create an Activity with organizer @0x1 and prize pool with enough balance.
- Create Game G1 via `create_game` (e.g., mode SINGLE, reward_amount = 100).
- Have a participant @0x2 join the activity (via `join_activity` or manual Activity construction).
- @0x2 submits a choice for G1 via `submit_choice`.
- Organizer reveals the answer for G1 via `reveal_game_answer`, making it ANSWER_REVEALED
  and giving @0x2 a correct answer.

- BEFORE creating G2:
  - Let @0x2 call `claim_game_reward` on G1 → MUST SUCCEED.

- Then create Game G2 via `create_game` (this updates `activity.current_game_id` to G2).

- After G2 is created, simulate another participant that:
  - had a correct participation in G1 (or reuse the same one, depending on how
    you structure the test), and then:
  - call `claim_game_reward` for G1 again.

Expectation:

- A claim on G1 AFTER G2 has been created must FAIL due to the new guard that checks
  `activity.current_game_id`.
- Use #[expected_failure] and the error code you used in the implementation
  (either E_GAME_NOT_ANSWER_REVEALED or a dedicated E_GAME_CLOSED_FOR_CLAIM).


If it is simpler, you can split this into two tests:

- test_game_claim_before_new_round_succeeds()
- test_game_claim_after_new_round_fails()


=====================================================
3) test_close_activity_with_zero_participants()
=====================================================

Scenario:

- Create an Activity with:
    - `participant_count = 0`
    - `participants = []`
    - `prize_pool_coin.value = 1000` (for example)
    - `status = ActivityStatus::OPEN`
    - organizer @0x1

- Call `close_activity` as organizer.

Expectations:

- `activity.status == ActivityStatus::CLOSED`
- `activity.close_payout_amount == 0`
- `activity.remaining_pool_after_close == 1000` (the whole pool is still there)

- After that, organizer calls `withdraw_remaining_after_close`:

  - Should succeed.
  - Should set `activity.prize_pool_coin.value == 0`
  - Should set `activity.remaining_pool_after_close == 0`

You can also add a small assertion that `withdraw_remaining_after_close` cannot
be called again (expected_failure with E_REMAINING_POOL_ZERO).


=====================================================
Implementation details / hints
=====================================================

- Reuse any helper patterns already present in your existing tests
  (dummy TxContext, object::new, etc.).
- Use addresses like @0x1, @0x2, @0x3 for organizer and participants.
- Don't forget to clean up UIDs with `object::delete` if the framework
  requires it to avoid "unused key" issues.
- For expected failures, use the proper error codes:
    - E_LOTTERY_NOT_OPEN
    - the error used for "old game claim" (e.g., E_GAME_NOT_ANSWER_REVEALED)
    - E_REMAINING_POOL_ZERO for a second withdraw.

Return the complete content of `spec_alignment_tests.move` (or the file
you chose to modify) as a single code block.
