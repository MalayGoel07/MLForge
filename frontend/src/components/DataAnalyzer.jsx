import { useEffect, useRef, useState } from "react";
import api from "../api/api";
import ThemeButton from "./ThemeButton";
import { fmt, skewColor, BoxPlot, SkewBar } from "./Chartkit";

const STAT_FIELDS = [
    ["Count", "count"], ["Mean", "mean"], ["Median", "median"], ["Std", "std"], ["IQR", "iqr"],
    ["Min", "min"], ["Q1", "q1"], ["Q3", "q3"], ["Max", "max"], ["Skewness", "skewness"],
];

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

const skewLabel = (s) => {
    const a = Math.abs(s ?? 0);
    const strength = a < 0.5 ? "Roughly symmetric" : a < 1 ? "Moderately skewed" : "Highly skewed";
    if (a < 0.5) return strength;
    return `${strength} to the ${s > 0 ? "right" : "left"}`;
};

/* Build the boxplot shape from the analyzer's stats + outlier bounds.
   Whiskers stop at the IQR fences, so they are approximate when the data
   ends before a fence. Red dots mark min / max when they lie beyond a fence. */
const toBox = (stat, out) => {
    if (!stat) return null;
    const min = num(stat.min), max = num(stat.max);
    const lo = num(out?.lower_bound), hi = num(out?.upper_bound);
    const outliers = [];
    if (lo !== null && min < lo) outliers.push(min);
    if (hi !== null && max > hi) outliers.push(max);
    return {
        min, max, q1: num(stat.q1), median: num(stat.median), q3: num(stat.q3),
        whisker_low: lo !== null ? Math.max(min, lo) : min,
        whisker_high: hi !== null ? Math.min(max, hi) : max,
        outliers,
        outlier_count: out?.count ?? 0,
    };
};

const nameList = (arr) => arr.slice(0, 3).join(", ") + (arr.length > 3 ? ` +${arr.length - 3} more` : "");

/* Plain-language findings shown right after analysis */
function findings(analysis) {
    if (!analysis) return [];
    const stats = analysis.stats || {};
    const outliers = analysis.outliers || {};
    const skewed = Object.keys(stats).filter((n) => Math.abs(num(stats[n].skewness) ?? 0) > 1);
    const outlierCols = Object.keys(outliers).filter((n) => (outliers[n]?.count ?? 0) > 0);
    const out = [];
    if (analysis.dup_rows > 0) out.push(`${fmt(analysis.dup_rows)} duplicate rows`);
    if (analysis.missing > 0) out.push(`${fmt(analysis.missing)} missing values`);
    if (outlierCols.length) out.push(`Unusual values in ${outlierCols.length} columns (${nameList(outlierCols)})`);
    if (skewed.length) out.push(`${skewed.length} columns are heavily skewed (${nameList(skewed)})`);
    return out;
}

/* ------------------------------------------------------------------ */
/*  Small UI pieces                                                    */
/* ------------------------------------------------------------------ */
const inputCls = "w-full rounded-lg border border-[#243724] bg-[#101a10] px-2 py-1.5 text-xs text-[#d4e6d5] focus:border-[#618c61] focus:outline-none";

