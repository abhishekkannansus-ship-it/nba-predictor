#!/usr/bin/env python3
"""
NBA Game Predictor - Model Trainer
Data source: Basketball Reference (via basketball_reference_web_scraper + direct scraping)
Run ONCE before starting the Flask app:  python model_trainer.py
"""

import sys
import time
import json
import requests
import numpy as np
from bs4 import BeautifulSoup
from collections import defaultdict
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import joblib

try:
    from basketball_reference_web_scraper import client as br_client
except ImportError:
    print("ERROR: basketball_reference_web_scraper not installed.")
    print("Run: pip install -r requirements.txt")
    sys.exit(1)

try:
    from nba_api.stats.static import teams as nba_teams_static
    _NBA_ABBR_MAP = {t["full_name"].upper(): t["abbreviation"]
                     for t in nba_teams_static.get_teams()}
except ImportError:
    _NBA_ABBR_MAP = {}

BR_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# (BR season_end_year, human label)
SEASONS = [(2023, "2022-23"), (2024, "2023-24")]

MODEL_PATH = "model.pkl"
STATS_PATH = "team_stats.json"


# ── Helpers ──────────────────────────────────────────────────────────────────

def team_abbr(team_enum):
    """BR Team enum → NBA abbreviation (e.g. 'LAL')."""
    name = team_enum.value.upper()          # 'LOS ANGELES LAKERS'
    return _NBA_ABBR_MAP.get(name, name.split()[-1][:3])


def team_display_name(team_enum):
    """BR Team enum → title-case full name (e.g. 'Los Angeles Lakers')."""
    return team_enum.value.title()


def polite_sleep(secs=3.0):
    print(f"  (waiting {secs:.0f}s to be polite to Basketball Reference...)")
    time.sleep(secs)


# ── Fetchers ─────────────────────────────────────────────────────────────────

def fetch_schedule(season_end_year):
    """Return all completed regular-season + playoff games for the season."""
    print(f"  Fetching schedule (season ending {season_end_year})...")
    games = br_client.season_schedule(season_end_year=season_end_year)
    played = [
        g for g in games
        if g["home_team_score"] is not None and g["away_team_score"] is not None
    ]
    print(f"  {len(played)} completed games")
    return played


def fetch_advanced_ratings(season_end_year):
    """
    Scrape real ORtg / DRtg per team from the BR season summary page.
    Returns dict: 'LOS ANGELES LAKERS' → (off_rtg, def_rtg)
    """
    print(f"  Scraping advanced ratings for {season_end_year}...")
    url = f"https://www.basketball-reference.com/leagues/NBA_{season_end_year}.html"
    r = requests.get(url, headers=BR_HEADERS, timeout=20)
    r.raise_for_status()

    soup = BeautifulSoup(r.content, "lxml")
    table = soup.find("table", {"id": "advanced-team"})
    if not table:
        raise ValueError(f"Could not find advanced-team table on {url}")

    ratings = {}
    for row in table.find("tbody").find_all("tr"):
        cells = {td.get("data-stat"): td.text.strip() for td in row.find_all(["td", "th"])}
        raw_name = cells.get("team", "").replace("*", "").replace("+", "").strip()
        if not raw_name or not cells.get("off_rtg"):
            continue
        try:
            ratings[raw_name.upper()] = (float(cells["off_rtg"]), float(cells["def_rtg"]))
        except (ValueError, KeyError):
            continue

    print(f"  Got ORtg/DRtg for {len(ratings)} teams")
    return ratings


# ── Stat computation ─────────────────────────────────────────────────────────

