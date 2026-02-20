"""
verify_data.py – Interactive CLI to verify player names and assign decklists
for weekly tournament JSON files.

Usage:
    python verify_data.py                  # runs against newest week-*.json
    python verify_data.py week-85.json     # runs against a specific file
    python verify_data.py 85               # shorthand: week number only
"""

import os
import sys
import re
import json
import glob
import argparse

from rapidfuzz import fuzz, process
from prompt_toolkit import PromptSession
from prompt_toolkit.completion import Completer, Completion
from prompt_toolkit.shortcuts import CompleteStyle

# ── Paths ───────────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
RAW_DIR = os.path.join(PROJECT_ROOT, "webapp", "public", "data", "raw")
PLAYERS_FILE = os.path.join(SCRIPT_DIR, "Players.txt")
DECKLIST_FILE = os.path.join(SCRIPT_DIR, "Decklist.txt")

# ── Styling (ANSI escape codes) ─────────────────────────────────────────────
os.system("")  # enable ANSI escape processing on Windows

RESET   = "\033[0m"
COLORS  = {
    "header":    "\033[1;4m",      # bold underline
    "banner":    "\033[1;96m",     # bold bright cyan
    "ok":        "\033[1;32m",     # bold green
    "warn":      "\033[1;33m",     # bold yellow
    "err":       "\033[1;91m",     # bold bright red
    "muted":     "\033[90m",       # gray
    "highlight": "\033[1;96m",     # bold bright cyan
}

FUZZY_THRESHOLD = 70        # minimum score to consider a fuzzy match
FUZZY_TOP_N = 5             # how many suggestions to show


class RapidFuzzyCompleter(Completer):
    """Dropdown completer powered by rapidfuzz – matches full multi-word entries."""

    def __init__(self, items, min_score=40, limit=10):
        self.items = list(items)
        self.min_score = min_score
        self.limit = limit

    @staticmethod
    def _score(query, candidate):
        """Score that prioritises exact/prefix/substring over pure fuzzy."""
        q = query.lower()
        c = candidate.lower()

        # Exact match
        if q == c:
            return 100

        # Prefix match  ("po" → "Pox")
        if c.startswith(q):
            return 95

        # Any word in candidate starts with query  ("sto" → "Moon Stompy")
        words = c.split()
        if any(w.startswith(q) for w in words):
            return 90

        # Substring  ("omp" → "Moon Stompy")
        if q in c:
            return 85

        # Fall back to rapidfuzz, but use ratio (not WRatio) to avoid
        # over-weighting partial matches on very different-length strings
        return fuzz.ratio(q, c)

    def get_completions(self, document, complete_event):
        text = document.text_before_cursor.strip()
        if not text:
            for item in self.items[:self.limit]:
                yield Completion(item, start_position=-len(document.text_before_cursor))
            return

        scored = [(item, self._score(text, item)) for item in self.items]
        scored.sort(key=lambda x: x[1], reverse=True)

        for match_text, score in scored[:self.limit]:
            if score >= self.min_score:
                yield Completion(
                    match_text,
                    start_position=-len(document.text_before_cursor),
                    display_meta=f"{score:.0f}%",
                )


# ── Helpers ─────────────────────────────────────────────────────────────────

def pf(style_tag, text):
    """Shortcut: print a styled line."""
    color = COLORS.get(style_tag, "")
    print(f"{color}{text}{RESET}")


def load_lines(filepath):
    """Load non-empty lines from a text file, skipping the header row."""
    if not os.path.exists(filepath):
        return []
    with open(filepath, "r", encoding="utf-8") as f:
        lines = [l.strip() for l in f.readlines()]
    # Skip header row (first line like "Name" or "Deck")
    if lines and lines[0].lower() in ("name", "deck"):
        lines = lines[1:]
    return [l for l in lines if l]


def save_lines(filepath, header, lines):
    """Write lines back to a text file with a header row (atomic write)."""
    tmp = filepath + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        if header:
            f.write(header + "\n")
        for line in sorted(set(lines)):
            f.write(line + "\n")
    os.replace(tmp, filepath)


