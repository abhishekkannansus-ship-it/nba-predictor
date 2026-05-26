import { useState, useRef, useEffect } from "react";
import { logoUrl } from "../teamLogos";

function Logo({ abbr, className }) {
  const [failed, setFailed] = useState(false);
  if (failed || !logoUrl(abbr)) return null;
  return (
    <img
      src={logoUrl(abbr)}
      className={className}
      alt=""
      onError={() => setFailed(true)}
    />
  );
}

export default function TeamSelect({ teams, value, onChange, label, badge }) {
  const [open, setOpen]     = useState(false);
  const [query, setQuery]   = useState("");
  const rootRef             = useRef(null);
  const inputRef            = useRef(null);

  const selected = teams.find((t) => t.abbreviation === value);
  const filtered = query
    ? teams.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()))
    : teams;

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  return (
    <div className="ts-root" ref={rootRef}>
      <div className="slot-label">{label}</div>

      <button
        type="button"
        className={`ts-trigger ${open ? "ts-open" : ""}`}
        onClick={() => setOpen((o) => !o)}
      >
        {selected && (
          <Logo abbr={selected.abbreviation} className="ts-logo-sm" />
        )}
        <span className="ts-trigger-name">
          {selected ? selected.name : "Select team"}
        </span>
        <span className="ts-chevron">{open ? "▲" : "▾"}</span>
      </button>

      {open && (
        <div className="ts-dropdown">
          <div className="ts-search-wrap">
            <input
              ref={inputRef}
              className="ts-search"
              placeholder="Search teams…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="ts-options">
            {filtered.map((t) => (
              <button
                key={t.abbreviation}
                type="button"
                className={`ts-option ${t.abbreviation === value ? "ts-selected" : ""}`}
                onClick={() => {
                  onChange(t.abbreviation);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <Logo abbr={t.abbreviation} className="ts-logo-option" />
                <span className="ts-option-name">{t.name}</span>
                {t.abbreviation === value && (
                  <span className="ts-check">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={`slot-badge ${badge === "HOME" ? "home-badge" : "away-badge"}`}>
        {badge}
      </div>
    </div>
  );
}
