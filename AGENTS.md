# AGENTS

This repository is for a **workshop DApp**: a company annual party lottery game built with:

- **Smart contracts:** Move on an IOTA-related chain (e.g., IOTA SVM / ShimmerVM).
- **Frontend:** React SPA, statically built and hosted on GitHub Pages (no custom backend).
- **Wallet integration:** `@liquidlink-lab/iota-snap-for-metamask` (MetaMask Snap for IOTA). This is a sponsored requirement and MUST be used for wallet connectivity.
- **Spec source of truth:** `TPM technical spec v1` for the “Company Lottery Game” (Activity / Participant / Bonus / Lottery / Four-choice game / Close & claim flow).

The system has **two major parts**:
1. Move modules implementing the on-chain logic.
2. React app implementing organizer/participant flows, talking directly to the chain via the wallet / IOTA Move client libraries.

The project MUST:
- Have **no custom infra**: no backend server, only static hosting (GitHub Pages).
- Keep all core state (activities, games, lotteries, balances, winners) fully on-chain.
- Use IOTA-related Move libraries / SDKs (not generic Aptos/Sui-only APIs) wherever chain interaction is needed.
- Use `@liquidlink-lab/iota-snap-for-metamask` as the primary way to connect the wallet and send transactions.

---

## Global rules

- Follow the existing TPM spec as the **source of truth** for:
  - Data model (Activity, Participant, Lottery, Game, GameParticipation, enums).
  - Entry functions (create_activity, join_activity, create_bonus_event, claim_bonus, draw_prize, create_lottery, join_lottery, execute_lottery, create_game, submit_choice, reveal_game_answer, claim_game_reward, close_activity, claim_close_reward, withdraw_remaining_after_close).
  - Business rules (one bonus event per activity, no duplicate winners in single draws, one join per lottery, multiple four-choice games per activity but only one active at a time, etc.).
- Do NOT silently change the on-chain business logic. If there is a mismatch with the spec, propose a change explicitly in comments.
- Prefer **TypeScript** for the frontend whenever possible.
- Code should be clean, readable, and minimal. Avoid over-engineering.
- All code comments must be in zh-tw to avoid mixing Chinese and English.

---

## Agents

### 1. Architect

Responsibilities:
- Keep the whole system coherent (Move modules + React app).
- Ensure the design matches the TPM spec and is friendly to static deployment on GitHub Pages.
- Decide folder structure, module boundaries, and naming conventions.

Guidelines:
- Place Move code under `contracts/`.
- Place frontend code under `frontend/` (e.g. `frontend/src/...`).
- Aim for a simple React SPA that can be exported as static files and deployed to GitHub Pages (e.g. Vite + React).
- Design the frontend so it can be ported to Next.js later without major rewrites (e.g. avoid browser-only globals in business logic, isolate “view” from “data fetching” where possible).

### 2. Move Smart Contract Engineer

Responsibilities:
- Implement the Move modules according to the TPM spec:
  - Data structs (Activity, Participant, Lottery, Game, GameParticipation, enums).
  - Events.
  - Entry functions and access control.
  - Pseudo-randomness logic using `hash(block_hash || tx_hash || caller || client_seed)` (or the closest equivalent available in the IOTA Move environment).
- Ensure correctness, safety, and upgradeability (use patterns that allow adding new features later).

Guidelines:
- Use IOTA-related Move libraries as the primary reference (not Aptos/Sui-only modules). Prefer helper functions/constants that come from the IOTA/SVM Move stdlib if available.
- Respect the **no-backend** assumption: all game state must live on-chain.
- Avoid heavy loops over all participants in a single transaction. Use “event + per-user claim” patterns (as in the spec).
- Keep random selection logic auditable and deterministic given on-chain inputs.

### 3. Frontend Engineer (React)

Responsibilities:
- Build a React SPA that:
  - Connects to IOTA via `@liquidlink-lab/iota-snap-for-metamask`.
  - Reads the on-chain state (activities, participants, lotteries, games).
  - Sends transactions calling the Move entry functions.
  - Implements the organizer and participant UX as described in the spec.
- Implement polling-based state updates to show the live activity state.

Guidelines:
- Use `@liquidlink-lab/iota-snap-for-metamask` as the **primary wallet connector**.
- Wrap wallet & chain access in a small abstraction layer (e.g. `frontend/src/lib/iotaClient.ts`) so the rest of the app is not tied to low-level APIs.
- Use React hooks for:
  - Connecting to the wallet.
  - Tracking the current address.
  - Polling activity/lottery/game state periodically.
- Pages / views to implement at minimum:
  - Organizer dashboard for a specific `activityId`.
  - Participant view for the same `activityId` (detected by comparing current address to organizer).
  - QR-code landing / “join activity” flow.
- The app must be buildable into static files (`npm run build`) suitable for GitHub Pages deployment.

### 4. QA / Test Agent

Responsibilities:
- Propose test cases for:
  - Smart contracts (unit tests / integration tests if the framework supports it).
  - Frontend flows (organizer and participant journeys).
- Check edge cases:
  - Bonus event only once per activity.
  - Participants can only claim each reward once.
  - No double winners in the single-draw flow.
  - Only one active game at a time; previous game’s rewards cannot be claimed after a new game is created.
  - Activity closure, claim of close rewards, and leftover withdrawal.

Guidelines:
- Prefer small, scenario-based tests:
  - “Happy path” for each feature.
  - Typical failure conditions (wrong caller, insufficient prize pool, double-claim attempts).
- Keep test descriptions human-readable and aligned with the TPM spec.

### 5. Documentation Agent

Responsibilities:
- Maintain concise docs for:
  - How to build and deploy the frontend to GitHub Pages.
  - How to compile and deploy the Move contracts.
  - How to configure and use `@liquidlink-lab/iota-snap-for-metamask` with the DApp.
- Provide short “developer onboarding” notes in a `README.md` (or `docs/`) so new contributors can quickly run the project.

Guidelines:
- Focus on “copy-paste-able” commands and minimal explanations.
- Explicitly document:
  - Required Node.js version.
  - How to install dependencies.
  - Which environment variables (if any) must be set.
  - Which chain / RPC endpoint is assumed for testing.

---
