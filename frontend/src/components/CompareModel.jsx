import { useEffect, useRef, useState } from "react";
import api from "../api/api";
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

export default function CompareModel({ onNavigate, theme = "forest", onSelectTheme }) {
    const fileInputRef = useRef(null);
    const [fileName, setFileName] = useState("");
    const [file, setFile] = useState(null);

    const [targetColumn, setTargetColumn] = useState("");
    const [taskType, setTaskType] = useState("classification");
    const [scalingTechnique, setScalingTechnique] = useState("standard");
    const [modelOptions, setModelOptions] = useState([]);
    const [selectedModels, setSelectedModels] = useState([]);

    const [isRunning, setIsRunning] = useState(false);
    const [results, setResults] = useState({});

    const modelTask = Object.fromEntries(modelOptions.map((model) => [model.name, model.task]));
    const visibleModels = modelOptions.filter(({ task }) => task === taskType || task === "both");

    useEffect(() => {api.get("/models").then(({ data }) => setModelOptions(data.models || [])).catch(() => setResults({ error: "Could not load models" }));}, []);

    const toggleModel = (modelName) => {setSelectedModels((current) => current.includes(modelName) ? current.filter((model) => model !== modelName) : [...current, modelName]);};

    const changeTaskType = (t) => {
        setTaskType(t);
        setSelectedModels((current) => current.filter((name) => {
            const selectedTask = modelTask[name];
            return selectedTask === t || selectedTask === "both";
        }));
    };

    const handleFileChange = (event) => {
        const selected = event.target.files[0];
        setFile(selected || null);
        setFileName(selected?.name || "");
        setResults({});
    };

    const activeTaskSets = new Set(selectedModels.map((name) => {
        const t = modelTask[name];
        return t === "both" ? taskType : t;
    }));
    const activeMetrics = [...activeTaskSets].flatMap((t) => METRIC_SETS[t]);
    const displayMetrics = [...new Set(activeMetrics)];
    const needsTarget = selectedModels.length > 0;

    const runComparison = async () => {
        if (!file) return;
        if (needsTarget && !targetColumn.trim()) {return;}
        if (selectedModels.length === 0) return;

        setIsRunning(true);
        setResults(Object.fromEntries(selectedModels.map((m) => [m, { status: "running" }])));

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("target_column", targetColumn);
            formData.append("task_type", taskType);
            formData.append("models", JSON.stringify(selectedModels));
            formData.append("scaling_technique", scalingTechnique);

            const { data } = await api.post("/train", formData);
            const nextResults = {};

            for (const name of selectedModels) {
                const entry = data.results?.[name];
                if (!entry) {nextResults[name] = { status: "failed", error: "No result returned" };} 
                else if (entry.error) {nextResults[name] = { status: "failed", error: entry.error };} 
                else {nextResults[name] = { status: "done", metrics: entry.metrics, testSamples: entry.test_samples };}
            }
            setResults(nextResults);
        } catch (err) {
            setResults(Object.fromEntries(selectedModels.map((m) => [m, { status: "failed", error: err.message }])));
        } finally {
            setIsRunning(false);
        }
    };

    const statusBadge = (name) => {
        const entry = results[name];
        if (!entry) return { label: "Pending", className: "border-[#243724] text-gray-500" };
        if (entry.status === "running") return { label: "Running", className: "border-[#618c61] text-[#adc9ae]" };
        if (entry.status === "done") return { label: "Done", className: "border-[#7aa88a] text-[#d4e6d5] bg-[#172617]" };
        return { label: "Failed", className: "border-red-800 text-red-400" };
    };

    const getLeaderboardStats = () => {
        const primary = PRIMARY_METRIC[taskType];
        const doneEntries = selectedModels .map((name) => ({ name, entry: results[name] })).filter(({ entry }) => entry?.status === "done" && entry.metrics?.[primary.key] !== undefined);
        const failedCount = selectedModels.filter((name) => results[name]?.status === "failed").length;
        if (doneEntries.length === 0) {return { bestScore: "--", bestModel: "--", failedRuns: failedCount || "--", testSamples: "--" };}
        const ranked = doneEntries.reduce((best, current) => {
            const currentValue = current.entry.metrics[primary.key];
            const bestValue = best.entry.metrics[primary.key];
            const currentIsBetter = primary.better === "higher" ? currentValue > bestValue : currentValue < bestValue;
            return currentIsBetter ? current : best;
        });
        return {bestScore: ranked.entry.metrics[primary.key],bestModel: ranked.name,failedRuns: failedCount,testSamples: ranked.entry.testSamples ?? "--",};
    };

    const { bestScore, bestModel, failedRuns, testSamples } = getLeaderboardStats();
    const cardValues = { "Best score": bestScore, "Best model": bestModel, "Failed runs": failedRuns, "Test samples": testSamples };

    return (
        <div className="t-page page-no-overscroll min-h-screen overflow-x-clip overscroll-none px-4 py-4 font-mono md:px-8 scrollbar-thin scrollbar-thumb-[#7aa88a] scroll-smooth">
            <section className="mx-auto max-w-7xl">
                <header className="t-card-line mb-4 border-b pb-5">
                    <p className="t-accent mb-2 text-xs uppercase tracking-[0.3em]">MlForge</p>
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Compare Models</h1>
                            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-400">Evaluate candidate models side by side and find the strongest fit for your dataset.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <ThemeButton theme={theme} onSelect={onSelectTheme} />
                            <button onClick={() => onNavigate("/home")} className="no-underline rounded-lg border border-red-600 bg-red-600/10 px-4 py-2 text-sm text-red-300 transition hover:bg-red-600/30">Back</button>
                        </div>
                    </div>
                </header>

                <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                    <section className="rounded-xl border border-[#243724] bg-[#0e140e]/80 p-5 shadow-2xl shadow-[#172617]/20">
                        <div className="mb-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-[#adc9ae]">01 / Setup</p>
                            <h2 className="mt-1 text-lg font-bold">Choose your models</h2>
                        </div>

                        <div className="mb-4 flex gap-2">
                            {["classification", "regression"].map((t) => (
                                <button key={t} type="button" onClick={() => changeTaskType(t)} className={`flex-1 rounded-lg border px-3 py-2 text-xs capitalize transition ${taskType === t ? "border-blue-400 bg-blue-400/10 text-white hover:bg-blue-500" : "border-[#243724] bg-[#101a10] text-gray-400 hover:border-green-400 hover:bg-green-400/10"}`}>{t}</button>
                            ))}
                        </div>

                        <div className="green-thin-scroll max-h-58 space-y-2 overflow-y-auto pr-2">
                            {visibleModels.map(({ name, description }) => {
                                const selected = selectedModels.includes(name);
                                return (
                                    <button key={name} type="button" aria-pressed={selected} onClick={() => toggleModel(name)} className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ${selected ? "border-[#618c61] bg-[#172617]" : "border-[#243724] bg-[#101a10] hover:border-[#618c61]"}`}>
                                        <span className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${selected ? "border-[#7aa88a] bg-[#618c61] text-white" : "border-[#618c61] text-transparent"}`}>+</span>
                                        <span>
                                            <span className="block text-sm font-semibold text-[#d4e6d5]">{name}</span>
                                            <span className="mt-1 block text-xs leading-5 text-gray-500">{description}</span>
                                        </span>
                                    </button>
                                );
                            })}
                            {visibleModels.length === 0 && (<p className="px-1 py-4 text-center text-xs text-gray-500">No models available for this task type.</p>)}
                        </div>

                        <div className="mt-5 border-t border-green-200 pt-4">
                            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-[#adc9ae]">Target column</p>
                            <input type="text" value={targetColumn} onChange={(e) => setTargetColumn(e.target.value)} placeholder="e.g. price, label, class" disabled={!needsTarget} className="w-full rounded-lg border border-[#243724] bg-[#101a10] px-3 py-2 text-sm text-[#d4e6d5] placeholder:text-gray-600 focus:border-[#618c61] focus:outline-none disabled:opacity-50" />
                        </div>

                        <div className="mt-5 border-t border-[#243724] pt-4">
                            <label htmlFor="scaling-technique" className="mb-2 block text-xs uppercase tracking-[0.2em] text-[#adc9ae]">Feature scaling</label>
                            <select id="scaling-technique" value={scalingTechnique} onChange={(event) => setScalingTechnique(event.target.value)} className="w-full rounded-lg border border-purple-400 bg-purple-400/10 px-3 py-2 text-sm text-grey-200 focus:bg-purple-400/30 focus:outline-none">
                                {SCALING_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                            </select>
                            <p className="mt-2 text-xs text-gray-500">{SCALING_OPTIONS.find(({ value }) => value === scalingTechnique)?.description}</p>
                        </div>

                        <div className="mt-5 border-t border-[#243724] pt-4">
                            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-[#adc9ae]">Dataset</p>
                            <input ref={fileInputRef} type="file" accept=".csv,.json,.xlsx" className="hidden" onChange={handleFileChange} />
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full rounded-lg border border-red-400 bg-red-400/10 px-4 py-2 text-sm text-[#d4e6d5] transition hover:bg-red-400 hover:border-red-500 hover:text-white">Upload dataset</button>
                            <p className="mt-2 truncate text-xs text-gray-500">{fileName || "No dataset selected"}</p>
                        </div>
                    </section>

                    <section className="rounded-xl border border-[#243724] bg-[#101a10] p-5">
                        <div className="mb-5 flex flex-col justify-between gap-2 md:flex-row md:items-end">
                            <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-[#adc9ae]">02 / Leaderboard</p>
                                <h2 className="mt-1 text-lg font-bold">Performance snapshot</h2>
                            </div>
                            <span className="text-xs text-gray-500">{selectedModels.length} models selected</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {["Best score", "Best model", "Failed runs", "Test samples"].map((label) => (
                                <div key={label} className="rounded-lg border border-[#243724] bg-[#0e140e] p-4">
                                    <p className="text-xs text-gray-500">{label}</p>
                                    <p className="mt-2 text-2xl font-bold text-[#adc9ae] truncate">{cardValues[label]}</p>
                                </div>
                            ))}
                        </div>

                        <button type="button" onClick={runComparison} disabled={isRunning || selectedModels.length === 0} className="mt-4 w-full rounded-lg border border-green-400/40 hover:bg-green-300/10 hover:border-green-300 px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50">{isRunning ? "Running..." : "Run comparison"}</button>
                    </section>
                </div>

                <section className="mt-5 rounded-xl border border-[#243724] bg-[#0e140e]/80 p-5">
                    <div className="mb-5 flex flex-col justify-between gap-2 md:flex-row md:items-end">
                        <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-[#adc9ae]">03 / Results</p>
                            <h2 className="mt-1 text-lg font-bold">Model metrics</h2>
                        </div>
                        <p className="text-xs text-gray-500">
                            {Object.keys(results).length === 0 ? "Results will appear after comparison" : "Metrics shown depend on task type"}
                        </p>
                    </div>
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
                                {selectedModels.length === 0 && (
                                    <tr className="border-t border-[#243724] bg-[#101a10]">
                                        <td colSpan={displayMetrics.length + 2} className="px-4 py-8 text-center text-sm text-gray-500">Select at least one model to populate the metrics table.</td>
                                    </tr>
                                )}
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
                                                return (
                                                    <td key={metric} className="px-4 py-4 text-right text-gray-500">{!applies ? "—" : value !== undefined ? value : "--"}</td>
                                                );
                                            })}
                                            <td className="px-4 py-4 text-right">
                                                <span className={`rounded border px-2 py-1 text-[10px] ${badge.className}`}>{badge.label}</span>
                                                {entry?.status === "failed" && entry.error && (<p className="mt-1 max-w-[180px] truncate text-[10px] text-red-500" title={entry.error}>{entry.error}</p>)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            </section>
        </div>
    );
}