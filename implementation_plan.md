# MTG League Web App Implementation Plan

## Goal
Migrate the MTG League management from Excel to a modern, responsive web application hosted on GitHub Pages. The app will display league standings, individual tournament results, and player statistics with a premium UI.

## User Review Required
> [!IMPORTANT]
> **Data Storage Strategy**: Since GitHub Pages is static, we will use **JSON files** stored in the repository as our "database".
> - `data/league.json`: Aggregated standings and player stats.
> - `data/tournaments/*.json`: Individual tournament details.
>
> This requires a build step (running a Python script) to update the JSON files whenever new tournament data is added (scraped or imported from Excel).

## Proposed Architecture

### 1. Frontend Stack (The "Nice UI")
- **Framework**: [React](https://react.dev/) (via [Vite](https://vitejs.dev/))
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) for a modern, responsive, and "premium" look (dark mode, glassmorphism).
- **Routing**: `react-router-dom` for navigation (League Table -> Tournament Details).
- **Host**: GitHub Pages.

### 2. Data Pipeline
- **Source**: Existing Excel files (historical) + New Scraped Data (future).
- **Processing**: A Python script (`process_data.py`) to:
    1. Read the "Master" Excel file (and individual tournament files).
    2. Normalize data (clean names, calculate points/wins).
    3. Generate the static JSON files for the frontend.

## Proposed Changes

### Frontend Setup
#### [NEW] `webapp/`
Initialize a new Vite project in a `webapp` subdirectory to keep it separate from the scraping scripts.
- `webapp/package.json`: Dependencies.
- `webapp/src/`: React source code.
- `webapp/public/data/`: Location for the generated JSON files.

### Data Processing
#### [NEW] `scripts/convert_data.py`
A script to convert the Excel history into the standard JSON schema.

#### [MODIFY] [aetherhub.py](file:///c:/Users/slk0anch/git/mtg-league/aetherhub.py)
Update the scraper to optionally output directly to the new JSON format or integrate with the processing pipeline.

## Verification Plan

### Automated Tests
- Verify JSON schema validity for generated files.
- Build the React app locally (`npm run build`) to ensure no errors.

### Manual Verification
- Run the local dev server (`npm run dev`) and check:
    - League table sorts correctly.
    - Tournament details load.
    - Responsive design works on mobile view.
