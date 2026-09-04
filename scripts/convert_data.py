import json
import os
import re
import glob
import csv
from datetime import datetime
import math

# --- CONFIGURATION ---
# Determine Project Root (Parent of 'scripts' folder)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)

# Define paths relative to Project Root
WEBAPP_DIR = os.path.join(PROJECT_ROOT, "webapp")
DATA_DIR = os.path.join(WEBAPP_DIR, "public", "data")
RAW_DIR = os.path.join(DATA_DIR, "raw")
DB_PATH = os.path.join(DATA_DIR, "db.json")
DECKLIST_PATH = os.path.join(SCRIPT_DIR, "Decklist.csv")

# Best X results count for each league
LEAGUE_RULES = {
    "autumn-2026": 7,
    "spring-2026": 7,
    "autumn-2025": 8,
    "spring-2025": 10,
    "autumn-2024": 10,
    "spring-2024": 12
}

# Leagues that use the alternate tiebreaker order:
# points (best-N) -> 4-0s -> 3-1s/3-0s -> game win % -> head-to-head (all season)
ALT_TIEBREAK_LEAGUES = {"autumn-2026"}

def load_deck_aliases():
    # Decklist.csv columns are "true,common"; a deck is grouped only when common differs from true.
    aliases = {}
    if not os.path.exists(DECKLIST_PATH):
        return aliases
    with open(DECKLIST_PATH, "r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            true_name = (row.get("true") or "").strip()
            common = (row.get("common") or "").strip()
            if true_name and common and common != true_name:
                aliases[true_name] = common
    return aliases

# Maps a deck's "true" name to its "common" (display) name used on all visible fields.
DECK_ALIASES = load_deck_aliases()

def get_common_name(true_name):
    if not true_name:
        return true_name
    return DECK_ALIASES.get(true_name.strip(), true_name)

def ensure_dirs():
    os.makedirs(DATA_DIR, exist_ok=True)

def get_league_info(week_num):
    # User defined ranges
    if 109 <= week_num <= 120: return "autumn-2026", "Autumn League 2026"
    if 89 <= week_num <= 100: return "spring-2026", "Spring League 2026"
    if 71 <= week_num <= 82: return "autumn-2025", "Autumn League 2025"
    if 49 <= week_num <= 63: return "spring-2025", "Spring League 2025"
    if 31 <= week_num <= 45: return "autumn-2024", "Autumn League 2024"
    if 9 <= week_num <= 25:  return "spring-2024", "Spring League 2024"
    return "off-season", "Off Season"

def safe_int(val):
    try: return int(val)
    except: return 0

def safe_float(val):
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f): return 0.0
        return f
    except: return 0.0

def update_league_stats(league, t_data):
    l_players = league["players"]
    for p in t_data["standings"]:
        name = p["name"]
        if name not in l_players:
            l_players[name] = {
                "stats": {"name": name, "points": 0, "wins": 0, "losses": 0, "draws": 0, "matches": 0, "tournaments_played": 0,
                           "four_ohs": 0, "three_ohs": 0, "three_ones": 0,
                           "game_wins": 0, "game_losses": 0, "game_draws": 0},
                "scores": [],
                "history": {},
                "h2h": {}
            }
        
        # Accumulate raw stats
        stats = l_players[name]["stats"]
        scores = l_players[name]["scores"]
        
        if name == "" or name == "nan": return 
        
        points = p["points"] or 0
        scores.append(points)
        l_players[name]["history"][t_data["id"]] = points
        
        stats["wins"] += p["wins"]
        stats["losses"] += p["losses"]
        stats["draws"] += p["draws"]
        stats["matches"] += (p["wins"] + p["losses"] + p["draws"])
        stats["tournaments_played"] += 1

        # Track tiebreaker records
        w, l, d = p["wins"], p["losses"], p["draws"]
        if w == 4 and l == 0:  stats["four_ohs"] += 1
        if w == 3 and l == 0 and d == 0:  stats["three_ohs"] += 1
        if w == 3 and l == 1 and d == 0:  stats["three_ones"] += 1

    # Accumulate game-level and head-to-head records from round-by-round match data
    for rnd in t_data.get("rounds", []):
        for m in rnd.get("matches", []):
            p1, p2 = m.get("p1"), m.get("p2")
            p1w, p2w, d = safe_int(m.get("p1_wins", 0)), safe_int(m.get("p2_wins", 0)), safe_int(m.get("draws", 0))

            if p1 and p1 != "BYE" and p1 in l_players:
                s = l_players[p1]["stats"]
                s["game_wins"] += p1w
                s["game_losses"] += p2w
                s["game_draws"] += d
            if p2 and p2 != "BYE" and p2 in l_players:
                s = l_players[p2]["stats"]
                s["game_wins"] += p2w
                s["game_losses"] += p1w
                s["game_draws"] += d

            if p1 and p2 and p1 != "BYE" and p2 != "BYE" and p1 in l_players and p2 in l_players:
                h1 = l_players[p1]["h2h"].setdefault(p2, {"w": 0, "l": 0, "d": 0})
                h2 = l_players[p2]["h2h"].setdefault(p1, {"w": 0, "l": 0, "d": 0})
                if p1w > p2w:
                    h1["w"] += 1; h2["l"] += 1
                elif p2w > p1w:
                    h2["w"] += 1; h1["l"] += 1
                else:
                    h1["d"] += 1; h2["d"] += 1


