import cloudscraper
from bs4 import BeautifulSoup
import openpyxl
from openpyxl.styles import Font, Alignment
import re
import time
import os
import sys
import json
from datetime import datetime

# --- CONFIGURATION ---
TOTAL_ROUNDS = 5  # Default, can be detected?

# Determine Project Root (Parent of 'scripts' folder)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)

# Define paths relative to Project Root
WEBAPP_DIR = os.path.join(PROJECT_ROOT, "webapp")
DATA_DIR = os.path.join(WEBAPP_DIR, "public", "data")
RAW_DIR = os.path.join(DATA_DIR, "raw")
DB_PATH = os.path.join(DATA_DIR, "db.json")

# Setup Scraper
scraper = cloudscraper.create_scraper(
    browser={
        'browser': 'chrome',
        'platform': 'windows',
        'desktop': True
    }
)

def clean_filename(name):
    return "".join([c for c in name if c.isalpha() or c.isdigit() or c in " ._-"]).strip()

def clean_name(name_str):
    if not name_str: return ""
    # Remove (Drop) or (Quit) markers often found
    name_str = re.sub(r"\s*\(.*?\)", "", name_str)
    return name_str.strip()

def get_soup(url):
    try:
        response = scraper.get(url)
        if "Just a moment" in response.text:
            print("  !! Cloudflare Challenge Detected. Waiting 5s...")
            time.sleep(5)
            response = scraper.get(url) # Retry once
        
        if response.status_code == 200:
            return BeautifulSoup(response.text, 'html.parser')
    except Exception as e:
        print(f"  !! Request Error: {e}")
    return None

def scrape_round(tourney_id, round_num):
    url = f"https://aetherhub.com/Tourney/RoundTourney/{tourney_id}?p={round_num}"
    soup = get_soup(url)
    if not soup: return []

    # Check for correct round pagination
    # AetherHub often defaults to page 1 if page N doesn't exist
    active_page = soup.find('li', class_='page-item active')
    if active_page:
        try:
            active_num = int(active_page.text.strip())
            if active_num != round_num:
                print(f"  (Requested Round {round_num}, but got Round {active_num}. Stopping.)")
                return []
        except: pass

    matches = []
    
    # Generic table finder
    tables = soup.find_all('table')
    target_table = None
    for t in tables:
        headers = [th.text.lower() for th in t.find_all('th')]
        if any("player" in h for h in headers) and any("result" in h for h in headers):
            target_table = t
            break
            
    if not target_table:
        # Fallback to id
        target_table = soup.find("table", {"id": "matchList"})

    if target_table:
        rows = target_table.find_all('tr')
        for row in rows:
            cols = row.find_all('td')
            if len(cols) < 4: continue
            
            p1 = clean_name(cols[1].text)
            p2_raw = cols[2].text.strip()
            p2 = clean_name(p2_raw)
            result = cols[3].text.strip()
            
            p1_wins = 0
            p2_wins = 0
            draws = 0
            
            # Parse result "2-0-0"
            # Some results are "2-0"
            parts = result.replace(" ", "").split("-")
            try:
                if len(parts) >= 2:
                    p1_wins = int(parts[0])
                    p2_wins = int(parts[1])
                    if len(parts) > 2: draws = int(parts[2])
            except: pass

            # Handle BYE
            is_bye = "BYE" in p2.upper() or not p2
            if is_bye:
                p2 = "BYE"
                p1_wins = 2
                p2_wins = 0
            
            matches.append({
                "p1": p1, "p2": p2, 
                "p1_wins": p1_wins, "p2_wins": p2_wins, "draws": draws
            })
            
    return matches

def calculate_standings(all_matches):
    stats = {}
    
    for r_matches in all_matches.values():
        for m in r_matches:
            p1 = m["p1"]
            p2 = m["p2"]
            
            if p1 not in stats: stats[p1] = {"points": 0, "w": 0, "l": 0, "d": 0, "omw": 0.0, "gw": 0.0, "ogw": 0.0, "mw": 0.0}
            if p2 != "BYE" and p2 not in stats: stats[p2] = {"points": 0, "w": 0, "l": 0, "d": 0, "omw": 0.0, "gw": 0.0, "ogw": 0.0, "mw": 0.0}
            
            # Update P1
            if m["p1_wins"] > m["p2_wins"]:
                stats[p1]["points"] += 3
                stats[p1]["w"] += 1
                if p2 != "BYE": stats[p2]["l"] += 1
            elif m["p2_wins"] > m["p1_wins"]:
                if p2 != "BYE": 
                    stats[p2]["points"] += 3
                    stats[p2]["w"] += 1
                stats[p1]["l"] += 1
            else:
                stats[p1]["points"] += 1
                stats[p1]["d"] += 1
                stats[p1]["points"] += 1
                if p2 != "BYE": 
                    stats[p2]["d"] += 1
                    stats[p2]["points"] += 1 
    
    # Convert to list and sort
    standings_list = []
    for name, s in stats.items():
        # Basic tiebreaker: Points > OMW (Set to 0) > GW (Set to 0)
        standings_list.append({
            "name": name,
            **s
        })
        
    standings_list.sort(key=lambda x: x["points"], reverse=True)
    return standings_list

def get_user_tournaments(user_url):
    print(f"Scanning user profile: {user_url}...")
    try:
        response = scraper.get(user_url)
        if response.status_code != 200:
            print(f"Failed to load user profile (Status {response.status_code}).")
            return []
        
        soup = BeautifulSoup(response.text, 'html.parser')
        # Look for RoundTourney links
        links = soup.find_all('a', href=re.compile(r'/Tourney/RoundTourney/\d+'))
        
        found_ids = []
        for link in links:
            href = link['href']
            match = re.search(r"RoundTourney/(\d+)", href)
            if match:
                t_id = match.group(1)
                if t_id not in found_ids:
                    found_ids.append(t_id)
        return found_ids
    except Exception as e:
        print(f"Error scanning user: {e}")
        return []

