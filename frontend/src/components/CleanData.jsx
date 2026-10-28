import { useEffect, useRef, useState } from "react";
import api from "../api/api";
import ThemeButton from "./ThemeButton";
import { fmt, skewColor, BEFORE_COLOR, AFTER_COLOR, BoxPlot, Hist, SkewBar } from "./Chartkit";

/* ------------------------------------------------------------------ */
/*  Options (hint = plain-language explanation shown under the select) */
/* ------------------------------------------------------------------ */
const NUM_IMPUTE = [
    { value: "median", label: "Median", hint: "The middle value. A safe default, even with extreme values." },
    { value: "mean", label: "Mean", hint: "The average. Works best when values are evenly spread." },
    { value: "mode", label: "Most common value", hint: "Uses the value that appears most often." },
    { value: "constant", label: "A fixed number", hint: "Fills every gap with a number you choose." },
    { value: "drop_rows", label: "Delete those rows", hint: "Removes any row that has a gap." },
];
const CAT_IMPUTE = [
    { value: "mode", label: "Most common value", hint: "Uses the value that appears most often." },
    { value: "constant", label: "A fixed label", hint: "Fills every gap with a label you choose, like 'unknown'." },
    { value: "drop_rows", label: "Delete those rows", hint: "Removes any row that has a gap." },
];
const OUTLIER_METHODS = [
    { value: "iqr_clip", label: "Cap extreme values (IQR)", hint: "Pulls extreme values back to the edge of the normal range. Keeps every row." },
    { value: "percentile_clip", label: "Cap at percentiles", hint: "Limits values to a low and a high percentile you choose. Keeps every row." },
    { value: "iqr_remove", label: "Remove extreme rows (IQR)", hint: "Deletes rows that hold an extreme value." },
    { value: "zscore_remove", label: "Remove extreme rows (Z-score)", hint: "Deletes rows far from the average, measured in standard deviations." },
];
const SKEW_METHODS = [
    { value: "yeo-johnson", label: "Yeo-Johnson", hint: "Works on any numbers, including negatives. A good default." },
    { value: "log", label: "Log", hint: "Squeezes large values. Good for prices and counts." },
    { value: "sqrt", label: "Square root", hint: "A gentler version of log." },
    { value: "box-cox", label: "Box-Cox", hint: "Like Yeo-Johnson but needs all values above zero." },
];
const ENCODE_METHODS = [
    { value: "onehot", label: "One-hot", hint: "One yes/no column per category. Best for most models." },
    { value: "label", label: "Label numbers", hint: "One number per category. Only suits tree-based models." },
];

const SUMMARY_FIELDS = [
    { key: "rows", label: "Rows", neutral: true, tip: "Number of records" },
    { key: "cols", label: "Columns", neutral: true, tip: "Number of fields" },
    { key: "missing_cells", label: "Missing values", tip: "Empty cells" },
    { key: "duplicate_rows", label: "Duplicate rows", tip: "Rows that repeat" },
    { key: "outlier_cells", label: "Unusual values", tip: "Values far outside the typical range" },
    { key: "mean_abs_skew", label: "Skewness (avg)", tip: "Closer to 0 means more balanced" },
];

const PRESETS = [
    { id: "smart", title: "Smart pick", desc: "Turns on only the steps your data needs." },
    { id: "basic", title: "Basic tidy", desc: "Spaces, duplicates and missing values." },
    { id: "ml", title: "Ready for ML", desc: "Basic tidy, plus capping extreme values and fixing skew." },
    { id: "custom", title: "Custom", desc: "Choose every step yourself." },
];

/* ------------------------------------------------------------------ */
/*  Config + presets                                                   */
/* ------------------------------------------------------------------ */
const DEFAULT_CONFIG = {
    trim_text: true,
    lowercase_text: false,
    drop_duplicates: true,
    drop_constant_cols: true,
    drop_missing_cols: { enabled: true, threshold: 60 },
    impute_numeric: { enabled: true, strategy: "median", constant: 0 },
    impute_categorical: { enabled: true, strategy: "mode", constant: "unknown" },
    outliers: { enabled: false, method: "iqr_clip", factor: 1.5, z: 3, lower_pct: 1, upper_pct: 99 },
    skew: { enabled: false, method: "yeo-johnson", threshold: 0.75 },
    encode: { enabled: false, method: "onehot" },
};
const clone = (o) => JSON.parse(JSON.stringify(o));

