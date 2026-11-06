import { useEffect, useRef, useState } from "react";
import api from "../api/api";
import { clearToken } from "../api/auth";
import { THEMES, getTheme } from "./ThemeButton";

const FONT_MIN = 0.9;
const FONT_MAX = 1.15;

const FONT_PRESETS = [
  { label: "Small", value: 0.9 },
  { label: "Default", value: 1 },
  { label: "Large", value: 1.05 },
  { label: "XL", value: 1.15 },
];

const FONT_SCALE_KEY = "mlforge-font-scale";

const getStoredFontScale = () => {
  const value = Number(localStorage.getItem(FONT_SCALE_KEY));
  return Number.isFinite(value) && value >= FONT_MIN && value <= FONT_MAX ? value : 1;
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388bfd]/70";

const optionClass = (active) =>
  `rounded-lg border px-3 py-2 text-xs font-medium transition ${
    active
      ? "border-[#388bfd] bg-[#1f6feb]/15 text-[#58a6ff]"
      : "border-[#30363d] bg-[#161b22] text-[#c9d1d9] hover:border-[#388bfd]/70 hover:bg-[#21262d]"
  }`;

const ICONS = {
  sliders: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
  close: "M18 6 6 18M6 6l12 12",
  check: "M20 6 9 17l-5-5",
  reset: "M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  alert: "M12 8v5M12 16.5v.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
};

function Icon({ name, size = 16, className = "" }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={ICONS[name]} />
    </svg>
  );
}

