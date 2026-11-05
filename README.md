# Phasewise 🎴

> A modern, open-source, server-authoritative multiplayer web card game inspired by the classic rummy-style 10-phase game. Playable instantly in any web browser via a simple 5-character room code or shareable link — **no accounts, no logins, and zero installs required.**

---

## 1. Project Structure

The project is structured as a TypeScript monorepo powered by **npm workspaces**:

```
phase_10_2/
├── package.json               # Root scripts, workspaces config, dev tooling
├── tsconfig.base.json         # Shared base TypeScript compiler options
├── vitest.config.ts           # Root test configuration (shared + server tests)
├── playwright.config.ts       # Playwright E2E configuration (multi-browser testing)
├── eslint.config.js           # ESLint flat config
├── Dockerfile                 # Multi-stage production container build for server
├── fly.toml                   # Fly.io deployment manifest
├── vercel.json                # Vercel static rewrite configuration
├── .env.example               # Example environment variables
│
├── packages/
│   ├── shared/                # Pure deterministic game engine, zero I/O
│   │   ├── src/
│   │   │   ├── config.ts      # Branding constants (GAME_TITLE), deck/room rules
│   │   │   ├── types/         # Cards, melds, phases, protocol & Zod schemas
│   │   │   ├── engine/        # Reducer, deck, validation, scoring, hints, bot
│   │   │   └── scripts/       # Headless 1000-game bot simulation script
│   │   └── package.json
│   │
│   ├── server/                # Node 20+ Express + Socket.IO authoritative server
│   │   ├── src/
│   │   │   ├── store/         # IRoomStore interface & MemoryRoomStore
│   │   │   ├── services/      # RoomManager (turns, auto-play, reconnect, cleanups)
│   │   │   ├── utils/         # Crypto RNG, rate limiting, text sanitization
│   │   │   ├── server.ts      # Express REST + Socket.IO server creation
│   │   │   └── index.ts       # Server entry point
│   │   └── package.json
│   │
│   └── client/                # React 18 + Vite + Tailwind CSS + Framer Motion
│       ├── src/
│       │   ├── audio/         # Web Audio API procedural sound synthesizer
│       │   ├── components/    # GameTable, CardView (SVG), Modals, ActionLog
│       │   ├── stores/        # Zustand state store with reconnection support
│       │   ├── tutorial/      # Interactive tutorial steps and card samples
│       │   ├── App.tsx        # View coordinator and auto-reconnect
│       │   └── main.tsx       # Fonts and React mount
│       └── package.json
│
└── e2e/                       # Playwright end-to-end tests
    └── gameplay.spec.ts       # 3-player multiplayer, mobile viewport, tutorial
```

---

## 2. Prerequisites

- **Node.js**: `v20.0.0` or higher (tested on Node `v24.15.0`)
- **npm**: `v10.0.0` or higher (installed with Node)

---

## 3. Quick Start (Run Locally)

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Both Server and Client in Development Mode
```bash
npm run dev
```

