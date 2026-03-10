import json, os, re

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "webapp", "public", "data", "raw")
weeks = []
for fname in os.listdir(RAW_DIR):
    m = re.match(r"week-(\d+)\.json", fname)
    if m:
        week_num = int(m.group(1))
        with open(os.path.join(RAW_DIR, fname), encoding="utf-8") as f:
            data = json.load(f)
        weeks.append((week_num, data))
weeks.sort(key=lambda x: x[0])

for wn, data in weeks[:6]:
    pool = data.get("metadata", {}).get("prize_pool", 0)
    rounds = data.get("metadata", {}).get("rounds", "?")
    print(f"=== week-{wn} pool={pool} rounds={rounds} ===")
    for s in data.get("standings", []):
        name = s["name"]
        rec = s["record"]
        w = s.get("wins", "?")
        l = s.get("losses", "?")
        d = s.get("draws", "?")
        pay = s.get("payout", "?")
        print(f"  {name:<28} {rec:<10} w={w} l={l} d={d} payout={pay}")
    print()
