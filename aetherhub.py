import cloudscraper
from bs4 import BeautifulSoup
import openpyxl
import re
import time
import os
import sys

# --- CONFIGURATION ---
TOTAL_ROUNDS = 4 

# Setup Scraper globally
scraper = cloudscraper.create_scraper()

def clean_filename(name):
    """Standardizes filename cleaning."""
    return "".join([c for c in name if c.isalpha() or c.isdigit() or c in " ._-"]).strip()

def get_tournament_title(tourney_id):
    """Fetches just the title of a tournament to check existence."""
    url = f"https://aetherhub.com/Tourney/RoundTourney/{tourney_id}?p=1"
    try:
        response = scraper.get(url)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            header = soup.find("span", class_="text-2xl") 
            if not header: header = soup.find("h1")
            if header:
                raw_title = header.text.strip().replace(":", "").replace("/", "-")
                return clean_filename(raw_title)
    except:
        pass
    return f"Tournament_{tourney_id}"

def get_user_tournaments(user_url):
    """Scrapes a user profile for the most recent RoundTourney IDs."""
    print(f"Scanning user profile: {user_url}...")
    try:
        response = scraper.get(user_url)
        if response.status_code != 200:
            print(f"Failed to load user profile (Status {response.status_code}).")
            return []
        
        soup = BeautifulSoup(response.text, 'html.parser')
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

def clean_name(name_str):
    if not name_str: return ""
    match = re.search(r"(.*?) \(", name_str)
    cleaned = match.group(1).strip() if match else name_str.strip()
    if "BYE" in cleaned.upper(): return ""
    return cleaned

# --- STEP 1: PARSE INPUT ---

print("--- Aetherhub Scraper v7 ---")

if len(sys.argv) > 1:
    raw_input = sys.argv[1].strip()
else:
    raw_input = input("Enter Username, Link, or ID: ").strip()

target_tourney_id = None
target_tourney_name = None
user_url_to_scan = None

# Logic to determine what the input is
if "aetherhub.com" in raw_input:
    # It's a full URL
    if "/User/" in raw_input:
        user_url_to_scan = raw_input
    elif "RoundTourney" in raw_input:
        match = re.search(r"RoundTourney/(\d+)", raw_input)
        if match: target_tourney_id = match.group(1)
elif raw_input.isdigit():
    # It's just a Tournament ID (e.g., 96876)
    target_tourney_id = raw_input
else:
    # It's just a Username
    print(f"Detected username: '{raw_input}'. Constructing URL...")
    user_url_to_scan = f"https://aetherhub.com/User/{raw_input}"

# --- STEP 2: RESOLVE USER (If applicable) ---

if user_url_to_scan:
    recent_ids = get_user_tournaments(user_url_to_scan)
    
    if not recent_ids:
        print("No tournaments found for this user.")
        sys.exit()
        
    print(f"Found {len(recent_ids)} tournaments. Checking top 3...")
    
    for i, t_id in enumerate(recent_ids[:3]):
        title_candidate = get_tournament_title(t_id)
        expected_filename = f"{title_candidate}_Raw.xlsx"
        
        print(f"  {i+1}. ID {t_id}: '{title_candidate}'")
        
        if os.path.exists(expected_filename):
            print(f"     -> Exists: {expected_filename} (Skipping)")
        else:
            print(f"     -> New! Scraping this one.")
            target_tourney_id = t_id
            target_tourney_name = title_candidate
            break
            
    if not target_tourney_id:
        print("All recent tournaments are already saved.")
        sys.exit()

if not target_tourney_id:
    print("Could not determine a valid Tournament ID.")
    sys.exit()

# --- STEP 3: PERFORM SCRAPE ---

base_url = f"https://aetherhub.com/Tourney/RoundTourney/{target_tourney_id}"
print(f"\nStarting Scrape for ID: {target_tourney_id}...")

all_rounds_data = {}

if not target_tourney_name:
    target_tourney_name = f"Tournament_{target_tourney_id}"

for round_num in range(1, TOTAL_ROUNDS + 1):
    url = f"{base_url}?p={round_num}"
    print(f"Processing Round {round_num}...")
    
    try:
        response = scraper.get(url)
    except:
        continue
    
    if response.status_code != 200: continue

    soup = BeautifulSoup(response.text, 'html.parser')
    
    # Grab Title from page if we don't have it (e.g. direct ID input)
    if round_num == 1 and target_tourney_name.startswith("Tournament_"):
        header = soup.find("span", class_="text-2xl") 
        if not header: header = soup.find("h1")
        if header:
            raw_title = header.text.strip().replace(":", "").replace("/", "-")
            target_tourney_name = clean_filename(raw_title)

    pairing_table = soup.find("table", {"id": "matchList"})
    if not pairing_table: pairing_table = soup.find("table") 
    if not pairing_table: continue

    rows = pairing_table.find_all('tr')
    round_matches = []

    for row in rows:
        if row.find('th'): continue 
        cols = row.find_all('td')
        if len(cols) < 4: continue

        p1_raw = cols[1].text.strip()
        p2_raw = cols[2].text.strip()
        result_raw = cols[3].text.strip()

        p1_name = clean_name(p1_raw)
        p2_name = clean_name(p2_raw)

        p1_wins, p2_wins = 0, 0
        if "-" in result_raw:
            parts = result_raw.split("-")
            if len(parts) >= 2:
                try:
                    p1_wins = int(parts[0].strip())
                    p2_wins = int(parts[1].strip())
                except: pass 
        
        if p2_name == "":
            p1_wins = 2
            p2_wins = 0

        round_matches.append([p1_name, p2_name, p1_wins, p2_wins, 0])
        
    all_rounds_data[round_num] = round_matches
    time.sleep(1)

# --- STEP 4: SAVE ---
if all_rounds_data:
    final_filename = f"{target_tourney_name}_Raw.xlsx"
    
    # Avoid overwrite if scanning user
    if os.path.exists(final_filename) and user_url_to_scan:
        final_filename = f"{target_tourney_name}_Raw_{int(time.time())}.xlsx"

    wb = openpyxl.Workbook()
    ws = wb.active
    
    # Collect all players while writing matches
    all_players = set()
    
    for r_num in sorted(all_rounds_data.keys()):
        for match in all_rounds_data[r_num]:
            p1, p2 = match[0], match[1]
            if p1:
                all_players.add(p1)
            if p2:
                all_players.add(p2)
            ws.append(match)
        ws.append([]) 
    
    # Add player list below matches
    ws.append([])
    ws.append(["All Players:"])
    for player in sorted(all_players):
        ws.append([player])

    ws.column_dimensions['A'].width = 25
    ws.column_dimensions['B'].width = 25
    
    wb.save(final_filename)
    print(f"\nSuccess! Saved to: {final_filename}")
else:
    print("No data collected.")