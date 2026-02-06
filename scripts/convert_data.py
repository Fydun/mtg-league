import pandas as pd
import json
import os
import re
import glob
from datetime import datetime
import math

# --- CONFIGURATION ---
DATA_DIR = "webapp/public/data"
RAW_DATA_PATH = "." 

# Best X results count for each league
LEAGUE_RULES = {
    "spring-2026": 7,
    "autumn-2025": 8,
    "spring-2025": 10,
    "autumn-2024": 10,
    "spring-2024": 12
}

def ensure_dirs():
    os.makedirs(DATA_DIR, exist_ok=True)

def get_league_info(week_num):
    # User defined ranges
    if 89 <= week_num <= 99: return "spring-2026", "Spring League 2026"
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

def parse_sheet(df, sheet_name):
    """
    Parses a single 'WeekXX' sheet dataframe.
    """
    try:
        # --- 1. METADATA (Cols Q-R, Rows 0-7) ---
        date_val = df.iloc[0, 18]
        if isinstance(date_val, datetime):
            date_str = date_val.strftime("%Y-%m-%d")
        else:
            date_str = str(date_val).split(" ")[0] # Fallback
            
        metadata = {
            "players": safe_int(df.iloc[1, 18]),
            "rounds": safe_int(df.iloc[2, 18]),
            "cutoff_points": safe_int(df.iloc[3, 18]),
            "prize_pool": safe_int(df.iloc[4, 18]),
            "event_cut": safe_int(df.iloc[5, 18]),
            "to_playing": safe_int(df.iloc[6, 18])
        }

        # --- 2. STANDINGS (Cols A-P) ---
        standings = []
        
        for i in range(1, len(df)):
            row = df.iloc[i]
            p_name = str(row[0]).strip()
            
            if pd.isna(row[0]) or p_name == "" or p_name == "nan": break
            
            deck = str(row[1]).strip() if pd.notna(row[1]) else ""
            points = safe_int(row[2])
            
            omw = safe_float(row[10])
            gw = safe_float(row[11])
            ogw = safe_float(row[12])
            mw = safe_float(row[13])
            
            payout = safe_int(row[15])
            
            # Record W-L-D from Column J (Index 9)
            record = str(row[9]).strip() if pd.notna(row[9]) else "0-0-0"
            wins = 0
            losses = 0
            draws = 0
            try:
                parts = record.split("-")
                if len(parts) >= 2:
                    wins = int(parts[0])
                    losses = int(parts[1])
                    if len(parts) > 2: draws = int(parts[2])
            except: pass

            standings.append({
                "rank": i,
                "name": p_name,
                "deck": deck,
                "points": points,
                "record": record,
                "wins": wins,
                "losses": losses,
                "draws": draws,
                "omw": omw,
                "gw": gw,
                "ogw": ogw,
                "mw": mw,
                "payout": payout
            })

        # --- 3. MATCHES (Cols U onwards) ---
        rounds = []
        current_round_matches = []
        current_round_num = 1
        
        for i in range(1, len(df)): 
            row = df.iloc[i]
            col_u = str(row[20]).strip()
            
            if col_u.lower().startswith("round"):
                 if current_round_matches:
                    rounds.append({"round": current_round_num, "matches": current_round_matches})
                    current_round_matches = []
                 try:
                    current_round_num = int(col_u.lower().replace("round", "").strip())
                 except: pass
                 continue

            if col_u.lower().startswith("table"):
                p1 = str(row[21]).strip()
                p2 = str(row[22]).strip()
                p1_wins = safe_int(row[23])
                p2_wins = safe_int(row[24])
                draws = safe_int(row[25])
                
                if p1 == "nan" or p1 == "": continue
                if p2 == "nan" or p2.lower() == "bye": p2 = "BYE"

                current_round_matches.append({
                    "p1": p1, 
                    "p2": p2,
                    "p1_wins": p1_wins,
                    "p2_wins": p2_wins,
                    "draws": draws
                })

        if current_round_matches:
            rounds.append({"round": current_round_num, "matches": current_round_matches})

        # --- CONSTRUCT TOURNAMENT OBJECT ---
        try:
            week_num = int(re.search(r'\d+', sheet_name).group())
        except: week_num = 0
            
        league_id, league_name = get_league_info(week_num)
        
        return {
            "id": f"week-{week_num}",
            "name": f"Week {week_num}",
            "league_id": league_id,
            "date": date_str,
            "metadata": metadata,
            "standings": standings,
            "rounds": rounds
        }

    except Exception as e:
        print(f"Error parsing {sheet_name}: {e}")
        return None

