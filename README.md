# Oslo Legacy League Manager

A dual-stack application for managing Magic: The Gathering league data.
It consists of Python scripts for data scraping/processing and a React frontend for displaying the league website.

## Project Structure

- **/scripts**: Python data pipeline — scraping, verification, and aggregation. See [scripts/README.md](scripts/README.md).
- **/webapp**: React + Vite frontend. See [webapp/README.md](webapp/README.md).
- **/docs**: Vite build output, served via GitHub Pages.

## Prerequisites

### Tools

| Tool | Version | Download |
|------|---------|----------|
| Git | any | [git-scm.com](https://git-scm.com) |
| Node.js | LTS (v18+) | [nodejs.org](https://nodejs.org) |
| Python | 3.10+ | [python.org](https://python.org) |

### Python packages

```bash
pip install -r scripts/requirements.txt
```

### Node packages

```bash
cd webapp
npm install
```

## Data Workflow

The easiest way to run the full weekly pipeline is the master script:

```bash
python scripts/weekly_update.py
```

It guides you through every step interactively: pull → scrape → verify → rebuild → build → publish.

The individual steps it runs, in order:

```
1. git pull
2. scripts/aetherhub.py    →  Scrape tournament from AetherHub → raw JSON
3. scripts/verify_data.py  →  Verify player names & assign decklists
4. scripts/convert_data.py →  Rebuild db.json from all raw files
5. npm run build + git push →  Build & publish website
```

### Known TO Accounts

| TO | AetherHub Username |
|----|--------------------|
| Anders | `Fydun` |
| Tormod | `BlindFlip` |
| Viktor | `Anonym_from_north` |

Raw tournament JSONs live in `webapp/public/data/raw/`. `convert_data.py` aggregates them into `webapp/public/data/db.json`, which the React app fetches at startup.

See [scripts/README.md](scripts/README.md) for full CLI usage of each script.

## Frontend

```bash
cd webapp
npm run dev       # dev server
npm run build     # build to ../docs (also writes 404.html for GitHub Pages SPA routing)
```