def compute_team_stats(games, adv_ratings):
    """
    Build per-team stats from completed games + scraped advanced ratings.
    Returns dict: abbreviation → stats dict (also stores the Team enum for lookups).
    """
    per_team = defaultdict(list)
    for g in games:
        h_pts, a_pts = g["home_team_score"], g["away_team_score"]
        per_team[g["home_team"]].append(
            {"pts_for": h_pts, "pts_against": a_pts, "win": h_pts > a_pts, "date": g["start_time"]}
        )
        per_team[g["away_team"]].append(
            {"pts_for": a_pts, "pts_against": h_pts, "win": a_pts > h_pts, "date": g["start_time"]}
        )

    team_stats = {}
    for team_enum, tgames in per_team.items():
        tgames.sort(key=lambda x: x["date"])
        abbr = team_abbr(team_enum)
        br_key = team_enum.value.upper()

        wins = sum(1 for g in tgames if g["win"])
        total = len(tgames)
        off_rtg, def_rtg = adv_ratings.get(br_key, (113.0, 113.0))

        team_stats[abbr] = {
            "team_name":      team_display_name(team_enum),
            "_team_enum":     team_enum,           # used internally for training-sample lookup
            "win_pct":        round(wins / total, 4) if total else 0.5,
            "avg_pts":        round(float(np.mean([g["pts_for"]     for g in tgames])), 2),
            "avg_pts_allowed":round(float(np.mean([g["pts_against"] for g in tgames])), 2),
            "off_rating":     round(off_rtg, 2),
            "def_rating":     round(def_rtg, 2),
            "last10":         sum(1 for g in tgames[-10:] if g["win"]),
        }

    return team_stats


def build_training_samples(games, team_stats):
    """Create feature matrix X and label vector y from completed games."""
    enum_to_abbr = {v["_team_enum"]: k for k, v in team_stats.items()}

    X, y = [], []
    for g in games:
        h_abbr = enum_to_abbr.get(g["home_team"])
        a_abbr = enum_to_abbr.get(g["away_team"])
        if not h_abbr or not a_abbr:
            continue

        h, a = team_stats[h_abbr], team_stats[a_abbr]

        X.append([
            h["win_pct"],         h["avg_pts"],         h["avg_pts_allowed"],
            h["off_rating"],      h["def_rating"],      h["last10"],
            a["win_pct"],         a["avg_pts"],         a["avg_pts_allowed"],
            a["off_rating"],      a["def_rating"],      a["last10"],
            1.0,                  # home court advantage flag
        ])
        y.append(1 if g["home_team_score"] > g["away_team_score"] else 0)

    return np.array(X, dtype=np.float32), np.array(y, dtype=np.int32)


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("NBA Game Predictor — Model Trainer (Basketball Reference)")
    print("=" * 60)

    all_X, all_y = [], []
    latest_team_stats = None

    for i, (season_end_year, label) in enumerate(SEASONS):
        print(f"\n[Season {label}]")
        if i > 0:
            polite_sleep(4)

        games = fetch_schedule(season_end_year)
        polite_sleep(3)
        adv_ratings = fetch_advanced_ratings(season_end_year)

        team_stats = compute_team_stats(games, adv_ratings)
        X, y = build_training_samples(games, team_stats)

        print(f"  {len(X)} training samples across {len(team_stats)} teams")
        all_X.append(X)
        all_y.append(y)
        latest_team_stats = team_stats

    X_all = np.vstack(all_X)
    y_all = np.concatenate(all_y)
    print(f"\nTotal training samples : {len(X_all)}")
    print(f"Home win rate in data  : {y_all.mean():.1%}")

    X_train, X_test, y_train, y_test = train_test_split(
        X_all, y_all, test_size=0.2, random_state=42, stratify=y_all
    )

    print("\nTraining Random Forest (200 trees)...")
    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=10,
        min_samples_split=5,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"\nTest accuracy : {acc:.1%}")
    print(classification_report(y_test, y_pred, target_names=["Away Wins", "Home Wins"]))

    joblib.dump(model, MODEL_PATH)
    print(f"Model saved → {MODEL_PATH}")

    # Write team_stats.json — strip internal _team_enum key before serializing
    stats_out = {
        abbr: {k: v for k, v in s.items() if not k.startswith("_")}
        for abbr, s in latest_team_stats.items()
    }
    with open(STATS_PATH, "w") as f:
        json.dump(stats_out, f, indent=2)
    print(f"Team stats saved → {STATS_PATH}")

    print("\nAll done! Start the API with:  python app.py")


if __name__ == "__main__":
    main()
