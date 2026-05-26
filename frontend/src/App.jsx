import { useState, useRef, useLayoutEffect } from "react";
import PredictPage from "./components/PredictPage";
import Dashboard from "./components/Dashboard";

// Subtle floating basketballs — purely decorative
const FLOATERS = [
  { style: { top: "6%",  left: "2%",  fontSize: "2.2rem", "--dur": "22s", "--delay": "0s"   } },
  { style: { top: "12%", left: "92%", fontSize: "1.6rem", "--dur": "28s", "--delay": "-8s"  } },
  { style: { top: "55%", left: "1%",  fontSize: "1.4rem", "--dur": "19s", "--delay": "-4s"  } },
  { style: { top: "72%", left: "94%", fontSize: "2rem",   "--dur": "25s", "--delay": "-12s" } },
  { style: { top: "88%", left: "45%", fontSize: "1.2rem", "--dur": "30s", "--delay": "-18s" } },
];

export default function App() {
  const [tab, setTab] = useState("predict");

  // Sliding underline indicator
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const predictRef  = useRef(null);
  const dashRef     = useRef(null);

  useLayoutEffect(() => {
    const el = tab === "predict" ? predictRef.current : dashRef.current;
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [tab]);

  return (
    <div className="app">
      {/* Background court watermark */}
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

      {/* Floating basketballs */}
      {FLOATERS.map((f, i) => (
        <span key={i} className="floater" style={f.style} aria-hidden="true">🏀</span>
      ))}

      {/* Header */}
      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-ball">🏀</span>
            <span className="logo-nba">NBA</span>
            <span className="logo-predict">Predict</span>
          </div>

          <nav className="nav-tabs">
            {/* Sliding underline */}
            <span
              className="tab-underline"
              style={{ left: indicator.left, width: indicator.width }}
            />
            <button
              ref={predictRef}
              className={`tab-btn ${tab === "predict" ? "tab-active" : ""}`}
              onClick={() => setTab("predict")}
            >
              ⚡ Predict
            </button>
            <button
              ref={dashRef}
              className={`tab-btn ${tab === "dashboard" ? "tab-active" : ""}`}
              onClick={() => setTab("dashboard")}
            >
              📊 Dashboard
            </button>
          </nav>
        </div>

        {/* Animated gradient border */}
        <div className="header-glow-border" aria-hidden="true" />
      </header>

      <main className="main-content">
        {tab === "predict" ? <PredictPage /> : <Dashboard />}
      </main>

      <footer className="app-footer">
        Data · Basketball Reference &nbsp;·&nbsp; Model · scikit-learn Random Forest
        &nbsp;·&nbsp; React &amp; Flask
      </footer>
    </div>
  );
}
