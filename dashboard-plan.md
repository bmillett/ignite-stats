# Ultimate Frisbee Stats Dashboard — Plan

## Overview

Build a SvelteKit dashboard that reads CSV stat files from a folder structure (`tournament/game.csv`) and presents three views: a tournament overview, a player leaderboard, and a per-player game-by-game drill-down. Priority metrics are **touches**, **turnovers**, **touches per point played**, and **total throw distance**. The app runs locally via `vite dev` but is structured so it can be deployed to any static host later.

## Confirmed Decisions

| Question | Decision |
|---|---|
| Distance units | Display in **yards** (multiply metres × 1.09361 in the data layer) |
| Turnovers | Use the **`Turnovers` column directly** — it is the ground-truth total. `Thrower errors` and `Receiver errors` are a breakdown sub-category (some TOs are neither, e.g. stalls). Show all three in the drill-down for transparency. |
| Theme | **Dark theme** |
| Multi-tournament | Tournament **selector** on the overview page — choose one tournament or a combined view across selected tournaments |

---

## Architecture

```
stats/
  dashboard/              ← SvelteKit project root
    src/
      lib/
        data.js           ← CSV parsing & aggregation logic
        stores.js         ← Svelte stores (derived stats)
      routes/
        +page.svelte              ← Tournament overview
        leaderboard/
          +page.svelte            ← Player leaderboard
        player/
          [name]/
            +page.svelte          ← Player drill-down
    static/
      data/               ← Symlink or copy of CSV folders
        nationals/
          *.csv
    vite.config.js
    package.json
```

CSV files are served as static assets and fetched at runtime via `fetch()`. This means adding a new tournament folder + CSV files is all that is needed to update the dashboard.

---

## Sub-Tasks

---

### Sub-Task 1 — Project Scaffold

**Intent:** Bootstrap the SvelteKit project with all required dependencies so the rest of the sub-tasks have a working foundation.

**Expected Outcomes:**
- `dashboard/` directory exists with a working SvelteKit + Vite project
- `papaparse` installed for CSV parsing
- `chart.js` + `svelte-chartjs` installed for charts
- `npm run dev` starts without errors and shows a blank home page
- CSV files are accessible as static assets under `static/data/`

**Todo List:**
1. Run `npm create svelte@latest dashboard` (choose "Skeleton project", no TypeScript, no additional plugins needed)
2. `cd dashboard && npm install`
3. `npm install papaparse chart.js svelte-chartjs`
4. Create `static/data/nationals/` and copy (or symlink) all CSV files there
5. Add a manifest file `static/data/manifest.json` listing all tournaments and their game files (this is needed because the browser cannot list directories — see note in Relevant Context)
6. Confirm `npm run dev` works

**Relevant Context:**
- CSV files live at `d:\stats\nationals\*.csv`
- Because browsers cannot list directory contents, a `manifest.json` is required that maps tournament names to arrays of CSV filenames. This must be kept in sync when new files are added. A small Node script (`scripts/build-manifest.js`) should be written to regenerate it automatically from the filesystem.
- Static asset path in SvelteKit: `static/` maps to `/` at runtime

**Status:** [ ] pending

---

### Sub-Task 2 — CSV Parsing & Data Layer

**Intent:** Build the shared data module that loads all CSVs, parses them with papaparse, and exposes clean aggregated data structures for the UI layers to consume.

**Expected Outcomes:**
- `src/lib/data.js` exports `loadAllStats()` which returns a structured object
- Per-game stats are available (raw rows per game)
- Per-player aggregated stats are computed (summed across all games in a tournament)
- Derived metrics are computed: `touchesPerPoint`, `turnovers` (= thrower errors + receiver errors), `totalThrowDistanceM` (renamed for clarity)
- Data is reactive via a Svelte store in `src/lib/stores.js`

**Todo List:**
1. Write `src/lib/data.js`:
   - Fetch `manifest.json` to discover all tournaments + game files
   - For each file, `fetch()` the CSV and parse with `papaparse.parse(text, { header: true, dynamicTyping: true })`
   - Parse opponent name and game date from filename pattern `Player Stats vs. {Opponent} {YYYY-MM-DD}_{HH-MM-SS}.csv`
   - Return structure:
     ```
     {
       tournaments: {
         [tournamentName]: {
           games: [{ opponent, date, players: [...rows] }],
           players: { [playerName]: { aggregated stats } }
         }
       }
     }
     ```
2. Compute derived fields per player per game:
   - `turnovers` = use the `Turnovers` column directly (ground-truth; `Thrower errors` and `Receiver errors` are kept as sub-breakdown fields)
   - `touchesPerPoint` = `Touches` / `Points played total` (guard divide-by-zero → 0)
   - `throwDistanceYards` = `Total completed throw distance (m)` × 1.09361 (convert once here, display everywhere as yards)