def find_newest_week_file():
    """Return the path to the week-*.json with the highest week number."""
    pattern = os.path.join(RAW_DIR, "week-*.json")
    files = glob.glob(pattern)
    if not files:
        return None

    def week_num(path):
        match = re.search(r"week-(\d+)\.json$", path)
        return int(match.group(1)) if match else 0

    return max(files, key=week_num)


def resolve_file(arg):
    """Turn a CLI argument into an absolute path to a week JSON file."""
    if arg is None:
        return find_newest_week_file()

    # Just a number → week-N.json
    if arg.isdigit():
        return os.path.join(RAW_DIR, f"week-{arg}.json")

    # Bare filename → look in RAW_DIR
    if not os.path.sep in arg and not os.path.isabs(arg):
        candidate = os.path.join(RAW_DIR, arg)
        if os.path.exists(candidate):
            return candidate

    # Otherwise treat as-is
    return arg


def fuzzy_match(name, known_names, threshold=FUZZY_THRESHOLD, top_n=FUZZY_TOP_N):
    """Return top fuzzy matches for *name* among *known_names*."""
    results = process.extract(name, known_names, scorer=fuzz.WRatio, limit=top_n)
    return [(match, score) for match, score, _ in results if score >= threshold]


def load_deck_history(exclude_file=None):
    """Scan all raw week-*.json files and return {player_name: [(week, deck), ...]} sorted newest-first."""
    pattern = os.path.join(RAW_DIR, "week-*.json")
    files = glob.glob(pattern)

    def _week_num_from_path(fpath):
        """Extract week number from filename (e.g. week-89.json → 89)."""
        m = re.search(r"week-(\d+)\.json$", fpath)
        return int(m.group(1)) if m else 0

    history = {}  # name → [(week_number, deck)]
    for fpath in files:
        if exclude_file and os.path.abspath(fpath) == os.path.abspath(exclude_file):
            continue
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                week_data = json.load(f)
            # Prefer week_number field, fall back to parsing filename
            wk = week_data.get("week_number") or _week_num_from_path(fpath)
            for entry in week_data.get("standings", []):
                deck = entry.get("deck", "").strip()
                name = entry.get("name", "")
                if name and deck:
                    history.setdefault(name, []).append((wk, deck))
        except (json.JSONDecodeError, KeyError):
            continue

    # Sort each player's history newest-first
    for name in history:
        history[name].sort(key=lambda x: x[0], reverse=True)
    return history


def get_recent_decks(player_name, deck_history, count=3):
    """Return up to *count* most recent distinct decks for a player."""
    entries = deck_history.get(player_name, [])
    seen = set()
    recent = []
    for _wk, deck in entries:
        if deck not in seen:
            seen.add(deck)
            recent.append(deck)
            if len(recent) >= count:
                break
    return recent


# ── Interactive prompts ─────────────────────────────────────────────────────

def prompt_select_name(session, original, suggestions, all_names):
    """
    Let the user pick from fuzzy suggestions, search all names, or type a new one.
    Returns the chosen name and whether it's brand-new (needs adding to file).
    """
    print()
    pf("warn", f"  ⚠  Unknown player: \"{original}\"")

    if suggestions:
        pf("muted", "     Closest matches:")
        for i, (name, score) in enumerate(suggestions, 1):
            pf("muted", f"       {i}. {name}  ({score:.0f}%)")

    print()
    pf("muted", "  Options:")
    pf("muted", "    • Enter a NUMBER to pick a suggestion above")
    pf("muted", "    • TYPE to search — a dropdown appears as you type (Tab to accept)")
    pf("muted", "    • Enter a completely NEW name")
    pf("muted", "    • Press Enter with no input to KEEP the original name")
    print()

    completer = RapidFuzzyCompleter(all_names)

    while True:
        answer = session.prompt(
            "  ➜  Choose name: ",
            completer=completer,
            complete_while_typing=True,
        ).strip()

        # Keep original
        if answer == "":
            pf("muted", f"     Keeping original: \"{original}\"")
            return original, False

        # Numeric pick from suggestions
        if answer.isdigit() and suggestions:
            idx = int(answer) - 1
            if 0 <= idx < len(suggestions):
                chosen = suggestions[idx][0]
                pf("ok", f"     ✓ Selected: \"{chosen}\"")
                return chosen, False
            else:
                pf("err", "     Invalid number, try again.")
                continue

        # Exact match in known list
        if answer in all_names:
            pf("ok", f"     ✓ Selected existing player: \"{answer}\"")
            return answer, False

        # New name — confirm
        confirm = session.prompt(
            f"  ➜  \"{answer}\" is new. Add to player list? (y/n): ",
            completer=None,
        ).strip().lower()
        if confirm in ("", "y", "yes"):
            pf("ok", f"     ✓ Added new player: \"{answer}\"")
            return answer, True
        # otherwise loop


