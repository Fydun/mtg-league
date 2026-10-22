"""
drop_player.py – Remove a player's matches from a round onward.

This corrects a player who was not marked as dropped in AetherHub. Existing
matches involving that player from the selected round onward are removed; no
replacement pairings or byes are inferred.

Usage:
    python scripts/drop_player.py <player> --from-round N [--week N] [--dry-run]
"""

import argparse
import glob
import io
import json
import os
import re
import sys

from aetherhub import calculate_standings

if isinstance(sys.stdout, io.TextIOWrapper):
    sys.stdout.reconfigure(encoding="utf-8")
if isinstance(sys.stderr, io.TextIOWrapper):
    sys.stderr.reconfigure(encoding="utf-8")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
RAW_DIR = os.path.join(SCRIPT_DIR, "..", "webapp", "public", "data", "raw")


def latest_week():
    nums = []
    for path in glob.glob(os.path.join(RAW_DIR, "week-*.json")):
        match = re.search(r"week-(\d+)\.json$", path)
        if match:
            nums.append(int(match.group(1)))
    if not nums:
        sys.exit("No week-*.json files found.")
    return max(nums)


def main():
    parser = argparse.ArgumentParser(
        description="Remove a player's matches from a round onward."
    )
    parser.add_argument("player", help="Player name or a unique name fragment")
    parser.add_argument("--from-round", type=int, required=True,
                        help="First round from which the player is dropped")
    parser.add_argument("--week", type=int, default=None,
                        help="Week number (default: latest)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Show the changes without saving")
    args = parser.parse_args()

    if args.from_round < 1:
        sys.exit("Round number must be at least 1.")

    week = args.week if args.week is not None else latest_week()
    path = os.path.join(RAW_DIR, f"week-{week}.json")
    if not os.path.exists(path):
        sys.exit(f"File not found: {path}")

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    rounds = data.get("rounds", [])
    round_numbers = {rnd.get("round") for rnd in rounds}
    if args.from_round not in round_numbers:
        sys.exit(f"Round {args.from_round} does not exist in week {week}.")

    player_names = {standing["name"] for standing in data.get("standings", [])}
    query = args.player.casefold()
    candidates = sorted(name for name in player_names if query in name.casefold())
    if not candidates:
        sys.exit(f"No player matching '{args.player}' found in week {week}.")
    if len(candidates) > 1:
        print(f"Multiple players match '{args.player}'; use a more specific name:")
        for name in candidates:
            print(f"  {name}")
        sys.exit(1)
    player = candidates[0]

    affected = []
    removed_matches = 0
    for rnd in rounds:
        if rnd.get("round", 0) < args.from_round:
            continue
        kept = []
        for match in rnd.get("matches", []):
            if player in (match.get("p1"), match.get("p2")):
                removed_matches += 1
                opponent = match.get("p2") if match.get("p1") == player else match.get("p1")
                if opponent != "BYE":
                    affected.append((rnd["round"], opponent))
            else:
                kept.append(match)
        rnd["matches"] = kept

    if removed_matches == 0:
        sys.exit(f"{player} has no matches in round {args.from_round} or later.")

    print(f"  Week {week}: dropping {player} from round {args.from_round}.")
    print(f"  Removed {removed_matches} match(es) involving this player.")
    if affected:
        print("  Other players in removed matches will have no result for those rounds:")
        for round_number, opponent in affected:
            print(f"    Round {round_number}: {opponent}")
    print("  No replacement pairings or byes will be assigned.")

    all_matches = {rnd["round"]: rnd["matches"] for rnd in rounds}
    new_standings = calculate_standings(all_matches)
    old_by_name = {standing["name"]: standing for standing in data.get("standings", [])}
    for standing in new_standings:
        previous = old_by_name.get(standing["name"])
        if previous:
            standing["deck"] = previous.get("deck", standing.get("deck", ""))
            standing["payout"] = previous.get("payout", standing.get("payout", 0))

    data["standings"] = new_standings
    data["metadata"]["players"] = len(new_standings)

    print("\n  Recomputed standings (top of table):")
    for standing in new_standings:
        print(f"    {standing['rank']:>2}. {standing['name']:<24} "
              f"{standing['record']:>7}  {standing['points']} pts")

    if args.dry_run:
        print("\n  Dry run — nothing saved.")
        return

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"\n  Saved: {path}")


if __name__ == "__main__":
    main()
