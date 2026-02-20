"""
weekly_update.py – Master script for the weekly tournament update.

Runs all steps of the weekly update in sequence:
  1. Pull latest data from GitHub
  2. Scrape tournament from AetherHub
  3. Verify player names & assign decks  (interactive)
  4. Rebuild database (db.json)
  5. Build & publish website to GitHub Pages

Usage:
    python weekly_update.py
"""

import os
import sys
import subprocess
import re
import glob

# ── Paths ──────────────────────────────────────────────────────────────────
SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
WEBAPP_DIR   = os.path.join(PROJECT_ROOT, "webapp")
RAW_DIR      = os.path.join(PROJECT_ROOT, "webapp", "public", "data", "raw")
PYTHON       = sys.executable  # same interpreter that launched this script

# ── ANSI colours ───────────────────────────────────────────────────────────
os.system("")  # enable ANSI escape processing on Windows

RESET = "\033[0m"
C = {
    "banner": "\033[1;96m",   # bold bright cyan
    "step":   "\033[1;94m",   # bold bright blue
    "ok":     "\033[1;32m",   # bold green
    "warn":   "\033[1;33m",   # bold yellow
    "err":    "\033[1;91m",   # bold bright red
    "muted":  "\033[90m",     # dark gray
    "bold":   "\033[1m",
    "info":   "\033[96m",     # cyan
}

TOTAL_STEPS = 5


# ── UI helpers ─────────────────────────────────────────────────────────────

def pf(style, text):
    print(f"{C.get(style, '')}{text}{RESET}")


def rule(char="─", width=58, style="muted"):
    pf(style, "  " + char * width)


def blank():
    print()


def step_header(num, title):
    blank()
    rule()
    pf("step", f"  ▶  Step {num} / {TOTAL_STEPS}  —  {title}")
    rule()
    blank()


def ask_yn(prompt, default="y"):
    hint = "Y/n" if default == "y" else "y/N"
    raw = input(
        f"  {C['bold']}{prompt} {C['muted']}({hint}):{RESET} "
    ).strip().lower()
    if raw == "":
        return default == "y"
    return raw in ("y", "yes")


def ask_input(prompt, default=""):
    suffix = f"{C['muted']} (leave blank for: {default}){RESET}" if default else ""
    raw = input(f"  {C['bold']}{prompt}{suffix}: {RESET}").strip()
    return raw if raw else default


# ── Subprocess helper ──────────────────────────────────────────────────────

def run(cmd, cwd=None, shell=False):
    """
    Run *cmd* with output streaming to the terminal.
    Returns True if exit code is 0.
    cmd can be a list (preferred) or a plain string (required for shell=True).
    """
    result = subprocess.run(cmd, cwd=cwd, shell=shell)
    return result.returncode == 0


def require(success, label):
    """Check result of a step; offer to abort on failure."""
    blank()
    if success:
        pf("ok", f"  ✓  {label} — done.")
    else:
        pf("err", f"  ✗  {label} — failed.")
        blank()
        if not ask_yn("Something went wrong. Continue anyway?", default="n"):
            blank()
            pf("err", "  Update aborted. Fix the issue above and try again.")
            blank()
            sys.exit(1)
        pf("warn", "  Continuing despite error...")


# ── Week number helpers ────────────────────────────────────────────────────

def scan_week_numbers():
    files = glob.glob(os.path.join(RAW_DIR, "week-*.json"))
    nums = []
    for f in files:
        m = re.search(r"week-(\d+)\.json$", f)
        if m:
            nums.append(int(m.group(1)))
    current = max(nums) if nums else 0
    return current


# ── Main ───────────────────────────────────────────────────────────────────

