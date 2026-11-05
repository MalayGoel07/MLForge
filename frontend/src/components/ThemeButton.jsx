/* eslint-disable react-refresh/only-export-components */
import { useEffect } from "react";
import AIButton from "./AIButton";
import { aiPanel } from "./aiPanelStore";
export const THEME_KEY = "mlforge-theme";

export const THEMES = [
  { id: "snow", label: "White", dot: "#ffffff" },
  { id: "black", label: "Black", dot: "#000000" },
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
  return "black";
}

// Theme lives on <html> so every page follows it; persisted across reloads.
export function useGlobalTheme(theme) {
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("mlforge-theme", theme);
  }, [theme]);
}

export default function ThemeButton({ onNavigate, className = "", showSettings = true }) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {showSettings && (
        <button
          type="button"
          onClick={() => aiPanel.openSettingsPanel()}
          aria-label="Settings"
          title="Settings"
          className="inline-flex items-center gap-2 rounded-full border border-line bg-card-soft px-3 py-1.5 text-xs font-medium text-acc transition hover:opacity-80"
        >
          ⚙ <span className="hidden sm:inline">Settings</span>
        </button>
      )}
      <AIButton />
    </div>
  );
}