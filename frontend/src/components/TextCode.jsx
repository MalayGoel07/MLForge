import { useMemo, useState } from "react";
import ThemeButton from "./ThemeButton";
import libraryGroups from "./mlLibraryData";

/* ---------- tiny Python highlighter (per line) ---------- */
const TOKEN_RE =
  /(#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(import|from|as|def|return|for|in|if|elif|else|while|with|class|lambda|try|except|break|continue|and|or|not|is|pass|yield|await|async)\b|\b(True|False|None)\b|\b(\d+\.?\d*)\b/g;

function highlight(line) {
  if (!line) return " ";
  const out = [];
  let last = 0;
  let key = 0;
  for (const m of line.matchAll(TOKEN_RE)) {
    if (m.index > last) out.push(line.slice(last, m.index));
    const [text, comment, str, kw, lit, num] = m;
    let cls = "";
    if (comment) cls = "text-slate-500 italic";
    else if (str) cls = "text-emerald-300";
    else if (kw) cls = "text-indigo-300";
    else if (lit) cls = "text-amber-300";
    else if (num) cls = "text-orange-300";
    out.push(
      <span key={key++} className={cls}>
        {text}
      </span>
    );
    last = m.index + text.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

export default function TextCode({ onNavigate, theme = "forest", onSelectTheme }) {
  const [selectedId, setSelectedId] = useState(libraryGroups[0].items[0].id);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("code");
  const [collapsed, setCollapsed] = useState({});
  const [revealed, setRevealed] = useState({});
  const [copied, setCopied] = useState("");

  const q = query.trim().toLowerCase();

  const visibleGroups = useMemo(
    () =>
      libraryGroups
        .map((g) => ({
          ...g,
          items: q
            ? g.items.filter(
                (i) =>
                  i.label.toLowerCase().includes(q) ||
                  g.title.toLowerCase().includes(q) ||
                  i.code.toLowerCase().includes(q)
              )
            : g.items,
        }))
        .filter((g) => g.items.length > 0),
    [q]
  );

  const flat = useMemo(
    () =>
      libraryGroups.flatMap((g) =>
        g.items.map((i) => ({ ...i, group: g.title }))
      ),
    []
  );
  const visibleFlat = useMemo(
    () => visibleGroups.flatMap((g) => g.items),
    [visibleGroups]
  );

  const selected = flat.find((i) => i.id === selectedId) ?? flat[0];
  const totalItems = flat.length;
  const lines = selected.code.split("\n");

  const navList = visibleFlat.length ? visibleFlat : flat;
  const idx = navList.findIndex((i) => i.id === selected.id);
  const go = (step) => {
    const next = navList[(idx + step + navList.length) % navList.length];
    select(next.id);
  };

  function select(id) {
    setSelectedId(id);
    setCopied("");
    setRevealed({});
  }

  const copy = async (what, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(""), 1600);
    } catch {
      setCopied("");
    }
  };

  const toggleReveal = (i) =>
    setRevealed((r) => ({ ...r, [i]: !r[i] }));
  const allShown = selected.qa.every((_, i) => revealed[i]);
  const setAll = (val) =>
    setRevealed(Object.fromEntries(selected.qa.map((_, i) => [i, val])));

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 font-sans text-slate-200 sm:px-6 lg:px-8">
      {/* header */}
      <header className="mx-auto mb-6 flex max-w-[1600px] flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-indigo-300">
            ML workspace
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            ML Reference Library
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            {totalItems} snippets across the full ML workflow: scraping, pandas,
            EDA, plotting, preprocessing, PCA, models, tuning and deployment.
            Each one has self-test questions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeButton theme={theme} onSelect={onSelectTheme} />
          <button
            type="button"
            onClick={() => onNavigate("/home")}
            className="no-underline rounded-lg border border-red-600 bg-red-600/10 px-4 py-2 text-sm text-red-300 transition hover:bg-red-600/30"
          >
            Back
          </button>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1600px] grid-cols-1 gap-4 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.7fr)]">
        {/* ---------------- sidebar ---------------- */}
        <aside
          className="flex min-w-0 flex-col rounded-2xl border border-slate-800 bg-slate-900/90 p-3 shadow-xl shadow-black/10 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start"
          aria-label="Algorithm navigation"
        >
          <div className="relative mb-3 px-1">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search: pca, scraping, heatmap..."
              className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:border-indigo-400/60 focus:outline-none"
              aria-label="Search snippets"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1 max-lg:max-h-[420px]">
            {visibleGroups.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-slate-500">
                Nothing matches "{query}".
              </p>
            )}

            {visibleGroups.map((group) => {
              const open = q ? true : !collapsed[group.title];
              return (
                <section className="mt-1" key={group.title}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-bold text-slate-200 transition hover:bg-slate-800"
                    onClick={() =>
                      setCollapsed((c) => ({ ...c, [group.title]: !c[group.title] }))
                    }
                    aria-expanded={open}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="grid h-6 w-6 place-items-center rounded-md border border-slate-700 bg-slate-800 text-sm text-indigo-300">
                        {group.icon}
                      </span>
                      <span>{group.title}</span>
                      <span className="grid h-[19px] min-w-5 place-items-center rounded-md bg-slate-800 px-1 text-[10px] text-slate-400">
                        {group.items.length}
                      </span>
                    </span>
                    <span
                      className={`text-sm text-slate-500 transition-transform ${
                        open ? "rotate-180" : ""
                      }`}
                    >
                      ▾
                    </span>
                  </button>

                  {open && (
                    <div className="mb-1 mt-1 grid gap-0.5 pl-2">
                      {group.items.map((item) => {
                        const active = selected.id === item.id;
                        return (
                          <button
                            type="button"
                            key={item.id}
                            onClick={() => select(item.id)}
                            aria-current={active ? "true" : undefined}
                            className={`flex min-w-0 items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-xs leading-5 transition ${
                              active
                                ? "border-indigo-400/25 bg-indigo-400/10 text-indigo-100"
                                : "border-transparent text-slate-400 hover:bg-slate-800/80 hover:text-slate-100"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                active
                                  ? "bg-indigo-300 ring-4 ring-indigo-300/10"
                                  : "bg-slate-600"
                              }`}
                            />
                            <span className="truncate">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          <div className="mt-2 flex items-start gap-2.5 border-t border-slate-800 px-2 pt-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-slate-700 text-xs text-indigo-300">
              ?
            </span>
            <p className="text-[10px] leading-4 text-slate-500">
              Switch to the Self-test tab to quiz yourself. Answers stay hidden
              until you reveal them.
            </p>
          </div>
        </aside>

        {/* ---------------- main panel ---------------- */}
        <section
          className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl shadow-black/10"
          aria-label="Selected snippet"
        >
          {/* title bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-4 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-700 bg-slate-800 text-xs font-medium text-indigo-200">
                Py
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-bold text-slate-100">
                  {selected.label}
                </h2>
                <p className="mt-1 text-[11px] text-slate-500">{selected.group}</p>
              </div>
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/50 p-1">
              {[
                ["code", "Code"],
                ["qa", `Self-test (${selected.qa.length})`],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition ${
                    tab === key
                      ? "bg-indigo-400/15 text-indigo-100"
                      : "text-slate-400 hover:text-slate-100"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* install line */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 bg-slate-950/30 px-4 py-2.5 sm:px-5">
            <code className="min-w-0 truncate font-mono text-[11px] text-slate-400">
              <span className="select-none text-slate-600">$ </span>
              {selected.requires}
            </code>
            <button
              type="button"
              onClick={() => copy("install", selected.requires)}
              className="shrink-0 text-[10px] font-semibold text-slate-500 transition hover:text-indigo-300"
            >
              {copied === "install" ? "Copied" : "Copy"}
            </button>
          </div>

          {tab === "code" ? (
            <>
              <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-2.5 text-[10px] text-slate-500 sm:px-5">
                <span className="inline-flex items-center gap-2 text-slate-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Python
                  <span className="text-slate-600">{lines.length} lines</span>
                </span>
                <button
                  type="button"
                  onClick={() => copy("code", selected.code)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition ${
                    copied === "code"
                      ? "border-emerald-800 text-emerald-300"
                      : "border-slate-700 bg-slate-800 text-slate-200 hover:border-indigo-400/60"
                  }`}
                >
                  <span aria-hidden="true">{copied === "code" ? "✓" : "▢"}</span>
                  {copied === "code" ? "Copied!" : "Copy code"}
                </button>
              </div>

              <div className="max-h-[640px] min-h-[360px] flex-1 overflow-auto bg-slate-950/40 py-5">
                <pre className="m-0 font-mono text-xs leading-[1.9] text-slate-300">
                  <code>
                    {lines.map((line, i) => (
                      <span
                        className="grid min-h-[22px] grid-cols-[52px_minmax(max-content,1fr)] pr-5"
                        key={`${selected.id}-${i}`}
                      >
                        <span className="select-none pr-4 text-right text-slate-600">
                          {i + 1}
                        </span>
                        <span className="whitespace-pre">{highlight(line)}</span>
                      </span>
                    ))}
                  </code>
                </pre>
              </div>
            </>
          ) : (
            <div className="min-h-[360px] flex-1 space-y-3 overflow-auto bg-slate-950/40 p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Answer out loud first, then reveal.
                </p>
                <button
                  type="button"
                  onClick={() => setAll(!allShown)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:border-indigo-400/60"
                >
                  {allShown ? "Hide all" : "Reveal all"}
                </button>
              </div>

              {selected.qa.map((item, i) => (
                <article
                  key={`${selected.id}-qa-${i}`}
                  className="rounded-xl border border-slate-800 bg-slate-900/80 p-4"
                >
                  <h3 className="text-sm font-semibold leading-6 text-slate-100">
                    {item.q}
                  </h3>
                  {revealed[i] ? (
                    <p className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs leading-6 text-emerald-100/90">
                      {item.a}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleReveal(i)}
                      className="mt-2 rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] font-semibold text-indigo-300 transition hover:bg-slate-800"
                    >
                      Show answer
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}

          {/* footer nav */}
          <footer className="flex items-center justify-between gap-3 border-t border-slate-800 px-4 py-3 text-[11px] text-slate-500 sm:px-5">
            <button
              type="button"
              onClick={() => go(-1)}
              className="rounded-lg border border-slate-800 px-3 py-1.5 text-slate-300 transition hover:border-indigo-400/50 hover:text-white"
            >
              ← Previous
            </button>
            <span>
              {idx + 1} / {navList.length}
            </span>
            <button
              type="button"
              onClick={() => go(1)}
              className="rounded-lg border border-slate-800 px-3 py-1.5 text-slate-300 transition hover:border-indigo-400/50 hover:text-white"
            >
              Next →
            </button>
          </footer>
        </section>
      </section>
    </main>
  );
}