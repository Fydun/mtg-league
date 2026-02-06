import cloudscraper
from bs4 import BeautifulSoup
import openpyxl
import re
import time
import os
import sys

# --- CONFIGURATION ---
TOTAL_ROUNDS = 4 

# Setup Scraper with specific browser headers to avoid detection
scraper = cloudscraper.create_scraper(
    browser={
        'browser': 'chrome',
        'platform': 'windows',
        'desktop': True
    }
)

def clean_filename(name):
    return "".join([c for c in name if c.isalpha() or c.isdigit() or c in " ._-"]).strip()

def get_tournament_title(tourney_id):
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

def find_correct_table(soup):
    """
    Scans all tables to find the one that actually looks like a pairings table.
    Looks for headers 'Player 1' or 'Result'.
    """
    tables = soup.find_all('table')
    for table in tables:
        # Check text content of the header row
        headers = table.find_all('th')
        header_text = " ".join([h.text for h in headers]).lower()
        
        if "player" in header_text or "result" in header_text:
            return table
            
    # Fallback: check if the table ID matches the known one
    specific_table = soup.find("table", {"id": "matchList"})
    if specific_table:
        return specific_table

    return None

# --- MAIN LOGIC ---

print("--- Aetherhub Scraper v8 (Robust) ---")

if len(sys.argv) > 1:
    raw_input = sys.argv[1].strip()
else:
    raw_input = input("Enter Username, Link, or ID: ").strip()

target_tourney_id = None
target_tourney_name = None
user_url_to_scan = None

# Determine input type
if "aetherhub.com" in raw_input:
    if "/User/" in raw_input:
        user_url_to_scan = raw_input
    elif "RoundTourney" in raw_input:
        match = re.search(r"RoundTourney/(\d+)", raw_input)
        if match: target_tourney_id = match.group(1)
elif raw_input.isdigit():
    target_tourney_id = raw_input
else:
    print(f"Detected username: '{raw_input}'. Constructing URL...")
    user_url_to_scan = f"https://aetherhub.com/User/{raw_input}"

# User Scan Logic
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
            print(f"     -> Exists (Skipping)")
        else:
            print(f"     -> New! Scraping this one.")
            target_tourney_id = t_id
            target_tourney_name = title_candidate
            break
            
    if not target_tourney_id:
        print("All recent tournaments are already saved.")
        sys.exit()

if not target_tourney_id:
    print("Error: Invalid Tournament ID.")
    sys.exit()

# Start Scraping
base_url = f"https://aetherhub.com/Tourney/RoundTourney/{target_tourney_id}"
print(f"\nStarting Scrape for ID: {target_tourney_id}...")

all_rounds_data = {}
if not target_tourney_name:
    target_tourney_name = f"Tournament_{target_tourney_id}"

for round_num in range(1, TOTAL_ROUNDS + 1):
    url = f"{base_url}?p={round_num}"
    print(f"Processing Round {round_num}...", end="")
    
    try:
        response = scraper.get(url)
    except Exception as e:
        print(f" Error: {e}")
        continue
    
    # Check for blocking
    if "Just a moment" in response.text or "Challenge" in response.text:
        print(" BLOCKED! (Cloudflare challenge detected). Try waiting or updating 'cloudscraper'.")
        continue

    if response.status_code != 200:
        print(f" Failed (Status {response.status_code})")
        continue

    soup = BeautifulSoup(response.text, 'html.parser')
    
    # Grab Title if needed
    if round_num == 1 and target_tourney_name.startswith("Tournament_"):
        header = soup.find("span", class_="text-2xl") 
        if not header: header = soup.find("h1")
        if header:
            target_tourney_name = clean_filename(header.text.strip().replace(":", "").replace("/", "-"))

    # INTELLIGENT TABLE SEARCH
    pairing_table = find_correct_table(soup)
    
    if not pairing_table: 
        print(" No data table found.")
        continue

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
        
    print(f" -> Found {len(round_matches)} matches.")
    all_rounds_data[round_num] = round_matches
    time.sleep(1)

# Save
if all_rounds_data and any(len(m) > 0 for m in all_rounds_data.values()):
    final_filename = f"{target_tourney_name}_Raw.xlsx"
    if os.path.exists(final_filename) and user_url_to_scan:
        final_filename = f"{target_tourney_name}_Raw_{int(time.time())}.xlsx"

    wb = openpyxl.Workbook()
    ws = wb.active
    
    all_players = set()
    
    for r_num in sorted(all_rounds_data.keys()):
        for match in all_rounds_data[r_num]:
            if match[0]: all_players.add(match[0])
            if match[1]: all_players.add(match[1])
            ws.append(match)
        ws.append([]) 

    ws.append([])
    ws.append(["All Players:"])
    for player in sorted(all_players):
        ws.append([player])

    ws.column_dimensions['A'].width = 25
    ws.column_dimensions['B'].width = 25
    
    wb.save(final_filename)
    print(f"\nSuccess! Saved to: {final_filename}")
else:
    print("\nNo match data collected. (The table structure might have changed or access was blocked).")