"""
fix_match.py – Correct a single mis-recorded match in a scraped week file.

AetherHub sometimes records a result wrong. Because standings, records and all
tiebreakers (OMW/GW/OGW) are computed *from the match results*, fixing the one
match and re-running the scraper's own calculate_standings() regenerates the
whole standings array consistently — no error-prone hand editing.

Run this AFTER scraping (aetherhub.py) and BEFORE payouts / verify / convert.

Usage:
    python scripts/fix_match.py <playerA> <playerB> <A_wins>-<B_wins>[-<draws>] [--week N] [--round N] [--dry-run]

Example (Round 4, Anders beat Ferdinand 2-0, but AetherHub recorded the loss):
    python scripts/fix_match.py Anders Ferdinand 2-0 --round 4
"""

import os
import io
import re
import sys
import glob
import json
import argparse

from aetherhub import calculate_standings

# Windows consoles default to cp1252; force UTF-8 so Nordic names never crash.
if isinstance(sys.stdout, io.TextIOWrapper):
    sys.stdout.reconfigure(encoding="utf-8")
if isinstance(sys.stderr, io.TextIOWrapper):
    sys.stderr.reconfigure(encoding="utf-8")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
RAW_DIR = os.path.join(SCRIPT_DIR, "..", "webapp", "public", "data", "raw")


def norm(s):
    """Case-insensitive fold that keeps Nordic letters distinct (ø ≠ ö ≠ o)."""
    return s.casefold()


def latest_week():
    nums = []
    for f in glob.glob(os.path.join(RAW_DIR, "week-*.json")):
        m = re.search(r"week-(\d+)\.json$", f)
        if m:
            nums.append(int(m.group(1)))
    if not nums:
        sys.exit("No week-*.json files found.")
    return max(nums)


def parse_score(text):
    parts = text.split("-")
    if len(parts) < 2:
        sys.exit(f"Invalid score '{text}'. Use A_wins-B_wins or A_wins-B_wins-draws.")
    try:
        a = int(parts[0])
        b = int(parts[1])
        d = int(parts[2]) if len(parts) > 2 else 0
    except ValueError:
        sys.exit(f"Invalid score '{text}'. Scores must be integers.")
    return a, b, d


def find_match(rounds, name_a, name_b, only_round=None):
    a, b = norm(name_a), norm(name_b)
    hits = []
    for rnd in rounds:
        if only_round is not None and rnd.get("round") != only_round:
            continue
        for m in rnd.get("matches", []):
            p1, p2 = norm(m.get("p1", "")), norm(m.get("p2", ""))
            if (a in p1 and b in p2) or (a in p2 and b in p1):
                hits.append((rnd, m))
    return hits


def main():
    ap = argparse.ArgumentParser(description="Correct a single match in a week file.")
    ap.add_argument("player_a")
    ap.add_argument("player_b")
    ap.add_argument("score", help="A_wins-B_wins[-draws], oriented as player_a vs player_b")
    ap.add_argument("--week", type=int, default=None, help="Week number (default: latest)")
    ap.add_argument("--round", type=int, default=None, help="Restrict to a specific round")
    ap.add_argument("--dry-run", action="store_true", help="Show the result without saving")
    args = ap.parse_args()

    week = args.week if args.week is not None else latest_week()
    path = os.path.join(RAW_DIR, f"week-{week}.json")
    if not os.path.exists(path):
        sys.exit(f"File not found: {path}")

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    rounds = data.get("rounds", [])
    hits = find_match(rounds, args.player_a, args.player_b, args.round)

    if not hits:
        scope = f" in round {args.round}" if args.round else ""
        sys.exit(f"No match between '{args.player_a}' and '{args.player_b}'{scope} in week {week}.")
    if len(hits) > 1:
        print(f"  !! Found {len(hits)} matching matches. Narrow it down with --round:")
        for rnd, m in hits:
            print(f"     Round {rnd['round']}: {m['p1']} vs {m['p2']}  ({m['p1_wins']}-{m['p2_wins']}-{m['draws']})")
        sys.exit(1)

    rnd, match = hits[0]
    a_wins, b_wins, draws = parse_score(args.score)

    # Orient the score to however p1/p2 are stored in the file.
    a = norm(args.player_a)
    a_is_p1 = a in norm(match.get("p1", ""))
    old = f"{match['p1_wins']}-{match['p2_wins']}-{match['draws']}"
    if a_is_p1:
        match["p1_wins"], match["p2_wins"], match["draws"] = a_wins, b_wins, draws
    else:
        match["p1_wins"], match["p2_wins"], match["draws"] = b_wins, a_wins, draws
    new = f"{match['p1_wins']}-{match['p2_wins']}-{match['draws']}"

    print(f"  Week {week}, Round {rnd['round']}: {match['p1']} vs {match['p2']}")
    print(f"    {old}  ->  {new}")

    # Recompute standings from the corrected matches (same logic the scraper uses).
    all_matches = {r["round"]: r["matches"] for r in rounds}
    new_standings = calculate_standings(all_matches)

    # Preserve deck assignments and any manual payout from the old standings.
    old_by_name = {s["name"]: s for s in data.get("standings", [])}
    for s in new_standings:
        prev = old_by_name.get(s["name"])
        if prev:
            s["deck"] = prev.get("deck", s.get("deck", ""))
            s["payout"] = prev.get("payout", s.get("payout", 0))

    data["standings"] = new_standings
    data["metadata"]["players"] = len(new_standings)

    print("\n  Recomputed standings (top of table):")
    for s in new_standings[:6]:
        print(f"    {s['rank']:>2}. {s['name']:<24} {s['record']:>7}  {s['points']} pts")

    if args.dry_run:
        print("\n  Dry run — nothing saved.")
        return

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"\n  Saved: {path}")


if __name__ == "__main__":
    main()