function recommend(profile) {
    const cfg = clone(DEFAULT_CONFIG);
    const cols = profile.columns;
    const numeric = cols.filter((c) => c.dtype === "numeric");
    cfg.drop_duplicates = profile.summary.duplicate_rows > 0;
    cfg.drop_missing_cols.enabled = cols.some((c) => c.missing_pct > cfg.drop_missing_cols.threshold);
    cfg.drop_constant_cols = cols.some((c) => c.unique <= 1);
    cfg.impute_numeric.enabled = numeric.some((c) => c.missing > 0);
    cfg.impute_categorical.enabled = cols.some((c) => c.dtype !== "numeric" && c.missing > 0);
    cfg.outliers.enabled = profile.summary.outlier_cells > 0;
    cfg.skew.enabled = numeric.some((c) => Math.abs(c.skew ?? 0) > 1);
    return cfg;
}

function presetConfig(id, profile) {
    if (id === "smart") return recommend(profile);
    const cfg = clone(DEFAULT_CONFIG);
    if (id === "ml") {
        cfg.outliers.enabled = true;
        cfg.skew.enabled = true;
    }
    return cfg;
}

const labelOf = (options, value) => options.find((o) => o.value === value)?.label || value;

function planLines(c) {
    const L = [];
    if (c.trim_text) L.push(`Trim extra spaces in text${c.lowercase_text ? " and make it lowercase" : ""}`);
    if (c.drop_duplicates) L.push("Remove duplicate rows");
    if (c.drop_constant_cols) L.push("Drop columns that hold a single repeated value");
    if (c.drop_missing_cols.enabled) L.push(`Drop columns that are more than ${c.drop_missing_cols.threshold}% empty`);
    if (c.impute_numeric.enabled) L.push(c.impute_numeric.strategy === "drop_rows" ? "Delete rows with missing numbers" : `Fill missing numbers (${labelOf(NUM_IMPUTE, c.impute_numeric.strategy).toLowerCase()})`);
    if (c.impute_categorical.enabled) L.push(c.impute_categorical.strategy === "drop_rows" ? "Delete rows with missing text" : `Fill missing text (${labelOf(CAT_IMPUTE, c.impute_categorical.strategy).toLowerCase()})`);
    if (c.outliers.enabled) L.push(labelOf(OUTLIER_METHODS, c.outliers.method));
    if (c.skew.enabled) L.push(`Fix skewed columns (${labelOf(SKEW_METHODS, c.skew.method)})`);
    if (c.encode.enabled) L.push(`Turn text columns into numbers (${labelOf(ENCODE_METHODS, c.encode.method).toLowerCase()})`);
    return L;
}

const nameList = (arr) => arr.slice(0, 3).map((c) => c.name).join(", ") + (arr.length > 3 ? ` +${arr.length - 3} more` : "");

function findings(profile) {
    const { summary, columns } = profile;
    const numeric = columns.filter((c) => c.dtype === "numeric");
    const missingCols = columns.filter((c) => c.missing > 0);
    const sparse = columns.filter((c) => c.missing_pct > 60);
    const constant = columns.filter((c) => c.unique <= 1);
    const skewed = numeric.filter((c) => Math.abs(c.skew ?? 0) > 1);
    const outlierCols = numeric.filter((c) => c.outlier_count > 0);
    const out = [];
    if (summary.duplicate_rows > 0) out.push(`${fmt(summary.duplicate_rows)} duplicate rows`);
    if (missingCols.length) out.push(`${fmt(summary.missing_cells)} missing values in ${missingCols.length} columns (${nameList(missingCols)})`);
    if (sparse.length) out.push(`${sparse.length} columns are mostly empty (${nameList(sparse)})`);
    if (constant.length) out.push(`${constant.length} columns hold a single value (${nameList(constant)})`);
    if (outlierCols.length) out.push(`${fmt(summary.outlier_cells)} unusual values in ${outlierCols.length} columns (${nameList(outlierCols)})`);
    if (skewed.length) out.push(`${skewed.length} columns are heavily skewed (${nameList(skewed)})`);
    return out;
}

/* ------------------------------------------------------------------ */
/*  Small UI pieces                                                    */
/* ------------------------------------------------------------------ */
const inputCls = "w-full rounded-lg border border-[#243724] bg-[#101a10] px-2 py-1.5 text-xs text-[#d4e6d5] focus:border-[#618c61] focus:outline-none";

function Switch({ checked, onChange, label }) {
    return (
        <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`relative h-5 w-9 shrink-0 rounded-full border transition ${checked ? "border-[#7aa88a] bg-[#618c61]" : "border-[#243724] bg-[#101a10]"}`}>
            <span className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
        </button>
    );
}

