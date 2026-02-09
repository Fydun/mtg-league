import cloudscraper
from bs4 import BeautifulSoup
import re
import time
import os
import sys
import json
import argparse
from datetime import datetime, timedelta
import math

# --- CONFIGURATION ---
TOTAL_ROUNDS = 4 

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
    name_str = re.sub(r"\s*\(.*?\)", "", name_str)
    return name_str.strip()

def get_soup(url):
    try:
        response = scraper.get(url)
        if "Just a moment" in response.text:
            print("  !! Cloudflare Challenge Detected. Waiting 5s...")
            time.sleep(5)
            response = scraper.get(url) 
        
        if response.status_code == 200:
            return BeautifulSoup(response.text, 'html.parser')
    except Exception as e:
        print(f"  !! Request Error: {e}")
    return None

def parse_date(soup):
    try:
        bodies = soup.find_all("div", class_="card-body")
        for b in bodies:
            if "Finished:" in b.text:
                match = re.search(r"Finished:\s*(\d+\s+[A-Za-z]+\s+\d{4})", b.text)
                if match:
                    date_str = match.group(1)
                    dt = datetime.strptime(date_str, "%d %b %Y")
                    return dt
    except Exception as e:
        print(f"Error parsing date: {e}")
    return datetime.now()

def adjust_date_to_thursday(dt):
    wd = dt.weekday()
    target_wd = 3 # Thursday
    if wd == target_wd: return dt
    
    days_to_subtract = (wd - target_wd) % 7
    new_date = dt - timedelta(days=days_to_subtract)
    return new_date

def scrape_round(tourney_id, round_num):
    url = f"https://aetherhub.com/Tourney/RoundTourney/{tourney_id}?p={round_num}"
    soup = get_soup(url)
    if not soup: return []

    active_page = soup.find('li', class_='page-item active')
    if active_page:
        try:
            active_num = int(active_page.text.strip())
            if active_num != round_num:
                return []
        except: pass

    matches = []
    
    tables = soup.find_all('table')
    target_table = None
    for t in tables:
        headers = [th.text.lower() for th in t.find_all('th')]
        if any("player" in h for h in headers) and any("result" in h for h in headers):
            target_table = t
            break
            
    if not target_table:
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
            
            clean_res = result.replace(" ", "")
            parts = clean_res.split("-")
            
            try:
                if len(parts) >= 2:
                    p1_wins = int(parts[0])
                    p2_wins = int(parts[1])
                    if len(parts) > 2: draws = int(parts[2])
            except: pass

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

class PlayerStats:
    def __init__(self, name):
        self.name = name
        self.match_points = 0
        self.matches_played = 0
        self.game_points = 0
        self.games_played = 0
        self.opponents = [] 
        self.m_wins = 0
        self.m_losses = 0
        self.m_draws = 0
        
    def add_match(self, points, opp_name, g_wins, g_losses, g_draws):
        self.match_points += points
        self.matches_played += 1
        
        if points == 3: self.m_wins += 1
        elif points == 1: self.m_draws += 1
        else: self.m_losses += 1
        
        self.game_points += (g_wins * 3) + (g_draws * 1)
        self.games_played += (g_wins + g_losses + g_draws)
        
        if opp_name != "BYE":
            self.opponents.append(opp_name)
            
    @property
    def mw_pct(self):
        if self.matches_played == 0: return 0.33
        pct = self.match_points / (self.matches_played * 3.0)
        return max(pct, 0.33)
        
    @property
    def gw_pct(self):
        if self.games_played == 0: return 0.33
        pct = self.game_points / (self.games_played * 3.0)
        return max(pct, 0.33)

def calculate_standings(all_matches, to_playing_count):
    players = {}
    
    # 1. First Pass: Aggregate Stats
    for r_matches in all_matches.values():
        for m in r_matches:
            p1 = m["p1"]
            p2 = m["p2"]
            
            if p1 not in players: players[p1] = PlayerStats(p1)
            if p2 != "BYE" and p2 not in players: players[p2] = PlayerStats(p2)
            
            p1_pts = 0
            if m["p1_wins"] > m["p2_wins"]: p1_pts = 3
            elif m["p2_wins"] > m["p1_wins"]: p1_pts = 0
            else: p1_pts = 1
            
            players[p1].add_match(p1_pts, p2, m["p1_wins"], m["p2_wins"], m["draws"])
            
            if p2 != "BYE":
                p2_pts = 0
                if m["p2_wins"] > m["p1_wins"]: p2_pts = 3
                elif m["p1_wins"] > m["p2_wins"]: p2_pts = 0
                else: p2_pts = 1
                
                players[p2].add_match(p2_pts, p1, m["p2_wins"], m["p1_wins"], m["draws"])

    final_standings = []
    
    # Prize Pool Calculation
    player_count = len(players)
    pool_players = max(0, player_count - to_playing_count)
    prize_pool = 105 * pool_players
    
    total_shares = 0
    eligible_players = []
    
    for name, s in players.items():
        opp_mw_sum = 0
        opp_gw_sum = 0
        valid_opps = 0
        
        for opp in s.opponents:
            if opp in players:
                opp_mw_sum += players[opp].mw_pct
                opp_gw_sum += players[opp].gw_pct
                valid_opps += 1
                
        omw = opp_mw_sum / valid_opps if valid_opps > 0 else 0.33
        ogw = opp_gw_sum / valid_opps if valid_opps > 0 else 0.33
        
        s.omw = omw
        s.ogw = ogw
        
        shares = 0
        if s.m_losses == 0 and s.m_draws == 0: shares = 4
        elif s.m_losses == 0 and s.m_draws == 1: shares = 3
        elif s.m_losses == 1 and s.m_draws == 0: shares = 2
            
        if shares > 0:
            total_shares += shares
            eligible_players.append((s, shares))
            
        final_standings.append(s)

    share_value = 0
    if total_shares > 0:
        share_value = prize_pool / total_shares
        
    payouts = {}
    for p, shares in eligible_players:
        amt = int(share_value * shares)
        payouts[p.name] = amt

    final_standings.sort(key=lambda x: (x.match_points, x.omw, x.gw_pct, x.ogw), reverse=True)
    
    results = []
    for i, s in enumerate(final_standings):
        results.append({
            "rank": i + 1,
            "name": s.name,
            "deck": "", # Default empty
            "points": s.match_points,
            "record": f"{s.m_wins}-{s.m_losses}-{s.m_draws}",
            "wins": s.m_wins,
            "losses": s.m_losses,
            "draws": s.m_draws,
            "omw": s.omw, # No * 100
            "gw": s.gw_pct,
            "ogw": s.ogw,
            "mw": s.mw_pct,
            "payout": payouts.get(s.name, 0)
        })
        
    return results, prize_pool

