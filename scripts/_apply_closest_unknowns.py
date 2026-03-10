"""
Apply closest-chronologically rule to all remaining unknown deck entries:
- Pick whichever of prev/next is nearest in week number to the unknown week.
- Tiebreak: prefer prev.
- If only one side exists, use it.
- If neither exists, keep unknown.
"""

import json
import os
import re

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "webapp", "public", "data", "raw")


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
    kept_unknown = []

    for entry in unknowns:
        prev = entry["prev_deck"]
        next_ = entry["next_deck"]
        wn = entry["week_num"]

        if prev and next_:
            prev_dist = wn - prev[0]
            next_dist = next_[0] - wn
            new_deck = prev[1] if prev_dist <= next_dist else next_[1]
            chosen = "prev" if prev_dist <= next_dist else "next"
        elif prev:
            new_deck = prev[1]
            chosen = "prev"
        elif next_:
            new_deck = next_[1]
            chosen = "next"
        else:
            kept_unknown.append(entry)
            continue

        apply_replacement(entry["path"], entry["standing_index"], new_deck)
        applied.append(f"  week-{wn:<4} {entry['player']:<26} [{chosen}] -> {new_deck}")

    print(f"Applied {len(applied)} replacements:")
    for line in applied:
        print(line)

    if kept_unknown:
        print(f"\nKept as unknown ({len(kept_unknown)} entries — no prev or next known deck):")
        for e in kept_unknown:
            print(f"  week-{e['week_num']:<4} {e['player']}")


if __name__ == "__main__":
    main()
