import { useState } from "react";
import PredictPage from "./components/PredictPage";
import Dashboard from "./components/Dashboard";

export default function App() {
  const [tab, setTab] = useState("predict");

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-ball">🏀</span>
            <span className="logo-word">NBA</span>
            <span className="logo-word accent">Predict</span>
          </div>

          <nav className="nav-tabs">
            <button
              className={`tab-btn ${tab === "predict" ? "active" : ""}`}
              onClick={() => setTab("predict")}
            >
              <span className="tab-icon">⚡</span>
              Predict
            </button>
            <button
              className={`tab-btn ${tab === "dashboard" ? "active" : ""}`}
              onClick={() => setTab("dashboard")}
            >
              <span className="tab-icon">📊</span>
              Dashboard
            </button>
          </nav>
        </div>
      </header>

      <main className="main-content">
        {tab === "predict" ? <PredictPage /> : <Dashboard />}
      </main>

      <footer className="app-footer">
        Data from Basketball Reference &nbsp;·&nbsp; Model: scikit-learn Random Forest &nbsp;·&nbsp; Built with React &amp; Flask
      </footer>
    </div>
  );
}
