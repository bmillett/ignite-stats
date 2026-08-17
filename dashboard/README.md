# Frisbee Stats Dashboard

A local SvelteKit dashboard for viewing Ultimate Frisbee tournament statistics.
Reads CSV stat files exported from the game tracker, parses them in the browser,
and presents three views: a tournament overview, a player leaderboard, and a
per-player game-by-game drill-down.

## Prerequisites

- **Node.js 18+** (includes `npm`)

## Getting started

```bash
# 1. Install dependencies (first time only)
cd dashboard
npm install

# 2. Regenerate the data manifest (run any time you add/remove CSV files)
npm run manifest

# 3. Start the dev server
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

## Folder structure

```
stats/
  dashboard/
    scripts/
      build-manifest.js   ← regenerates static/data/manifest.json
    src/
      app.css             ← global dark-theme CSS variables
      lib/
        data.js           ← CSV fetching, parsing, aggregation
        stores.js         ← Svelte stores (statsStore, selectedTournaments)
      routes/
        +layout.svelte    ← top nav bar, imports app.css
        +page.svelte      ← Tournament overview (/)
        leaderboard/
          +page.svelte    ← Player leaderboard (/leaderboard)
        player/[name]/
          +page.svelte    ← Player drill-down (/player/:name)
    static/
      data/
        manifest.json     ← auto-generated; do not edit by hand
        nationals/        ← one folder per tournament
          *.csv
```

## Adding a new tournament

1. Create a sub-folder under `static/data/` named after the tournament, e.g. `static/data/regionals/`.
2. Copy all CSV game files into that folder.
   Files must match the pattern: `Player Stats vs. {Opponent} {YYYY-MM-DD}_{HH-MM-SS}.csv`
3. Regenerate the manifest:
   ```bash
   npm run manifest
   ```
4. Refresh the browser — the new tournament appears in the selector automatically.

## Adding a new game to an existing tournament

1. Copy the new CSV file into the correct tournament folder under `static/data/`.
2. Re-run `npm run manifest`.
3. Refresh the browser.

## CSV column requirements

The dashboard expects the following columns (as exported by the game tracker):

| Column | Used for |
|---|---|
| `Player` | Player identity (format: `"22 First Last"`) |
| `Points played total` | Points played count; denominator for Touches/Point |
| `Touches` | Primary metric |
| `Turnovers` | Ground-truth turnover count |
| `Thrower errors` | Breakdown sub-field (transparency only) |
| `Receiver errors` | Breakdown sub-field (transparency only) |
| `Total completed throw distance (m)` | Converted to yards in the data layer (× 1.09361) |
| `Assists`, `Goals`, `Defensive blocks` | Secondary metrics |

## Deploying to a static host

```bash
npm run build
```

This outputs a fully static site to `build/`. Upload that folder to any static
host (GitHub Pages, Netlify, Cloudflare Pages, etc.).

> **Note:** Because data is loaded via `fetch()` at runtime, the `static/data/`
> folder (including `manifest.json` and all CSV files) must be included in the
> deployment.
