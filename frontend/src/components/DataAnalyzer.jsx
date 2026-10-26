import { useRef, useState } from "react";
import api from "../api/api";
import ThemeButton from "./ThemeButton";

export default function DataAnalyzer({ onNavigate, theme = "forest", onSelectTheme }) {
    const fileInputRef = useRef(null);
    const [fileName, setFileName] = useState("");
    const [file, setFile] = useState(null);
    const [input, setInput] = useState("");
    const [analysis, setAnalysis] = useState(null);
    const [error, setError] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const handleFileChange = (event) => {
        const selected = event.target.files[0] || null;
        setFile(selected); setFileName(selected?.name || ""); setAnalysis(null); setError("");
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
        } catch (err) {
            setAnalysis(null); setError(err.message);
        } finally {setIsAnalyzing(false);}
    };

    return (
        <div className="t-page page-no-overscroll min-h-screen overflow-x-clip overscroll-none px-4 py-4 font-mono md:px-8 scrollbar-thin scrollbar-thumb-[#7aa88a] scroll-smooth">
            <section className="mx-auto max-w-5xl">
                <header className="t-card-line mb-4 border-b pb-5">
                    <p className="t-accent mb-2 text-xs uppercase tracking-[0.3em]">MlForge</p>
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Data Analyzer</h1>
                            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-400">Inspect your dataset, find its shape, and surface patterns worth exploring.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <ThemeButton theme={theme} onSelect={onSelectTheme} />
                            <button onClick={() => onNavigate("/home")} className="no-underline rounded-lg border border-red-600 bg-red-600/10 px-4 py-2 text-sm text-red-300 transition hover:bg-red-600/30">Back</button>
                        </div>
                    </div>
                </header>

                <div className="flex flex-col gap-4">
                    <div className="rounded-xl border border-[#243724] bg-[#0e140e]/80 p-5 shadow-2xl shadow-[#172617]/20">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-[#adc9ae]">01 / Input</p>
                                <h2 className="mt-1 text-lg font-bold">Bring in your data</h2>
                            </div>
                            <span className="rounded border border-pruple-600 bg-purple-500/10 px-2 py-1 text-[10px] text-gray-400">CSV / JSON</span>
                        </div>

                        <textarea
                            value={input}
                            onChange={(event) => {setInput(event.target.value);setFile(null);setFileName("");setAnalysis(null);setError("");}}
                            className="h-64 w-full resize-none rounded-lg border border-[#243724] bg-[#070a07] p-4 text-sm leading-6 text-[#d4e6d5] outline-none transition placeholder:text-gray-600 focus:border-[#7aa88a]"
                            placeholder="Paste rows or JSON here..."
                            aria-label="Dataset input"
                        />
                        <input ref={fileInputRef} type="file" accept=".csv,.json,.xlsx" className="hidden" onChange={handleFileChange} />
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <button
                                type="button"
                                className="rounded-lg border border-[#618c61] bg-[#172617] px-4 py-2 text-sm text-[#d4e6d5] transition hover:bg-[#1f331f] hover:text-white"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                Upload file
                            </button>
                            <span className="truncate text-xs text-gray-500">{fileName || "No file selected"}</span>
                            <button type="button" onClick={runAnalyzer} disabled={isAnalyzing} className="rounded-lg bg-red-400/10 px-4 py-2 border border-red-500 text-sm font-semibold text-white transition hover:bg-red-400/30 disabled:cursor-not-allowed disabled:opacity-50">
                                {isAnalyzing ? "Analyzing..." : "Analyze dataset"}
                            </button>
                        </div>
                        {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
                    </div>

                    <div className="flex flex-col gap-5 rounded-xl border border-[#243724] bg-[#101a10] p-5 shadow-2xl shadow-[#172617]/10">
                        <div className="flex flex-col gap-1 border-b border-[#243724] pb-4 sm:flex-row sm:items-end sm:justify-between">
                            <p className="text-xs uppercase tracking-[0.2em] text-[#adc9ae]">02 / Snapshot</p>
                            <h2 className="mt-1 text-lg font-bold">Dataset overview</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                            {[
                                ["No. of Rows", analysis?.rows ?? "--"],
                                ["No. of Columns", analysis?.columns ?? "--"],
                                ["Missing values", analysis?.missing ?? "--"],
                                ["No. of Duplicate rows", analysis?.dup_rows ?? "--"],
                            ].map(([label, value]) => (
                                <div key={label} className="rounded-lg border border-[#243724] bg-[#0e140e] p-4 transition-colors hover:border-[#618c61] hover:bg-[#101a10]">
                                    <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
                                    <p className="mt-2 text-2xl font-bold tabular-nums text-[#adc9ae]">{value}</p>
                                </div>
                            ))}
                        </div>
                        {analysis && 
                        <div className="rounded-lg border border-[#243724] bg-[#0e140e] p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.18em] text-[#adc9ae]">Schema</p>
                                    <h3 className="mt-1 font-semibold text-white">Columns and data types</h3>
                                </div>
                                <span className="rounded-full border border-[#243724] px-2.5 py-1 text-[10px] text-gray-500">{analysis.types.length} fields</span>
                            </div>
                            <div className="mt-4 grid gap-2 sm:grid-cols-2">{analysis.types.map(({ name, type }) => <div key={name} className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-[#243724] bg-[#101a10] px-3 py-2 text-sm"><span className="truncate text-[#d4e6d5]">{name}</span><span className="shrink-0 rounded bg-[#172617] px-2 py-1 text-xs text-[#adc9ae]">{type}</span></div>)}</div>
                        </div>
                        }
                        {analysis?.stats && (
                            <div className="rounded-lg border border-[#243724] bg-[#0e140e] p-4">
                                <div className="mb-5 border-b border-[#243724] pb-4">
                                    <p className="text-xs uppercase tracking-[0.2em] text-[#adc9ae]">Statistics</p>             
                                    <h2 className="mt-1 text-lg font-bold"> Numerical statistics </h2>
                                </div>                 
                                <div className="grid gap-3 xl:grid-cols-2">
                                    {Object.entries(analysis.stats).map(([column, stat]) => (
                                        <div key={column} className="rounded-lg border border-[#243724] bg-[#101a10] p-4">
                                        <h3 className="mb-4 truncate border-l-2 border-[#7aa88a] pl-3 font-semibold text-[#d4e6d5]">{column}</h3>
                                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                    <div>
                                      <p className="text-xs text-gray-500">Count</p>
                                      <p className="mt-1 font-semibold">{stat.count}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Mean</p>
                                      <p className="mt-1 font-semibold">{stat.mean}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Median</p>
                                      <p className="mt-1 font-semibold">{stat.median}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Std</p>
                                      <p className="mt-1 font-semibold">{stat.std}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Min</p>
                                      <p className="mt-1 font-semibold">{stat.min}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Q1</p>
                                      <p className="mt-1 font-semibold">{stat.q1}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Q3</p>
                                      <p className="mt-1 font-semibold">{stat.q3}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Max</p>
                                      <p className="mt-1 font-semibold">{stat.max}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Skewness</p>
                                      <p className="mt-1 font-semibold">{stat.skewness}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">IQR</p>
                                      <p className="mt-1 font-semibold">{stat.iqr}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {analysis?.outliers && (
                            <div className="rounded-lg border border-[#243724] bg-[#0e140e] p-4">
                                <div className="mb-5 border-b border-[#243724] pb-4">
                                    <p className="text-xs uppercase tracking-[0.2em] text-[#adc9ae]">Outliers</p>             
                                    <h2 className="mt-1 text-lg font-bold"> Outlier Analysis </h2>
                                </div>               
                                <div className="grid gap-3 xl:grid-cols-2">
                                    {Object.entries(analysis.outliers).map(([column, outliers]) => (
                                        <div key={column} className="rounded-lg border border-[#243724] bg-[#101a10] p-4">
                                        <h3 className="mb-4 truncate border-l-2 border-[#7aa88a] pl-3 font-semibold text-[#d4e6d5]">{column}</h3>
                                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    <div>
                                      <p className="text-xs text-gray-500">Count</p>
                                      <p className="mt-1 font-semibold">{outliers.count}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Percentage</p>
                                      <p className="mt-1 font-semibold">{outliers.percentage}%</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Lower Bound</p>
                                      <p className="mt-1 font-semibold">{outliers.lower_bound}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Upper Bound</p>
                                      <p className="mt-1 font-semibold">{outliers.upper_bound}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                </div>

                <section className="mt-5 rounded-xl border border-[#243724] bg-[#0e140e]/80 p-5">
                    <div className="mb-5 flex flex-col justify-between gap-2 md:flex-row md:items-end">
                        <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-[#adc9ae]">03 / Explore</p>
                            <h2 className="mt-1 text-lg font-bold">Patterns and visualizations</h2>
                        </div>
                        <p className="text-xs text-gray-500">{analysis?.charts?.length || 0} relationship charts</p>
                    </div>
                    {analysis?.charts?.length ? (
                        <div className="grid gap-4 md:grid-cols-2">
                            {analysis.charts.map(({ title, image }) => (
                                <figure key={title} className="overflow-hidden rounded-lg border border-[#243724] bg-[#101a10] p-3">
                                    <img src={`data:image/png;base64,${image}`} alt={title} className="h-auto w-full rounded bg-white" />
                                    <figcaption className="px-1 pt-3 text-sm text-[#d4e6d5]">{title}</figcaption>
                                </figure>
                            ))}
                        </div>
                    ) : (
                        <p className="rounded-lg border border-dashed border-[#243724] p-6 text-sm text-gray-500">Analyze data with at least two related columns to generate relationship charts.</p>
                    )}
                </section>
            </section>
        </div>
    );
}