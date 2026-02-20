# Oslo Legacy League — Setup & Weekly Update Guide

This guide walks through everything you need to get set up from scratch, and how to update the website after each weekly tournament.

---

## Part 1 — One-Time Setup

You only need to do this section once.

> **Before you start:** All commands in this guide are typed into the **Terminal** app. You can open it by searching for **Terminal** in the Start menu. The older "Windows PowerShell" app works fine, the newer Terminal is easier to use.

---

### Step 0 — GitHub account & access

The website is hosted on GitHub, so you need a free account and permission to make changes.

1. Go to [github.com](https://github.com) and sign up for a free account if you don't have one.
2. Send your GitHub username to the league admin so they can add you as a **contributor** on the repository.
3. Once accepted, you'll receive an email invitation — click **Accept invitation** before continuing.

> You won't be able to publish updates until you've been added as a contributor.

---

### Step 1 — Install Git

Git is used to download the project and later publish changes to the website.

1. Go to [git-scm.com/download/win](https://git-scm.com/download/win) and download the installer.
2. Run it, click **Next** through all the defaults.
3. When done, open the **Terminal** app (search for it in the Start menu) and run:
   ```
   git --version
   ```
   You should see something like `git version 2.x.x`. If so, it worked.

---

### Step 2 — Install Node.js

Node.js is needed to build the website.

1. Go to [nodejs.org](https://nodejs.org) and download the **LTS** version.
2. Run the installer, click **Next** through all the defaults.
3. Verify in Terminal:
   ```
   node --version
   ```
   You should see `v22.x.x` or similar.

---

### Step 3 — Install Python

Python runs the scripts that scrape and process tournament data.

1. Go to [python.org/downloads](https://python.org/downloads) and download the latest **Python 3** installer.
2. Run the installer. **Important:** on the first screen, tick the box that says **"Add Python to PATH"** before clicking Install.
3. Verify in Terminal:
   ```
   python --version
   ```
   You should see `Python 3.x.x`.

---

### Step 4 — Download the Project

In PowerShell, navigate to wherever you want to keep the project (e.g. your Documents folder), then run:

```
cd C:\Users\YourName\Documents
git clone https://github.com/Fydun/mtg-league.git
cd mtg-league
```

---

### Step 5 — Install Python packages

```
pip install -r scripts/requirements.txt
```

This installs all the Python libraries the scripts need (scraper, fuzzy matching, etc.). Only needs to be done once.

---

### Step 6 — Install website packages

```
cd webapp
npm install
cd ..
```

This downloads all the JavaScript libraries for the website. Only needs to be done once.

---

You're set up. From now on, the weekly update is all you need.

---

## Part 2 — Weekly Update (After Each Tournament)

Open the **Terminal** app, navigate to the `mtg-league` folder, and run the master update script:

```
python scripts/weekly_update.py
```

The script will guide you through every step with on-screen prompts:

1. **Pulls** the latest data from GitHub.
2. **Asks who was TO** — pick Anders, Tormod, or Viktor from a numbered list (or choose "someone else" to enter a tournament ID / URL manually).
3. **Asks how many non-paying players** — usually 1 (the TO).
4. **Scrapes** the tournament from AetherHub.
5. **Walks you through** verifying player names and assigning decks.
6. **Rebuilds** the database and **publishes** the website.

That's all you need for a normal week.

> **Make sure you're in the right folder first.** The Terminal prompt should show something like `C:\Users\YourName\Documents\mtg-league`. If not, type `cd C:\Users\YourName\Documents\mtg-league` and press Enter.

---

## Part 2 (Manual) — Step-by-Step Reference

You don't normally need this section — the master script above handles everything. Use this if something goes wrong mid-update and you need to re-run a specific step on its own.

All commands are run from inside the `mtg-league` folder.

---

### Step 0 — Pull the latest data from GitHub

Before doing anything else, download any changes that have been made since you last updated (e.g. if someone else ran the scripts, or files were edited online):

```
git pull
```

You should see something like `Already up to date.` or a list of updated files. Either is fine — just make sure it completes without errors before moving on.

---

### Step 1 — Scrape the tournament

Use the AetherHub username of whoever ran the tournament that week:

| TO | Command |
|----|-------------------------------|
| Anders | `python scripts/aetherhub.py Fydun -to 1` |
| Tormod | `python scripts/aetherhub.py BlindFlip -to 1` |
| Viktor | `python scripts/aetherhub.py Anonym_from_north -to 1` |

The `-to 1` means one person (the Tournament Organizer) is not paying into the prize pool. **If the TO also played in the event as a paying participant**, change it to `-to 0`. **If two non-paying TOs were present**, use `-to 2`.

The week number is calculated automatically from existing data.

When it finishes you'll see:
```
Success! Saved to: webapp/public/data/raw/week-92.json
```

> **Alternative:** If the tournament isn't showing up via the username, you can pass the numeric ID from the AetherHub URL directly instead:
> ```
> python scripts/aetherhub.py 97704 -to 1
> ```

---

### Step 2 — Verify player names and assign decks

```
python scripts/verify_data.py
```

This opens an interactive tool that works in two phases:

**Phase 1 — Player names**

For each player the script hasn't seen before, it suggests the closest known match from the player list. You can:
- Press **Enter** to accept the top suggestion
- Type a **number** (1–5) to pick a different suggestion
- Start **typing** a name — a dropdown appears as you type
- Press **Enter with nothing typed** to keep the original name as-is
- Type a completely **new name** and confirm with `y` to add them to the list

Players already in the list are accepted automatically (shown with a green ✓).

**Phase 2 — Decklists**

For each player, the tool shows their deck from last time as the default. You can:
- Press **Enter** to keep the current deck
- Type a **number** to pick from their last 3 distinct decks
- Start **typing** to search the full deck list — a dropdown appears
- Type a new deck name and confirm with `y` to add it

At the end you'll see a summary and be asked to confirm before anything is saved.

---

### Step 3 — Rebuild the database

```
python scripts/convert_data.py
```

This reads all the raw tournament files and rebuilds the main `db.json` file that the website uses. Takes only a second.

---

### Step 4 — Build and publish the website

```
cd webapp
npm run build
cd ..
```

This compiles the website into the `docs/` folder. Then publish it:

```
git add .
git commit -m "Week 92 results"
git push
```

Replace `92` with the actual week number. The website on GitHub Pages will update within a minute or two.

---

## Quick Reference

For a normal weekly update, just run:

```
python scripts/weekly_update.py
```

If you need to re-run individual steps manually (replace the username with the TO who ran it):

```
git pull
python scripts/aetherhub.py Fydun -to 1        # Anders
python scripts/aetherhub.py BlindFlip -to 1     # Tormod
python scripts/aetherhub.py Anonym_from_north -to 1  # Viktor
python scripts/verify_data.py
python scripts/convert_data.py
cd webapp && npm run build && cd ..
git add .
git commit -m "Week XX results"
git push
```

---

## Troubleshooting

**"python is not recognized"**
Python wasn't added to PATH during install. Re-run the Python installer, choose **Modify**, and tick **"Add Python to PATH"**.

**"Cloudflare Challenge Detected" during scraping**
The scraper will automatically wait and retry. If it keeps failing, wait a few minutes and try again.

**Wrong week number was auto-calculated**
Pass the week number explicitly as a second argument:
```
python scripts/aetherhub.py 97704 92
```

**A player's name is completely wrong and fuzzy matching isn't helping**
Just type the correct name in full at the prompt — even if it's not in the list yet, you can add it as a new player.

**The website didn't update after `git push`**
Check the **Actions** tab on the GitHub repository page. GitHub Pages can sometimes take 1–2 minutes to deploy.
