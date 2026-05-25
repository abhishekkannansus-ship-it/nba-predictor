import os
import json
import sqlite3
import numpy as np
import joblib
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "model.pkl")
STATS_PATH = os.path.join(BASE_DIR, "team_stats.json")
DB_PATH = os.path.join(BASE_DIR, "predictions.db")

FEATURE_NAMES = [
    "Home Win%",
    "Home Avg PTS",
    "Home Avg PTS Allowed",
    "Home Off Rating",
    "Home Def Rating",
    "Home Last 10 Wins",
    "Away Win%",
    "Away Avg PTS",
    "Away Avg PTS Allowed",
    "Away Off Rating",
    "Away Def Rating",
    "Away Last 10 Wins",
    "Home Court Advantage",
]

_model = None
_team_stats = None


def get_model():
    global _model
    if _model is None and os.path.exists(MODEL_PATH):
        _model = joblib.load(MODEL_PATH)
    return _model


def get_team_stats():
    global _team_stats
    if _team_stats is None and os.path.exists(STATS_PATH):
        with open(STATS_PATH) as f:
            _team_stats = json.load(f)
    return _team_stats


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            home_team TEXT NOT NULL,
            away_team TEXT NOT NULL,
            home_team_name TEXT NOT NULL,
            away_team_name TEXT NOT NULL,
            predicted_winner TEXT NOT NULL,
            win_probability REAL NOT NULL,
            contributing_factors TEXT NOT NULL,
            actual_winner TEXT,
            correct INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.commit()
    conn.close()


init_db()


@app.route("/health", methods=["GET"])
def health():
    return jsonify(
        {
            "status": "ok",
            "model_ready": os.path.exists(MODEL_PATH) and os.path.exists(STATS_PATH),
        }
    )


@app.route("/teams", methods=["GET"])
def get_teams():
    stats = get_team_stats()
    if not stats:
        return jsonify({"error": "Model not trained yet. Run model_trainer.py first."}), 503
    teams = [{"name": v["team_name"], "abbreviation": k} for k, v in stats.items()]
    teams.sort(key=lambda x: x["name"])
    return jsonify(teams)


@app.route("/predict", methods=["POST"])
def predict():
    model = get_model()
    stats = get_team_stats()
    if not model or not stats:
        return jsonify({"error": "Model not trained yet. Run model_trainer.py first."}), 503

    data = request.get_json()
    home_abbr = data.get("home_team", "").upper()
    away_abbr = data.get("away_team", "").upper()

    if not home_abbr or not away_abbr:
        return jsonify({"error": "home_team and away_team are required"}), 400
    if home_abbr == away_abbr:
        return jsonify({"error": "Home and away teams must be different"}), 400
    if home_abbr not in stats:
        return jsonify({"error": f"Unknown team: {home_abbr}"}), 400
    if away_abbr not in stats:
        return jsonify({"error": f"Unknown team: {away_abbr}"}), 400

    h = stats[home_abbr]
    a = stats[away_abbr]

    features = np.array(
        [[
            h["win_pct"], h["avg_pts"], h["avg_pts_allowed"],
            h["off_rating"], h["def_rating"], h["last10"],
            a["win_pct"], a["avg_pts"], a["avg_pts_allowed"],
            a["off_rating"], a["def_rating"], a["last10"],
            1.0,
        ]]
    )

    proba = model.predict_proba(features)[0]
    prediction = int(model.predict(features)[0])
    classes = model.classes_.tolist()
    home_win_prob = float(proba[classes.index(1)]) if 1 in classes else float(proba[1])

    if prediction == 1:
        predicted_winner = h["team_name"]
        predicted_abbr = home_abbr
        win_prob_pct = round(home_win_prob * 100, 1)
    else:
        predicted_winner = a["team_name"]
        predicted_abbr = away_abbr
        win_prob_pct = round((1 - home_win_prob) * 100, 1)

    importances = model.feature_importances_
    top5_idx = np.argsort(importances)[::-1][:5]
    top5 = [
        {"feature": FEATURE_NAMES[i], "importance": round(float(importances[i]), 4)}
        for i in top5_idx
    ]

    conn = get_db()
    cursor = conn.execute(
        """INSERT INTO predictions
           (home_team, away_team, home_team_name, away_team_name,
            predicted_winner, win_probability, contributing_factors)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (
            home_abbr, away_abbr,
            h["team_name"], a["team_name"],
            predicted_winner, win_prob_pct,
            json.dumps(top5),
        ),
    )
    pred_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify(
        {
            "id": pred_id,
            "home_team": h["team_name"],
            "home_team_abbr": home_abbr,
            "away_team": a["team_name"],
            "away_team_abbr": away_abbr,
            "predicted_winner": predicted_winner,
            "predicted_winner_abbr": predicted_abbr,
            "win_probability": win_prob_pct,
            "contributing_factors": top5,
        }
    )


@app.route("/accuracy", methods=["GET"])
def get_accuracy():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM predictions ORDER BY created_at DESC"
    ).fetchall()
    conn.close()

    predictions = []
    correct_count = 0
    total_with_result = 0
    running_correct = 0
    running_total = 0
    accuracy_over_time = []

    for row in reversed(list(rows)):
        p = dict(row)
        if p["actual_winner"] is not None:
            running_total += 1
            if p["correct"]:
                running_correct += 1
            accuracy_over_time.append(
                {
                    "date": p["created_at"],
                    "accuracy": round(running_correct / running_total * 100, 1),
                    "game": running_total,
                }
            )

    for row in rows:
        p = dict(row)
        p["contributing_factors"] = json.loads(p["contributing_factors"])
        predictions.append(p)
        if p["actual_winner"] is not None:
            total_with_result += 1
            if p["correct"]:
                correct_count += 1

    accuracy = round(correct_count / total_with_result * 100, 1) if total_with_result > 0 else 0

    return jsonify(
        {
            "predictions": predictions,
            "accuracy": accuracy,
            "total_predictions": len(predictions),
            "correct": correct_count,
            "total_with_result": total_with_result,
            "accuracy_over_time": accuracy_over_time,
        }
    )


@app.route("/save-result", methods=["POST"])
def save_result():
    data = request.get_json()
    pred_id = data.get("id")
    actual_winner = data.get("actual_winner", "").strip()

    if not pred_id or not actual_winner:
        return jsonify({"error": "id and actual_winner are required"}), 400

    conn = get_db()
    row = conn.execute("SELECT * FROM predictions WHERE id = ?", (pred_id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Prediction not found"}), 404

    correct = 1 if row["predicted_winner"] == actual_winner else 0
    conn.execute(
        "UPDATE predictions SET actual_winner = ?, correct = ? WHERE id = ?",
        (actual_winner, correct, pred_id),
    )
    conn.commit()
    conn.close()

    return jsonify({"success": True, "correct": bool(correct)})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)