- **Client App**: [http://localhost:5173](http://localhost:5173)
- **Game Server**: [http://localhost:3001](http://localhost:3001)
- **Health Check**: [http://localhost:3001/health](http://localhost:3001/health)

### 3. How to Test Multiplayer Locally
1. Open [http://localhost:5173](http://localhost:5173) in your normal browser window.
2. Enter your name (e.g. `Alice`) and click **"Create Multiplayer Room"**.
3. Note the 5-character room code (e.g. `ABCDE`) or click **"Copy Invite Link"**.
4. Open an **Incognito / Private Window** (or a different browser like Firefox/Edge), go to [http://localhost:5173](http://localhost:5173), enter a second name (`Bob`), click **"Join with Room Code"**, enter the code, and click **"Join"**.
5. Once 2 or more players join, click **"Start Game"** in the host's window.

### 4. How to Test from a Phone on the Same Wi-Fi Network
1. Find your computer's local network IP address:
   - **Windows**: Run `ipconfig` in PowerShell and look for `IPv4 Address` (e.g. `192.168.1.50`).
   - **macOS / Linux**: Run `ifconfig` or `ip a` (e.g. `192.168.1.50`).
2. Start the development servers with host listening enabled (already configured in `vite.config.ts` and `server.ts`):
   ```bash
   # Set the client's target server URL to your LAN IP
   # (or set it in packages/client/.env)
   VITE_SERVER_URL="http://192.168.1.50:3001" npm run dev
   ```
3. On your phone connected to the same Wi-Fi, open the browser and navigate to:
   `http://192.168.1.50:5173`
4. *Firewall Note*: If connection fails, ensure Windows Defender Firewall allows incoming connections on ports `3001` and `5173`.

---

## 4. Testing, Simulation & Quality Commands

All tests are real, passing, and runnable via single commands:

```bash
# Run all unit tests (shared + server + client)
npm test

# Run Playwright End-to-End tests (3 browser contexts, refresh rejoin, mobile viewport)
npm run test:e2e

# Run the 1000-game headless bot-vs-bot simulation script
npm run simulate

# Run ESLint across all packages
npm run lint

# Build all packages for production
npm run build

# Start the built production server
npm start
```

---

## 5. Environment Variables

### Server (`packages/server/.env`)

| Variable | Description | Default | Example |
| :--- | :--- | :--- | :--- |
| `PORT` | Port for the HTTP and Socket.IO server | `3001` | `3001` |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins or `*` | `*` | `https://my-phasewise.vercel.app,http://localhost:5173` |

### Client (`packages/client/.env`)

| Variable | Description | Default | Example |
| :--- | :--- | :--- | :--- |
| `VITE_SERVER_URL` | Base URL of the backend Socket.IO / REST server | `http://localhost:3001` | `https://phasewise-server.onrender.com` |

---

## 6. Architecture Overview

### Server-Authoritative Design
The client is strictly an input mechanism and state renderer. The server:
- Owns the 108-card deck and executes Fisher-Yates shuffling using cryptographically secure random numbers (`crypto.randomInt`).
- Enforces strict state-machine transitions: `Draw -> Action -> Discard`.
- Validates all phase submissions, meld hits, and discards.
- Computes all round-end scores and phase advancements.

### Hand Privacy Projection
Clients never receive the draw pile order or opponents' cards. The server projects `GameState` into `ClientGameState` before transmitting:
- Opponents' hands are stripped; only `cardCount: number` is provided.
- The draw pile array is never sent; only `drawPileCount: number` is sent.

### Reconnection & Session Identity
- When a player joins, the server returns a unique UUID `sessionToken` stored in the client's `localStorage`.
- When a player refreshes their browser mid-game, the client reconnects with their `sessionToken`, immediately restoring their exact seat, hand, and game view without dropping them.
- If a player disconnects, they are marked `isAway: true`. If their turn timer expires (or after 60s if no timer is configured), the server auto-plays a safe move (draws deck, discards highest-value non-wild card) to ensure the game never stalls.

---

## 7. Deployment Guide (Beginner Friendly)

### Why Two Separate Deployments?
Serverless hosting platforms (like Vercel and Netlify) run stateless serverless functions that terminate after requests and **cannot keep persistent WebSocket connections open**. Therefore, Phasewise is deployed in two complementary parts:
1. **Frontend (Client)**: Deployed as a static SPA on **Vercel** (or Netlify/Cloudflare Pages).
2. **Backend (Server)**: Deployed as a persistent Node service on **Render**, **Fly.io**, or **Railway**.

---

### Step 1: Deploy Server to Render (Free Web Service)

1. Sign up for free at [render.com](https://render.com).
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository.
4. Configure the service settings:
   - **Name**: `phasewise-server`
   - **Language**: `Node`
   - **Root Directory**: Leave blank (monorepo root)
   - **Build Command**: `npm install && npm run build -w packages/shared && npm run build -w packages/server`
   - **Start Command**: `node packages/server/dist/index.js`
   - **Instance Type**: `Free`
5. Under **Advanced** -> **Add Environment Variable**:
   - `PORT` = `3001` (or leave default; Render automatically injects `PORT`)
   - `ALLOWED_ORIGINS` = `*` (or your Vercel URL once deployed)
6. Under **Health Check Path**: set `/health`.
7. Click **Create Web Service**.
8. Note your public backend URL: `https://phasewise-server.onrender.com`.

> [!NOTE]
> **Free Tier Cold Starts**: Render's free tier spins down after 15 minutes of inactivity. When a player opens the game, the server takes ~30-60 seconds to wake up. The Phasewise client automatically displays a friendly "Connecting to server..." indicator with retries. You can optionally use an external uptime monitor (e.g. UptimeRobot or Cron-job.org) to ping `https://phasewise-server.onrender.com/health` every 10 minutes to keep it warm.

---

### Step 2: Deploy Server with Docker (Fly.io)

Phasewise includes a tested, production-ready `Dockerfile` and `fly.toml`:

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login and deploy
fly auth login
fly launch --no-deploy
fly deploy
```

---

### Step 3: Deploy Client to Vercel

1. Sign up for free at [vercel.com](https://vercel.com).
2. Click **Add New...** -> **Project** and import your GitHub repository.
3. Configure the project:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `packages/client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Expand **Environment Variables**:
   - `VITE_SERVER_URL`: Paste your Render backend URL (e.g. `https://phasewise-server.onrender.com`).
5. Click **Deploy**.
6. The included `vercel.json` automatically ensures all client-side routes (like `/r/CODE`) rewrite to `/index.html` without 404s.

---

### Post-Deployment Verification Checklist
- [ ] Open the Vercel URL in your browser; verify the landing page loads cleanly.
- [ ] Create a room and share the link with another device.
- [ ] Play a complete turn between both devices.
- [ ] Refresh the page on one device; verify it restores the player's seat and hand seamlessly.

### Troubleshooting
| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **CORS Error** in console | `ALLOWED_ORIGINS` on server doesn't match client URL | Set `ALLOWED_ORIGINS` on the server to your Vercel domain or `*`. |
| **WebSocket Connection Failed** | Server URL protocol mismatch (`http` vs `https`) | Use `https://` for `VITE_SERVER_URL` in production; Socket.IO upgrades to `wss://` automatically. |
| **Room Not Found after restart** | Active rooms live in server memory | In-memory rooms reset if server restarts. Players can simply create a new room in seconds. |

---

## 8. Customization Guide

### Renaming the Game
The game working title is configured in **one single place**:
- Edit `GAME_TITLE` in [packages/shared/src/config.ts](file:///c:/Game/phase_10_2/packages/shared/src/config.ts):
```typescript
export const GAME_TITLE = 'Phasewise'; // Change this string to rename everywhere
```

### Modifying or Adding Phases
The 10 phases are stored purely as declarative data, not hardcoded logic:
- Edit `PHASES` array in [packages/shared/src/types/phases.ts](file:///c:/Game/phase_10_2/packages/shared/src/types/phases.ts).
- You can change set counts, run lengths, or define custom game modes (e.g. 5-phase speed runs).

### Customizing Card Themes & Colors
- Card colors and SVG symbols are defined in [packages/client/src/components/CardView.tsx](file:///c:/Game/phase_10_2/packages/client/src/components/CardView.tsx).
- Table felt textures and dark/light modes are defined in [packages/client/tailwind.config.js](file:///c:/Game/phase_10_2/packages/client/tailwind.config.js).

---

## 9. Game Rules Reference Table

### The 10 Phases
| Phase | Requirement | Details |
| :---: | :--- | :--- |
| **1** | 2 sets of 3 | Two groups of 3 cards of the same number (e.g. 3 sevens & 3 tens) |
| **2** | 1 set of 3 + 1 run of 4 | 3 of the same number + 4 consecutive numbers |
| **3** | 1 set of 4 + 1 run of 4 | 4 of the same number + 4 consecutive numbers |
| **4** | 1 run of 7 | 7 consecutive numbers (e.g. 2-3-4-5-6-7-8) |
| **5** | 1 run of 8 | 8 consecutive numbers |
| **6** | 1 run of 9 | 9 consecutive numbers |
| **7** | 2 sets of 4 | Two groups of 4 cards of the same number |
| **8** | 7 cards of one color | 7 cards all of red, blue, green, or yellow (numbers irrelevant) |
| **9** | 1 set of 5 + 1 set of 2 | 5 of the same number + 2 of the same number |
| **10** | 1 set of 5 + 1 set of 3 | 5 of the same number + 3 of the same number |

### Card Point Values
- **Cards 1 – 9**: 5 points
- **Cards 10 – 12**: 10 points
- **Skip Card**: 15 points
- **Wild Card**: 25 points

### Rule Decisions & Documented Assumptions
1. **No Wrap-Around in Runs**: Consecutive runs must strictly fall within `1` to `12`. `12` does not connect to `1`.
2. **At Least One Natural Card per Meld**: Every set, run, or color group must contain at least one natural (non-Wild) card. A meld composed solely of Wilds is rejected.
3. **Skip Card Restrictions**: Skip cards cannot be melded. A Skip card cannot be picked up from the discard pile. In a 2-player game, discarding a Skip card skips the opponent and immediately awards the discarder another turn.
4. **Authoritative Wild Value Resolution**: When a Wild card is placed in a run, its exact represented value is resolved and stored on the server so that subsequent hits (low end or high end) validate accurately.
5. **Going Out Rule**: A player going out (emptying their hand) must have laid down their phase. Going out without completing your phase is not allowed.
6. **Deck Reshuffle**: When the draw pile is depleted, the discard pile (except its top card) is shuffled via Fisher-Yates to form a new draw pile. If both piles are exhausted, drawing is skipped and the turn advances to the action stage.

---

## 10. License & Disclaimers

### License
This project is open-source and released under the **MIT License**.

### Trademark Disclaimer
"Phase 10" is a registered trademark of Mattel, Inc. This project is an independent, original open-source software implementation titled **Phasewise** with original card artwork, custom procedural audio, and data-driven rule definitions. It is not affiliated with, endorsed by, or sponsored by Mattel, Inc.

### Font Credits
- **Outfit**: Designed by Rodrigo Fuenzalida, licensed under the SIL Open Font License (packaged via `@fontsource/outfit`).
- **JetBrains Mono**: Designed by JetBrains, licensed under the SIL Open Font License (packaged via `@fontsource/jetbrains-mono`).

## 11. Client experience and learning tools

The client now has an overlapping, single-row hand, persistent custom card order, drag to reorder/discard/hit, a NEW badge after drawing, a clear Coach toggle, and accessible name entry for `/r/CODE` invitations. Invite previews expose player names and away state only. Daylight, evening, and high-contrast themes are available in the in-game menu, together with sound, volume, motion, double-tap discard, the scoreboard, rules, glossary, and keyboard help.

New players receive a dismissible invitation to the playable 12-step tour. It uses the actual practice table and normal engine actions: draw, select, build two sets including a Wild, hit a run, choose a Wild's end, hit a set, target a Skip, go out, and inspect scoring. Back restores the prepared state for that step; Skip tour and the final button start a fresh practice game. Onboarding preferences use guarded localStorage access, with usable defaults when storage is unavailable.

### UX design notes

Selection represents a deliberate tap, never a recommendation. The regular hand permits one selected card; tapping it again clears it. Draw, discard, hit, lay down, turn/stage changes, rounds, and hand membership changes clear selection. The new card remains marked for that turn. Sorting changes an independent array of card IDs; snapshots preserve that order, remove departed IDs, and append new cards. Pointer capture starts on press so fast gestures cannot escape the card. A movement threshold distinguishes dragging from tapping; captured taps and keyboard activation share the same single-selection action. Dragging suppresses the following click and prevents page scrolling.

The lay-down builder owns its multiple card assignments, keyed by ID. Slots begin empty when it opens. Hand updates prune departed cards without rebuilding the slots. Shared engine validators provide live counts, readiness checks, and rule explanations. Suggest for me creates an editable preview only when requested. The builder keeps its own visible hand in a bottom sheet; cards can return to the hand or move between slots by drag.

The animation layer observes state differences and action-log entries; it never dispatches an engine action or delays state rendering. Shared card IDs connect hand, discard, and meld layouts, while bounded cosmetic travel records depict deck/seat movement. Deal flights stagger by 60ms; individual travel lasts 400ms. Logs retain opponent draws when React coalesces snapshots. Motion preferences disable travel and celebrations; reduced-motion overrides the in-app setting. Confetti, the tour, builder, scoreboard, and end-of-round overlays load on demand. Practice bot actions are scheduled every 800ms, narrate through the normal action log, and read the latest authoritative local state on each action. Audio stays silent until a user gesture unlocks it.

The timer ring is a cosmetic indication based on the client's observed turn; the server remains responsible for timeout enforcement. The animation queue may coalesce rapid updates, so it does not promise a replay of every intermediate network frame. Physical phone frame-rate benchmarking has not been performed.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| Tab / Shift+Tab | Move between controls; visible focus remains inside an open modal and its tour controls |
| Left / Right arrow | Move focus through the hand |
| Alt + Left / Right arrow | Reorder the focused card |
| Enter / Space | Lift or return the focused card; activate controls |
| D | Discard the lifted card (opens a Skip target or helpful-card confirmation when appropriate) |
| B | Open the phase builder after drawing |
| Escape | Close the builder/settings, or clear a regular table selection |

Cards retain number/color symbols and spoken labels. Turn changes, draws, discards, and rejected actions are announced through a live region. Rejected actions show an auto-dismissing explanation toast. The glossary explains set, run, meld, hit, Wild, Skip, and phase.

### Client tests and browser verification

```bash
# Includes shared, server, and jsdom client tests
npm test

# Client selection, hand order, and builder tests only
npm run test -w packages/client

# Builds current source, then tests the built client and real Socket.IO server
npx playwright install chromium
npm run test:e2e

npm run lint
npm run build
npm run simulate
```

Playwright serves the built client and server on one test origin, `http://127.0.0.1:5180`, avoiding separate-origin test configuration. Local development uses Vite's `/api` and `/socket.io` proxies; separately hosted deployments should continue setting `VITE_SERVER_URL` to the backend URL.

Browser coverage includes multiplayer/reconnect, mobile layout, selection clearing, empty/editable builder, button and pointer-drag discards, Wild run-end choice, invitation previews, reduced motion, the settings toggle, and full tour completion on desktop, 360px phone, and keyboard. Client tests use Vitest, jsdom, and Testing Library. The added shared tutorial tests check deterministic preparation, deck conservation, and legal bot replies. A server test checks that invite previews never contain session credentials or deck data.

To reproduce visual checks while the test server is running:

```bash
node scripts/test-server.mjs
# In a second terminal:
node scripts/screenshots.mjs
node scripts/animation-screenshots.mjs
node scripts/play-practice.mjs
```

The practice verification script drives visible browser controls using the same recommendations available from the shared engine, reads only public table/hand information, accelerates waiting with Playwright's clock, and plays a complete five-phase game. One verified run completed 72 human actions over five rounds with no browser runtime errors; its result is saved in `docs/screenshots/practice-verification.json`.

### Screenshots

The complete matrix is under [docs/screenshots](docs/screenshots/): 360×640 portrait, 640×360 landscape, 768×1024 tablet, and 1280×800 desktop, each with 2, 4, and 6 players in all three themes. `geometry.json` records detected page overflow/overlap issues (empty after verification). The contact sheet shows all 36 combinations.

- [All layouts and themes](docs/screenshots/contact-sheet.jpg)
- [Phone, six players](docs/screenshots/360x640-6p-dark.png)
- [Landscape daylight](docs/screenshots/640x360-4p-light.png)
- [Desktop, six players](docs/screenshots/1280x800-6p-dark.png)
- [Phone builder during the tour](docs/screenshots/tour-builder-phone.png)
- [Phone scoring](docs/screenshots/tour-scoring-phone.png)
- [Deal](docs/screenshots/animation-deal.png), [draw](docs/screenshots/animation-draw.png), and [discard](docs/screenshots/animation-discard.png) frames
- [Complete practice game](docs/screenshots/full-practice-finish.png)

The finishing pass also corrected the partial practice next-round projection, duplicate rules overlays, static cards incorrectly appearing interactive, lost Wild identity in meld rendering, and the old floating action log covering mobile controls. No scoring or game-rule implementation changed. An existing Skip test fixture now explicitly sets its intended actor, avoiding a random opening Skip changing the scenario.

Final verification: `npm test` passes 104 tests across 13 files; the client-only command covers 12 tests. Playwright passes 11 tests, and the fast drag/discard scenario additionally passed five consecutive independent deals. The completed tenth-phase display has its own regression test. Test workers are bounded to three forked processes for predictable memory usage.

The crowded phone check can be repeated with `node scripts/play-practice.mjs --crowded`. It plays normal bot turns until real melds are present, enables Coach, checks geometry, and saves [the occupied six-player phone table](docs/screenshots/360x640-6p-with-melds.png).