def get_user_tournaments(user_url):
    print(f"Scanning user profile: {user_url}...")
    try:
        response = scraper.get(user_url)
        if response.status_code != 200: return []
        soup = BeautifulSoup(response.text, 'html.parser')
        links = soup.find_all('a', href=re.compile(r'/Tourney/RoundTourney/\d+'))
        found_ids = []
        for link in links:
            match = re.search(r"RoundTourney/(\d+)", link['href'])
            if match:
                t_id = match.group(1)
                if t_id not in found_ids: found_ids.append(t_id)
        return found_ids
    except: return []

def get_next_week_number():
    next_week = 1
    if os.path.exists(DB_PATH):
        try:
            with open(DB_PATH, "r", encoding="utf-8") as f:
                db = json.load(f)
                max_week = 0
                for t_id in db.get("tournaments", {}):
                    match = re.search(r"week-(\d+)", t_id)
                    if match:
                        w = int(match.group(1))
                        if w > max_week: max_week = w
                if max_week > 0: return max_week + 1
        except: pass
    
    if os.path.exists(RAW_DIR):
        files = os.listdir(RAW_DIR)
        max_week = 0
        for f in files:
            match = re.search(r"week-(\d+)", f.lower())
            if match:
                w = int(match.group(1))
                if w > max_week: max_week = w
        if max_week > 0: return max_week + 1
            
    return next_week

def main():
    parser = argparse.ArgumentParser(description='Aetherhub Scraper')
    parser.add_argument('target', nargs='?', help='Username, ID, or URL')
    parser.add_argument('week', nargs='?', help='Week Number (Optional)')
    parser.add_argument('-to', type=int, default=1, help='Number of TO/Non-paying players (Default: 1)')
    
    args = parser.parse_args()
    
    print("\n=== Aetherhub to MTG League Import ===")

    # Target
    target = args.target
    if not target:
        target = input("Enter Username, Tournament ID or URL: ").strip()
        
    t_id = None
    if target.isdigit():
        t_id = target
    elif "RoundTourney" in target:
        match = re.search(r"RoundTourney/(\d+)", target)
        if match: t_id = match.group(1)
    else:
        user_url = target
        if "aetherhub.com" not in target:
            user_url = f"https://aetherhub.com/User/{target}"
        recent_ids = get_user_tournaments(user_url)
        if not recent_ids:
            print("No tournaments found.")
            return
        t_id = recent_ids[0]
        print(f"Auto-selecting newest tournament ID: {t_id}")

    if not t_id:
        print("Invalid ID.")
        return

    # Week
    week_str = args.week
    if not week_str:
        week_str = str(get_next_week_number())
        print(f"Auto-calculated Week: {week_str}")

    if not week_str: week_str = "1" # Fallback
    week_num = int(week_str)

    print(f"\nScraping Tournament {t_id} (Week {week_num})...")
    print(f"Prize Pool Logic: 105 * (Players - {args.to})")
    
    # Scrape Date
    url = f"https://aetherhub.com/Tourney/RoundTourney/{t_id}"
    soup = get_soup(url)
    
    final_date_str = datetime.now().strftime("%Y-%m-%d")
    if soup:
        parsed_date = parse_date(soup)
        adjusted_date = adjust_date_to_thursday(parsed_date)
        final_date_str = adjusted_date.strftime("%Y-%m-%d")
        print(f"  Parsed Date: {parsed_date.strftime('%Y-%m-%d')} -> Adjusted: {final_date_str}")
    
    all_matches = {}
    total_rounds = 0
    
    for r in range(1, 10): 
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

    # Process
    standings, total_prize_pool = calculate_standings(all_matches, args.to)
    
    # Save
    output_data = {
        "id": f"week-{week_num}",
        "name": f"Week {week_num}",
        "date": final_date_str,
        "week_number": week_num,
        "metadata": {
            "aetherhub_id": t_id,
            "players": len(standings),
            "rounds": total_rounds,
            "prize_pool": total_prize_pool, 
            "top_cut": 0,
            "to_playing": args.to,
            "event_cut": 0,
            "cutoff_points": 9 # Default X-1 for 4 rounds assumed
        },
        "standings": standings,
        "rounds": []
    }
    
    for r in sorted(all_matches.keys()):
        output_data["rounds"].append({
            "round": r,
            "matches": all_matches[r]
        })

    os.makedirs(RAW_DIR, exist_ok=True)
    filename = os.path.join(RAW_DIR, f"week-{week_num}.json")
    
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2)
        
    print(f"\nSuccess! Saved to: {filename}")

if __name__ == "__main__":
    main()