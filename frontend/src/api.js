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
