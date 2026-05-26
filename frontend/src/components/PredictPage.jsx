import { useState, useEffect, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, Tooltip,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Bar } from "react-chartjs-2";
import confetti from "canvas-confetti";
import TeamSelect from "./TeamSelect";
import { logoUrl } from "../teamLogos";
import { getTeams, predict, getTeamStats, getAccuracy } from "../api";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, ChartDataLabels);

// ─────────────────────────────────────────────
// Hardcoded 2026 playoff bracket (Conference Finals onwards)
// ─────────────────────────────────────────────
const BRACKET_2026 = [
  {
    round:    "East Conference Finals",
    conf:     "EAST",
    home:     { abbr: "BOS", name: "Boston Celtics",        seed: 1 },
    away:     { abbr: "NYK", name: "New York Knicks",        seed: 3 },
    homeWins: 3,
    awayWins: 2,
    status:   "active",
    note:     "BOS leads 3-2  ·  Game 6",
  },
  {
    round:    "West Conference Finals",
    conf:     "WEST",
    home:     { abbr: "OKC", name: "Oklahoma City Thunder",  seed: 1 },
    away:     { abbr: "LAL", name: "Los Angeles Lakers",     seed: 4 },
    homeWins: 3,
    awayWins: 1,
    status:   "active",
    note:     "OKC leads 3-1  ·  Game 5",
  },
  {
    round:    "NBA Finals 2026",
    conf:     "FINALS",
    home:     { abbr: null,  name: "East Champion",          seed: null },
    away:     { abbr: null,  name: "West Champion",          seed: null },
    homeWins: 0,
    awayWins: 0,
    status:   "upcoming",
    note:     "Begins June 4, 2026",
  },
];

// ─────────────────────────────────────────────
// Small components
// ─────────────────────────────────────────────
function TeamLogo({ abbr, className }) {
  const [failed, setFailed] = useState(false);
  if (failed || !logoUrl(abbr)) return null;
  return (
    <img src={logoUrl(abbr)} className={className} alt={abbr} onError={() => setFailed(true)} />
  );
}

function PulsingDots() {
  return (
    <span className="pulsing-dots" aria-label="Calculating">
      <span /><span /><span />
    </span>
  );
}

function ConfidenceMeter({ probability }) {
  const [disp, setDisp] = useState(0);

  useEffect(() => {
    setDisp(0);
    const t = setTimeout(() => setDisp(probability), 120);
    return () => clearTimeout(t);
  }, [probability]);

  const R      = 80;
  const circ   = Math.PI * R;
  const offset = circ * (1 - disp / 100);
  const color  = disp > 70 ? "#22c55e" : disp >= 50 ? "#EAB308" : "#ef4444";
  const shadow = disp > 70 ? "#22c55e55" : disp >= 50 ? "#EAB30855" : "#ef444455";
  const label  = disp > 70 ? "HIGH CONFIDENCE" : disp >= 50 ? "MODERATE" : "LOW CONFIDENCE";

  return (
    <div className="gauge-wrap">
      <svg viewBox="0 0 200 120" className="gauge-svg">
        <path d="M 20,100 A 80,80 0 0,1 180,100"
              fill="none" stroke="rgba(255,255,255,0.07)"
              strokeWidth="16" strokeLinecap="round" />
        <path d="M 20,100 A 80,80 0 0,1 180,100"
              fill="none" stroke={color}
              strokeWidth="16" strokeLinecap="round"
              strokeDasharray={`${circ} ${circ}`}
              strokeDashoffset={offset}
              style={{
                transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1), stroke 0.6s",
                filter: `drop-shadow(0 0 8px ${shadow})`,
              }} />
        <text x="100" y="90" textAnchor="middle" fontSize="29" fontWeight="900"
              fill={color} fontFamily="Inter, sans-serif"
              style={{ transition: "fill 0.6s" }}>
          {disp}%
        </text>
        <text x="100" y="112" textAnchor="middle" fontSize="8.5" fontWeight="700"
              fill="#5a5a7a" fontFamily="Inter, sans-serif" letterSpacing="1.5">
          {label}
        </text>
      </svg>
    </div>
  );
}

const STAT_ROWS = [
  { key: "avg_pts",         label: "Points / Game", fmt: v => v?.toFixed(1),                              higherBetter: true  },
  { key: "avg_pts_allowed", label: "Opp PTS / G",   fmt: v => v?.toFixed(1),                              higherBetter: false },
  { key: "off_rating",      label: "Off Rating",    fmt: v => v?.toFixed(1),                              higherBetter: true  },
  { key: "def_rating",      label: "Def Rating",    fmt: v => v?.toFixed(1),                              higherBetter: false },
  { key: "win_pct",         label: "Win %",         fmt: v => v != null ? `${(v*100).toFixed(0)}%` : "—", higherBetter: true  },
];

