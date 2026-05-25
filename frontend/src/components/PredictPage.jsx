import { useState, useEffect } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { getTeams, predict } from "../api";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

export default function PredictPage() {
  const [teams, setTeams]       = useState([]);
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [probWidth, setProbWidth] = useState(0);

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
        setError("Could not reach the backend. Make sure the Flask server is running on port 5001.")
      );
  }, []);

  // Animate the progress bar in after result arrives
  useEffect(() => {
    if (result) {
      setProbWidth(0);
      const t = setTimeout(() => setProbWidth(result.win_probability), 60);
      return () => clearTimeout(t);
    }
  }, [result]);

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

  // Convert importance (0–1) to percent for display
  const chartData = result
    ? {
        labels: result.contributing_factors.map((f) => f.feature),
        datasets: [
          {
            data: result.contributing_factors.map((f) =>
              parseFloat((f.importance * 100).toFixed(1))
            ),
            backgroundColor: [
              "rgba(255,107,53,0.90)",
              "rgba(255,120,58,0.82)",
              "rgba(255,133,63,0.74)",
              "rgba(255,143,68,0.66)",
              "rgba(255,150,72,0.58)",
            ],
            borderRadius: 6,
            borderSkipped: false,
          },
        ],
      }
    : null;

  const chartOptions = {
    indexAxis: "y",
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: { label: (ctx) => `  ${ctx.parsed.x.toFixed(1)}%` },
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
      x: {
        ticks: {
          color: "#5a5a7a",
          callback: (v) => v + "%",
          font: { family: "Inter", size: 11 },
        },
        grid: { color: "rgba(255,255,255,0.04)" },
        border: { display: false },
      },
      y: {
        ticks: {
          color: "#b0b0c8",
          font: { family: "Inter", size: 12 },
        },
        grid: { display: false },
        border: { display: false },
      },
    },
    animation: { duration: 700, easing: "easeOutQuart" },
  };

  return (
    <div className="predict-page">
      <div className="page-hero">
        <h1 className="page-title">Game Predictor</h1>
        <p className="page-subtitle">
          Pick two teams — our Random Forest model handles the rest
        </p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* ── Matchup builder ── */}
      <div className="matchup-card">
        <div className="matchup-builder">
          <div className="team-slot">
            <div className="slot-label">Home Team</div>
            <div className="select-wrap">
              <select
                className="team-select"
                value={homeTeam}
                onChange={(e) => setHomeTeam(e.target.value)}
              >
                {teams.map((t) => (
                  <option key={t.abbreviation} value={t.abbreviation}>
                    {t.name}
                  </option>
                ))}
              </select>
              <span className="select-arrow">▾</span>
            </div>
            <div className="slot-badge home-badge">HOME</div>
          </div>

          <div className="vs-divider">
            <div className="vs-ring">VS</div>
          </div>

          <div className="team-slot">
            <div className="slot-label">Away Team</div>
            <div className="select-wrap">
              <select
                className="team-select"
                value={awayTeam}
                onChange={(e) => setAwayTeam(e.target.value)}
              >
                {teams.map((t) => (
                  <option key={t.abbreviation} value={t.abbreviation}>
                    {t.name}
                  </option>
                ))}
              </select>
              <span className="select-arrow">▾</span>
            </div>
            <div className="slot-badge away-badge">AWAY</div>
          </div>
        </div>

        <button
          className="predict-btn"
          onClick={handlePredict}
          disabled={loading || !homeTeam || !awayTeam}
        >
          {loading ? (
            <>
              <span className="spinner" />
              Analyzing matchup…
            </>
          ) : (
            "Predict Winner"
          )}
        </button>
      </div>

      {/* ── Result ── */}
      {result && (
        <div className="result-section">

          {/* Broadcast card */}
          <div className="broadcast-card">
            <div className="bc-teams">
              <div className="bc-team">
                <div className="bc-abbr">{result.home_team_abbr}</div>
                <div className="bc-name">{result.home_team}</div>
                <div className="bc-role home-role">HOME</div>
              </div>
              <div className="bc-vs">VS</div>
              <div className="bc-team bc-team-right">
                <div className="bc-abbr">{result.away_team_abbr}</div>
                <div className="bc-name">{result.away_team}</div>
                <div className="bc-role away-role">AWAY</div>
              </div>
            </div>

            <div className="bc-divider" />

            <div className="bc-winner">
              <div className="bc-winner-label">PREDICTED WINNER</div>
              <div className="bc-winner-name">{result.predicted_winner}</div>
            </div>

            <div className="bc-prob">
              <div className="bc-prob-row">
                <span className="bc-prob-label">WIN PROBABILITY</span>
                <span className="bc-prob-pct">{result.win_probability}%</span>
              </div>
              <div className="bc-prob-track">
                <div
                  className="bc-prob-fill"
                  style={{ width: `${probWidth}%` }}
                />
              </div>
            </div>
          </div>

          {/* Contributing factors chart */}
          <div className="factors-card">
            <div className="factors-header">
              Top 5 Contributing Factors
            </div>
            <div className="chart-wrap">
              {chartData && <Bar data={chartData} options={chartOptions} />}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
