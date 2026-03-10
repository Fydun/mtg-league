import json, os, re

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "webapp", "public", "data", "raw")

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

unknowns = []
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
            unknowns.append((week_num, name, prev_deck, next_deck))

print(f"Total unknown entries: {len(unknowns)}")
print()
for idx, (week_num, name, prev, next_) in enumerate(unknowns, 1):
    prev_str = f"{prev[1]} (w{prev[0]})" if prev else "---"
    next_str = f"{next_[1]} (w{next_[0]})" if next_ else "---"
    same = prev and next_ and prev[1] == next_[1]
    flag = " ** same **" if same else ""
    print(f"[{idx:>3}] Week {week_num:<4} {name:<26} | prev: {prev_str:<40} | next: {next_str}{flag}")
