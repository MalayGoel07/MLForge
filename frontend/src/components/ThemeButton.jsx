/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, useState } from "react";
import AIButton from "./AIButton";
export const THEME_KEY = "mlforge-theme";

export const THEMES = [
  { id: "forest", label: "Green", dot: "#7aa88a" },
  { id: "snow", label: "White", dot: "#ffffff" },
  { id: "black", label: "Black", dot: "#000000" },
  { id: "navy", label: "Navy blue", dot: "#5b87c7" },
];

export function getTheme(id) {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function loadTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (THEMES.some((t) => t.id === saved)) return saved;
  } catch {
    /* storage unavailable, fall back to default */
  }
  return "forest";
}

// Theme lives on <html> so every page follows it; persisted across reloads.
export function useGlobalTheme(theme) {
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
}

export default function ThemeButton({ theme, onSelect, className = "" }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const active = getTheme(theme);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
    {window.location.pathname !== "/" && <AIButton />}
    <div ref={boxRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        title={`Theme: ${active.label}. Click to change`}
        className="inline-flex items-center gap-2 rounded-full border border-line bg-card-soft px-3 py-1.5 text-xs font-medium text-acc transition hover:opacity-80"
      >
        <span
          className="inline-block h-2.5 w-2.5 rounded-full border border-line"
          style={{ backgroundColor: active.dot }}
        />
        {active.label} ▾
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 z-50 mt-2 w-40 overflow-hidden rounded-xl border border-line bg-card-soft shadow-2xl shadow-black/40"
        >
          {THEMES.map((t) => (
            <li key={t.id} role="option" aria-selected={t.id === active.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(t.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-line ${
                  t.id === active.id ? "text-acc" : "text-acc-soft"
                }`}
              >
                <span
                  className="inline-block h-3 w-3 rounded-full border border-line"
                  style={{ backgroundColor: t.dot }}
                />
                {t.label}
                {t.id === active.id && <span className="ml-auto">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
  );
}