def resolve_h2h_ties(standings, h2h_map):
    """Break ties (equal points/4-0s/3-1s-3-0s/game win %) using head-to-head record among just the tied players."""
    def group_key(x):
        return (x["points"], x.get("four_ohs", 0), x.get("three_ohs", 0) + x.get("three_ones", 0), round(x.get("game_win_pct", 0.0), 6))

    result = []
    i, n = 0, len(standings)
    while i < n:
        j = i
        while j + 1 < n and group_key(standings[j + 1]) == group_key(standings[i]):
            j += 1
        group = standings[i:j + 1]
        if len(group) > 1:
            names = [p["name"] for p in group]
            def h2h_score(p, names=names):
                h = h2h_map.get(p["name"], {})
                w = sum(h.get(opp, {}).get("w", 0) for opp in names if opp != p["name"])
                l = sum(h.get(opp, {}).get("l", 0) for opp in names if opp != p["name"])
                return w - l
            group.sort(key=h2h_score, reverse=True)
        result.extend(group)
        i = j + 1
    return result

def main():
    print(f"Converting Excel data to Single DB...")
    ensure_dirs()
    
    # --- RESET DB STATES ---
    tournaments = {}
    leagues = {}

    # Initialize All-Time League
    leagues["all-time"] = {
        "id": "all-time",
        "name": "All-Time Records",
        "tournaments": [],
        "players": {}, 
        "is_all_time": True
    }

    # --- INGEST NEW JSON FILES ---
    if os.path.exists(RAW_DIR):
        # Sort files by week number ensuring correct order
        json_files = glob.glob(f"{RAW_DIR}/*.json")
        
        def get_week_num(filename):
            try:
                # Use simplified regex to be safer slightly
                return int(re.search(r'week-(\d+)', filename).group(1))
            except:
                return 0
        
        # Sort by week number ASCENDING
        json_files.sort(key=get_week_num)

        for jf in json_files:
            print(f"Reading JSON {jf}...")
            try:
                with open(jf, "r", encoding="utf-8") as f:
                    t_data = json.load(f)
                    
                    # Ensure minimal schema matching
                    week_num = t_data.get("week_number", 0)
                    if week_num == 0:
                         try:
                             week_num = int(re.search(r'week-(\d+)', jf).group(1))
                         except: pass

                    league_id, league_name = get_league_info(week_num)
                    t_data["league_id"] = league_id
                    
                    # Normalize standings keys if needed (already matches mostly)
                    # output from scraper: {name, points, w, l, d...}
                    # target: {rank, name, deck, points, record, wins, losses, draws...}
                    
                    for i, p in enumerate(t_data["standings"]):
                        if "rank" not in p: p["rank"] = i + 1
                        # Preserve original name in deck_true; expose grouped name in deck.
                        true_deck = p.get("deck", "")
                        p["deck_true"] = true_deck
                        p["deck"] = get_common_name(true_deck)
                        if "record" not in p: p["record"] = f"{p.get('w',0)}-{p.get('l',0)}-{p.get('d',0)}"
                        # Map keys if slightly different
                        if "wins" not in p: p["wins"] = p.get("w", 0)
                        if "losses" not in p: p["losses"] = p.get("l", 0)
                        if "draws" not in p: p["draws"] = p.get("d", 0)
                    
                    t_id = t_data["id"]
                    tournaments[t_id] = t_data

                    # Add to Leagues
                    if league_id != "off-season":
                        if league_id not in leagues:
                             leagues[league_id] = {
                                "id": league_id,
                                "name": league_name,
                                "tournaments": [],
                                "players": {},
                                "is_all_time": False
                            }
                        if t_id not in leagues[league_id]["tournaments"]:
                            leagues[league_id]["tournaments"].append(t_id)
                            update_league_stats(leagues[league_id], t_data)
                    
                    # All-time
                    if t_id not in leagues["all-time"]["tournaments"]:
                         leagues["all-time"]["tournaments"].append(t_id)
                         update_league_stats(leagues["all-time"], t_data)
                         
            except Exception as e:
                print(f"Error reading JSON {jf}: {e}")

    # Finalize Leagues (Sort standings with rules)
    final_leagues = []
    
    # Process leagues
    for l_id, l_data in leagues.items():
        processed_standings = []
        is_all_time = l_data.get("is_all_time", False)
        
        # Calculate final points based on rules
        max_counted_tournaments = LEAGUE_RULES.get(l_id, None) # None means count all (for All-Time)
        
        for p_name, p_stats in l_data["players"].items():
            scores = sorted(p_stats["scores"], reverse=True)
            tournaments_total = p_stats["stats"]["tournaments_played"]
            
            lowest_counting = 0
            
            if max_counted_tournaments and not is_all_time:
                counted_scores = scores[:max_counted_tournaments]
                final_points = sum(counted_scores)
                
                if counted_scores:
                    lowest_counting = counted_scores[-1]
                
                if tournaments_total > max_counted_tournaments:
                    t_display = f"{len(counted_scores)} ({tournaments_total})"
                else:
                    t_display = str(tournaments_total)
            else:
                final_points = sum(scores)
                t_display = str(tournaments_total)
                lowest_counting = scores[-1] if scores else 0
            
            if max_counted_tournaments and not is_all_time:
                if tournaments_total < max_counted_tournaments:
                    lowest_counting = 0
            
            p_stats["stats"]["points"] = final_points 
            p_stats["stats"]["tournaments_display"] = t_display
            p_stats["stats"]["lowest_counting"] = lowest_counting
            p_stats["stats"]["history"] = p_stats["history"]

            games_played = p_stats["stats"]["game_wins"] + p_stats["stats"]["game_losses"] + p_stats["stats"]["game_draws"]
            p_stats["stats"]["game_win_pct"] = round(p_stats["stats"]["game_wins"] / games_played, 4) if games_played else 0.0
            
            processed_standings.append(p_stats["stats"])

        if l_id in ALT_TIEBREAK_LEAGUES:
            # Points (best-N) -> 4-0s -> 3-1s/3-0s -> game win % -> head-to-head (all season)
            processed_standings.sort(
                key=lambda x: (
                    x["points"],
                    x.get("four_ohs", 0),
                    x.get("three_ohs", 0) + x.get("three_ones", 0),
                    x.get("game_win_pct", 0.0),
                ),
                reverse=True,
            )
            h2h_map = {p_name: p_stats["h2h"] for p_name, p_stats in l_data["players"].items()}
            processed_standings = resolve_h2h_ties(processed_standings, h2h_map)
        else:
            # Sort standings by points, then tiebreakers: 4-0s, 3-0s, 3-1s, tournaments played
            processed_standings.sort(
                key=lambda x: (
                    x["points"],
                    x.get("four_ohs", 0),
                    x.get("three_ohs", 0),
                    x.get("three_ones", 0),
                    x["tournaments_played"],
                ),
                reverse=True,
            )
        for i, p in enumerate(processed_standings): p["rank"] = i + 1
        
        # Sort tournaments list specifically for this league
        unique_tournaments = list(set(l_data["tournaments"]))
        sorted_tournaments = sorted(unique_tournaments, key=lambda x: int(x.split('-')[1]), reverse=True) # Newest first

        final_leagues.append({
            "id": l_id,
            "name": l_data["name"],
            "max_counted": max_counted_tournaments, 
            "tournaments": sorted_tournaments,
            "standings": processed_standings
        })

    def league_sorter(l):
        if l["id"] == "all-time": return 0 
        lid = l["id"]
        if "2026" in lid: val = 20260
        elif "2025" in lid: val = 20250
        elif "2024" in lid: val = 20240
        else: val = 0
        
        if "autumn" in lid: val += 5
        if "spring" in lid: val += 1
        return val

    final_leagues.sort(key=lambda x: (1 if x["id"] != "all-time" else 0, league_sorter(x)), reverse=True)

    # Output DB
    db = {
        "leagues": final_leagues,
        "tournaments": tournaments
    }
    
    with open(DB_PATH, "w") as out:
        json.dump(db, out, indent=2)

    print(f"Success! Rebuilt db.json with {len(tournaments)} tournaments and {len(final_leagues)} leagues.")

if __name__ == "__main__":
    main()
