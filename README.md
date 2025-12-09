# 🎉 IOTA Move Annual Party Lottery DApp

A fully on-chain **company annual party lottery game** built with:

- **Smart contracts:** Move on an IOTA-related chain (e.g. IOTA SVM / ShimmerVM)
- **Frontend:** React + TypeScript + Vite (static SPA)
- **Wallet:** [`@liquidlink-lab/iota-snap-for-metamask`](https://www.npmjs.com/package/@liquidlink-lab/iota-snap-for-metamask)
- **Hosting:** GitHub Pages (no custom backend, zero infra cost)

> 🧪 This repo is designed for a workshop. All core logic lives on-chain; the frontend is a thin DApp that talks to the chain and the wallet.

---

## ✨ Features

- **Activity management**
  - Organizer creates activities with an initial prize pool
  - Each activity is fully on-chain and independent

- **Participant onboarding**
  - Employees scan a QR code to open the DApp
  - Connect wallet and join the activity (on-chain `Participant` record)

- **Bonus (participation reward)**
  - Organizer defines a one-time bonus per participant
  - Contract verifies `prize_pool >= bonus * number_of_participants`
  - Each participant can claim their bonus exactly once

- **Single winner draw**
  - Organizer inputs an amount and triggers a random draw
  - Randomness uses on-chain data (`block_hash`, `tx_hash`, `caller`, `seed`)
  - A participant can win at most once in this “single draw” series

- **Lottery**
  - Organizer creates a lottery pool
  - Participants can join once per lottery, sending tokens into the pool
  - Organizer executes the lottery → one winner takes the entire pool
  - Multiple lotteries per activity; only one open at a time

- **Four-choice game (multiple rounds)**
  - Organizer can create multiple quiz rounds for the same activity
  - At any given time, only **one game** is active (OPEN / ANSWER_REVEALED)
  - Participants choose 1 of 4 options (one choice per game)
  - Reward modes:
    - `SINGLE`: random winner among all correct answers
    - `AVERAGE`: equal split among all correct answers
  - If a new game is created, previous game is closed and its rewards can no longer be claimed  
    (UI must clearly warn about this)

- **Activity closure & leftover handling**
  - Organizer closes the activity
  - Remaining prize pool is **evenly split** among all participants
  - Each participant claims once; any unclaimed leftover can later be withdrawn by the organizer

- **No backend required**
  - All state is on-chain via Move objects
  - Frontend is a static SPA hosted on GitHub Pages
  - Wallet interactions via MetaMask Snap for IOTA

---

## 🏗 Architecture

```txt
repo-root/
├─ contracts/          # Move modules (Activity, Participant, Lottery, Game, etc.)
├─ frontend/           # React + TypeScript + Vite SPA
├─ AGENTS.md           # System / agent design hints for Codex / AI assistants
├─ SPEC.md             # TPM-level technical spec (source of truth)
├─ README.md
└─ .github/
   └─ workflows/
      └─ ci-and-pages.yml   # CI + GitHub Pages deployment
````

* **contracts/**

  * Contains Move modules implementing:

    * `Activity`, `Participant`, `Lottery`, `Game`, `GameParticipation`
    * Events for all flows
    * Entry functions for organizer/participant actions
  * All business rules follow the TPM spec in `SPEC.md`.

* **frontend/**

  * React SPA (with Vite + TypeScript)
  * Uses `@liquidlink-lab/iota-snap-for-metamask` for wallet integration
  * Polls on-chain state (activities, lotteries, games) and updates the UI
  * Builds to static assets (`frontend/dist`) for GitHub Pages

---

## 🧩 Tech Stack

* **Smart contracts**

  * Move language
  * IOTA-related Move toolchain (e.g. SVM / ShimmerVM)
* **Frontend**

  * React + TypeScript
  * Vite bundler
  * Wallet: `@liquidlink-lab/iota-snap-for-metamask`
* **CI / CD**

  * GitHub Actions
  * GitHub Pages for static hosting

---

## 📜 On-chain Data Model (brief)

> Full spec is in `SPEC.md`. This is a high-level summary.

* `Activity`

  * Organizer address
  * Name
  * Status (`OPEN`, `BONUS_READY`, `CLOSED`)
  * Prize pool
  * Participant count
  * Bonus info (`has_bonus_event`, `bonus_amount_per_user`)
  * Close reward info (`close_payout_amount`, `remaining_pool_after_close`)
  * `lottery_id` (optional current lottery)
  * `current_game_id` (optional current four-choice game)

* `Participant`

  * Activity ID
  * Owner address
  * Flags:

    * `joined`
    * `has_claimed_bonus`
    * `eligible_for_draw`
    * `has_claimed_close_reward`

* `Lottery`

  * Activity ID
  * Status (`OPEN`, `DRAWN`, `CLOSED`)
  * Pot amount
  * Participants (addresses)
  * Winner (optional)

* `Game` (four-choice)

  * Activity ID
  * Status (`OPEN`, `ANSWER_REVEALED`, `CLOSED`)
  * Question + 4 options
  * Reward amount
  * Reward mode (`SINGLE` / `AVERAGE`)
  * Correct option (optional)
  * Total correct count
  * Winner address (for `SINGLE` mode)

* `GameParticipation`

  * Game ID
  * Activity ID
  * Owner address
  * Choice (1–4)
  * `is_correct`
  * `has_claimed_reward`

---

## 🚀 Getting Started

### Prerequisites

* **Node.js**: v18+ (recommended v20)
* **npm** or `pnpm`/`yarn` (examples use `npm`)
* **Rust + Cargo** (for Move CLI installation)
* **Move toolchain** compatible with your IOTA-related chain
* **MetaMask** installed in your browser
* **IOTA Snap**:

  * `@liquidlink-lab/iota-snap-for-metamask` will guide you to install/enable the Snap when the DApp connects

### 1. Clone the repo

```bash
git clone https://github.com/your-org/iota-move-annual-party-lottery.git
cd iota-move-annual-party-lottery
```

### 2. Setup IOTA Move toolchain

本專案的 `contracts/` 資料夾是使用 `iota move new` 建立的，請使用 **IOTA Move CLI**：

```bash
# 安裝 IOTA Move CLI（依照 IOTA 官方文件為準）
cargo install --git https://github.com/iotaledger/iota --bin iota-move --locked

cd contracts
iota move build
iota move test
cd ..
```

### 3. Install frontend dependencies

```bash
cd frontend
npm install
```

### 4. Run frontend dev server

```bash
npm run dev
# Vite dev server (e.g. http://localhost:5173)
```

---

## 🧪 Testing

### Move tests

From the repo root:

```bash
cd contracts
iota move test
cd ..
```

### Frontend lint / tests (optional)

Inside `frontend/`:

```bash
npm run lint
npm run test   # if tests are configured
```

---

## 🏁 Build & Deploy (GitHub Pages)

This project is intended to be deployed as a static site to **GitHub Pages**.

### 1. Build frontend

```bash
cd frontend
npm run build
# Outputs to frontend/dist
```

### 2. GitHub Actions CI/CD

The workflow file at `.github/workflows/ci-and-pages.yml`:

* Runs IOTA Move tests (`iota move test`) in `contracts/`
* Builds the frontend in `frontend/`
* Uploads `frontend/dist` as a GitHub Pages artifact
* Deploys to GitHub Pages when pushing to the `main` branch

To enable GitHub Pages:

1. Go to **Settings → Pages** in your GitHub repo.
2. Under “Source”, choose **GitHub Actions**.
3. The `ci-and-pages` workflow will handle building and deployment.

Once deployed, your DApp will be served at:

```txt
https://<your-username>.github.io/<your-repo>/
```

Make sure your Vite config `base` is correctly set for GitHub Pages (e.g. `base: '/<your-repo>/'`).

---

## 🔌 Wallet Integration

The frontend uses:

```bash
npm install @liquidlink-lab/iota-snap-for-metamask
```

Key points:

* MetaMask must be installed.
* The IOTA Snap will be requested/installed when the user connects their wallet.
* All on-chain transactions (joining activities, claiming rewards, etc.) are signed by the user’s wallet and sent via the Snap / IOTA RPC.

---

## 📝 License

TBD – choose an appropriate license (e.g. MIT) for your use case.
