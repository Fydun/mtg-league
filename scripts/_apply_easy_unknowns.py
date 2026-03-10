"""
Apply all "easy" unknown deck replacements:
- Any entry where prev deck == next deck (use that deck)
- Eirik Larsen week 30 (use next: Dreadnought)
Then print remaining unknowns.
"""

import json
import os
import re

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "docs", "data", "raw")


def load_all_weeks():
    weeks = []
    for fname in os.listdir(RAW_DIR):
        m = re.match(r"week-(\d+)\.json", fname)
        if m:
            week_num = int(m.group(1))
            path = os.path.join(RAW_DIR, fname)
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            weeks.append((week_num, fname, path, data))
    weeks.sort(key=lambda x: x[0])
    return weeks


def build_player_timeline(weeks):
    timeline = {}
    for week_num, fname, path, data in weeks:
        for entry in data.get("standings", []):
            name = entry.get("name")
            deck = entry.get("deck", "unknown")
            if name:
                if name not in timeline:
                    timeline[name] = []
                timeline[name].append((week_num, deck))
    for name in timeline:
        timeline[name].sort(key=lambda x: x[0])
    return timeline


def find_unknown_entries(weeks, timeline):
    results = []
    for week_num, fname, path, data in weeks:
        for i, entry in enumerate(data.get("standings", [])):
            name = entry.get("name")
            deck = entry.get("deck", "unknown")
            if deck.lower() == "unknown":
                player_history = timeline.get(name, [])
                prev_deck = None
                next_deck = None
                for (wn, dk) in player_history:
                    if wn < week_num and dk.lower() != "unknown":
                        prev_deck = (wn, dk)
                for (wn, dk) in player_history:
                    if wn > week_num and dk.lower() != "unknown":
                        next_deck = (wn, dk)
                        break
                results.append({
                    "week_num": week_num,
                    "fname": fname,
                    "path": path,
                    "standing_index": i,
                    "player": name,
                    "prev_deck": prev_deck,
                    "next_deck": next_deck,
                })
    return results


def apply_replacement(path, standing_index, new_deck):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    data["standings"][standing_index]["deck"] = new_deck
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def main():
    weeks = load_all_weeks()
    timeline = build_player_timeline(weeks)
    unknowns = find_unknown_entries(weeks, timeline)

    applied = []
    skipped = []

    for entry in unknowns:
        prev = entry["prev_deck"]
        next_ = entry["next_deck"]
        name = entry["player"]
        wn = entry["week_num"]

        new_deck = None

        # All ⭐ same cases
        if prev and next_ and prev[1] == next_[1]:
            new_deck = prev[1]
        # Eirik Larsen week 30: use next (Dreadnought w31)
        elif name == "Eirik Larsen" and wn == 30 and next_:
            new_deck = next_[1]

        if new_deck:
            apply_replacement(entry["path"], entry["standing_index"], new_deck)
            applied.append(f"  week-{wn:<4} {name:<26} -> {new_deck}")
        else:
            skipped.append(entry)

    print(f"Applied {len(applied)} replacements:")
    for line in applied:
        print(line)

    # Now reload and rescan for remaining
    weeks2 = load_all_weeks()
    timeline2 = build_player_timeline(weeks2)
    remaining = find_unknown_entries(weeks2, timeline2)

    print(f"\n{'='*80}")
    print(f"Remaining unknown entries: {len(remaining)}\n")
    print(f"{'#':<5} {'Week':<6} {'Player':<26} {'PREV deck (week)':<40} {'NEXT deck (week)'}")
    print("-" * 110)
    for idx, entry in enumerate(remaining, 1):
        prev = entry["prev_deck"]
        next_ = entry["next_deck"]
        prev_str = f"{prev[1]} (w{prev[0]})" if prev else "---"
        next_str = f"{next_[1]} (w{next_[0]})" if next_ else "---"
        print(f"{idx:<5} {entry['week_num']:<6} {entry['player']:<26} {prev_str:<40} {next_str}")


if __name__ == "__main__":
    main()
