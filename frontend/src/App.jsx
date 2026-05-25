import { useState } from "react";
import PredictPage from "./components/PredictPage";
import Dashboard from "./components/Dashboard";

export default function App() {
  const [tab, setTab] = useState("predict");

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="logo">🏀 NBA Predictor</div>
          <nav className="nav-tabs">
            <button
              className={`tab-btn ${tab === "predict" ? "active" : ""}`}
              onClick={() => setTab("predict")}
            >
              Predict
            </button>
            <button
              className={`tab-btn ${tab === "dashboard" ? "active" : ""}`}
              onClick={() => setTab("dashboard")}
            >
              Dashboard
            </button>
          </nav>
        </div>
      </header>

      <main className="main-content">
        {tab === "predict" ? <PredictPage /> : <Dashboard />}
      </main>

      <footer className="app-footer">
        Built with nba_api + scikit-learn · Powered by React &amp; Flask
      </footer>
    </div>
  );
}
