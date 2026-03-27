import json, os, re, math

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "webapp", "public", "data", "raw")


def load_all_weeks():
    weeks = []
    for fname in os.listdir(RAW_DIR):
        m = re.match(r"week-(\d+)\.json", fname)
        if m:
            week_num = int(m.group(1))
            path = os.path.join(RAW_DIR, fname)
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
            weeks.append((week_num, path, data))
    weeks.sort(key=lambda x: x[0])
    return weeks


def get_shares(wins, losses, draws, total_rounds=4):
    """Return share count based on record.
    4 shares for undefeated (wins == rounds), 3 for one draw, 2 for one loss.
    Players who dropped or had extra losses get nothing."""
    if wins == total_rounds:
        return 4  # undefeated
    if wins == total_rounds - 1:
        if draws > 0:
            return 3  # one draw
        if losses > 0:
            return 2  # one loss
    return 0


def calc_payouts(standings, prize_pool):
    """
    Calculate base payouts (floor division) for each player.
    Returns list of (index, base_payout) for all players.
    """
    shares_list = []
    for s in standings:
        sh = get_shares(s.get("wins", 0), s.get("losses", 99), s.get("draws", 0))
        shares_list.append(sh)

    total_shares = sum(shares_list)
    if total_shares == 0:
        return [(i, 0) for i in range(len(standings))]

    per_share = prize_pool / total_shares
    result = []
    for i, sh in enumerate(shares_list):
        payout = math.floor(sh * per_share) if sh > 0 else 0
        result.append((i, payout))
    return result


def detect_bonus(standings, formula_payouts):
    """
    Detect bonus allocation by comparing existing payouts to formula payouts.
    Returns dict of {player_index: bonus_amount} for any player whose existing
    payout differs from formula by >= 40kr (i.e., a bonus, not rounding).
    """
    bonuses = {}
    for i, s in enumerate(standings):
        existing = s.get("payout", 0)
        formula = formula_payouts[i][1]
        diff = existing - formula
        if abs(diff) >= 40:
            bonuses[i] = diff
    return bonuses


def save_week(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def main():
    weeks = load_all_weeks()
    changed = 0

    for wn, path, data in weeks:
        standings = data.get("standings", [])
        pool = data.get("metadata", {}).get("prize_pool", 0)

        # Skip if already have payouts for any player (weeks 38+)
        has_existing = any(s.get("payout", 0) > 0 for s in standings)
        if has_existing:
            continue

        formula_payouts = calc_payouts(standings, pool)

        # Apply
        any_change = False
        for i, payout in formula_payouts:
            if standings[i].get("payout", 0) != payout:
                standings[i]["payout"] = payout
                any_change = True

        if any_change:
            total_paid = sum(p for _, p in formula_payouts)
            paying = [(standings[i]["name"], standings[i]["record"], p) for i, p in formula_payouts if p > 0]
            print(f"week-{wn:<3}  pool={pool:<6}  total_paid={total_paid:<6}  | " +
                  "  ".join(f"{n}({r})={p}" for n, r, p in paying))
            data["standings"] = standings
            save_week(path, data)
            changed += 1

    print(f"\nUpdated {changed} weeks.")


if __name__ == "__main__":
    main()