function Section({ title, description, children }) {
  return (
    <section className="border-b border-[#30363d] py-5 first:pt-0">
      <h2 className="text-sm font-semibold text-[#e6edf3]">{title}</h2>
      {description && <p className="mt-1 text-xs leading-5 text-[#8b949e]">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function Setting({ isOpen, onClose, theme, onSelectTheme }) {
  const [scale, setScale] = useState(getStoredFontScale);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const closeRef = useRef(null);
  const activeTheme = getTheme(theme);

  useEffect(() => {
    document.documentElement.style.setProperty("--font-scale", scale);
    localStorage.setItem(FONT_SCALE_KEY, String(scale));
  }, [scale]);

  // Esc closes the confirm step first, then the drawer; focus moves in on open
  useEffect(() => {
    if (!isOpen) return;
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (confirmDelete && !deleting) setConfirmDelete(false);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, confirmDelete, deleting, onClose]);

  useEffect(() => {
    if (!isOpen) { setConfirmDelete(false); setDeleteError(""); }
  }, [isOpen]);

  const chooseTheme = (id) => onSelectTheme(id);

  const reset = () => {
    chooseTheme("black");
    setScale(1);
  };

  const logout = () => {
    clearToken();
    onClose();
  };

  const deleteAccount = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await api.delete("/me");
      clearToken();
      setConfirmDelete(false);
      onClose();
    } catch (error) {
      setDeleteError(error.message || "Unable to delete your account. Try again.");
    } finally {
      setDeleting(false);
    }
  };

  const pct = ((scale - FONT_MIN) / (FONT_MAX - FONT_MIN)) * 100;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] md:hidden" onClick={onClose} aria-hidden="true" />
      )}

      <aside
        role="dialog"
        aria-label="Settings"
        aria-hidden={!isOpen}
        className={`fixed inset-y-0 left-0 z-50 flex w-full flex-col border-r border-[#30363d] bg-[#0d1117] font-sans text-[#c9d1d9] shadow-2xl shadow-black/60 transition-[transform,visibility] duration-200 motion-reduce:transition-none md:w-[min(460px,45vw)] ${
          isOpen ? "visible translate-x-0" : "invisible -translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[#30363d] bg-[#161b22] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#1f6feb]/30 bg-[#1f6feb]/15 text-[#58a6ff]">
              <Icon name="sliders" size={18} />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight text-[#e6edf3]">Settings</h1>
              <p className="text-[11px] leading-tight text-[#8b949e]">Personalize your workspace</p>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className={`rounded-lg p-2 text-[#8b949e] transition hover:bg-[#21262d] hover:text-white ${focusRing}`}
            aria-label="Close settings"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 scrollbar-thin sm:px-6">
          {/* Theme */}
          <Section title="Theme" description="Choose how the workspace looks.">
            <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Theme">
              {THEMES.map((item) => {
                const active = theme === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => chooseTheme(item.id)}
                    className={`${optionClass(active)} relative flex flex-col items-stretch gap-2 !p-2 ${focusRing}`}
                  >
                    <span className="flex h-10 w-full overflow-hidden rounded-md border border-[#30363d]">
                      <span className="flex-1" style={{ backgroundColor: item.dot }} />
                      <span className="flex-1 bg-[#161b22]" />
                      <span className="flex-1 bg-[#388bfd]" />
                    </span>
                    <span className="flex items-center justify-between px-0.5">
                      {item.label}
                      {active && <Icon name="check" size={14} className="text-[#58a6ff]" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Font size */}
          <Section title="Text size" description="Scales text across the whole app.">
            <div className="mb-3 flex items-center justify-between text-xs text-[#8b949e]">
              <span aria-hidden="true">A</span>
              <span className="rounded-md bg-[#1f6feb]/15 px-2 py-0.5 font-mono text-xs text-[#58a6ff]">{Math.round(scale * 100)}%</span>
              <span aria-hidden="true" className="text-base">A</span>
            </div>
            <input
              type="range"
              min={FONT_MIN}
              max={FONT_MAX}
              step={0.05}
              value={scale}
              onChange={(event) => setScale(Number(event.target.value))}
              aria-label="Text size"
              aria-valuetext={`${Math.round(scale * 100)} percent`}
              className={`h-1.5 w-full cursor-pointer appearance-none rounded-full accent-[#388bfd] ${focusRing}`}
              style={{ background: `linear-gradient(to right, #388bfd ${pct}%, #30363d ${pct}%)` }}
            />

            <div className="mt-4 grid grid-cols-4 gap-2" role="group" aria-label="Text size presets">
              {FONT_PRESETS.map((preset) => {
                const active = Math.abs(scale - preset.value) < 0.01;
                return (
                  <button key={preset.label} type="button" aria-pressed={active} onClick={() => setScale(preset.value)} className={`${optionClass(active)} ${focusRing}`}>
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-xl border border-[#30363d] bg-[#161b22] p-4">
              <p className="mb-1.5 text-xs font-medium text-[#8b949e]">Preview</p>
              <p className="leading-7 text-[#e6edf3]" style={{ fontSize: `${14 * scale}px` }}>
                The quick brown fox jumps over the lazy dog.
              </p>
            </div>
          </Section>

          {/* Account */}
          <section className="pt-5">
            <h2 className="text-sm font-semibold text-[#e6edf3]">Account</h2>
            <button
              type="button"
              onClick={logout}
              className={`mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#30363d] bg-[#161b22] text-sm font-medium text-[#c9d1d9] transition hover:border-[#388bfd]/70 hover:bg-[#21262d] ${focusRing}`}
            >
              <Icon name="logout" size={16} />
              Log out
            </button>

            <div className="mt-4 rounded-xl border border-[#f85149]/30 bg-[#161b22] p-4">
              <h3 className="text-sm font-semibold text-[#ff7b72]">Delete account</h3>
              <p className="mt-1 text-xs leading-5 text-[#8b949e]">
                Permanently deletes your account and all stored files. This can't be undone.
              </p>

              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className={`mt-3 rounded-lg border border-[#f85149]/50 px-4 py-2 text-xs font-semibold text-[#ff7b72] transition hover:bg-[#f85149]/15 ${focusRing}`}
                >
                  Delete account
                </button>
              ) : (
                <div className="mt-3 rounded-lg border border-[#f85149]/40 bg-[#f85149]/10 p-3" role="alertdialog" aria-label="Confirm account deletion">
                  <p className="text-xs font-medium text-[#ffa198]">Delete your account and all stored files?</p>
                  {deleteError && (
                    <p role="alert" className="mt-2 flex items-start gap-1.5 text-xs text-[#ffa198]">
                      <Icon name="alert" size={13} className="mt-0.5 shrink-0" />
                      {deleteError}
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={deleteAccount}
                      disabled={deleting}
                      className={`rounded-lg bg-[#da3633] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#f85149] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
                    >
                      {deleting ? "Deleting..." : "Yes, delete"}
                    </button>
                    <button
                      type="button"
                      autoFocus
                      onClick={() => { setConfirmDelete(false); setDeleteError(""); }}
                      disabled={deleting}
                      className={`rounded-lg border border-[#30363d] px-3 py-1.5 text-xs font-medium text-[#c9d1d9] transition hover:bg-[#21262d] disabled:opacity-60 ${focusRing}`}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-[#30363d] bg-[#161b22] px-5 py-3">
          <button
            type="button"
            onClick={reset}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-[#8b949e] transition hover:bg-[#21262d] hover:text-white ${focusRing}`}
          >
            <Icon name="reset" size={14} />
            Reset to defaults
          </button>
          <div className="flex items-center gap-3">
            <span className="hidden text-[11px] text-[#6e7681] sm:inline">Changes save automatically</span>
            <button
              type="button"
              onClick={onClose}
              className={`rounded-lg bg-[#238636] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#2ea043] ${focusRing}`}
            >
              Done
            </button>
          </div>
        </div>

        <span className="sr-only" role="status">Current theme: {activeTheme.label}</span>
      </aside>
    </>
  );
}