function Select({ label, value, onChange, options }) {
    const hint = options.find((o) => o.value === value)?.hint;
    return (
        <label className="block">
            <span className="mb-1 block text-[11px] text-gray-400">{label}</span>
            <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
                {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {hint && <span className="mt-1 block text-[10px] leading-4 text-gray-500">{hint}</span>}
        </label>
    );
}

function NumberField({ label, hint, value, onChange, min, max, step = 1 }) {
    return (
        <label className="block">
            <span className="mb-1 block text-[11px] text-gray-400">{label}</span>
            <input type="number" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} className={inputCls} />
            {hint && <span className="mt-1 block text-[10px] leading-4 text-gray-500">{hint}</span>}
        </label>
    );
}

function TextField({ label, value, onChange }) {
    return (
        <label className="block">
            <span className="mb-1 block text-[11px] text-gray-400">{label}</span>
            <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />
        </label>
    );
}

function StepCard({ title, description, enabled, onToggle, children }) {
    return (
        <div className={`rounded-lg border p-3 transition ${enabled ? "border-[#618c61] bg-[#172617]" : "border-[#243724] bg-[#101a10]"}`}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold text-[#d4e6d5]">{title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-gray-500">{description}</p>
                </div>
                <Switch checked={enabled} onChange={onToggle} label={title} />
            </div>
            {enabled && children && <div className="mt-3 space-y-3">{children}</div>}
        </div>
    );
}

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

function SkewChart({ before, after }) {
    const afterMap = Object.fromEntries((after?.columns || []).map((c) => [c.name, c]));
    const rows = (before?.columns || []).filter((c) => c.dtype === "numeric");
    if (rows.length === 0) return <p className="py-6 text-center text-xs text-gray-500">No numeric columns.</p>;
    return (
        <div className="green-thin-scroll max-h-72 space-y-3 overflow-y-auto pr-2">
            {rows.map((c) => {
                const a = afterMap[c.name];
                return (
                    <div key={c.name} className="grid grid-cols-[110px_1fr_90px] items-center gap-3">
                        <span className="truncate text-xs text-[#d4e6d5]" title={c.name}>{c.name}</span>
                        <div className="space-y-1.5">
                            <SkewBar value={c.skew} />
                            {a ? <SkewBar value={a.skew} /> : <p className="text-[10px] text-gray-600">column removed</p>}
                        </div>
                        <span className="text-right text-[11px] text-gray-500">{fmt(c.skew)} → {a ? fmt(a.skew) : "--"}</span>
                    </div>
                );
            })}
            <p className="pt-1 text-[10px] text-gray-600">Top bar is before, bottom bar is after. Bars close to the center line are balanced. Green is fine, amber is moderate, red is heavily skewed.</p>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function CleanData({ onNavigate, theme = "forest", onSelectTheme }) {
    const fileInputRef = useRef(null);
    const resultsRef = useRef(null);
    const [file, setFile] = useState(null);
    const [fileName, setFileName] = useState("");
    const [dragging, setDragging] = useState(false);

    const [config, setConfig] = useState(clone(DEFAULT_CONFIG));
    const [preset, setPreset] = useState("smart");
    const [target, setTarget] = useState("");
    const [protectedCols, setProtectedCols] = useState([]);

    const [profile, setProfile] = useState(null);
    const [result, setResult] = useState(null);
    const [ranKey, setRanKey] = useState("");
    const [selectedCol, setSelectedCol] = useState("");
    const [sharedScale, setSharedScale] = useState(true);

    const [showCustom, setShowCustom] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showCharts, setShowCharts] = useState(true);
    const [showTables, setShowTables] = useState(false);

    const [isProfiling, setIsProfiling] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [error, setError] = useState("");

    const errMsg = (err) => err.response?.data?.detail || err.message || "Something went wrong";

    /* any manual edit switches the preset to Custom */
    const setStep = (key, changes) => { setPreset("custom"); setConfig((c) => ({ ...c, [key]: { ...c[key], ...changes } })); };
    const setFlag = (key, value) => { setPreset("custom"); setConfig((c) => ({ ...c, [key]: value })); };
    const toggleProtect = (name) => setProtectedCols((p) => (p.includes(name) ? p.filter((n) => n !== name) : [...p, name]));

    const applyPreset = (id) => {
        setPreset(id);
        if (id === "custom") { setShowCustom(true); return; }
        setConfig(presetConfig(id, profile));
    };

    const resetAll = () => {
        setConfig(clone(DEFAULT_CONFIG));
        setPreset("basic");
        setProtectedCols([]);
        setTarget("");
    };

    const buildPayload = () => ({ ...config, excluded_columns: [...new Set([...protectedCols, ...(target ? [target] : [])])] });

    const handleFile = async (selected) => {
        if (!selected) return;
        if (!/\.(csv|json|xlsx)$/i.test(selected.name)) { setError("Please choose a .csv, .json or .xlsx file."); return; }
        setFile(selected);
        setFileName(selected.name);
        setProfile(null);
        setResult(null);
        setError("");
        setTarget("");
        setProtectedCols([]);
        setShowCustom(false);
        setShowAdvanced(false);

        setIsProfiling(true);
        try {
            const formData = new FormData();
            formData.append("file", selected);
            const { data } = await api.post("/clean/profile", formData);
            setProfile(data);
            setPreset("smart");
            setConfig(recommend(data));
            const numeric = data.columns.filter((c) => c.dtype === "numeric");
            const mostSkewed = [...numeric].sort((a, b) => Math.abs(b.skew ?? 0) - Math.abs(a.skew ?? 0))[0];
            setSelectedCol(mostSkewed?.name || "");
        } catch (err) {
            setError(errMsg(err));
        } finally {
            setIsProfiling(false);
        }
    };

    const runCleaning = async () => {
        if (!file || !profile) return;
        setIsRunning(true);
        setError("");
        try {
            const payload = buildPayload();
            const formData = new FormData();
            formData.append("file", file);
            formData.append("config", JSON.stringify(payload));
            const { data } = await api.post("/clean/run", formData);
            setResult(data);
            setRanKey(JSON.stringify(payload));
        } catch (err) {
            setError(errMsg(err));
        } finally {
            setIsRunning(false);
        }
    };

    useEffect(() => {
        if (result) resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, [result]);

    const downloadCsv = () => {
        if (!result?.csv) return;
        const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `cleaned_${fileName.replace(/\.[^.]+$/, "") || "dataset"}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    /* derived */
    const issues = profile ? findings(profile) : [];
    const plan = planLines(config);
    const stepsOn = plan.length;
    const dirty = !!result && ranKey !== JSON.stringify(buildPayload());

    const beforeData = result?.before || profile;
    const afterData = result?.after || null;
    const numericCols = (beforeData?.columns || []).filter((c) => c.dtype === "numeric");
    const beforeCol = beforeData?.columns.find((c) => c.name === selectedCol);
    const afterCol = afterData?.columns.find((c) => c.name === selectedCol);

    const missingRows = (() => {
        if (!beforeData) return [];
        const map = new Map();
        beforeData.columns.forEach((c) => map.set(c.name, { name: c.name, before: c.missing, beforePct: c.missing_pct, after: null }));
        afterData?.columns.forEach((c) => {
            const row = map.get(c.name) || { name: c.name, before: null, beforePct: null, after: null };
            row.after = c.missing;
            map.set(c.name, row);
        });
        return [...map.values()].filter((r) => (r.before || 0) > 0 || (r.after || 0) > 0);
    })();

    const deltaCell = (key, neutral) => {
        if (!afterData) return null;
        const b = beforeData.summary[key], a = afterData.summary[key];
        const d = +(a - b).toFixed(3);
        if (d === 0) return <span className="text-[10px] text-gray-500">no change</span>;
        const good = !neutral && d < 0;
        const cls = neutral ? "text-gray-400" : good ? "text-[#7aa88a]" : "text-red-400";
        return <span className={`text-[10px] ${cls}`}>{d > 0 ? "+" : ""}{fmt(d)}</span>;
    };

    return (
        <div className="t-page page-no-overscroll min-h-screen overflow-x-clip overscroll-none px-4 py-4 font-mono md:px-8 scrollbar-thin scrollbar-thumb-[#7aa88a] scroll-smooth">
            <section className="mx-auto max-w-5xl">
                <header className="t-card-line mb-4 border-b pb-5">
                    <p className="t-accent mb-2 text-xs uppercase tracking-[0.3em]">MlForge</p>
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Clean Data</h1>
                            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-400">Upload a dataset, let us suggest fixes, then compare it before and after.</p>
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
                        <StepHeader n="1" title="Upload your dataset" sub="CSV, JSON or XLSX. Nothing changes until you click Clean." />
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
                            <span className="mt-1 block text-xs text-gray-500">{isProfiling ? "Reading dataset..." : fileName ? "Click to choose a different file" : ".csv, .json or .xlsx"}</span>
                        </button>
                        {error && <p role="alert" className="mt-3 rounded-lg border border-red-800 bg-red-900/10 p-3 text-xs text-red-400">{error}</p>}

                        {profile && (
                            <div className="mt-4 rounded-lg border border-[#243724] bg-[#101a10] p-4">
                                <p className="text-sm font-semibold text-[#d4e6d5]">{fmt(profile.summary.rows)} rows, {profile.summary.cols} columns</p>
                                <p className="mb-2 mt-1 text-xs text-gray-500">What we found:</p>
                                {issues.length === 0 ? (
                                    <p className="text-xs text-[#7aa88a]">No obvious problems. This dataset already looks clean.</p>
                                ) : (
                                    <ul className="space-y-1.5 text-xs leading-5 text-gray-400">
                                        {issues.map((t) => (
                                            <li key={t} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d9b45a]" />{t}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </section>

                    {/* ---------------- Step 2: choose ---------------- */}
                    {profile && (
                        <section className="rounded-xl border border-[#243724] bg-[#0e140e]/80 p-5">
                            <StepHeader n="2" title="Choose how to clean" sub="Pick a starting point. You can change any step afterwards." />

                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" role="radiogroup" aria-label="Cleaning preset">
                                {PRESETS.map(({ id, title, desc }) => {
                                    const on = preset === id;
                                    return (
                                        <button key={id} type="button" role="radio" aria-checked={on} onClick={() => applyPreset(id)} className={`rounded-lg border p-3 text-left transition ${on ? "border-[#7aa88a] bg-[#172617]" : "border-[#243724] bg-[#101a10] hover:border-[#618c61]"}`}>
                                            <p className="text-sm font-semibold text-[#d4e6d5]">{title}{id === "smart" && <span className="ml-2 rounded bg-[#618c61]/30 px-1.5 py-0.5 text-[9px] text-[#adc9ae]">Recommended</span>}</p>
                                            <p className="mt-1 text-[11px] leading-4 text-gray-500">{desc}</p>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="mt-4 rounded-lg border border-[#243724] bg-[#101a10] p-4">
                                <p className="text-xs font-semibold text-[#adc9ae]">When you click Clean, we will:</p>
                                {plan.length === 0 ? (
                                    <p className="mt-2 text-xs text-gray-500">Nothing. The dataset would be returned unchanged.</p>
                                ) : (
                                    <ul className="mt-2 space-y-1 text-xs leading-5 text-gray-400">
                                        {plan.map((t) => <li key={t} className="flex gap-2"><span className="text-[#7aa88a]">✓</span>{t}</li>)}
                                    </ul>
                                )}
                            </div>

                            <div className="mt-4">
                                <label className="block">
                                    <span className="mb-1 block text-xs font-semibold text-[#adc9ae]">Column you want to predict (optional)</span>
                                    <select value={target} onChange={(e) => setTarget(e.target.value)} className={`${inputCls} max-w-sm`}>
                                        <option value="">None, or not sure yet</option>
                                        {profile.columns.map(({ name }) => <option key={name} value={name}>{name}</option>)}
                                    </select>
                                    <span className="mt-1 block text-[11px] text-gray-500">We will leave this column exactly as it is.</span>
                                </label>
                            </div>

                            <div className="mt-4 space-y-2">
                                <Collapse title="Customize each step" badge={`${stepsOn} on`} open={showCustom} onToggle={() => setShowCustom((v) => !v)}>
                                    <div className="space-y-5">
                                        <div>
                                            <p className="mb-2 text-xs font-semibold text-[#adc9ae]">Tidy up</p>
                                            <div className="space-y-2">
                                                <StepCard title="Trim text" description="Remove extra spaces and treat blank cells as missing." enabled={config.trim_text} onToggle={(v) => setFlag("trim_text", v)}>
                                                    <label className="flex items-center gap-2 text-xs text-gray-400">
                                                        <input type="checkbox" checked={config.lowercase_text} onChange={(e) => setFlag("lowercase_text", e.target.checked)} />
                                                        Also make text lowercase
                                                    </label>
                                                </StepCard>
                                                <StepCard title="Remove duplicate rows" description="Keep one copy of any row that repeats." enabled={config.drop_duplicates} onToggle={(v) => setFlag("drop_duplicates", v)} />
                                                <StepCard title="Drop single-value columns" description="Remove columns where every row has the same value." enabled={config.drop_constant_cols} onToggle={(v) => setFlag("drop_constant_cols", v)} />
                                            </div>
                                        </div>

                                        <div>
                                            <p className="mb-2 text-xs font-semibold text-[#adc9ae]">Missing data</p>
                                            <div className="space-y-2">
                                                <StepCard title="Drop mostly-empty columns" description="Remove columns with too many gaps to be useful." enabled={config.drop_missing_cols.enabled} onToggle={(v) => setStep("drop_missing_cols", { enabled: v })}>
                                                    <NumberField label="Drop a column when it is more than this % empty" value={config.drop_missing_cols.threshold} min={0} max={100} onChange={(v) => setStep("drop_missing_cols", { threshold: v })} />
                                                </StepCard>
                                                <StepCard title="Fill missing numbers" description="Decide what goes in empty numeric cells." enabled={config.impute_numeric.enabled} onToggle={(v) => setStep("impute_numeric", { enabled: v })}>
                                                    <Select label="Fill with" value={config.impute_numeric.strategy} options={NUM_IMPUTE} onChange={(v) => setStep("impute_numeric", { strategy: v })} />
                                                    {config.impute_numeric.strategy === "constant" && <NumberField label="Number to use" value={config.impute_numeric.constant} step="any" onChange={(v) => setStep("impute_numeric", { constant: v })} />}
                                                </StepCard>
                                                <StepCard title="Fill missing text" description="Decide what goes in empty text cells." enabled={config.impute_categorical.enabled} onToggle={(v) => setStep("impute_categorical", { enabled: v })}>
                                                    <Select label="Fill with" value={config.impute_categorical.strategy} options={CAT_IMPUTE} onChange={(v) => setStep("impute_categorical", { strategy: v })} />
                                                    {config.impute_categorical.strategy === "constant" && <TextField label="Label to use" value={config.impute_categorical.constant} onChange={(v) => setStep("impute_categorical", { constant: v })} />}
                                                </StepCard>
                                            </div>
                                        </div>

                                        <div>
                                            <p className="mb-2 text-xs font-semibold text-[#adc9ae]">Unusual values</p>
                                            <div className="space-y-2">
                                                <StepCard title="Handle extreme values" description="Deal with numbers far outside the typical range." enabled={config.outliers.enabled} onToggle={(v) => setStep("outliers", { enabled: v })}>
                                                    <Select label="Method" value={config.outliers.method} options={OUTLIER_METHODS} onChange={(v) => setStep("outliers", { method: v })} />
                                                    {config.outliers.method.startsWith("iqr") && <NumberField label="Strictness" hint="1.5 is the standard. A higher number treats fewer values as extreme." value={config.outliers.factor} min={0.5} step={0.1} onChange={(v) => setStep("outliers", { factor: v })} />}
                                                    {config.outliers.method === "zscore_remove" && <NumberField label="Standard deviations from average" hint="3 is the standard. A higher number removes fewer rows." value={config.outliers.z} min={1} step={0.5} onChange={(v) => setStep("outliers", { z: v })} />}
                                                    {config.outliers.method === "percentile_clip" && (
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <NumberField label="Low cap (percentile)" value={config.outliers.lower_pct} min={0} max={49} onChange={(v) => setStep("outliers", { lower_pct: v })} />
                                                            <NumberField label="High cap (percentile)" value={config.outliers.upper_pct} min={51} max={100} onChange={(v) => setStep("outliers", { upper_pct: v })} />
                                                        </div>
                                                    )}
                                                </StepCard>
                                                <StepCard title="Fix skewed columns" description="Reshape lopsided columns so values spread more evenly." enabled={config.skew.enabled} onToggle={(v) => setStep("skew", { enabled: v })}>
                                                    <Select label="Transform" value={config.skew.method} options={SKEW_METHODS} onChange={(v) => setStep("skew", { method: v })} />
                                                    <NumberField label="Only fix columns more skewed than" hint="0.75 is a common cutoff. Skewness near 0 is balanced." value={config.skew.threshold} min={0} step={0.05} onChange={(v) => setStep("skew", { threshold: v })} />
                                                </StepCard>
                                            </div>
                                        </div>

                                        <div>
                                            <p className="mb-2 text-xs font-semibold text-[#adc9ae]">Prepare for models</p>
                                            <StepCard title="Turn text into numbers" description="Only needed if you train outside MlForge. Compare Models does this for you." enabled={config.encode.enabled} onToggle={(v) => setStep("encode", { enabled: v })}>
                                                <Select label="Encoding" value={config.encode.method} options={ENCODE_METHODS} onChange={(v) => setStep("encode", { method: v })} />
                                            </StepCard>
                                        </div>
                                    </div>
                                </Collapse>

                                <Collapse title="Protect more columns" badge={protectedCols.length ? `${protectedCols.length} protected` : undefined} open={showAdvanced} onToggle={() => setShowAdvanced((v) => !v)}>
                                    <p className="mb-3 text-xs text-gray-500">Protected columns are skipped by every step, such as IDs or dates you want untouched.</p>
                                    <div className="green-thin-scroll flex max-h-32 flex-wrap gap-2 overflow-y-auto">
                                        {profile.columns.map(({ name }) => {
                                            const isTarget = name === target;
                                            const on = isTarget || protectedCols.includes(name);
                                            return (
                                                <button key={name} type="button" aria-pressed={on} disabled={isTarget} onClick={() => toggleProtect(name)} className={`rounded border px-2 py-1 text-[11px] transition disabled:cursor-not-allowed ${on ? "border-red-400 bg-red-400/10 text-red-300" : "border-[#243724] bg-[#0e140e] text-gray-400 hover:border-[#618c61]"}`}>{name}</button>
                                            );
                                        })}
                                    </div>
                                </Collapse>
                            </div>

                            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
                                <button type="button" onClick={runCleaning} disabled={isRunning} className="flex-1 rounded-lg border border-green-400/60 bg-green-400/10 px-4 py-3 text-sm font-semibold text-white transition hover:border-green-300 hover:bg-green-300/20 disabled:cursor-not-allowed disabled:opacity-50">{isRunning ? "Cleaning..." : dirty ? "Clean again with these settings" : "Clean dataset"}</button>
                                <button type="button" onClick={resetAll} className="rounded-lg border border-[#243724] px-4 py-3 text-xs text-gray-400 transition hover:border-[#618c61] hover:text-[#d4e6d5]">Reset settings</button>
                            </div>
                        </section>
                    )}

                    {/* ---------------- Step 3: results ---------------- */}
                    {result && (
                        <section ref={resultsRef} className="scroll-mt-4 rounded-xl border border-[#243724] bg-[#0e140e]/80 p-5">
                            <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                                <StepHeader n="3" title="Review the result" sub={`${fmt(result.before.summary.rows)} rows → ${fmt(result.after.summary.rows)} rows, ${result.before.summary.cols} columns → ${result.after.summary.cols} columns`} />
                                <button type="button" onClick={downloadCsv} className="shrink-0 rounded-lg border border-blue-400 bg-blue-400/10 px-4 py-2 text-sm font-semibold text-[#d4e6d5] transition hover:bg-blue-500">Download cleaned CSV</button>
                            </div>

                            {dirty && <p className="mb-4 rounded-lg border border-[#d9b45a]/40 bg-[#d9b45a]/10 p-3 text-xs text-[#d9b45a]">You changed the settings after this run. Click "Clean again" above to update these results.</p>}

                            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                                {SUMMARY_FIELDS.map(({ key, label, neutral, tip }) => (
                                    <div key={key} title={tip} className="rounded-lg border border-[#243724] bg-[#101a10] p-4">
                                        <p className="text-xs text-gray-500">{label}</p>
                                        <p className="mt-2 truncate text-2xl font-bold text-[#adc9ae]">
                                            {fmt(result.before.summary[key])}
                                            <span className="text-base text-gray-500"> → {fmt(result.after.summary[key])}</span>
                                        </p>
                                        <div className="mt-1 h-4">{deltaCell(key, neutral)}</div>
                                    </div>
                                ))}
                            </div>

                            {result.log?.length > 0 && (
                                <div className="mt-4 rounded-lg border border-[#243724] bg-[#101a10] p-4">
                                    <p className="mb-2 text-xs font-semibold text-[#adc9ae]">What changed</p>
                                    <ul className="space-y-1 text-xs leading-5 text-gray-400">
                                        {result.log.map((line, i) => <li key={i} className="flex gap-2"><span className="text-[#7aa88a]">✓</span>{line}</li>)}
                                    </ul>
                                </div>
                            )}

                            <div className="mt-4 space-y-2">
                                <Collapse title="Charts: before vs after" open={showCharts} onToggle={() => setShowCharts((v) => !v)}>
                                    <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
                                        <label className="flex items-center gap-2 text-xs text-gray-400">
                                            Column
                                            <select value={selectedCol} onChange={(e) => setSelectedCol(e.target.value)} disabled={numericCols.length === 0} aria-label="Column to inspect" className={`${inputCls} w-48 disabled:opacity-50`}>
                                                {numericCols.length === 0 && <option value="">No numeric columns</option>}
                                                {numericCols.map(({ name }) => <option key={name} value={name}>{name}</option>)}
                                            </select>
                                        </label>
                                        <label className="flex items-center gap-2 text-xs text-gray-500">
                                            <input type="checkbox" checked={sharedScale} onChange={(e) => setSharedScale(e.target.checked)} />
                                            Same scale for both plots
                                        </label>
                                    </div>

                                    <div className="grid gap-4 lg:grid-cols-2">
                                        <div className="rounded-lg border border-[#243724] bg-[#0e140e] p-4">
                                            <p className="text-xs font-semibold text-[#adc9ae]">Boxplot</p>
                                            <p className="mb-2 text-[11px] text-gray-500">The box holds the middle half of the values. The white line is the median. Red dots are unusual values.</p>
                                            {!afterCol && <p className="mb-2 text-xs text-gray-500">This column was removed by the pipeline.</p>}
                                            <BoxPlot before={beforeCol} after={afterCol} shared={sharedScale} />
                                            {beforeCol && afterCol && (
                                                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-gray-500">
                                                    <p>Skew: <span style={{ color: skewColor(beforeCol.skew) }}>{fmt(beforeCol.skew)}</span> → <span style={{ color: skewColor(afterCol.skew) }}>{fmt(afterCol.skew)}</span></p>
                                                    <p>Mean: {fmt(beforeCol.mean)} → {fmt(afterCol.mean)}</p>
                                                    <p>Std: {fmt(beforeCol.std)} → {fmt(afterCol.std)}</p>
                                                    <p>Unusual values: {fmt(beforeCol.outlier_count)} → {fmt(afterCol.outlier_count)}</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="rounded-lg border border-[#243724] bg-[#0e140e] p-4">
                                            <p className="text-xs font-semibold text-[#adc9ae]">Histogram</p>
                                            <p className="mb-2 text-[11px] text-gray-500">Taller bars mean more values in that range. A balanced column looks like a hill.</p>
                                            <div className="grid grid-cols-2 gap-4">
                                                <Hist h={beforeCol?.hist} color={BEFORE_COLOR} title="Before" />
                                                {afterCol ? <Hist h={afterCol.hist} color={AFTER_COLOR} title="After" /> : <p className="self-center text-center text-xs text-gray-600">Column removed</p>}
                                            </div>
                                        </div>

                                        <div className="rounded-lg border border-[#243724] bg-[#0e140e] p-4 lg:col-span-2">
                                            <p className="mb-3 text-xs font-semibold text-[#adc9ae]">Skewness per column</p>
                                            <SkewChart before={result.before} after={result.after} />
                                        </div>
                                    </div>
                                </Collapse>

                                <Collapse title="Tables: missing values and preview" open={showTables} onToggle={() => setShowTables((v) => !v)}>
                                    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
                                        <div className="overflow-x-auto rounded-lg border border-[#243724]">
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-[#172617] text-xs text-[#adc9ae]">
                                                    <tr>
                                                        <th className="px-4 py-3 font-normal">Column</th>
                                                        <th className="px-4 py-3 text-right font-normal">Missing before</th>
                                                        <th className="px-4 py-3 text-right font-normal">After</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {missingRows.length === 0 && (
                                                        <tr className="border-t border-[#243724] bg-[#101a10]"><td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-500">No missing values found.</td></tr>
                                                    )}
                                                    {missingRows.map((r) => (
                                                        <tr key={r.name} className="border-t border-[#243724] bg-[#101a10] text-[#d4e6d5]">
                                                            <td className="px-4 py-3 font-semibold">{r.name}</td>
                                                            <td className="px-4 py-3 text-right text-gray-400">{r.before === null ? "--" : `${r.before} (${fmt(r.beforePct)}%)`}</td>
                                                            <td className="px-4 py-3 text-right text-gray-400">{r.after === null ? "dropped" : r.after}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="overflow-x-auto rounded-lg border border-[#243724]">
                                            <table className="w-full min-w-[480px] text-left text-xs">
                                                <thead className="bg-[#172617] text-[#adc9ae]">
                                                    <tr>{(result.preview?.columns || []).map((c) => <th key={c} className="whitespace-nowrap px-3 py-3 font-normal">{c}</th>)}</tr>
                                                </thead>
                                                <tbody>
                                                    {(result.preview?.rows || []).map((row, i) => (
                                                        <tr key={i} className="border-t border-[#243724] bg-[#101a10] text-[#d4e6d5]">
                                                            {row.map((cell, j) => <td key={j} className="whitespace-nowrap px-3 py-2 text-gray-400">{cell === null ? "--" : typeof cell === "number" ? fmt(cell) : String(cell)}</td>)}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    <p className="mt-2 text-[11px] text-gray-600">The preview shows the first 8 cleaned rows. Download the CSV for everything.</p>
                                </Collapse>
                            </div>
                        </section>
                    )}
                </div>
            </section>
        </div>
    );
}