3. Write `src/lib/stores.js`: writable store `statsStore` initialized by calling `loadAllStats()` on mount
4. Write `scripts/build-manifest.js` (Node script, not part of the SvelteKit app) that walks `static/data/` and writes `static/data/manifest.json` — each entry: `{ tournament: "nationals", files: ["Player Stats vs. Toro 2026-08-11_12-30-00.csv", ...] }`

**Relevant Context:**
- CSV columns: `Player, Points played total, Points played, Offense points played, Defense points played, Offense points won, Defense points won, Touches, Points played with touches, Throws, Catches, Possessions initiated, Assists, Secondary assists, Goals, Turnovers, Thrower errors, Receiver errors, Defensive blocks, Stall outs for, Stall outs against, Total completed throw distance (m), Total completed throw gain (m), Average completed throw distance (m), Average completed throw gain (m), Total caught pass distance (m), Total caught pass gain (m), Average caught pass distance (m), Average caught pass gain (m)`
- Note: `Points played` column contains a quoted comma-separated list of point numbers (e.g. `"1,3,5"`). The actual count of points played is in `Points played total` — use this for `touchesPerPoint`.
- `Turnovers` is the ground-truth column. `Thrower errors` + `Receiver errors` is a sub-breakdown that does **not** always sum to `Turnovers` (some TOs are stall-outs or uncategorised). Keep all three available in the data structure.
- Distance conversion: 1 metre = 1.09361 yards. Apply in `data.js` so all consumers receive yards.
- Player numbers are prefixed to names (e.g. `"22 Theo Chandler-Nantel"`) — strip the number for display or keep as-is for uniqueness.

**Status:** [ ] pending

---

### Sub-Task 3 — Tournament Overview Page

**Intent:** Build the home page (`/`) showing a tournament-level summary: game results, team-wide stats per game, and a trend chart.

**Expected Outcomes:**
- Tournament selector at the top: multi-select checkboxes for each available tournament + a "Combined" shortcut
- Lists all games for the selected tournament(s) (opponent + date)
- Shows team totals per game: total touches, total turnovers, total throw distance (yards)
- Bar chart showing touches vs. turnovers per game (visual efficiency trend)
- Navigation links to leaderboard and player pages

**Todo List:**
1. Create `src/routes/+page.svelte`
2. On mount, load data from `statsStore` (which includes all tournaments from manifest)
3. Render tournament selector: one checkbox per tournament name, default all selected
4. Filter displayed games to selected tournaments
5. Render a game-results table (columns: Tournament, Opponent, Date, Team Touches, Team Turnovers, Team Throw Distance (yds))
6. Aggregate team totals per game by summing all player rows for that game
7. Render a grouped bar chart (Chart.js via svelte-chartjs): x-axis = opponent/game, two bars per game = Touches and Turnovers
8. Add nav links: "Leaderboard →"

**Relevant Context:**
- One row per player per game — sum all players in a game for team totals
- Chart library: `svelte-chartjs` wrapping `Chart.js` Bar chart
- Keep layout simple: header + game table + chart

**Status:** [ ] pending

---

### Sub-Task 4 — Player Leaderboard Page

**Intent:** Build `/leaderboard` showing all players ranked by the priority metrics across the whole tournament.

**Expected Outcomes:**
- Respects the tournament selection from the overview (passed via URL query param or store)
- Table of all players with aggregated stats across selected tournaments
- Columns: Player, Points Played, Touches, Turnovers, Thrower Errors, Receiver Errors, Touches/Point, Throw Distance (yds), Assists, Goals, Blocks
- Default sort: Touches descending
- Column headers are clickable to re-sort
- Efficiency indicator: turnovers highlighted red if above a threshold (e.g. > 3 across tournament)
- Touches/Point displayed to 2 decimal places
- Horizontal bar chart showing top 10 players by touches

**Todo List:**
1. Create `src/routes/leaderboard/+page.svelte`
2. Load aggregated player data from `statsStore`
3. Implement client-side sort state (reactive `sortKey` + `sortDir`)
4. Render sortable table with all required columns
5. Apply conditional CSS class to turnovers cell when value exceeds threshold
6. Render horizontal bar chart (Chart.js) for top-10 touches
7. Each player name links to `/player/[name]`

**Relevant Context:**
- Player names with number prefixes make good unique keys (e.g. `"22 Theo Chandler-Nantel"`)
- URL-encode player name for route param: `encodeURIComponent(player.name)`
- Aggregated stats come from `statsStore.tournaments[name].players`

**Status:** [ ] pending

---