function StatsComparison({ homeStats, awayStats, homeAbbr, awayAbbr }) {
  return (
    <div className="stats-compare-card">
      <div className="sc-header">
        <span className="sc-team-label">{homeAbbr}</span>
        <span className="sc-title">HEAD TO HEAD</span>
        <span className="sc-team-label">{awayAbbr}</span>
      </div>
      <div className="sc-rows">
        {STAT_ROWS.map(({ key, label, fmt, higherBetter }) => {
          const h = homeStats?.[key];
          const a = awayStats?.[key];
          const homeEdge = h != null && a != null && (higherBetter ? h > a : h < a);
          const awayEdge = h != null && a != null && (higherBetter ? a > h : a < h);
          return (
            <div key={key} className="sc-row">
              <span className={`sc-val sc-val-home ${homeEdge ? "sc-edge" : ""}`}>{fmt(h) ?? "—"}</span>
              <span className="sc-label">{label}</span>
              <span className={`sc-val sc-val-away ${awayEdge ? "sc-edge" : ""}`}>{fmt(a) ?? "—"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Playoff series card
// ─────────────────────────────────────────────
function PlayoffSeriesCard({ series, onPredict, availTeams }) {
  const { round, conf, home, away, homeWins, awayWins, status, note } = series;
  const homeLeads   = homeWins > awayWins;
  const awayLeads   = awayWins > homeWins;
  const isFinals    = conf === "FINALS";
  const canPredict  = status === "active" && home.abbr && away.abbr
    && availTeams.some(t => t.abbreviation === home.abbr)
    && availTeams.some(t => t.abbreviation === away.abbr);

  return (
    <div className={`series-card series-${status} ${isFinals ? "series-finals" : ""}`}>
      <div className="series-round-label">
        {conf !== "FINALS" && (
          <span className={`series-conf-badge series-conf-${conf.toLowerCase()}`}>{conf}</span>
        )}
        {round}
      </div>

      <div className="series-teams-row">
        {/* Home / top team */}
        <div className={`series-team ${homeLeads ? "series-leader" : ""}`}>
          {home.abbr
            ? <TeamLogo abbr={home.abbr} className="series-logo" />
            : <div className="series-tbd-logo">?</div>}
          <div className="series-abbr">{home.abbr ?? "TBD"}</div>
          {home.seed != null && <div className="series-seed">Seed {home.seed}</div>}
        </div>

        {/* Score column */}
        <div className="series-vs-col">
          {status === "upcoming" ? (
            <div className="series-score-tbd">TBD</div>
          ) : (
            <div className="series-score">
              <span className={homeLeads ? "score-lead" : ""}>{homeWins}</span>
              <span className="score-sep">–</span>
              <span className={awayLeads ? "score-lead" : ""}>{awayWins}</span>
            </div>
          )}
          {note && <div className="series-note">{note}</div>}
        </div>

        {/* Away / bottom team */}
        <div className={`series-team series-team-r ${awayLeads ? "series-leader" : ""}`}>
          {away.abbr
            ? <TeamLogo abbr={away.abbr} className="series-logo" />
            : <div className="series-tbd-logo">?</div>}
          <div className="series-abbr">{away.abbr ?? "TBD"}</div>
          {away.seed != null && <div className="series-seed">Seed {away.seed}</div>}
        </div>
      </div>

      {canPredict ? (
        <button className="series-predict-btn" onClick={() => onPredict(home.abbr, away.abbr)}>
          Predict This Game ↗
        </button>
      ) : status === "upcoming" ? (
        <div className="series-upcoming-chip">
          <span className="series-upcoming-dot" />
          Teams TBD
        </div>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────
// Chart options (module-level, stable reference)
// ─────────────────────────────────────────────
const chartOptions = {
  indexAxis: "y", responsive: true,
  plugins: {
    legend: { display: false },
    tooltip: { enabled: false },
    datalabels: {
      color: "#fff", anchor: "center", align: "center",
      formatter: v => `${v.toFixed(1)}%`,
      font: { family: "Inter", size: 11, weight: "700" },
    },
  },
  scales: {
    x: { display: false, grid: { display: false } },
    y: {
      ticks: { color: "#b0b0c8", font: { family: "Inter", size: 12 } },
      grid: { display: false }, border: { display: false },
    },
  },
  animation: { duration: 700, easing: "easeOutQuart" },
};

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────
export default function PredictPage() {
  const [teams, setTeams]         = useState([]);
  const [homeTeam, setHomeTeam]   = useState("");
  const [awayTeam, setAwayTeam]   = useState("");
  const [result, setResult]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [homeStats, setHomeStats] = useState(null);
  const [awayStats, setAwayStats] = useState(null);
  const [gaugeProb, setGaugeProb] = useState(0);
  const [copied, setCopied]       = useState(false);
  const [modelStats, setModelStats] = useState(null);

  const matchupCardRef = useRef(null);

  // ── Fetch teams + model accuracy on mount ──
  useEffect(() => {
    getTeams()
      .then(res => {
        setTeams(res.data);
        if (res.data.length >= 2) {
          setHomeTeam(res.data[0].abbreviation);
          setAwayTeam(res.data[1].abbreviation);
        }
      })
      .catch(() =>
        setError("Could not reach the backend. Make sure the Flask server is running on port 5001.")
      );

    getAccuracy()
      .then(r => setModelStats(r.data))
      .catch(() => {});
  }, []);

  // ── Fetch team stats whenever selection changes ──
  useEffect(() => {
    if (!homeTeam) return;
    getTeamStats(homeTeam).then(r => setHomeStats(r.data)).catch(() => {});
  }, [homeTeam]);

  useEffect(() => {
    if (!awayTeam) return;
    getTeamStats(awayTeam).then(r => setAwayStats(r.data)).catch(() => {});
  }, [awayTeam]);

  // ── Animate gauge + confetti when result arrives ──
  useEffect(() => {
    if (!result) return;
    setGaugeProb(0);
    const t = setTimeout(() => setGaugeProb(result.win_probability), 120);
    confetti({
      particleCount: 130, spread: 75,
      origin: { x: 0.5, y: 0.45 },
      colors: ["#FFD700", "#FF6B35", "#7C3AED", "#ffffff", "#1a9fff"],
      gravity: 0.9, scalar: 1.1,
    });
    return () => clearTimeout(t);
  }, [result]);

  // ── Handlers ──
  const handlePredict = async () => {
    if (!homeTeam || !awayTeam) return;
    if (homeTeam === awayTeam) { setError("Home and away teams must be different."); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await predict(homeTeam, awayTeam);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Prediction failed. Check the backend logs.");
    } finally {
      setLoading(false);
    }
  };

  const fillMatchup = (homeAbbr, awayAbbr) => {
    setHomeTeam(homeAbbr);
    setAwayTeam(awayAbbr);
    setResult(null);
    setTimeout(() => {
      matchupCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  };

  const handleShare = () => {
    if (!result) return;
    const loser = result.predicted_winner_abbr === result.home_team_abbr
      ? result.away_team : result.home_team;
    const text = `🏀 NBA Predictor says: ${result.predicted_winner} wins vs ${loser} with ${result.win_probability}% confidence! Try it at nba-predictor-rust.vercel.app`;
    navigator.clipboard.writeText(text)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2200); })
      .catch(() => {});
  };

  // ── Chart data ──
  const chartData = result ? {
    labels: result.contributing_factors.map(f => f.feature),
    datasets: [{
      data: result.contributing_factors.map(f => parseFloat((f.importance * 100).toFixed(1))),
      backgroundColor(ctx) {
        const { chartArea, ctx: c } = ctx.chart;
        if (!chartArea) return "#FF6B35";
        const g = c.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
        g.addColorStop(0, "rgba(255,107,53,0.95)");
        g.addColorStop(1, "rgba(124,58,237,0.85)");
        return g;
      },
      borderRadius: 6, borderSkipped: false,
    }],
  } : null;

  const homeWins = result && result.predicted_winner_abbr === result.home_team_abbr;

  return (
    <div className="predict-page">

      {/* ── Hero banner ── */}
      <div className="predict-hero">
        <div className="hero-live">
          <span className="live-dot" />
          <span className="live-text">LIVE</span>
        </div>
        <h1 className="hero-title">NBA Game Predictor</h1>
        <p className="hero-subtitle">
          Powered by Machine Learning &nbsp;·&nbsp; 63% Accuracy
        </p>
        <div className="hero-chips">
          <span className="hero-chip">2 Seasons of Data</span>
          <span className="hero-chip">Random Forest Model</span>
          <span className="hero-chip">13 Features</span>
        </div>

        {/* Model stats row */}
        {modelStats && (
          <div className="model-stats-bar">
            <div className="ms-item">
              <span className="ms-value">{modelStats.total_predictions.toLocaleString()}</span>
              <span className="ms-label">Total Predictions</span>
            </div>
            <div className="ms-sep" />
            <div className="ms-item">
              <span className="ms-value ms-accent">
                {modelStats.total_with_result > 0 ? `${modelStats.accuracy}%` : "—"}
              </span>
              <span className="ms-label">Overall Accuracy</span>
            </div>
            <div className="ms-sep" />
            <div className="ms-item">
              <span className="ms-value">2,639</span>
              <span className="ms-label">Games Analyzed</span>
            </div>
          </div>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* ── Matchup builder ── */}
      <div className="matchup-card" ref={matchupCardRef}>
        <div className="matchup-builder">
          <TeamSelect
            teams={teams} value={homeTeam} label="Home Team" badge="HOME"
            onChange={v => { setHomeTeam(v); setResult(null); }}
          />
          <div className="vs-divider">
            <div className="vs-ring">
              <span className="vs-bolt">⚡</span>
              <span className="vs-text">VS</span>
            </div>
          </div>
          <TeamSelect
            teams={teams} value={awayTeam} label="Away Team" badge="AWAY"
            onChange={v => { setAwayTeam(v); setResult(null); }}
          />
        </div>
        <button className="predict-btn" onClick={handlePredict}
                disabled={loading || !homeTeam || !awayTeam}>
          {loading
            ? <><PulsingDots /><span className="btn-calc-text">Calculating…</span></>
            : "Predict Winner"}
        </button>
      </div>

      {/* ── Head-to-head stats comparison ── */}
      {homeStats && awayStats && homeTeam !== awayTeam && (
        <StatsComparison
          homeStats={homeStats} awayStats={awayStats}
          homeAbbr={homeTeam}   awayAbbr={awayTeam}
        />
      )}

      {/* ── Prediction result ── */}
      {result && (
        <div className="result-section">

          {/* Broadcast card */}
          <div className="broadcast-card">
            <div className="bc-teams">
              <div className={`bc-team ${homeWins ? "bc-winner-side" : "bc-loser-side"}`}>
                <TeamLogo abbr={result.home_team_abbr} className="bc-logo" />
                <div className="bc-abbr">{result.home_team_abbr}</div>
                <div className="bc-name">{result.home_team}</div>
                <span className="bc-role home-role">HOME</span>
                {homeStats && (
                  <div className="bc-form">
                    <span className="form-label">L10</span>
                    <span className="form-wins">{homeStats.last10_wins}W</span>
                    <span className="form-losses">{homeStats.last10_losses}L</span>
                  </div>
                )}
              </div>
              <div className="bc-center"><div className="bc-center-vs">VS</div></div>
              <div className={`bc-team bc-team-r ${!homeWins ? "bc-winner-side" : "bc-loser-side"}`}>
                <TeamLogo abbr={result.away_team_abbr} className="bc-logo" />
                <div className="bc-abbr">{result.away_team_abbr}</div>
                <div className="bc-name">{result.away_team}</div>
                <span className="bc-role away-role">AWAY</span>
                {awayStats && (
                  <div className="bc-form">
                    <span className="form-label">L10</span>
                    <span className="form-wins">{awayStats.last10_wins}W</span>
                    <span className="form-losses">{awayStats.last10_losses}L</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bc-divider" />

            <div className="bc-result">
              <div className="bc-crown">👑</div>
              <div className="bc-winner-label">PREDICTED WINNER</div>
              <div className="bc-winner-name">{result.predicted_winner}</div>
            </div>

            <ConfidenceMeter probability={gaugeProb} />

            <button className={`share-btn ${copied ? "share-copied" : ""}`} onClick={handleShare}>
              {copied ? "✓ Copied to clipboard!" : "↗ Share Prediction"}
            </button>
          </div>

          {/* Factors card */}
          <div className="factors-card">
            <div className="factors-title">Top 5 Contributing Factors</div>
            <div className="chart-wrap">
              {chartData && <Bar data={chartData} options={chartOptions} />}
            </div>
          </div>
        </div>
      )}

      {/* ── Playoffs 2026 bracket ── */}
      <div className="playoffs-section">
        <div className="playoffs-header">
          <div className="playoffs-title-group">
            <span className="playoffs-trophy">🏆</span>
            <div>
              <div className="playoffs-title">Playoffs 2026</div>
              <div className="playoffs-subtitle">Conference Finals &amp; NBA Finals</div>
            </div>
          </div>
          <div className="playoffs-live-badge">
            <span className="live-dot" />
            <span className="live-text">IN PROGRESS</span>
          </div>
        </div>

        <div className="playoffs-grid">
          {BRACKET_2026.map((series, i) => (
            <PlayoffSeriesCard
              key={i}
              series={series}
              onPredict={fillMatchup}
              availTeams={teams}
            />
          ))}
        </div>
      </div>

    </div>
  );
}
