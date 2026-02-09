import json
import os
import re

# Configuration
DB_PATH = "webapp/public/data/db.json"
RAW_DIR = "webapp/public/data/raw"

def main():
    print(f"Extracting tournaments from {DB_PATH} to {RAW_DIR}...")
    
    if not os.path.exists(DB_PATH):
        print(f"Error: {DB_PATH} not found.")
        return

    os.makedirs(RAW_DIR, exist_ok=True)

    with open(DB_PATH, "r", encoding="utf-8") as f:
        db = json.load(f)

    tournaments = db.get("tournaments", {})
    count = 0

    for t_id, t_data in tournaments.items():
        # Ensure filename is safe
        filename = f"{t_id}.json"
        filepath = os.path.join(RAW_DIR, filename)
        
        # Save individual tournament file
        with open(filepath, "w", encoding="utf-8") as out:
            json.dump(t_data, out, indent=2)
        
        count += 1
        print(f"  Saved {filename}")

    print(f"\nSuccess! Extracted {count} tournaments.")

if __name__ == "__main__":
    main()
