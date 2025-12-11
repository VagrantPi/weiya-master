// annual-party.ts
export const ANNUAL_PARTY_PACKAGE_ID =
  "0x43572924a0b39b6509737f93365c5eac9cf2718fe6bdd312281face6fcbeebb7";

export const MODULE_ANNUAL_PARTY = `${ANNUAL_PARTY_PACKAGE_ID}::annual_party`;

// 之後會用到的 moveCall target
export const ENTRY_CREATE_ACTIVITY = `${MODULE_ANNUAL_PARTY}::create_activity`;
export const ENTRY_JOIN_ACTIVITY = `${MODULE_ANNUAL_PARTY}::join_activity`;
export const ENTRY_ADD_PRIZE_FUND = `${MODULE_ANNUAL_PARTY}::add_prize_fund`;
export const ENTRY_CREATE_BONUS_EVENT = `${MODULE_ANNUAL_PARTY}::create_bonus_event`;
export const ENTRY_CLAIM_BONUS = `${MODULE_ANNUAL_PARTY}::claim_bonus`;
export const ENTRY_DRAW_PRIZE = `${MODULE_ANNUAL_PARTY}::draw_prize`;
export const ENTRY_CREATE_LOTTERY = `${MODULE_ANNUAL_PARTY}::create_lottery`;
export const ENTRY_JOIN_LOTTERY = `${MODULE_ANNUAL_PARTY}::join_lottery`;
export const ENTRY_EXECUTE_LOTTERY = `${MODULE_ANNUAL_PARTY}::execute_lottery`;
export const ENTRY_CREATE_GAME = `${MODULE_ANNUAL_PARTY}::create_game`;
export const ENTRY_SUBMIT_CHOICE = `${MODULE_ANNUAL_PARTY}::submit_choice`;
export const ENTRY_REVEAL_GAME_ANSWER = `${MODULE_ANNUAL_PARTY}::reveal_game_answer`;
export const ENTRY_CLAIM_GAME_REWARD = `${MODULE_ANNUAL_PARTY}::claim_game_reward`;
export const ENTRY_CLOSE_ACTIVITY = `${MODULE_ANNUAL_PARTY}::close_activity`;
export const ENTRY_CLAIM_CLOSE_REWARD = `${MODULE_ANNUAL_PARTY}::claim_close_reward`;
export const ENTRY_WITHDRAW_REMAINING = `${MODULE_ANNUAL_PARTY}::withdraw_remaining_after_close`;
