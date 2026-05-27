import axios from "axios";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:5001";

const api = axios.create({ baseURL: BASE });

export const getTeams    = () => api.get("/teams");
export const predict     = (homeTeam, awayTeam) =>
  api.post("/predict", { home_team: homeTeam, away_team: awayTeam });
export const getTeamStats = (abbr) => api.get(`/team-stats/${abbr}`);

// ── localStorage prediction store ──────────────────────────────────────────
// All prediction persistence lives here; the backend /predict is used only
// to run the ML model — it never needs to be read back.

const LS_KEY = "nba_predictions";

export function loadLocalPredictions() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); }
  catch { return []; }
}

export function upsertLocalPrediction(pred) {
  const preds = loadLocalPredictions();
  const idx = preds.findIndex(p => p.id === pred.id);
  if (idx >= 0) preds[idx] = { ...preds[idx], ...pred };
  else preds.unshift(pred);
  try { localStorage.setItem(LS_KEY, JSON.stringify(preds)); } catch {}
}

export function updateLocalResult(id, actual_winner, predicted_winner) {
  const preds = loadLocalPredictions();
  const idx = preds.findIndex(p => p.id === id);
  if (idx >= 0) {
    preds[idx] = {
      ...preds[idx],
      actual_winner,
      correct: actual_winner === predicted_winner ? 1 : 0,
    };
    try { localStorage.setItem(LS_KEY, JSON.stringify(preds)); } catch {}
  }
}

export function computeLocalStats() {
  const preds = loadLocalPredictions();
  const withResult = preds.filter(p => p.actual_winner != null);
  const correct = withResult.filter(p => p.correct === 1).length;
  return {
    total_predictions: preds.length,
    total_with_result: withResult.length,
    accuracy: withResult.length > 0
      ? Math.round(correct / withResult.length * 1000) / 10
      : 0,
  };
}