### Sub-Task 5 — Player Drill-Down Page

**Intent:** Build `/player/[name]` showing a single player's performance across all games in the tournament — the game-by-game breakdown.

**Expected Outcomes:**
- Player name + jersey number shown as heading
- Summary stat cards: total touches, total turnovers, avg touches/point, total throw distance
- Table: one row per game (Opponent, Date, Points Played, Touches, Turnovers, Touches/Point, Throw Distance, Assists, Goals, Blocks)
- Line chart: touches per point trend across games (x = game/opponent, y = touches/point)
- Back navigation to leaderboard

**Todo List:**
1. Create `src/routes/player/[name]/+page.svelte`
2. Read `[name]` from `$page.params.name` (URL-decoded)
3. Filter game-level rows for this player from `statsStore`
4. Compute summary stat cards (sum/average as appropriate)
5. Render per-game table sorted by game date ascending
6. Render line chart (Chart.js Line) for touches/point across games
7. Add "← Back to Leaderboard" link

**Relevant Context:**
- Game date is parsed from the filename in the data layer (Sub-Task 2)
- `touchesPerPoint` = `Touches` / `Points played total` per game row (0 if points played = 0)
- Some players have 0 touches in some games — handle gracefully (show 0, not NaN)
- Throw distance already in yards from the data layer — label columns as `yds`
- Turnovers breakdown (Thrower errors / Receiver errors) shown in a collapsible or sub-row for transparency

**Status:** [ ] pending

---

### Sub-Task 6 — Styling & Polish

**Intent:** Apply consistent, readable styling so the dashboard looks professional locally. No external CSS framework required — plain CSS with CSS variables is sufficient.

**Expected Outcomes:**
- **Dark theme** with a clear color palette (dark backgrounds, high-contrast text, accent colors for priority metrics)
- Responsive layout (works at 1280px wide minimum)
- Priority metrics (touches, turnovers) visually distinguished from secondary stats
- Turnovers column styled red when high
- Charts have consistent color scheme matching the UI theme
- Navigation is clearly visible on all pages

**Todo List:**
1. Create `src/app.css` with CSS variables (colors, fonts, spacing)
2. Import `app.css` in `src/routes/+layout.svelte`
3. Style tables: alternating row color, sticky header
4. Style stat cards on the player drill-down page
5. Ensure chart colors match theme (pass color arrays to Chart.js datasets)
6. Add a simple top nav bar (Tournament Overview | Leaderboard) to `+layout.svelte`

**Relevant Context:**
- No external CSS framework needed — keep it minimal
- SvelteKit scoped `<style>` blocks per component for component-specific styles
- Global styles in `src/app.css`

**Status:** [ ] pending

---

### Sub-Task 7 — Manifest Build Script & README

**Intent:** Make it easy to add new tournaments/games and document how to run and extend the dashboard.

**Expected Outcomes:**
- `scripts/build-manifest.js` can be run with `node scripts/build-manifest.js` to regenerate `static/data/manifest.json`
- `package.json` has a `"manifest"` script alias for the above
- `README.md` explains: how to run locally, how to add a new tournament, how to add a new game CSV, and how to deploy to a static host

**Todo List:**
1. Finalize `scripts/build-manifest.js` (walks `static/data/`, groups CSVs by folder, writes `manifest.json`)
2. Add `"manifest": "node scripts/build-manifest.js"` to `package.json` scripts
3. Write `README.md` covering:
   - Prerequisites (Node 18+)
   - `npm run manifest && npm run dev` to start
   - Folder structure explanation
   - How to add a new tournament (create folder, drop CSVs, re-run manifest)
   - How to deploy (`npm run build` → copy `build/` to any static host)

**Status:** [ ] pending

---

## Key Decisions & Constraints

| Decision | Choice | Reason |
|---|---|---|
| Framework | SvelteKit + Vite | Concise reactivity, file-based routing, small bundle |
| Charts | Chart.js + svelte-chartjs | Mature, well-documented, works with SSR off |
| CSV parsing | papaparse | Battle-tested, handles quoted fields (the `Points played` list column) |
| Data loading | Static assets + fetch | No server needed; works locally and on static hosts |
| Directory discovery | manifest.json | Browsers cannot list directories; manifest is regenerated by a script |
| Distance units | **Yards** (converted in data layer) | Multiply metres × 1.09361 once in `data.js`; all UI receives yards |
| Turnovers | **`Turnovers` column** (ground truth) | `Thrower errors` + `Receiver errors` do not always sum to `Turnovers`; kept as transparency breakdown |
| Theme | **Dark** | User preference |
| Multi-tournament | **Checkbox selector** on overview page | Allows combined or individual tournament views; selection shared via store |