function Collapse({ title, badge, open, onToggle, children }) {
    return (
        <div className="rounded-lg border border-[#243724] bg-[#101a10]">
            <button type="button" aria-expanded={open} onClick={onToggle} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[#172617]">
                <span className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-[#d4e6d5]">{title}</span>
                    {badge && <span className="rounded-md bg-[#0e140e] px-2 py-0.5 text-[10px] text-gray-400">{badge}</span>}
                </span>
                <span className={`text-sm text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
            </button>
            {open && <div className="border-t border-[#243724] p-4">{children}</div>}
        </div>
    );
}

function StepHeader({ n, title, sub }) {
    return (
        <div className="mb-4 flex items-start gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[#618c61] bg-[#172617] text-xs font-bold text-[#d4e6d5]">{n}</span>
            <div>
                <h2 className="text-lg font-bold leading-7">{title}</h2>
                {sub && <p className="text-xs leading-5 text-gray-500">{sub}</p>}
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function DataAnalyzer({ onNavigate, theme = "forest", onSelectTheme }) {
    const fileInputRef = useRef(null);
    const resultsRef = useRef(null);
    const [fileName, setFileName] = useState("");
    const [file, setFile] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [input, setInput] = useState("");
    const [analysis, setAnalysis] = useState(null);
    const [error, setError] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [selectedCol, setSelectedCol] = useState("");

    /* all sections start closed */
    const [showPaste, setShowPaste] = useState(false);
    const [showTypes, setShowTypes] = useState(false);
    const [showDistribution, setShowDistribution] = useState(false);
    const [showColumnCharts, setShowColumnCharts] = useState(false);
    const [showRelations, setShowRelations] = useState(false);

    const closeAll = () => {
        setShowTypes(false);
        setShowDistribution(false);
        setShowColumnCharts(false);
        setShowRelations(false);
    };

    const handleFile = (selected) => {
        if (!selected) return;
        if (!/\.(csv|json|xlsx)$/i.test(selected.name)) { setError("Please choose a .csv, .json or .xlsx file."); return; }
        setFile(selected);
        setFileName(selected.name);
        setInput("");
        setAnalysis(null);
        setError("");
        closeAll();
    };

    const runAnalyzer = async () => {
        setIsAnalyzing(true);
        setError("");
        try {
            if (!input.trim() && !file) throw new Error("Add data or choose a file before analyzing.");
            const formData = new FormData();
            if (file) {
                formData.append("file", file);
            } else {
                const isJson = input.trimStart().startsWith("[") || input.trimStart().startsWith("{");
                formData.append("file", new Blob([input], { type: isJson ? "application/json" : "text/csv" }), isJson ? "pasted-data.json" : "pasted-data.csv");
            }
            const { data } = await api.post("/analyze", formData);
            setAnalysis({ ...data.analysis, charts: data.charts || [] });
            setSelectedCol(Object.keys(data.analysis?.stats || {})[0] || "");
            closeAll();
        } catch (err) {
            setAnalysis(null);
            setError(err.response?.data?.detail || err.message || "Something went wrong");
        } finally { setIsAnalyzing(false); }
    };

    useEffect(() => {
        if (analysis) resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, [analysis]);

    /* derived */
    const statCols = Object.keys(analysis?.stats || {});
    const activeCol = statCols.includes(selectedCol) ? selectedCol : statCols[0];
    const activeStat = analysis?.stats?.[activeCol];
    const activeOut = analysis?.outliers?.[activeCol];
    const skewRows = statCols
        .map((name) => ({ name, skew: num(analysis.stats[name].skewness) ?? 0 }))
        .sort((a, b) => Math.abs(b.skew) - Math.abs(a.skew));
    const outlierRows = Object.entries(analysis?.outliers || {})
        .map(([name, o]) => ({ name, ...o, pct: num(o.percentage) ?? 0 }))
        .sort((a, b) => b.pct - a.pct);
    const maxPct = Math.max(...outlierRows.map((r) => r.pct), 1);
    const outlierColCount = outlierRows.filter((r) => r.count > 0).length;
    const issues = findings(analysis);
    const chartCount = analysis?.charts?.length || 0;

    const cards = [
        ["Rows", analysis?.rows],
        ["Columns", analysis?.columns],
        ["Missing values", analysis?.missing],
        ["Duplicate rows", analysis?.dup_rows],
        ["Numeric columns", analysis ? statCols.length : undefined],
        ["Columns with outliers", analysis ? outlierColCount : undefined],
    ];

    const hasSource = !!file || !!input.trim();

    return (
        <div className="t-page page-no-overscroll min-h-screen overflow-x-clip overscroll-none px-4 py-4 font-mono md:px-8 scrollbar-thin scrollbar-thumb-[#7aa88a] scroll-smooth">
            <section className="mx-auto max-w-5xl">
                <header className="t-card-line mb-4 border-b pb-5">
                    <p className="t-accent mb-2 text-xs uppercase tracking-[0.3em]">MlForge</p>
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Data Analyzer</h1>
                            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-400">Upload a dataset, see what is in it, then dig into the details you care about.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <ThemeButton theme={theme} onSelect={onSelectTheme} />
                            <button onClick={() => onNavigate("/home")} className="no-underline rounded-lg border border-red-600 bg-red-600/10 px-4 py-2 text-sm text-red-300 transition hover:bg-red-600/30">Back</button>
                        </div>
                    </div>
                </header>

                <div className="flex flex-col gap-5">
                    {/* ---------------- Step 1: upload ---------------- */}
                    <section className="rounded-xl border border-[#243724] bg-[#0e140e]/80 p-5 shadow-2xl shadow-[#172617]/20">
                        <StepHeader n="1" title="Bring in your data" sub="CSV, JSON or XLSX. Nothing is changed, this only reads your data." />
                        <input ref={fileInputRef} type="file" accept=".csv,.json,.xlsx" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
                            className={`w-full rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${dragging ? "border-[#7aa88a] bg-[#172617]" : "border-[#243724] bg-[#101a10] hover:border-[#618c61]"}`}
                        >
                            <span className="block text-sm font-semibold text-[#d4e6d5]">{fileName || "Drop a file here, or click to browse"}</span>
                            <span className="mt-1 block text-xs text-gray-500">{fileName ? "Click to choose a different file" : ".csv, .json or .xlsx"}</span>
                        </button>

                        <div className="mt-3">
                            <Collapse title="Or paste your data" badge={input.trim() ? "has data" : undefined} open={showPaste} onToggle={() => setShowPaste((v) => !v)}>
                                <textarea
                                    value={input}
                                    onChange={(event) => { setInput(event.target.value); setFile(null); setFileName(""); setAnalysis(null); setError(""); }}
                                    className="h-48 w-full resize-none rounded-lg border border-[#243724] bg-[#070a07] p-4 text-sm leading-6 text-[#d4e6d5] outline-none transition placeholder:text-gray-600 focus:border-[#7aa88a]"
                                    placeholder="Paste rows or JSON here..."
                                    aria-label="Dataset input"
                                />
                            </Collapse>
                        </div>

                        {error && <p role="alert" className="mt-3 rounded-lg border border-red-800 bg-red-900/10 p-3 text-xs text-red-400">{error}</p>}

                        <button type="button" onClick={runAnalyzer} disabled={isAnalyzing || !hasSource} className="mt-4 w-full rounded-lg border border-green-400/60 bg-green-400/10 px-4 py-3 text-sm font-semibold text-white transition hover:border-green-300 hover:bg-green-300/20 disabled:cursor-not-allowed disabled:opacity-50">{isAnalyzing ? "Analyzing..." : analysis ? "Analyze again" : "Analyze dataset"}</button>
                    </section>

                    {/* ---------------- Step 2: overview ---------------- */}
                    {analysis && (
                        <section ref={resultsRef} className="scroll-mt-4 rounded-xl border border-[#243724] bg-[#101a10] p-5 shadow-2xl shadow-[#172617]/10">
                            <StepHeader n="2" title="Dataset overview" sub={`${fmt(analysis.rows)} rows, ${fmt(analysis.columns)} columns`} />

                            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                                {cards.map(([label, value]) => (
                                    <div key={label} className="rounded-lg border border-[#243724] bg-[#0e140e] p-4 transition-colors hover:border-[#618c61]">
                                        <p className="text-xs text-gray-500">{label}</p>
                                        <p className="mt-2 truncate text-2xl font-bold tabular-nums text-[#adc9ae]">{value === undefined || value === null ? "--" : fmt(value)}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-4 rounded-lg border border-[#243724] bg-[#0e140e] p-4">
                                <p className="mb-2 text-xs font-semibold text-[#adc9ae]">What we found:</p>
                                {issues.length === 0 ? (
                                    <p className="text-xs text-[#7aa88a]">No obvious problems. This dataset looks healthy.</p>
                                ) : (
                                    <ul className="space-y-1.5 text-xs leading-5 text-gray-400">
                                        {issues.map((t) => (
                                            <li key={t} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d9b45a]" />{t}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </section>
                    )}

                    {/* ---------------- Step 3: explore ---------------- */}
                    {analysis && (
                        <section className="rounded-xl border border-[#243724] bg-[#0e140e]/80 p-5">
                            <StepHeader n="3" title="Explore the details" sub="Open any section to look closer. Everything starts collapsed." />

                            <div className="space-y-2">
                                {analysis.types && (
                                    <Collapse title="Columns and data types" badge={`${analysis.types.length} fields`} open={showTypes} onToggle={() => setShowTypes((v) => !v)}>
                                        <div className="green-thin-scroll grid max-h-56 gap-2 overflow-y-auto pr-2 sm:grid-cols-2">
                                            {analysis.types.map(({ name, type }) => (
                                                <div key={name} className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-[#243724] bg-[#0e140e] px-3 py-2 text-sm">
                                                    <span className="truncate text-[#d4e6d5]">{name}</span>
                                                    <span className="shrink-0 rounded bg-[#172617] px-2 py-1 text-xs text-[#adc9ae]">{type}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </Collapse>
                                )}

                                <Collapse title="Spread and shape of one column" badge={statCols.length ? `${statCols.length} numeric` : undefined} open={showDistribution} onToggle={() => setShowDistribution((v) => !v)}>
                                    <label className="mb-4 flex items-center gap-2 text-xs text-gray-400">
                                        Column
                                        <select value={activeCol || ""} onChange={(e) => setSelectedCol(e.target.value)} disabled={statCols.length === 0} aria-label="Column to inspect" className={`${inputCls} w-48 disabled:opacity-50`}>
                                            {statCols.length === 0 && <option value="">No numeric columns</option>}
                                            {statCols.map((name) => <option key={name} value={name}>{name}</option>)}
                                        </select>
                                    </label>

                                    {!activeStat ? (
                                        <p className="rounded-lg border border-dashed border-[#243724] p-6 text-center text-sm text-gray-500">This dataset has no numeric columns to plot.</p>
                                    ) : (
                                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                                            <div className="rounded-lg border border-[#243724] bg-[#0e140e] p-4">
                                                <div className="mb-2 flex items-center justify-between gap-3">
                                                    <p className="truncate text-xs uppercase tracking-[0.2em] text-[#adc9ae]">{activeCol}</p>
                                                    <span className="text-xs" style={{ color: skewColor(num(activeStat.skewness)) }}>{skewLabel(num(activeStat.skewness))}</span>
                                                </div>
                                                <BoxPlot before={toBox(activeStat, activeOut)} beforeLabel="Data" />
                                                {activeOut && (
                                                    <p className="mt-2 text-[11px] leading-5 text-gray-500">
                                                        Outlier fences: {fmt(num(activeOut.lower_bound))} to {fmt(num(activeOut.upper_bound))}. {activeOut.count} values outside ({activeOut.percentage}%).
                                                    </p>
                                                )}
                                            </div>

                                            <div className="rounded-lg border border-[#243724] bg-[#0e140e] p-4">
                                                <p className="mb-3 text-xs uppercase tracking-[0.2em] text-[#adc9ae]">Statistics</p>
                                                <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-3">
                                                    {STAT_FIELDS.map(([label, key]) => (
                                                        <div key={key}>
                                                            <p className="text-xs text-gray-500">{label}</p>
                                                            <p className="mt-1 truncate font-semibold text-[#d4e6d5]">{fmt(num(activeStat[key]))}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </Collapse>

                                <Collapse title="Skewness and outliers per column" badge={outlierColCount ? `${outlierColCount} with outliers` : undefined} open={showColumnCharts} onToggle={() => setShowColumnCharts((v) => !v)}>
                                    {statCols.length === 0 ? (
                                        <p className="rounded-lg border border-dashed border-[#243724] p-6 text-center text-sm text-gray-500">This dataset has no numeric columns.</p>
                                    ) : (
                                        <div className="grid gap-4 lg:grid-cols-2">
                                            <div className="rounded-lg border border-[#243724] bg-[#0e140e] p-4">
                                                <p className="mb-3 text-xs uppercase tracking-[0.2em] text-[#adc9ae]">Skewness per column</p>
                                                <div className="green-thin-scroll max-h-72 space-y-3 overflow-y-auto pr-2">
                                                    {skewRows.map(({ name, skew }) => (
                                                        <button key={name} type="button" onClick={() => { setSelectedCol(name); setShowDistribution(true); }} className={`grid w-full grid-cols-[110px_1fr_50px] items-center gap-3 rounded px-1 py-0.5 text-left transition hover:bg-[#172617] ${name === activeCol ? "bg-[#172617]" : ""}`}>
                                                            <span className="truncate text-xs text-[#d4e6d5]" title={name}>{name}</span>
                                                            <SkewBar value={skew} />
                                                            <span className="text-right text-[11px]" style={{ color: skewColor(skew) }}>{fmt(skew)}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                                <p className="mt-3 text-[10px] text-gray-600">Sorted by strength. Green under 0.5, amber under 1, red above 1. Click a row to inspect it.</p>
                                            </div>

                                            <div className="rounded-lg border border-[#243724] bg-[#0e140e] p-4">
                                                <p className="mb-3 text-xs uppercase tracking-[0.2em] text-[#adc9ae]">Outlier share per column</p>
                                                <div className="green-thin-scroll max-h-72 space-y-3 overflow-y-auto pr-2">
                                                    {outlierRows.map(({ name, count, pct }) => (
                                                        <button key={name} type="button" onClick={() => { setSelectedCol(name); setShowDistribution(true); }} className={`grid w-full grid-cols-[110px_1fr_80px] items-center gap-3 rounded px-1 py-0.5 text-left transition hover:bg-[#172617] ${name === activeCol ? "bg-[#172617]" : ""}`}>
                                                            <span className="truncate text-xs text-[#d4e6d5]" title={name}>{name}</span>
                                                            <div className="h-2 w-full rounded bg-[#172617]">
                                                                <div className="h-full rounded" style={{ width: `${Math.min(pct / maxPct, 1) * 100}%`, background: pct === 0 ? "#7aa88a" : pct > 5 ? "#d46a6a" : "#d9b45a" }} />
                                                            </div>
                                                            <span className="text-right text-[11px] text-gray-500">{count} ({fmt(pct)}%)</span>
                                                        </button>
                                                    ))}
                                                </div>
                                                <p className="mt-3 text-[10px] text-gray-600">Bars are scaled to the column with the most outliers. Red is above 5% of rows.</p>
                                            </div>
                                        </div>
                                    )}
                                </Collapse>

                                <Collapse title="Relationships between columns" badge={`${chartCount} charts`} open={showRelations} onToggle={() => setShowRelations((v) => !v)}>
                                    {chartCount ? (
                                        <div className="grid gap-4 md:grid-cols-2">
                                            {analysis.charts.map(({ title, image }) => (
                                                <figure key={title} className="overflow-hidden rounded-lg border border-[#243724] bg-[#0e140e] p-3">
                                                    <img src={`data:image/png;base64,${image}`} alt={title} className="h-auto w-full rounded bg-white" />
                                                    <figcaption className="px-1 pt-3 text-sm text-[#d4e6d5]">{title}</figcaption>
                                                </figure>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="rounded-lg border border-dashed border-[#243724] p-6 text-sm text-gray-500">This dataset needs at least two related columns to generate relationship charts.</p>
                                    )}
                                </Collapse>
                            </div>
                        </section>
                    )}
                </div>
            </section>
        </div>
    );
}