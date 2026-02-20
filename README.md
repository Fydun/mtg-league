# Oslo Legacy League Manager

A dual-stack application for managing Magic: The Gathering league data.
It consists of a Python backend for data scraping/processing and a React frontend for displaying the league website.

## Project Structure

- **/scripts**: Python scripts for scraping AetherHub and processing data.
- **/webapp**: React + Vite application for the frontend. (See [webapp/README.md](webapp/README.md) for details)
- **/docs**: Build output directory (served via GitHub Pages).

## Setup & Usage

### Backend (Python)

Scripts are located in `scripts/`.

1.  **Scrape Data**:

    ```bash
    python scripts/aetherhub.py
    ```

    (See script for CLI arguments like `-to`, `-url`, etc.)

2.  **Process Data**:
    ```bash
    python scripts/convert_data.py
    ```
    Regenerates `webapp/public/data/db.json` from the raw data files.

### Frontend (React)

Located in `webapp/`.

See the dedicated [webapp README](webapp/README.md) for setup and development instructions.

## Data Workflow

1.  Raw tournament JSONs are stored in `webapp/public/data/raw/`.
2.  `convert_data.py` aggregates them into `webapp/public/data/db.json`.
3.  The React app fetches `db.json` to render the UI.