def main():
    current_week = scan_week_numbers()
    next_week    = current_week + 1

    # ── Banner ────────────────────────────────────────────────────────────
    title = "  Oslo Legacy League — Weekly Update  "
    blank()
    pf("banner", f"  ╔{'═' * len(title)}╗")
    pf("banner", f"  ║{title}║")
    pf("banner", f"  ╚{'═' * len(title)}╝")
    blank()
    pf("info",  f"  Last recorded week: {current_week}   →   Will scrape: Week {next_week}")
    blank()
    pf("muted", "  This script will:")
    pf("muted", "    1.  Pull the latest data from GitHub")
    pf("muted", "    2.  Scrape this week's tournament from AetherHub")
    pf("muted", "    3.  Verify player names and assign decklists  (you'll be prompted)")
    pf("muted", "    4.  Rebuild the website database")
    pf("muted", "    5.  Build and publish the website")
    blank()

    if not ask_yn("Ready to start?"):
        pf("muted", "  No changes made. Goodbye.")
        blank()
        sys.exit(0)

    # ── Step 1: git pull ──────────────────────────────────────────────────
    step_header(1, "Pull latest from GitHub")
    pf("muted", "  Downloading any changes made since your last update...\n")
    ok = run(["git", "pull"], cwd=PROJECT_ROOT)
    require(ok, "git pull")

    # ── Step 2: Scrape ────────────────────────────────────────────────────
    step_header(2, "Scrape Tournament")

    # 2a — Who ran the tournament?
    TO_OPTIONS = {
        "1": ("Anders",  "Fydun"),
        "2": ("Tormod",  "BlindFlip"),
        "3": ("Viktor",  "Anonym_from_north"),
    }

    pf("muted", "  Who was the Tournament Organizer this week?\n")
    for key, (name, user) in TO_OPTIONS.items():
        pf("muted", f"    {key}.  {name:<10}  (aetherhub.com/User/{user})")
    pf("muted", f"    4.  Someone else / enter manually")
    blank()

    to_choice = ask_input("Pick a number", default="1")

    if to_choice in TO_OPTIONS:
        to_name, aetherhub_target = TO_OPTIONS[to_choice]
        pf("ok", f"  ✓  TO: {to_name}")
    else:
        blank()
        pf("muted", "  Enter an AetherHub username, tournament ID, or full URL:")
        aetherhub_target = ask_input("Target", default="")
        if not aetherhub_target:
            pf("err", "  No target provided — cannot scrape.")
            sys.exit(1)
        to_name = aetherhub_target

    # 2b — Non-paying players
    blank()
    pf("muted", "  How many people are NOT paying into the prize pool?")
    pf("muted", "  (This is usually just the Tournament Organizer = 1)")
    pf("muted", "  Use 0 if the TO also paid, or 2 if two people didn't pay.\n")
    to_val = ask_input("Non-paying players", default="1")
    try:
        to_val = int(to_val)
    except ValueError:
        pf("warn", "  Couldn't read that — defaulting to 1.")
        to_val = 1

    blank()
    pf("muted", f"  Scraping latest tournament from '{to_name}' (week {next_week}, -to {to_val})...\n")

    ok = run(
        [PYTHON, os.path.join(SCRIPT_DIR, "aetherhub.py"), aetherhub_target, "-to", str(to_val)],
        cwd=PROJECT_ROOT,
    )
    require(ok, "Scrape")

    # re-detect in case week number shifted (e.g. file already existed)
    scraped_week = scan_week_numbers()

    # ── Step 3: Verify ────────────────────────────────────────────────────
    step_header(3, "Verify Player Names & Decks")
    pf("muted", "  The tool below will walk you through confirming each player's name")
    pf("muted", "  and assigning their deck. Follow the on-screen prompts.\n")

    while True:
        result = subprocess.run(
            [PYTHON, os.path.join(SCRIPT_DIR, "verify_data.py")],
            cwd=PROJECT_ROOT,
        )

        if result.returncode == 0:
            # Saved successfully (or no changes needed)
            blank()
            pf("ok", "  ✓  Verify — done.")
            break
        elif result.returncode == 2:
            # User chose not to save
            blank()
            pf("warn", "  Changes were discarded.")
            blank()
            pf("muted", "  What would you like to do?")
            pf("muted", "    1.  Run verify again")
            pf("muted", "    2.  Quit the update")
            blank()
            choice = ask_input("Pick a number", default="1")
            if choice == "2":
                blank()
                pf("err", "  Update aborted.")
                blank()
                sys.exit(1)
            # otherwise loop back and re-run verify
            blank()
            pf("muted", "  Re-running verify...\n")
        else:
            # Some other error
            require(False, "Verify")
            break

    # ── Step 4: Rebuild DB ────────────────────────────────────────────────
    step_header(4, "Rebuild Database")
    pf("muted", "  Aggregating all tournament data into db.json...\n")

    ok = run(
        [PYTHON, os.path.join(SCRIPT_DIR, "convert_data.py")],
        cwd=PROJECT_ROOT,
    )
    require(ok, "Rebuild database")

    # ── Step 5: Build & Publish ───────────────────────────────────────────
    step_header(5, "Build & Publish Website")

    # 5a — npm build
    pf("muted", "  Compiling the website...\n")
    ok = run("npm run build", cwd=WEBAPP_DIR, shell=True)
    require(ok, "Website build")

    # 5b — commit message
    blank()
    default_msg = f"Week {scraped_week} results"
    commit_msg  = ask_input("Commit message", default=default_msg)
    blank()

    # 5c — git add + commit + push
    pf("muted", "  Staging all changed files...")
    run(["git", "add", "."], cwd=PROJECT_ROOT)

    pf("muted", f"  Committing: \"{commit_msg}\"...")
    run(["git", "commit", "-m", commit_msg], cwd=PROJECT_ROOT)

    pf("muted", "  Pushing to GitHub...")
    ok = run(["git", "push"], cwd=PROJECT_ROOT)
    require(ok, "Publish")

    # ── Done ─────────────────────────────────────────────────────────────
    blank()
    rule("═", style="ok")
    pf("ok", f"  ✓  Week {scraped_week} published successfully!")
    pf("muted", "     The website will refresh on GitHub Pages within 1–2 minutes.")
    rule("═", style="ok")
    blank()


if __name__ == "__main__":
    main()