def prompt_auto_accept(session, original, suggestion_name, score):
    """Quick Y/n confirmation for a high-confidence match."""
    print()
    pf("warn", f"  ⚠  \"{original}\" → best match: \"{suggestion_name}\" ({score:.0f}%)")
    answer = session.prompt(
        "     Accept this match? (y/n): ",
        completer=None,
    ).strip().lower()
    return answer in ("", "y", "yes")


def prompt_deck(session, player_name, current_deck, all_decks, deck_history):
    """Prompt the user to assign / change a deck for a player."""
    display_deck = current_deck if current_deck else "(none)"
    pf("muted", f"  Current deck: {display_deck}")

    # Show recent decks as quick-pick options
    recent = get_recent_decks(player_name, deck_history)
    if recent:
        pf("muted", "  Recent decks:")
        for i, deck in enumerate(recent, 1):
            pf("muted", f"    {i}. {deck}")

    pf("muted", "  Type to search, pick a number, or Enter to keep current.")
    completer = RapidFuzzyCompleter(all_decks)
    answer = session.prompt(
        f"  ➜  Deck for {player_name}: ",
        completer=completer,
        complete_while_typing=True,
        default=current_deck or "",
    ).strip()

    # Numeric pick from recent decks
    if answer.isdigit() and recent:
        idx = int(answer) - 1
        if 0 <= idx < len(recent):
            chosen = recent[idx]
            pf("ok", f"     ✓ Deck set: \"{chosen}\"")
            return chosen, False

    if answer == "" or answer == current_deck:
        return current_deck, False

    is_new = answer not in all_decks
    if is_new:
        confirm = session.prompt(
            f"  ➜  \"{answer}\" is a new deck. Add to deck list? (y/n): ",
            completer=None,
        ).strip().lower()
        if confirm not in ("", "y", "yes"):
            return current_deck, False
        pf("ok", f"     ✓ New deck added: \"{answer}\"")
    else:
        pf("ok", f"     ✓ Deck set: \"{answer}\"")

    return answer, is_new


