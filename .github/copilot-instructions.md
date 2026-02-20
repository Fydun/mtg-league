# MTG League – Copilot Instructions

## Architecture Overview

Dual-stack app: **Python scripts** scrape & process data → **React + Vite webapp** renders it.
All data flows through a single `db.json` file — there is no backend API at runtime.

```
scripts/aetherhub.py  →  webapp/public/data/raw/week-N.json  (per-tournament JSON)
scripts/convert_data.py  →  webapp/public/data/db.json        (aggregated DB)
webapp (React)  →  fetches db.json at startup via DataContext
vite build  →  docs/                                          (GitHub Pages)
```

## Data Pipeline (Python)

- **`scripts/aetherhub.py`** – Scrapes tournament data from AetherHub. Accepts a username, tournament ID, or URL. Outputs `webapp/public/data/raw/week-N.json`. Uses `cloudscraper` + `BeautifulSoup`. Run: `python scripts/aetherhub.py <target> [week]`.
- **`scripts/convert_data.py`** – Reads all `raw/week-*.json` files, aggregates them into leagues based on week-number ranges defined in `LEAGUE_RULES` and `get_league_info()`, and writes `webapp/public/data/db.json`. Run: `python scripts/convert_data.py`.
- **Adding a new league season**: Update both `LEAGUE_RULES` (best-N count) and `get_league_info()` (week-range → league-id mapping) in `convert_data.py`.
- Raw JSON schema: `{ id, name, date, week_number, metadata: { aetherhub_id, players, rounds, prize_pool, ... }, standings: [{ rank, name, deck, points, record, wins, losses, draws, omw, gw, ogw, mw, payout }], rounds: [{ round, matches }] }`.

## Webapp (React + Vite)

### Key Commands

```bash
cd webapp
npm run dev       # Vite dev server
npm run build     # Build to ../docs + copies index.html → 404.html for SPA routing on GitHub Pages
npm run lint      # ESLint
```

### Conventions

- **React 19, JSX only** — no TypeScript. Functional components with default exports.
- **Styling**: Tailwind CSS utility classes exclusively (dark `slate-*` theme). No CSS modules or styled-components.
- **State**: Single `DataContext` provides `{ data, loading, error }` from one `db.json` fetch. Components use `useData()` hook. No other global state. URL search params (`useSearchParams`) drive active league on Dashboard.
- **Routing**: React Router v7 — three routes: `/` (Dashboard), `/tournament/:tournamentId`, `/player/:playerName`.
- **Charts**: Recharts library (`LineChart`, `PieChart`, `BarChart`).

### Component Patterns

- **Pages** (`src/pages/`): `Dashboard`, `TournamentDetail`, `PlayerProfile` — each reads from `useData()` and derives display data via `useMemo`.
- **Components** (`src/components/`): Presentational, receive data via props. No prop-types validation.
- `LeagueTable` — standings table with rank badges (gold/silver/bronze top 3).
- `ScoreMatrix` — heat-mapped grid with sticky columns, dual-table scroll sync, best-N highlighting.
- `PerformanceChart` — cumulative score line chart with interactive legend (click to toggle, hover to highlight).
- `DeckChart` — pie chart of deck metagame; filters out an `EXCLUDED_DECKS` list, groups overflow into "Others".
- `MatchTable` — round-by-round match results, winner highlighted green with 🏆.

### Build & Deploy

Vite builds to `../docs/` (configured in `vite.config.js`). The `docs/` folder is served by GitHub Pages. The build script also copies `index.html` to `404.html` for client-side routing fallback. The `CNAME` file in `docs/` and at root controls the custom domain.

## db.json Schema

```
{
  "leagues": [{ id, name, max_counted, tournaments: [ids], standings: [{ rank, name, points, wins, losses, draws, matches, tournaments_played, tournaments_display, lowest_counting, history }] }],
  "tournaments": { "week-N": { ...raw tournament data } }
}
```

Leagues are sorted: newest first, all-time league listed last. Standings within each league are sorted by total points descending, with a "best N of M" scoring rule dropping lowest results.