def main():
    print("Converting Excel data to Single DB...")
    ensure_dirs()
    
    all_excel_files = glob.glob(f"{RAW_DATA_PATH}/*.xlsx")
    tournaments = {}
    leagues = {}
    
    # Initialize All-Time League
    leagues["all-time"] = {
        "id": "all-time",
        "name": "All-Time Records",
        "tournaments": [],
        "players": {}, # {name: {stats, scores: []}}
        "is_all_time": True
    }

    for f in all_excel_files:
        if "_Raw" in f or "~$" in f: continue
        print(f"Reading {f}...")
        
        try:
            xl = pd.ExcelFile(f)
            
            for sheet in xl.sheet_names:
                if sheet.startswith("Week"):
                    print(f"  Parsing {sheet}...")
                    t_data = parse_sheet(xl.parse(sheet, header=None), sheet)
                    
                    if t_data:
                        t_id = t_data["id"]
                        tournaments[t_id] = t_data
                        l_id = t_data["league_id"]
                        
                        # Initialize Regular League if needed
                        if l_id != "off-season" and l_id not in leagues:
                            _, l_name = get_league_info(int(re.search(r'\d+', sheet).group()))
                            leagues[l_id] = {
                                "id": l_id,
                                "name": l_name,
                                "tournaments": [],
                                "players": {}, # {name: {stats, scores: []}}
                                "is_all_time": False
                            }
                        
                        # Add to Regular League
                        if l_id != "off-season":
                            leagues[l_id]["tournaments"].append(t_id)
                            update_league_stats(leagues[l_id], t_data)

                        # Add to All-Time League (Include EVERYTHING)
                        leagues["all-time"]["tournaments"].append(t_id)
                        update_league_stats(leagues["all-time"], t_data)
                            
        except Exception as e:
            print(f"Error reading {f}: {e}")

    # --- INGEST NEW JSON FILES ---
    json_dir = f"webapp/public/data/raw"
    if os.path.exists(json_dir):
        json_files = glob.glob(f"{json_dir}/*.json")
        for jf in json_files:
            print(f"Reading JSON {jf}...")
            try:
                with open(jf, "r", encoding="utf-8") as f:
                    t_data = json.load(f)
                    
                    # Ensure minimal schema matching
                    week_num = t_data.get("week_number", 0)
                    if week_num == 0:
                         # Try to parse from filename as fallback
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
                        if "deck" not in p: p["deck"] = ""
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
            # If there's a limit, sort scores and take top X
            scores = sorted(p_stats["scores"], reverse=True)
            tournaments_total = p_stats["stats"]["tournaments_played"]
            
            lowest_counting = 0
            
            if max_counted_tournaments and not is_all_time:
                counted_scores = scores[:max_counted_tournaments]
                final_points = sum(counted_scores)
                
                # Lowest counting score is the last one in the counted list
                # But only if we have scores
                if counted_scores:
                    lowest_counting = counted_scores[-1]
                
                # Format string: "8 (10)" if capped, else "8"
                if tournaments_total > max_counted_tournaments:
                    t_display = f"{len(counted_scores)} ({tournaments_total})"
                else:
                    t_display = str(tournaments_total)
            else:
                final_points = sum(scores)
                t_display = str(tournaments_total)
                lowest_counting = scores[-1] if scores else 0
            
            # Logic Update: If they haven't reached the cap, their lowest counting score is effectively 0
            # (Because their next score will fully add to their total, rather than replacing a low score)
            if max_counted_tournaments and not is_all_time:
                if tournaments_total < max_counted_tournaments:
                    lowest_counting = 0
            
            p_stats["stats"]["points"] = final_points # Overwrite total with best-X sum
            p_stats["stats"]["tournaments_display"] = t_display
            p_stats["stats"]["lowest_counting"] = lowest_counting
            p_stats["stats"]["history"] = p_stats["history"] # Add history to final stats
            
            processed_standings.append(p_stats["stats"])

        # Sort standings by points
        processed_standings.sort(key=lambda x: x["points"], reverse=True)
        for i, p in enumerate(processed_standings): p["rank"] = i + 1
        
        # Sort tournaments list specifically for this league
        # Use SET to remove duplicates (idempotency fix)
        unique_tournaments = list(set(l_data["tournaments"]))
        sorted_tournaments = sorted(unique_tournaments, key=lambda x: int(x.split('-')[1]), reverse=True) # Newest first

        final_leagues.append({
            "id": l_id,
            "name": l_data["name"],
            "max_counted": max_counted_tournaments, # Add detailed metadata
            "tournaments": sorted_tournaments,
            "standings": processed_standings
        })

    # Sort final leagues list: Spring 2026 first, ..., All-Time last (or first?)
    
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
    
    with open(f"{DATA_DIR}/db.json", "w") as out:
        json.dump(db, out, indent=2)

    print(f"Success! Generated db.json with {len(tournaments)} tournaments and {len(final_leagues)} leagues.")

def update_league_stats(league, t_data):
    l_players = league["players"]
    for p in t_data["standings"]:
        name = p["name"]
        if name not in l_players:
            l_players[name] = {
                "stats": {"name": name, "points": 0, "wins": 0, "losses": 0, "draws": 0, "matches": 0, "tournaments_played": 0},
                "scores": [],
                "history": {}
            }
        
        # Accumulate raw stats (wins, losses etc always count everything usually? Or only for the best X?)
        # Convention: Stats like Wins/Losses usually reflect TOTAL played. Points reflect SCORING.
        # So we accumulate everything here, but recalculate POINTS later.
        
        stats = l_players[name]["stats"]
        scores = l_players[name]["scores"]
        
        # We don't verify if this player actually played or just exists?
        # Assuming convert_data standings includes everyone who played.
        
        if name == "" or name == "nan": return # Extra safety
        
        points = p["points"] or 0
        scores.append(points)
        l_players[name]["history"][t_data["id"]] = points
        
        stats["wins"] += p["wins"]
        stats["losses"] += p["losses"]
        stats["draws"] += p["draws"]
        stats["matches"] += (p["wins"] + p["losses"] + p["draws"])
        stats["tournaments_played"] += 1

if __name__ == "__main__":
    main()
