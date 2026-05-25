import { useState, useEffect } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { getTeams, predict } from "../api";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const BAR_OPTIONS = {
  indexAxis: "y",
  responsive: true,
  plugins: {
    legend: { display: false },
    title: {
      display: true,
      text: "Top 5 Contributing Factors",
      color: "#fff",
      font: { size: 14, weight: "bold" },
      padding: { bottom: 16 },
    },
    tooltip: {
      callbacks: {
        label: (ctx) => ` ${(ctx.parsed.x * 100).toFixed(1)}%`,
      },
    },
  },
  scales: {
    x: {
      ticks: {
        color: "#aab",
        callback: (v) => (v * 100).toFixed(0) + "%",
      },
      grid: { color: "rgba(255,255,255,0.08)" },
    },
    y: {
      ticks: { color: "#dde", font: { size: 12 } },
      grid: { display: false },
    },
  },
};

export default function PredictPage() {
  const [teams, setTeams] = useState([]);
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getTeams()
      .then((res) => {
        setTeams(res.data);
        if (res.data.length >= 2) {
          setHomeTeam(res.data[0].abbreviation);
          setAwayTeam(res.data[1].abbreviation);
        }
      })
      .catch(() =>
        setError(
          "Could not reach the backend. Make sure the Flask server is running on port 5001."
        )
      );
  }, []);

  const handlePredict = async () => {
    if (!homeTeam || !awayTeam) return;
    if (homeTeam === awayTeam) {
      setError("Home and away teams must be different.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await predict(homeTeam, awayTeam);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Prediction failed. Check the backend logs.");
    } finally {
      setLoading(false);
    }
  };

  const chartData = result
    ? {
        labels: result.contributing_factors.map((f) => f.feature),
        datasets: [
          {
            label: "Importance",
            data: result.contributing_factors.map((f) => f.importance),
            backgroundColor: "rgba(255, 107, 53, 0.85)",
            borderColor: "#FF6B35",
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      }
    : null;

  return (
    <div className="predict-page">
      <h2 className="section-title">Game Predictor</h2>

      {error && <div className="error-banner">{error}</div>}

      <div className="matchup-card">
        <div className="team-select-row">
          <div className="team-select-group">
            <label>Home Team</label>
            <select value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)}>
              {teams.map((t) => (
                <option key={t.abbreviation} value={t.abbreviation}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="vs-badge">VS</div>

          <div className="team-select-group">
            <label>Away Team</label>
            <select value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)}>
              {teams.map((t) => (
                <option key={t.abbreviation} value={t.abbreviation}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          className="predict-btn"
          onClick={handlePredict}
          disabled={loading || !homeTeam || !awayTeam}
        >
          {loading ? "Predicting..." : "Predict Winner"}
        </button>
      </div>

      {result && (
        <div className="result-grid">
          <div className="winner-card">
            <div className="result-tag">Predicted Winner</div>
            <div className="winner-name">{result.predicted_winner}</div>

            <div className="prob-section">
              <div className="prob-label">
                Win Probability
                <span className="prob-value"> {result.win_probability}%</span>
              </div>
              <div className="prob-track">
                <div
                  className="prob-fill"
                  style={{ width: `${result.win_probability}%` }}
                />
              </div>
            </div>

            <div className="matchup-summary">
              <span className="team-chip home">{result.home_team} (H)</span>
              <span className="chip-vs">vs</span>
              <span className="team-chip away">{result.away_team}</span>
            </div>
          </div>

          <div className="chart-card">
            {chartData && <Bar data={chartData} options={BAR_OPTIONS} />}
          </div>
        </div>
      )}
    </div>
  );
}
