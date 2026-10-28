import { useEffect, useRef, useState } from "react";
import api from "../api/api";
import { aiPanel } from "./aiPanelStore";
import ThemeButton from "./ThemeButton";

const METRIC_SETS = {
    classification: ["Accuracy", "Precision", "Recall", "F1 score"],
    regression: ["RMSE", "MAE", "R² score"],
};
const PRIMARY_METRIC = {
    classification: { key: "Accuracy", better: "higher" },
    regression: { key: "R² score", better: "higher" },
};
const SCALING_OPTIONS = [
    { value: "standard", label: "StandardScaler", description: "Centered around mean with unit variance" },
    { value: "minmax", label: "MinMaxScaler", description: "Maps values into a 0 to 1 range" },
    { value: "robust", label: "RobustScaler", description: "Less sensitive to outliers" },
    { value: "none", label: "No scaling", description: "Use the original feature ranges" },
];

/* ------------------------------------------------------------------ */
/*  Small UI pieces                                                    */
/* ------------------------------------------------------------------ */
const inputCls = "w-full rounded-lg border border-[#243724] bg-[#101a10] px-3 py-2 text-sm text-[#d4e6d5] placeholder:text-gray-600 focus:border-[#618c61] focus:outline-none";

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
export default function CompareModel({ onNavigate, theme = "forest", onSelectTheme }) {
    const fileInputRef = useRef(null);
    const resultsRef = useRef(null);
    const [fileName, setFileName] = useState("");
    const [file, setFile] = useState(null);
    const [dragging, setDragging] = useState(false);

    const [targetColumn, setTargetColumn] = useState("");
    const [taskType, setTaskType] = useState("classification");
    const [scalingTechnique, setScalingTechnique] = useState("standard");
    const [modelOptions, setModelOptions] = useState([]);
    const [selectedModels, setSelectedModels] = useState([]);

    const [isRunning, setIsRunning] = useState(false);
    const [results, setResults] = useState({});
    const [error, setError] = useState("");

    /* all sections start closed */
    const [showModels, setShowModels] = useState(false);
    const [showScaling, setShowScaling] = useState(false);
    const [showTable, setShowTable] = useState(false);

    const modelTask = Object.fromEntries(modelOptions.map((model) => [model.name, model.task]));
    const visibleModels = modelOptions.filter(({ task }) => task === taskType || task === "both");

    useEffect(() => {
        api.get("/models")
            .then(({ data }) => setModelOptions(data.models || []))
            .catch(() => setError("Could not load models"));
    }, []);

    const toggleModel = (modelName) => {
        setSelectedModels((current) => current.includes(modelName) ? current.filter((model) => model !== modelName) : [...current, modelName]);
    };

    const changeTaskType = (t) => {
        setTaskType(t);
        setResults({});
        setSelectedModels((current) => current.filter((name) => {
            const selectedTask = modelTask[name];
            return selectedTask === t || selectedTask === "both";
        }));
    };

    const handleFile = (selected) => {
        if (!selected) return;
        if (!/\.(csv|json|xlsx)$/i.test(selected.name)) { setError("Please choose a .csv, .json or .xlsx file."); return; }
        setFile(selected);
        setFileName(selected.name);
        setResults({});
        setError("");
        setShowTable(false);
    };

    const activeTaskSets = new Set(selectedModels.map((name) => {
        const t = modelTask[name];
        return t === "both" ? taskType : t;
    }));
    const displayMetrics = [...new Set([...activeTaskSets].flatMap((t) => METRIC_SETS[t] || []))];

    const canRun = !!file && selectedModels.length > 0 && !!targetColumn.trim() && !isRunning;
    const runHint = !file ? "Upload a dataset first." : !targetColumn.trim() ? "Enter the target column." : selectedModels.length === 0 ? "Open \"Models\" and pick at least one." : "";

    const runComparison = async () => {
        if (!canRun) return;

        setIsRunning(true);
        setError("");
        setShowTable(false);
        setResults(Object.fromEntries(selectedModels.map((m) => [m, { status: "running" }])));

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("target_column", targetColumn.trim());
            formData.append("task_type", taskType);
            formData.append("models", JSON.stringify(selectedModels));
            formData.append("scaling_technique", scalingTechnique);

            const { data } = await api.post("/train", formData);
            const nextResults = {};

            for (const name of selectedModels) {
                const entry = data.results?.[name];
                if (!entry) nextResults[name] = { status: "failed", error: "No result returned" };
                else if (entry.error) nextResults[name] = { status: "failed", error: entry.error };
                else nextResults[name] = { status: "done", metrics: entry.metrics, testSamples: entry.test_samples };
            }
            setResults(nextResults);
        } catch (err) {
            const msg = err.response?.data?.detail || err.message || "Something went wrong";
            setResults(Object.fromEntries(selectedModels.map((m) => [m, { status: "failed", error: msg }])));
        } finally {
            setIsRunning(false);
        }
    };

    const hasResults = selectedModels.some((m) => results[m]);

    useEffect(() => {
        if (!isRunning && hasResults) resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isRunning]);

    const statusBadge = (name) => {
        const entry = results[name];
        if (!entry) return { label: "Pending", className: "border-[#243724] text-gray-500" };
        if (entry.status === "running") return { label: "Running", className: "border-[#618c61] text-[#adc9ae]" };
        if (entry.status === "done") return { label: "Done", className: "border-[#7aa88a] text-[#d4e6d5] bg-[#172617]" };
        return { label: "Failed", className: "border-red-800 text-red-400" };
    };

    const getLeaderboardStats = () => {
        const primary = PRIMARY_METRIC[taskType];
        const doneEntries = selectedModels
            .map((name) => ({ name, entry: results[name] }))
            .filter(({ entry }) => entry?.status === "done" && entry.metrics?.[primary.key] !== undefined);
        const failedCount = selectedModels.filter((name) => results[name]?.status === "failed").length;
        if (doneEntries.length === 0) return { bestScore: "--", bestModel: "--", failedRuns: failedCount || "--", testSamples: "--" };
        const ranked = doneEntries.reduce((best, current) => {
            const currentValue = current.entry.metrics[primary.key];
            const bestValue = best.entry.metrics[primary.key];
            const currentIsBetter = primary.better === "higher" ? currentValue > bestValue : currentValue < bestValue;
            return currentIsBetter ? current : best;
        });
        return { bestScore: ranked.entry.metrics[primary.key], bestModel: ranked.name, failedRuns: failedCount, testSamples: ranked.entry.testSamples ?? "--" };
    };

    const { bestScore, bestModel, failedRuns, testSamples } = getLeaderboardStats();
    const cardValues = { "Best score": bestScore, "Best model": bestModel, "Failed runs": failedRuns, "Test samples": testSamples };
    const scalingInfo = SCALING_OPTIONS.find(({ value }) => value === scalingTechnique);
    const doneCount = selectedModels.filter((m) => results[m]?.status === "done").length;
    const [runStamp, setRunStamp] = useState(0);
    useEffect(() => { if (!isRunning && doneCount > 0) setRunStamp(Date.now()); }, [isRunning]); // eslint-disable-line react-hooks/exhaustive-deps

    const shareWithAI = async () => {
        let preview = "", rows = "?", cols = "?";
        if (/\.csv$/i.test(fileName) && file.size < 20 * 1024 * 1024) {
            const lines = (await file.text()).split(/\r?\n/).filter(Boolean);
            rows = Math.max(lines.length - 1, 0);
            cols = lines[0]?.split(",").length ?? "?";
            preview = lines.slice(0, 11).join("\n");
        }
        const modelLines = selectedModels.map((name) => {
            const e = results[name];
            if (e?.status === "done") return `- ${name}: ${Object.entries(e.metrics || {}).map(([k, v]) => `${k}=${v}`).join(", ")}`;
            if (e?.status === "failed") return `- ${name}: FAILED (${e.error})`;
            return `- ${name}: not run`;
        });
        const text = [
            "Page: Compare Models",
            `Dataset: ${fileName} (${rows} rows, ${cols} columns)`,
            `Task: ${taskType}; target column: ${targetColumn.trim()}; scaling: ${scalingInfo?.label}`,
            `Ranked by: ${PRIMARY_METRIC[taskType].key} (higher is better)`,
            `Best model: ${bestModel} (${bestScore}); test samples: ${testSamples}`,
            "Model results:", ...modelLines,
            preview && `CSV preview (header + first rows):\n${preview}`,
        ].filter(Boolean).join("\n").slice(0, 6000);

        aiPanel.openWithContext({
            id: `compare-${fileName}-${runStamp}`,
            title: `Compare: ${fileName}`,
            label: `Compare run · ${fileName}`,
            greeting: `I have your model comparison on ${fileName} (${doneCount} model${doneCount === 1 ? "" : "s"}). How can I help you with the model comparison?`,
            text,
        });
    };
    return (
        <div className="t-page page-no-overscroll min-h-screen overflow-x-clip overscroll-none px-4 py-4 font-mono md:px-8 scrollbar-thin scrollbar-thumb-[#7aa88a] scroll-smooth">
            <section className="mx-auto max-w-5xl">
                <header className="t-card-line mb-4 border-b pb-5">
                    <p className="t-accent mb-2 text-xs uppercase tracking-[0.3em]">MlForge</p>
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Compare Models</h1>
                            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-400">Upload a dataset, pick candidate models, then see which one fits best.</p>
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
                        <StepHeader n="1" title="Upload your dataset" sub="CSV, JSON or XLSX. It should already be cleaned, and include the column you want to predict." />
                        <button type="button" onClick={shareWithAI} disabled={isRunning || doneCount === 0}
                            className="mb-4 inline-flex items-center gap-2 rounded-lg border border-[#618c61] bg-[#172617] px-3 py-2 text-xs font-semibold text-[#d4e6d5] transition hover:bg-[#1f331f] disabled:cursor-not-allowed disabled:opacity-50">
                            ✦ Context AI
                        </button>
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
                        {error && <p role="alert" className="mt-3 rounded-lg border border-red-800 bg-red-900/10 p-3 text-xs text-red-400">{error}</p>}
                    </section>

                    {/* ---------------- Step 2: setup ---------------- */}
                    {file && (
                        <section className="rounded-xl border border-[#243724] bg-[#0e140e]/80 p-5">
                            <StepHeader n="2" title="Set up the comparison" sub="Choose the task and target, then open the sections below to pick models." />

                            <div className="grid grid-cols-2 gap-2 sm:max-w-md" role="radiogroup" aria-label="Task type">
                                {["classification", "regression"].map((t) => {
                                    const on = taskType === t;
                                    return (
                                        <button key={t} type="button" role="radio" aria-checked={on} onClick={() => changeTaskType(t)} className={`rounded-lg border px-3 py-2 text-sm capitalize transition ${on ? "border-[#7aa88a] bg-[#172617] text-[#d4e6d5]" : "border-[#243724] bg-[#101a10] text-gray-400 hover:border-[#618c61]"}`}>{t}</button>
                                    );
                                })}
                            </div>

                            <div className="mt-4">
                                <label className="block">
                                    <span className="mb-1 block text-xs font-semibold text-[#adc9ae]">Column you want to predict</span>
                                    <input type="text" value={targetColumn} onChange={(e) => setTargetColumn(e.target.value)} placeholder="e.g. price, label, class" className={`${inputCls} max-w-sm`} />
                                    <span className="mt-1 block text-[11px] text-gray-500">Must match a column name in your file exactly.</span>
                                </label>
                            </div>

                            <div className="mt-4 space-y-2">
                                <Collapse title="Models" badge={`${selectedModels.length} selected`} open={showModels} onToggle={() => setShowModels((v) => !v)}>
                                    <div className="green-thin-scroll max-h-72 space-y-2 overflow-y-auto pr-2">
                                        {visibleModels.map(({ name, description }) => {
                                            const selected = selectedModels.includes(name);
                                            return (
                                                <button key={name} type="button" aria-pressed={selected} onClick={() => toggleModel(name)} className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ${selected ? "border-[#618c61] bg-[#172617]" : "border-[#243724] bg-[#0e140e] hover:border-[#618c61]"}`}>
                                                    <span className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${selected ? "border-[#7aa88a] bg-[#618c61] text-white" : "border-[#618c61] text-transparent"}`}>+</span>
                                                    <span>
                                                        <span className="block text-sm font-semibold text-[#d4e6d5]">{name}</span>
                                                        <span className="mt-1 block text-xs leading-5 text-gray-500">{description}</span>
                                                    </span>
                                                </button>
                                            );
                                        })}
                                        {visibleModels.length === 0 && <p className="px-1 py-4 text-center text-xs text-gray-500">No models available for this task type.</p>}
                                    </div>
                                </Collapse>

                                <Collapse title="Feature scaling" badge={scalingInfo?.label} open={showScaling} onToggle={() => setShowScaling((v) => !v)}>
                                    <label htmlFor="scaling-technique" className="mb-1 block text-[11px] text-gray-400">Scaling method</label>
                                    <select id="scaling-technique" value={scalingTechnique} onChange={(e) => setScalingTechnique(e.target.value)} className={`${inputCls} max-w-sm`}>
                                        {SCALING_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                                    </select>
                                    <p className="mt-2 text-[11px] text-gray-500">{scalingInfo?.description}</p>
                                </Collapse>
                            </div>

                            <div className="mt-4 rounded-lg border border-[#243724] bg-[#101a10] p-4">
                                <p className="text-xs font-semibold text-[#adc9ae]">When you click Run, we will:</p>
                                <ul className="mt-2 space-y-1 text-xs leading-5 text-gray-400">
                                    <li className="flex gap-2"><span className="text-[#7aa88a]">✓</span>Train {selectedModels.length || "no"} {taskType} model{selectedModels.length === 1 ? "" : "s"}{targetColumn.trim() ? ` to predict "${targetColumn.trim()}"` : ""}</li>
                                    <li className="flex gap-2"><span className="text-[#7aa88a]">✓</span>Apply {scalingInfo?.label.toLowerCase()} to the features</li>
                                    <li className="flex gap-2"><span className="text-[#7aa88a]">✓</span>Score each model on held-out test data</li>
                                </ul>
                            </div>

                            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
                                <button type="button" onClick={runComparison} disabled={!canRun} className="flex-1 rounded-lg border border-green-400/60 bg-green-400/10 px-4 py-3 text-sm font-semibold text-white transition hover:border-green-300 hover:bg-green-300/20 disabled:cursor-not-allowed disabled:opacity-50">{isRunning ? "Running..." : hasResults ? "Run again" : "Run comparison"}</button>
                            </div>
                            {runHint && <p className="mt-2 text-[11px] text-gray-500">{runHint}</p>}
                        </section>
                    )}

                    {/* ---------------- Step 3: results ---------------- */}
                    {file && hasResults && (
                        <section ref={resultsRef} className="scroll-mt-4 rounded-xl border border-[#243724] bg-[#101a10] p-5">
                            <StepHeader n="3" title="Review the results" sub={isRunning ? "Training models..." : `${doneCount} of ${selectedModels.length} models finished`} />

                            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                                {["Best score", "Best model", "Failed runs", "Test samples"].map((label) => (
                                    <div key={label} className="rounded-lg border border-[#243724] bg-[#0e140e] p-4">
                                        <p className="text-xs text-gray-500">{label}</p>
                                        <p className="mt-2 truncate text-2xl font-bold text-[#adc9ae]">{cardValues[label]}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-4">
                                <Collapse title="Model metrics table" badge={`${selectedModels.length} models`} open={showTable} onToggle={() => setShowTable((v) => !v)}>
                                    <div className="overflow-x-auto rounded-lg border border-[#243724]">
                                        <table className="w-full min-w-[620px] text-left text-sm">
                                            <thead className="bg-[#172617] text-xs uppercase tracking-[0.12em] text-[#adc9ae]">
                                                <tr>
                                                    <th className="px-4 py-3 font-normal">Model</th>
                                                    {displayMetrics.map((metric) => <th key={metric} className="px-4 py-3 text-right font-normal">{metric}</th>)}
                                                    <th className="px-4 py-3 text-right font-normal">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedModels.map((name) => {
                                                    const entry = results[name];
                                                    const badge = statusBadge(name);
                                                    const selectedTask = modelTask[name] === "both" ? taskType : modelTask[name];
                                                    return (
                                                        <tr key={name} className="border-t border-[#243724] bg-[#101a10] text-[#d4e6d5]">
                                                            <td className="px-4 py-4 font-semibold">{name}</td>
                                                            {displayMetrics.map((metric) => {
                                                                const applies = METRIC_SETS[selectedTask]?.includes(metric);
                                                                const value = entry?.status === "done" ? entry.metrics?.[metric] : undefined;
                                                                return <td key={metric} className="px-4 py-4 text-right text-gray-500">{!applies ? "—" : value !== undefined ? value : "--"}</td>;
                                                            })}
                                                            <td className="px-4 py-4 text-right">
                                                                <span className={`rounded border px-2 py-1 text-[10px] ${badge.className}`}>{badge.label}</span>
                                                                {entry?.status === "failed" && entry.error && <p className="mt-1 max-w-[180px] truncate text-[10px] text-red-500" title={entry.error}>{entry.error}</p>}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    <p className="mt-2 text-[11px] text-gray-600">Metrics shown depend on task type. The best model is ranked by {PRIMARY_METRIC[taskType].key}.</p>
                                </Collapse>
                            </div>
                        </section>
                    )}
                </div>
            </section>
        </div>
    );
}