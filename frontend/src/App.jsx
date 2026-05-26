import { useState, useRef, useLayoutEffect, useEffect } from "react";
import PredictPage from "./components/PredictPage";
import Dashboard from "./components/Dashboard";
import { getAccuracy } from "./api";

const FLOATERS = [
  { style: { top: "6%",  left: "2%",  fontSize: "2.2rem", "--dur": "22s", "--delay": "0s"   } },
  { style: { top: "12%", left: "92%", fontSize: "1.6rem", "--dur": "28s", "--delay": "-8s"  } },
  { style: { top: "55%", left: "1%",  fontSize: "1.4rem", "--dur": "19s", "--delay": "-4s"  } },
  { style: { top: "72%", left: "94%", fontSize: "2rem",   "--dur": "25s", "--delay": "-12s" } },
  { style: { top: "88%", left: "45%", fontSize: "1.2rem", "--dur": "30s", "--delay": "-18s" } },
];

function PredictionTicker({ predictions }) {
  if (!predictions.length) return null;

  const items = predictions.slice(0, 20);
  const doubled = [...items, ...items];

  return (
    <div className="ticker-bar" aria-hidden="true">
      <span className="ticker-badge">RECENT PICKS</span>
      <div className="ticker-track-wrap">
        <div className="ticker-track" style={{ "--count": doubled.length }}>
          {doubled.map((p, i) => {
            const winnerAbbr = p.predicted_winner === p.home_team_name ? p.home_team : p.away_team;
            const loserAbbr  = winnerAbbr === p.home_team ? p.away_team : p.home_team;
            return (
              <span key={i} className="ticker-item">
                <span className="ticker-winner">{winnerAbbr}</span>
                {" def. "}
                <span className="ticker-loser">{loserAbbr}</span>
                {" • "}
                <span className="ticker-prob">{p.win_probability}%</span>
                {p.actual_winner != null && (
                  <span className={p.correct ? "ticker-mark-correct" : "ticker-mark-wrong"}>
                    {p.correct ? " ✓" : " ✗"}
                  </span>
                )}
                <span className="ticker-sep">◆</span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab]           = useState("predict");
  const [fading, setFading]     = useState(false);
  const [theme, setTheme]       = useState("dark");
  const [predictions, setPredictions] = useState([]);

  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const predictRef = useRef(null);
  const dashRef    = useRef(null);

  useLayoutEffect(() => {
    const el = tab === "predict" ? predictRef.current : dashRef.current;
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [tab]);

  useEffect(() => {
    getAccuracy()
      .then(r => setPredictions(r.data.predictions || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  const switchTab = (next) => {
    if (next === tab) return;
    setFading(true);
    setTimeout(() => { setTab(next); setFading(false); }, 200);
  };

  return (
    <div className="app">
      <svg className="court-bg" viewBox="0 0 500 470" fill="none"
           stroke="white" strokeWidth="1.5" aria-hidden="true">
        <rect x="8" y="8" width="484" height="454"/>
        <rect x="170" y="8" width="160" height="190"/>
        <circle cx="250" cy="198" r="62"/>
        <path d="M 62 8 A 202 202 0 0 1 438 8"/>
        <circle cx="250" cy="235" r="62"/>
        <circle cx="250" cy="235" r="5" fill="white" stroke="none"/>
        <rect x="170" y="276" width="160" height="190"/>
        <circle cx="250" cy="276" r="62"/>
        <path d="M 62 462 A 202 202 0 0 0 438 462"/>
        <circle cx="250" cy="36" r="10"/>
        <line x1="218" y1="22" x2="282" y2="22"/>
        <circle cx="250" cy="434" r="10"/>
        <line x1="218" y1="448" x2="282" y2="448"/>
      </svg>

      {FLOATERS.map((f, i) => (
        <span key={i} className="floater" style={f.style} aria-hidden="true">🏀</span>
      ))}

      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-ball">🏀</span>
            <span className="logo-nba">NBA</span>
            <span className="logo-predict">Predict</span>
          </div>

          <nav className="nav-tabs">
            <span className="tab-underline"
                  style={{ left: indicator.left, width: indicator.width }} />
            <button ref={predictRef}
                    className={`tab-btn ${tab === "predict" ? "tab-active" : ""}`}
                    onClick={() => switchTab("predict")}>
              ⚡ Predict
            </button>
            <button ref={dashRef}
                    className={`tab-btn ${tab === "dashboard" ? "tab-active" : ""}`}
                    onClick={() => switchTab("dashboard")}>
              📊 Dashboard
            </button>
          </nav>

          <button
            className="theme-toggle"
            onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
        <div className="header-glow-border" aria-hidden="true" />
      </header>

      <PredictionTicker predictions={predictions} />

      <main className="main-content">
        <div className={`tab-content ${fading ? "tab-fading" : ""}`} key={tab}>
          {tab === "predict" ? <PredictPage /> : <Dashboard />}
        </div>
      </main>

      <footer className="app-footer">
        <div className="footer-top">
          Built with&nbsp;
          <span className="footer-tech">Python</span>&nbsp;·&nbsp;
          <span className="footer-tech">scikit-learn</span>&nbsp;·&nbsp;
          <span className="footer-tech">React</span>&nbsp;·&nbsp;
          <span className="footer-tech">Flask</span>
          &nbsp;&nbsp;|&nbsp;&nbsp;
          Data from Basketball Reference
        </div>
        <div className="footer-credit">
          Created by <span className="footer-name">Abhishek Kannan</span>
          &nbsp;·&nbsp; High School Capstone 2025
        </div>
      </footer>
    </div>
  );
}