# ── Main flow ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Verify player names and assign decks.")
    parser.add_argument("file", nargs="?", default=None,
                        help="Week file to verify (number, filename, or path). "
                             "Defaults to newest week-*.json.")
    args = parser.parse_args()

    # Create interactive session – MULTI_COLUMN renders completions as text
    # below the prompt (more reliable than floating popup on Windows)
    session = PromptSession(complete_style=CompleteStyle.MULTI_COLUMN)

    # Resolve file
    filepath = resolve_file(args.file)
    if not filepath or not os.path.exists(filepath):
        pf("err", f"✗ File not found: {args.file or '(no week files)'}")
        sys.exit(1)

    filename = os.path.basename(filepath)
    title = " MTG League - Verify Tournament Data "
    print()
    pf("banner", f"  ╔{'═' * len(title)}╗")
    pf("banner", f"  ║{title}║")
    pf("banner", f"  ╚{'═' * len(title)}╝")
    print()
    pf("highlight", f"  File: {filename}")

    # Load data
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    standings = data.get("standings", [])
    rounds = data.get("rounds", [])
    if not standings:
        pf("err", "  ✗ No standings found in file.")
        sys.exit(1)

    pf("muted", f"  Players: {len(standings)}  |  Rounds: {len(rounds)}")

    # Load reference lists
    all_names = load_lines(PLAYERS_FILE)
    all_decks = load_lines(DECKLIST_FILE)

    name_set = set(all_names)
    names_changed = False
    rename_map = {}  # old name → new name

    # ── Phase 1: Verify player names ────────────────────────────────────
    print()
    pf("header", "  ── Phase 1: Verify Player Names ─────────────────────")
    print()

    for entry in standings:
        name = entry["name"]

        if name in name_set:
            pf("ok", f"  ✓  {name}")
            continue

        # Try fuzzy match
        suggestions = fuzzy_match(name, all_names)

        if suggestions:
            best_name, best_score = suggestions[0]
            # High confidence → quick prompt
            if best_score >= 90:
                if prompt_auto_accept(session, name, best_name, best_score):
                    rename_map[name] = best_name
                    continue
                # User declined auto-match → fall through to full selection

            # Show full selection UI
            chosen, is_new = prompt_select_name(session, name, suggestions, all_names)
        else:
            # No suggestions at all
            chosen, is_new = prompt_select_name(session, name, [], all_names)

        if chosen != name:
            rename_map[name] = chosen

        if is_new:
            all_names.append(chosen)
            name_set.add(chosen)
            names_changed = True

    # Apply renames to standings
    if rename_map:
        print()
        pf("highlight", "  ── Name changes ──")
        for old, new in rename_map.items():
            pf("muted", f"     {old}  →  {new}")

        # Rename in standings
        for entry in standings:
            if entry["name"] in rename_map:
                entry["name"] = rename_map[entry["name"]]

        # Rename in rounds/matches
        for rnd in rounds:
            for match in rnd.get("matches", []):
                if match.get("p1") in rename_map:
                    match["p1"] = rename_map[match["p1"]]
                if match.get("p2") in rename_map:
                    match["p2"] = rename_map[match["p2"]]
    else:
        print()
        pf("ok", "  All player names verified — no changes needed.")

    # ── Phase 2: Assign decks ───────────────────────────────────────────
    print()
    pf("header", "  ── Phase 2: Assign Decks ────────────────────────────")
    pf("muted", "  Loading deck history...")
    deck_history = load_deck_history(exclude_file=filepath)
    print()

    decks_changed = False
    for entry in standings:
        name = entry["name"]
        current_deck = entry.get("deck", "")

        pf("highlight", f"  [{entry['rank']}] {name}")
        chosen_deck, is_new_deck = prompt_deck(session, name, current_deck, all_decks, deck_history)

        if chosen_deck != current_deck:
            entry["deck"] = chosen_deck
            decks_changed = True

        if is_new_deck:
            all_decks.append(chosen_deck)
        print()

    # ── Save ────────────────────────────────────────────────────────────
    any_changes = rename_map or decks_changed or names_changed

    if any_changes:
        print()
        pf("header", "  ── Summary ──────────────────────────────────────────")
        print()
        for entry in standings:
            deck_display = entry.get("deck") or "(none)"
            pf("muted", f"  {entry['rank']:>2}. {entry['name']:<30} {deck_display}")
        print()

        confirm = session.prompt(
            "  Save changes? (y/n): ",
            completer=None,
        ).strip().lower()

        if confirm in ("", "y", "yes"):
            # Write JSON
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            pf("ok", f"  ✓ Saved {filename}")

            # Write updated player list
            if names_changed:
                save_lines(PLAYERS_FILE, "Name", all_names)
                pf("ok", "  ✓ Updated Players.txt")

            # Write updated deck list
            original_decks = set(load_lines(DECKLIST_FILE))
            new_decks = [d for d in all_decks if d not in original_decks]
            if new_decks:
                full_list = list(original_decks | set(new_decks))
                save_lines(DECKLIST_FILE, None, full_list)
                pf("ok", f"  ✓ Updated Decklist.txt (+{len(new_decks)} new)")

            print()
            pf("ok", "  Done! You can now run convert_data.py to rebuild db.json.")
        else:
            pf("warn", "  Changes discarded.")
    else:
        print()
        pf("ok", "  No changes made.")

    print()


if __name__ == "__main__":
    main()
