# Scripts

These scripts form the data pipeline for the Oslo Legacy League website. Run them from the `scripts/` directory.

## Workflow

The easiest way is the master script, which handles everything interactively:

```bash
python weekly_update.py
```

Or run the steps individually:

```
1. aetherhub.py   →  Scrape tournament from AetherHub → raw JSON
2. verify_data.py →  Verify player names & assign decklists
3. convert_data.py → Rebuild db.json from all raw files
```

---

## weekly_update.py

Interactive master script that runs the full weekly pipeline (pull → scrape → verify → rebuild → build → publish). Calls the other scripts — no duplicated logic.

### Usage

```bash
python weekly_update.py
```

No arguments needed. The script will:

1. Pull latest changes from GitHub
2. Ask who the TO was (Anders / Tormod / Viktor, or enter manually)
3. Ask how many non-paying players (default: 1)
4. Run `aetherhub.py` with the chosen settings
5. Run `verify_data.py` interactively
6. Run `convert_data.py`
7. Build the website (`npm run build`)
8. Commit and push to GitHub

---

## aetherhub.py

Scrapes tournament data from AetherHub and outputs a `week-N.json` file into `webapp/public/data/raw/`.

### Usage

```bash
python aetherhub.py <target> [week] [-to N]
```

| Argument | Description |
|----------|-------------|
| `target` | AetherHub username, tournament ID, or full URL. If omitted, you'll be prompted. |
| `week` | Week number for the output file. Auto-calculated from existing files if omitted. |
| `-to N` | Number of non-paying Tournament Organizer players (default: 1). Affects prize pool calculation. |

### Known TO Accounts

| TO | AetherHub Username |
|----|--------------------|
| Anders | `Fydun` |
| Tormod | `BlindFlip` |
| Viktor | `Anonym_from_north` |

### Examples

```bash
python aetherhub.py Fydun                          # scrape Anders' latest tournament
python aetherhub.py BlindFlip -to 1                # scrape Tormod's latest tournament
python aetherhub.py Anonym_from_north -to 1        # scrape Viktor's latest tournament
python aetherhub.py 12345                          # scrape by tournament ID
python aetherhub.py 12345 92                       # scrape as week 92
python aetherhub.py 12345 92 -to 2                 # 2 non-paying TOs
```

### Output

Writes `webapp/public/data/raw/week-N.json` containing standings, round-by-round match data, metadata, and prize pool.

---

## verify_data.py

Interactive CLI tool for verifying player names against `Players.txt` and assigning decklists from `Decklist.txt`. Uses fuzzy matching with autocomplete.

### Prerequisites

```bash
pip install rapidfuzz prompt_toolkit
```

### Usage

```bash
python verify_data.py [file]
```

| Argument | Description |
|----------|-------------|
| `file` | Week file to verify — accepts a number (`91`), filename (`week-91.json`), or full path. Defaults to the newest `week-*.json`. |

### Examples

```bash
python verify_data.py           # verify newest week file
python verify_data.py 91        # verify week 91
python verify_data.py week-85.json
```

### Features

- **Fuzzy name matching** — suggests closest matches from `Players.txt` with ranked scoring
- **Deck autocomplete** — dropdown completion from `Decklist.txt`
- **Deck history** — shows each player's last 3 distinct decks as quick-pick options
- **Auto-accept** — exact name matches are accepted automatically (with option to override)
- **Atomic saves** — writes to a temp file first, then replaces, to prevent data loss

---

## convert_data.py

Reads all `week-*.json` files from `webapp/public/data/raw/`, aggregates them into leagues, and writes `webapp/public/data/db.json`.

### Prerequisites

Requires `pandas` (use system Python if your venv doesn't have it).

### Usage

```bash
python convert_data.py
```

No arguments — it processes all raw files automatically.

### What it does

1. Reads every `week-*.json` in the raw data folder
2. Assigns each tournament to a league based on week-number ranges (defined in `get_league_info()`)
3. Calculates league standings using a "best N of M" scoring rule (defined in `LEAGUE_RULES`)
4. Tracks tiebreakers: 4-0 records, 3-0 records, 3-1 records
5. Builds an all-time league from every tournament
6. Writes the final `db.json`

### Adding a new league season

Update two places in `convert_data.py`:

1. **`LEAGUE_RULES`** — add the league ID and best-N count
2. **`get_league_info()`** — add the week-number range mapping to the league ID