def get_next_week_number():
    next_week = 1
    # Try reading from db.json first (most accurate source of truth)
    if os.path.exists(DB_PATH):
        try:
            with open(DB_PATH, "r", encoding="utf-8") as f:
                db = json.load(f)
                max_week = 0
                for t_id in db.get("tournaments", {}):
                    # Expecting "week-XX"
                    match = re.search(r"week-(\d+)", t_id)
                    if match:
                        w = int(match.group(1))
                        if w > max_week: max_week = w
                if max_week > 0:
                    next_week = max_week + 1
                    print(f"Found latest week in DB: {max_week}. Next week: {next_week}")
                    return next_week
        except Exception as e:
            print(f"Error reading DB: {e}")
    
    # Fallback: Check raw JSON files
    if os.path.exists(RAW_DIR):
        files = os.listdir(RAW_DIR)
        max_week = 0
        for f in files:
            match = re.search(r"week-(\d+)", f.lower())
            if match:
                w = int(match.group(1))
                if w > max_week: max_week = w
        if max_week > 0:
            next_week = max_week + 1
            print(f"Found latest raw file week: {max_week}. Next week: {next_week}")
            
    return next_week

def main():
    print("\n=== Aetherhub to MTG League Import ===")
    
    # Check for command line arguments
    user_input = None
    if len(sys.argv) > 1:
        user_input = sys.argv[1]
        print(f"Using argument: {user_input}")
    else:
        user_input = input("Enter Username, Tournament ID or URL: ").strip()
    
    t_id = None
    
    # Check if input is digits (ID)
    if user_input.isdigit():
        t_id = user_input
    # Check if input is RoundTourney URL
    elif "RoundTourney" in user_input:
        match = re.search(r"RoundTourney/(\d+)", user_input)
        if match: t_id = match.group(1)
    # Assume Username or User URL
    else:
        user_url = user_input
        if "aetherhub.com" not in user_input:
            user_url = f"https://aetherhub.com/User/{user_input}"
            
        recent_ids = get_user_tournaments(user_url)
        
        if not recent_ids:
            print("No tournaments found for this user.")
            return 
            
        t_id_newest = recent_ids[0]
        
        # Get Title for confirmation
        url = f"https://aetherhub.com/Tourney/RoundTourney/{t_id_newest}"
        title = f"Tournament {t_id_newest}"
        try:
            soup = get_soup(url)
            if soup:
                header = soup.find("h1") or soup.find("span", class_="text-2xl")
                if header: title = header.text.strip()
        except: pass
        
        print(f"\nAuto-selecting newest tournament: {title} (ID: {t_id_newest})")
        t_id = t_id_newest

    if not t_id:
        print("Invalid ID.")
        return

    # Ask for Week Number
    if len(sys.argv) > 2:
        week_str = sys.argv[2]
        print(f"Using Week Number argument: {week_str}")
    elif len(sys.argv) > 1:
        # Argument provided for user, but no week -> Auto-calc
        print("No week argument. Auto-calculating...")
        week_str = str(get_next_week_number())
    else:
        # Interactive mode
        week_input = input("Enter League Week Number (Leave empty for auto): ").strip()
        if not week_input:
             week_str = str(get_next_week_number())
        else:
             week_str = week_input

    if not week_str.isdigit():
        print("Invalid Week Number.")
        return
    week_num = int(week_str)

    print(f"\nScraping Tournament {t_id}...")
    
    # Get Title
    soup = get_soup(f"https://aetherhub.com/Tourney/RoundTourney/{t_id}")
    if soup:
        header = soup.find("h1") or soup.find("span", class_="text-2xl") 
    
    all_matches = {}
    total_rounds = 0
    
    for r in range(1, 10): # Try up to 9 rounds
        print(f"  Reading Round {r}...", end="")
        matches = scrape_round(t_id, r)
        if not matches:
            print(" No matches found. Finished.")
            break
        print(f" {len(matches)} matches.")
        all_matches[r] = matches
        total_rounds = r
        time.sleep(1)
        
    if not all_matches:
        print("No data collected.")
        return

    # Process Standings
    print("Calculating Standings...")
    standings = calculate_standings(all_matches)
    
    # --- SAVE TO JSON ---
    output_data = {
        "id": f"week-{week_num}",
        "name": f"Week {week_num}",
        "date": datetime.now().strftime("%Y-%m-%d"),
        "week_number": week_num,
        "metadata": {
            "aetherhub_id": t_id,
            "players": len(standings),
            "rounds": total_rounds,
            "prize_pool": 0,    # Manual if needed
            "top_cut": 0
        },
        "standings": standings,
        "rounds": []
    }
    
    # Format matches into rounds list
    for r in sorted(all_matches.keys()):
        output_data["rounds"].append({
            "round": r,
            "matches": all_matches[r]
        })

    # Ensure output directory exists
    os.makedirs(RAW_DIR, exist_ok=True)
    
    filename = os.path.join(RAW_DIR, f"week-{week_num}.json")
    
    # Check if exists
    if os.path.exists(filename):
        print(f"File {filename} exists. Overwriting...")
        
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2)
        
    print(f"\nSuccess! Saved to: {filename}")
    print("Next: Run 'python scripts/convert_data.py' to merge this into the database.")

if __name__ == "__main__":
    main()