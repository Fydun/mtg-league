import json

try:
    with open('webapp/public/data/db.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    tournaments = data.get('tournaments', {})
    leagues = data.get('leagues', [])
    
    print(f"Total tournaments: {len(tournaments)}")
    print("Tournament IDs:", sorted(tournaments.keys()))
    
    print(f"Total leagues: {len(leagues)}")
    for l in leagues:
        print(f"League: {l['id']} - Tournaments: {len(l['tournaments'])}")

except Exception as e:
    print(f"Error: {e}")
