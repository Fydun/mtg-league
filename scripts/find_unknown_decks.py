"""
Script to find all "unknown" deck entries in week JSON files,
show the player's last known and next known deck, and allow
interactive replacement.
"""

import json
import os
import re
import sys

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "webapp", "public", "data", "raw")

def load_all_weeks():
    """Load all week JSON files sorted by week number."""
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
    """Build a dict: player_name -> list of (week_num, deck) sorted by week."""
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
    """
    For each unknown deck entry, find last and next known deck for that player.
    Returns list of dicts with context info.
    """
    results = []
    for week_num, fname, path, data in weeks:
        for i, entry in enumerate(data.get("standings", [])):
            name = entry.get("name")
            deck = entry.get("deck", "unknown")
            if deck.lower() == "unknown":
                # Find prev/next known deck in that player's timeline
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
                    "prev_deck": prev_deck,  # (week_num, deck) or None
                    "next_deck": next_deck,  # (week_num, deck) or None
                })
    return results

def apply_replacement(entry, new_deck):
    """Write the new deck value into the JSON file."""
    with open(entry["path"], "r", encoding="utf-8") as f:
        data = json.load(f)
    data["standings"][entry["standing_index"]]["deck"] = new_deck
    with open(entry["path"], "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def color(text, code):
    """ANSI color helper."""
    return f"\033[{code}m{text}\033[0m"

def run_interactive():
    print(color("Loading week files...", "36"))
    weeks = load_all_weeks()
    timeline = build_player_timeline(weeks)
    unknowns = find_unknown_entries(weeks, timeline)

    if not unknowns:
        print(color("No unknown decks found!", "32"))
        return

    print(color(f"\nFound {len(unknowns)} unknown deck entries.\n", "33"))
    print(color("For each entry, choose:", "37"))
    print(color("  [p] = use PREV deck", "32"))
    print(color("  [n] = use NEXT deck", "34"))
    print(color("  [k] = keep as 'unknown'", "33"))
    print(color("  [c] = type a CUSTOM deck name", "35"))
    print(color("  [q] = quit (saves progress so far)\n", "31"))

    changes = []

    for idx, entry in enumerate(unknowns):
        prev = entry["prev_deck"]
        next_ = entry["next_deck"]

        prev_str = color(f"Week {prev[0]}: {prev[1]}", "32") if prev else color("(none)", "90")
        next_str = color(f"Week {next_[0]}: {next_[1]}", "34") if next_ else color("(none)", "90")

        print(f"─" * 60)
        print(f"[{idx+1}/{len(unknowns)}] {color(entry['player'], '1')}  ─  {color('Week ' + str(entry['week_num']), '33')}")
        print(f"  PREV: {prev_str}")
        print(f"  NEXT: {next_str}")

        while True:
            options = []
            if prev:
                options.append(f"[p] {prev[1]}")
            if next_:
                options.append(f"[n] {next_[1]}")
            options.append("[k] keep unknown")
            options.append("[c] custom")
            options.append("[q] quit")
            choice = input(f"  Choice ({' / '.join(options)}): ").strip().lower()

            if choice == "q":
                print(color("\nQuitting. Applying all decisions made so far...", "31"))
                for c in changes:
                    apply_replacement(c["entry"], c["new_deck"])
                    print(f"  ✓ {c['entry']['player']} week-{c['entry']['week_num']} → {c['new_deck']}")
                print(color(f"\nDone. Applied {len(changes)} change(s).", "32"))
                sys.exit(0)
            elif choice == "p" and prev:
                new_deck = prev[1]
                break
            elif choice == "n" and next_:
                new_deck = next_[1]
                break
            elif choice == "k":
                new_deck = "unknown"
                break
            elif choice == "c":
                new_deck = input("  Enter deck name: ").strip()
                if new_deck:
                    break
                print("  (empty, try again)")
            else:
                print(color("  Invalid choice, try again.", "31"))

        changes.append({"entry": entry, "new_deck": new_deck})
        action = color(f"→ {new_deck}", "32") if new_deck != "unknown" else color("→ kept unknown", "33")
        print(f"  {action}\n")

    print(color("─" * 60, "90"))
    print(color(f"All {len(unknowns)} entries reviewed. Applying changes...", "36"))
    applied = 0
    for c in changes:
        if c["new_deck"] != "unknown" or True:  # always write (even if keeping unknown, no change needed)
            if c["new_deck"] != "unknown":
                apply_replacement(c["entry"], c["new_deck"])
                print(f"  ✓ {c['entry']['player']} week-{c['entry']['week_num']} → {c['new_deck']}")
                applied += 1
    print(color(f"\nDone. Applied {applied} change(s).", "32"))

if __name__ == "__main__":
    run_interactive()
