import { useState, useEffect } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { getAccuracy, saveResult } from "../api";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const LINE_OPTIONS = {
  responsive: true,
  plugins: {
    legend: { display: false },
    title: {
      display: true,
      text: "Prediction Accuracy Over Time",
      color: "#fff",
      font: { size: 14, weight: "bold" },
      padding: { bottom: 16 },
    },
    tooltip: {
      callbacks: {
        label: (ctx) => ` ${ctx.parsed.y}% accuracy`,
      },
    },
  },
  scales: {
    y: {
      min: 0,
      max: 100,
      ticks: {
        color: "#aab",
        callback: (v) => v + "%",
      },
      grid: { color: "rgba(255,255,255,0.08)" },
    },
    x: {
      ticks: { color: "#aab" },
      grid: { display: false },
    },
  },
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState(null); // which row is being edited

  const reload = () => {
    setLoading(true);
    getAccuracy()
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  const submitResult = async (pred, winnerName) => {
    try {
      await saveResult(pred.id, winnerName);
      setPendingId(null);
      reload();
    } catch {
      alert("Failed to save result.");
    }
  };

  if (loading) return <div className="loading">Loading dashboard...</div>;

  const hasOverTime = data?.accuracy_over_time?.length > 0;
  const lineChartData = hasOverTime
    ? {
        labels: data.accuracy_over_time.map((d) => `Game ${d.game}`),
        datasets: [
          {
            label: "Accuracy",
            data: data.accuracy_over_time.map((d) => d.accuracy),
            borderColor: "#FF6B35",
            backgroundColor: "rgba(255, 107, 53, 0.12)",
            fill: true,
            tension: 0.35,
            pointBackgroundColor: "#FF6B35",
            pointRadius: 5,
            pointHoverRadius: 7,
          },
        ],
      }
    : null;

  return (
    <div className="dashboard-page">
      <h2 className="section-title">Prediction Dashboard</h2>

      <div className="stats-row">
        {[
          { label: "Overall Accuracy", value: `${data?.accuracy ?? 0}%` },
          { label: "Total Predictions", value: data?.total_predictions ?? 0 },
          { label: "Correct", value: data?.correct ?? 0 },
          { label: "With Result", value: data?.total_with_result ?? 0 },
        ].map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {lineChartData ? (
        <div className="chart-card">
          <Line data={lineChartData} options={LINE_OPTIONS} />
        </div>
      ) : (
        <div className="chart-card empty-chart">
          <p>Accuracy chart will appear after you add actual game results below.</p>
        </div>
      )}

      <div className="table-card">
        <h3>All Predictions</h3>
        {!data?.predictions?.length ? (
          <p className="empty-state">
            No predictions yet. Head to the Predict tab to get started!
          </p>
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
                {data.predictions.map((pred) => (
                  <tr
                    key={pred.id}
                    className={
                      pred.correct === 1
                        ? "row-correct"
                        : pred.correct === 0
                        ? "row-wrong"
                        : ""
                    }
                  >
                    <td>{new Date(pred.created_at).toLocaleDateString()}</td>
                    <td>
                      <span className="matchup-text">
                        {pred.home_team_name} <em>(H)</em> vs {pred.away_team_name}
                      </span>
                    </td>
                    <td>{pred.predicted_winner}</td>
                    <td>{pred.win_probability}%</td>
                    <td>{pred.actual_winner ?? "—"}</td>
                    <td className="result-cell">
                      {pred.correct === 1 ? (
                        <span className="badge correct">✓ Correct</span>
                      ) : pred.correct === 0 ? (
                        <span className="badge wrong">✗ Wrong</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {pred.actual_winner ? null : pendingId === pred.id ? (
                        <div className="inline-result">
                          <button
                            className="team-pick-btn"
                            onClick={() => submitResult(pred, pred.home_team_name)}
                          >
                            {pred.home_team_name}
                          </button>
                          <button
                            className="team-pick-btn"
                            onClick={() => submitResult(pred, pred.away_team_name)}
                          >
                            {pred.away_team_name}
                          </button>
                          <button
                            className="cancel-pick-btn"
                            onClick={() => setPendingId(null)}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          className="add-result-btn"
                          onClick={() => setPendingId(pred.id)}
                        >
                          Add Result
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
