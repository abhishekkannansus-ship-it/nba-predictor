import axios from "axios";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:5001";

const api = axios.create({ baseURL: BASE });

export const getTeams = () => api.get("/teams");
export const predict = (homeTeam, awayTeam) =>
  api.post("/predict", { home_team: homeTeam, away_team: awayTeam });
export const getAccuracy = () => api.get("/accuracy");
export const saveResult = (id, actualWinner) =>
  api.post("/save-result", { id, actual_winner: actualWinner });
export const getTeamStats = (abbr) => api.get(`/team-stats/${abbr}`);

// ── localStorage prediction persistence ──
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

export function updateLocalResult(id, actual_winner, correct) {
  const preds = loadLocalPredictions();
  const idx = preds.findIndex(p => p.id === id);
  if (idx >= 0) {
    preds[idx] = { ...preds[idx], actual_winner, correct: correct ? 1 : 0 };
    try { localStorage.setItem(LS_KEY, JSON.stringify(preds)); } catch {}
  }
}
