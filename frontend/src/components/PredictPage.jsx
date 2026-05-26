import { useState, useEffect } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Bar } from "react-chartjs-2";
import confetti from "canvas-confetti";
import TeamSelect from "./TeamSelect";
import { logoUrl } from "../teamLogos";
import { getTeams, predict } from "../api";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, ChartDataLabels);

function TeamLogo({ abbr, className }) {
  const [failed, setFailed] = useState(false);
  if (failed || !logoUrl(abbr)) return null;
  return (
    <img
      src={logoUrl(abbr)}
      className={className}
      alt={abbr}
      onError={() => setFailed(true)}
    />
  );
}

function PulsingDots() {
  return (
    <span className="pulsing-dots" aria-label="Calculating">
      <span /><span /><span />
    </span>
  );
}

export default function PredictPage() {
  const [teams, setTeams]         = useState([]);
  const [homeTeam, setHomeTeam]   = useState("");
  const [awayTeam, setAwayTeam]   = useState("");
  const [result, setResult]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
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

  // Animate probability bar and fire confetti when result arrives
  useEffect(() => {
    if (result) {
      setProbWidth(0);
      const t = setTimeout(() => setProbWidth(result.win_probability), 80);

      confetti({
        particleCount: 130,
        spread: 75,
        origin: { x: 0.5, y: 0.45 },
        colors: ["#FFD700", "#FF6B35", "#7C3AED", "#ffffff", "#1a9fff"],
        gravity: 0.9,
        scalar: 1.1,
      });

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

  // Importance values × 100 → percentages for display
  const chartData = result
    ? {
        labels: result.contributing_factors.map((f) => f.feature),
        datasets: [
          {
            data: result.contributing_factors.map((f) =>
              parseFloat((f.importance * 100).toFixed(1))
            ),
            backgroundColor(ctx) {
              const { chartArea, ctx: c } = ctx.chart;
              if (!chartArea) return "#FF6B35";
              const g = c.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
              g.addColorStop(0, "rgba(255,107,53,0.95)");
              g.addColorStop(1, "rgba(124,58,237,0.85)");
              return g;
            },
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
      tooltip: { enabled: false },
      datalabels: {
        color: "#fff",
        anchor: "center",
        align: "center",
        formatter: (v) => `${v.toFixed(1)}%`,
        font: { family: "Inter", size: 11, weight: "700" },
      },
    },
    scales: {
      x: {
        display: false,
        grid: { display: false },
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

  const homeWins =
    result && result.predicted_winner_abbr === result.home_team_abbr;

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
          <TeamSelect
            teams={teams}
            value={homeTeam}
            onChange={setHomeTeam}
            label="Home Team"
            badge="HOME"
          />

          <div className="vs-divider">
            <div className="vs-ring">
              <span className="vs-bolt">⚡</span>
              <span className="vs-text">VS</span>
            </div>
          </div>

          <TeamSelect
            teams={teams}
            value={awayTeam}
            onChange={setAwayTeam}
            label="Away Team"
            badge="AWAY"
          />
        </div>

        <button
          className="predict-btn"
          onClick={handlePredict}
          disabled={loading || !homeTeam || !awayTeam}
        >
          {loading ? (
            <>
              <PulsingDots />
              <span className="btn-calc-text">Calculating…</span>
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
              {/* Home team */}
              <div className={`bc-team ${homeWins ? "bc-winner-side" : "bc-loser-side"}`}>
                <TeamLogo abbr={result.home_team_abbr} className="bc-logo" />
                <div className="bc-abbr">{result.home_team_abbr}</div>
                <div className="bc-name">{result.home_team}</div>
                <span className="bc-role home-role">HOME</span>
              </div>

              <div className="bc-center">
                <div className="bc-center-vs">VS</div>
              </div>

              {/* Away team */}
              <div className={`bc-team bc-team-r ${!homeWins ? "bc-winner-side" : "bc-loser-side"}`}>
                <TeamLogo abbr={result.away_team_abbr} className="bc-logo" />
                <div className="bc-abbr">{result.away_team_abbr}</div>
                <div className="bc-name">{result.away_team}</div>
                <span className="bc-role away-role">AWAY</span>
              </div>
            </div>

            <div className="bc-divider" />

            {/* Winner */}
            <div className="bc-result">
              <div className="bc-crown">👑</div>
              <div className="bc-winner-label">PREDICTED WINNER</div>
              <div className="bc-winner-name">{result.predicted_winner}</div>
            </div>

            {/* Probability bar */}
            <div className="bc-prob">
              <div className="bc-prob-row">
                <span className="bc-prob-label">WIN PROBABILITY</span>
                <span className="bc-prob-pct">{result.win_probability}%</span>
              </div>
              <div className="bc-prob-track">
                <div className="bc-prob-fill" style={{ width: `${probWidth}%` }} />
              </div>
            </div>
          </div>

          {/* Contributing factors */}
          <div className="factors-card">
            <div className="factors-title">Top 5 Contributing Factors</div>
            <div className="chart-wrap">
              {chartData && <Bar data={chartData} options={chartOptions} />}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
