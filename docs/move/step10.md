## ✅ 【Codex Prompt 1】實作 Participation 索引（annual_party.move）

```
You are Codex. Modify the file [annual_party.move](contracts/sources/annual_party.move) with the following changes.

############################################################
#  Goal: Implement on-chain Participation Index for Games  #
############################################################

We need to add a fully functional indexing system for GameParticipation objects, allowing:

1. Each user can only submit_choice ONCE per game.
2. reveal_game_answer must iterate all Participation objects of a game.
3. total_correct and participation.is_correct must be updated.
4. SINGLE mode must randomly choose one correct participant as winner.
5. AVERAGE mode must correctly count all correct participants.
6. claim_game_reward must work properly.

============================================================
# PART 1 — Data Structure Changes
============================================================

Modify struct Game:

Add:
    participation_ids: vector<ID>;

Explanation:
- When a user submits a choice, we append the new GameParticipation object's ID into game.participation_ids.

Modify struct GameParticipation:

Add:
    // no change needed, but ensure it still stores:
    // owner, choice, is_correct, has_claimed_reward.

============================================================
# PART 2 — submit_choice implementation
============================================================

Modify submit_choice so that:

1. Before creating a new GameParticipation, scan game.participation_ids:
      - Load each GameParticipation via object::borrow / object::borrow_mut
      - If participation.owner == caller → abort E_ALREADY_SUBMITTED_CHOICE

2. After creating the participation object, append its ID into:
      game.participation_ids

============================================================
# PART 3 — reveal_game_answer implementation
============================================================

Replace the TODO logic with:

1. Iterate through game.participation_ids.
2. For each participation:
      - Load the object mutably
      - participation.is_correct = (participation.choice == correct_option)
      - If correct → game.total_correct += 1

3. If SINGLE mode:
      - Collect all correct participants (addresses) into a temporary vector
      - Use IOTA random to pick ONE correct winner
      - Set game.winner_addr = some(address)

4. Set:
      game.status = GameStatus::ANSWER_REVEALED

============================================================
# PART 4 — claim_game_reward fix
============================================================

Update:

- Now participation.is_correct is real and must be checked.

- For SINGLE:
      - Must compare caller with game.winner_addr

- For AVERAGE:
      - amount = reward_amount / total_correct

Do NOT close the game in AVERAGE mode.

============================================================
# PART 5 — New error code
============================================================

Add:
    const E_ALREADY_SUBMITTED_CHOICE: u64 = <next number>;

============================================================
# PART 6 — Important Constraint
============================================================

DO NOT introduce any global table, any aggregator, or any non-UTXO index.
All indexing must be implemented purely by storing vector<ID> inside Game.

============================================================
# PART 7 — Maintain formatting
============================================================

Keep the original structure, style, and formatting similar to the existing code.
Do not modify unrelated logic.
```

## ✅ 【Codex Prompt 2】Participation 索引測試（Move test）

```
You are Codex. Create or update the file `tests/game_participation_test.move`
to test the full Participation Index flow.

###########################################################
#   Test: GameParticipation Index end-to-end Validation   #
###########################################################

The test must cover:

===========================================
# 1. Setup: create an activity
===========================================
- let organizer create_activity("Test", 1000)
- three users join_activity

===========================================
# 2. Create a game (reward = 300, mode = SINGLE)
===========================================
- organizer calls create_game with 4 options

===========================================
# 3. Users submit choices
===========================================
- user1 pick option 1
- user2 pick option 2
- user3 pick option 1

Test:
- user1 cannot submit again → expect abort with E_ALREADY_SUBMITTED_CHOICE

===========================================
# 4. Reveal answer = option 1
===========================================
- call reveal_game_answer
- verify:
      game.total_correct == 2
      both participation.is_correct updated

===========================================
# 5. SINGLE mode winner selection
===========================================
- winner must be either user1 or user3
- assert game.winner_addr is_some

===========================================
# 6. Winner claim reward
===========================================
- winner calls claim_game_reward
- reward amount = 300
- verify event emitted

===========================================
# 7. Loser cannot claim
===========================================
- user2 claim → expect abort E_NOT_GAME_WINNER

===========================================
# 8. Game should now be closed
===========================================
- game.status == CLOSED

=============================================================
# Notes to Codex:
=============================================================
- Use iota move test syntax: fun test_*() { ... }
- Use test accounts: @0xA, @0xB, @0xC as participants.
- Load/borrow objects properly with object APIs.
- Do NOT mock randomness; using fixed seed is acceptable.
- Ensure assertions check correctness of indexing behavior.
```
