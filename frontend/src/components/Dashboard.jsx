import { useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Line } from "react-chartjs-2";
import { loadLocalPredictions, updateLocalResult } from "../api";

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  Tooltip, Filler, ChartDataLabels
);

const LINE_OPTIONS = {
  responsive: true,
  plugins: {
    legend: { display: false },
    datalabels: { display: false },
    tooltip: {
      callbacks: { label: (ctx) => `  ${ctx.parsed.y}% accuracy` },
      backgroundColor: "#16162a",
      borderColor: "rgba(255,107,53,0.25)",
      borderWidth: 1,
      titleColor: "#f0f0ff",
      bodyColor: "#FF8C42",
      padding: 10,
      cornerRadius: 8,
    },
  },
  scales: {
    y: {
      min: 0,
      max: 100,
      ticks: {
        color: "#5a5a7a",
        callback: (v) => v + "%",
        font: { family: "Inter", size: 11 },
      },
      grid: { color: "rgba(255,255,255,0.04)" },
      border: { display: false },
    },
    x: {
      ticks: { color: "#5a5a7a", font: { family: "Inter", size: 11 } },
      grid: { display: false },
      border: { display: false },
    },
  },
};

const STATS = [
  { key: "accuracy",          label: "Accuracy",    fmt: (v) => `${v ?? 0}%`, accent: true },
  { key: "total_predictions", label: "Predictions", fmt: (v) => v ?? 0 },
  { key: "correct",           label: "Correct",     fmt: (v) => v ?? 0 },
  { key: "total_with_result", label: "With Result", fmt: (v) => v ?? 0 },
];

function buildStats(preds) {
  const withResult = preds.filter(p => p.actual_winner != null);
  const correct = withResult.filter(p => p.correct === 1).length;
  const accuracy = withResult.length > 0
    ? Math.round(correct / withResult.length * 1000) / 10
    : 0;
  const chrono = [...preds].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  let rc = 0, rt = 0;
  const accuracy_over_time = [];
  for (const p of chrono) {
    if (p.actual_winner != null) {
      rt++;
      if (p.correct === 1) rc++;
      accuracy_over_time.push({
        date: p.created_at,
        accuracy: Math.round(rc / rt * 1000) / 10,
        game: rt,
      });
    }
  }
  return { predictions: preds, accuracy, total_predictions: preds.length, correct, total_with_result: withResult.length, accuracy_over_time };
}

export default function Dashboard() {
  const [data, setData]           = useState(() => buildStats(loadLocalPredictions()));
  const [pendingId, setPendingId] = useState(null);

  const reload = () => setData(buildStats(loadLocalPredictions()));

  const submitResult = (pred, winnerName) => {
    updateLocalResult(pred.id, winnerName, pred.predicted_winner);
    setPendingId(null);
    reload();
  };

  const hasOverTime = data.accuracy_over_time.length > 0;

  const lineData = hasOverTime
    ? {
        labels: data.accuracy_over_time.map((d) => `Game ${d.game}`),
        datasets: [
          {
            data: data.accuracy_over_time.map((d) => d.accuracy),
            borderColor: "#FF6B35",
            backgroundColor: "rgba(255,107,53,0.07)",
            fill: true,
            tension: 0.4,
            pointBackgroundColor: "#FF6B35",
            pointBorderColor: "#0e0e1a",
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
          },
        ],
      }
    : null;

  return (
    <div className="dashboard-page">
      <div className="page-hero">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Track your prediction record over time</p>
      </div>

      {/* Stat cards */}
      <div className="stats-row">
        {STATS.map(({ key, label, fmt, accent }) => (
          <div key={key} className={`stat-card ${accent ? "stat-card-accent" : ""}`}>
            <div className="stat-value">{fmt(data[key])}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      <div className="accuracy-disclaimer">
        <span className="disclaimer-label">Note</span>
        Live accuracy tracks 2026 playoff predictions. Playoff games are significantly harder to predict than regular season — Vegas sportsbooks also drop to ~55% accuracy in playoffs. Model was trained and tested at 63.3% accuracy on regular season data.
      </div>

      {/* Accuracy chart */}
      <div className="dash-card">
        <div className="card-header">Accuracy Over Time</div>
        {lineData ? (
          <div className="chart-wrap">
            <Line data={lineData} options={LINE_OPTIONS} />
          </div>
        ) : (
          <div className="empty-chart">
            Add actual game results below to see your accuracy trend.
          </div>
        )}
      </div>

      {/* Predictions table */}
      <div className="dash-card">
        <div className="card-header">All Predictions</div>

        {!data.predictions.length ? (
          <div className="empty-state">
            No predictions yet — head to the Predict tab to get started!
          </div>
        ) : (
          <div className="table-scroll">
            <table className="pred-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Matchup</th>
                  <th>Predicted Winner</th>
                  <th>Probability</th>
                  <th>Actual Winner</th>
                  <th>Result</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.predictions.map((pred, idx) => (
                  <tr
                    key={pred.id}
                    className={[
                      idx % 2 === 1 ? "row-alt" : "",
                      pred.correct === 1 ? "row-correct" : "",
                      pred.correct === 0 ? "row-wrong" : "",
                    ].filter(Boolean).join(" ")}
                  >
                    <td className="td-date">
                      {new Date(pred.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <span className="matchup-home">{pred.home_team_name}</span>
                      <span className="matchup-sep">vs</span>
                      <span className="matchup-away">{pred.away_team_name}</span>
                    </td>
                    <td>{pred.predicted_winner}</td>
                    <td className="td-prob">{pred.win_probability}%</td>
                    <td>{pred.actual_winner ?? <span className="td-empty">—</span>}</td>
                    <td>
                      {pred.correct === 1 ? (
                        <span className="badge badge-correct">✓ Correct</span>
                      ) : pred.correct === 0 ? (
                        <span className="badge badge-wrong">✗ Wrong</span>
                      ) : (
                        <span className="td-empty">—</span>
                      )}
                    </td>
                    <td>
                      {pred.actual_winner ? null : pendingId === pred.id ? (
                        <div className="inline-result">
                          <button className="pick-btn"
                            onClick={() => submitResult(pred, pred.home_team_name)}>
                            {pred.home_team_name}
                          </button>
                          <button className="pick-btn"
                            onClick={() => submitResult(pred, pred.away_team_name)}>
                            {pred.away_team_name}
                          </button>
                          <button className="cancel-btn"
                            onClick={() => setPendingId(null)}>✕</button>
                        </div>
                      ) : (
                        <button className="add-result-btn"
                          onClick={() => setPendingId(pred.id)}>
                          + Add Result
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
