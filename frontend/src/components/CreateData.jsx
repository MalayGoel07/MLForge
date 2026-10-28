import { useEffect, useRef, useState } from "react";
import ThemeButton from "./ThemeButton";

const randomNormal = (mean = 0, std = 1) => {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return mean + z * std;
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));

const VALUE_TYPES = [
    { value: "decimal", label: "Decimal", hint: "Numbers with two decimal places, like 42.17." },
    { value: "integer", label: "Integer", hint: "Whole numbers, like 42." },
    { value: "categorical", label: "Categorical", hint: "Labels: low, medium or high. Regression targets are built from numeric features only, so they will be flat for this type." },
];

const TASK_TYPES = [
    { value: "regression", label: "Regression", hint: "The target is a number built from the average of the features, plus noise." },
    { value: "classification", label: "Classification", hint: "The target is a class label picked from the average of the features." },
];

const createRows = (rowCount, columnCount, dataType, missingRate, type, slope, constant, classLabels, noiseLevel) => {
    const rows = [];
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
        const features = [];
        for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
            if (Math.random() < missingRate / 100) {
                features.push("");
                continue;
            }
            if (dataType === "categorical") {
                const categories = ["low", "medium", "high"];
                features.push(categories[Math.floor(Math.random() * categories.length)]);
                continue;
            }
            if (dataType === "integer") {
                const baseValue = Math.floor(Math.random() * 100) + 1;
                const noise = randomNormal(0, noiseLevel);
                features.push(String(Math.max(0, Math.round(baseValue + noise))));
                continue;
            }
            const baseValue = Math.random() * 100;
            const noise = randomNormal(0, noiseLevel);
            features.push((baseValue + noise).toFixed(2));
        }

        let featureSum = 0;
        let validFeatureCount = 0;
        features.forEach((value) => {
            const numericValue = Number(value);
            if (value !== "" && !Number.isNaN(numericValue)) {
                featureSum += numericValue;
                validFeatureCount++;
            }
        });

        let target;
        if (type === "regression") {
            const averageFeature = validFeatureCount > 0 ? featureSum / validFeatureCount : 0;
            const targetNoise = randomNormal(0, noiseLevel);
            target = (slope * averageFeature + constant + targetNoise).toFixed(2);
        } else {
            const averageFeature = validFeatureCount > 0 ? featureSum / validFeatureCount : Math.random() * 100;
            let classIndex;
            if (classLabels.length === 2) {
                classIndex = averageFeature >= 50 ? 1 : 0;
            } else {
                const normalized = Math.max(0, Math.min(0.9999, averageFeature / 100));
                classIndex = Math.floor(normalized * classLabels.length);
            }
            if (Math.random() < noiseLevel / 100) {
                classIndex = Math.floor(Math.random() * classLabels.length);
            }
            target = classLabels[classIndex];
        }
        rows.push([...features, target]);
    }

    for (let i = rows.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rows[i], rows[j]] = [rows[j], rows[i]];
    }

    return rows;
};

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

function Slider({ label, value, onChange, hint }) {
    return (
        <label className="block text-[11px] text-gray-400">
            <span className="flex justify-between"><span>{label}</span><span className="text-[#adc9ae]">{value}%</span></span>
            <input type="range" min="0" max="30" value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-3 w-full accent-[#7aa88a]" />
            {hint && <span className="mt-1 block text-[10px] leading-4 text-gray-500">{hint}</span>}
        </label>
    );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function CreateData({ onNavigate, theme = "forest", onSelectTheme }) {
    const resultsRef = useRef(null);

    const [rowCount, setRowCount] = useState(12);
    const [columnCount, setColumnCount] = useState(4);
    const [dataType, setDataType] = useState("decimal");
    const [missingRate, setMissingRate] = useState(0);
    const [noiseLevel, setNoiseLevel] = useState(5);

    const [type, setType] = useState("regression");
    const [slope, setSlope] = useState(2);
    const [constant, setConstant] = useState(0);
    const [classCount, setClassCount] = useState(2);
    const [classLabels, setClassLabels] = useState("class_0, class_1");

    /* generated result, stored with the settings that made it */
    const [dataset, setDataset] = useState(null);
    const [ranKey, setRanKey] = useState("");

    /* all sections start closed */
    const [showShape, setShowShape] = useState(false);
    const [showMessiness, setShowMessiness] = useState(false);
    const [showTarget, setShowTarget] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    const settingsKey = JSON.stringify({ rowCount, columnCount, dataType, missingRate, noiseLevel, type, slope, constant, classCount, classLabels });
    const dirty = !!dataset && ranKey !== settingsKey;

    const buildLabels = () => {
        const labels = classLabels.split(",").map((label) => label.trim()).filter(Boolean).slice(0, classCount);
        while (labels.length < classCount) labels.push(`class_${labels.length}`);
        return labels;
    };

    const generateDataset = () => {
        const rows = clamp(rowCount, 1, 500);
        const cols = clamp(columnCount, 1, 12);
        const classes = clamp(classCount, 2, 10);
        const labels = buildLabels();

        /* write the clamped values back so the inputs match what was built */
        setRowCount(rows);
        setColumnCount(cols);
        setClassCount(classes);
        setClassLabels(labels.join(", "));

        const nextKey = JSON.stringify({ rowCount: rows, columnCount: cols, dataType, missingRate, noiseLevel, type, slope, constant, classCount: classes, classLabels: labels.join(", ") });
        const data = createRows(rows, cols, dataType, missingRate, type, slope, constant, labels, noiseLevel);
        setDataset({
            rows: data,
            headers: [...Array.from({ length: cols }, (_, i) => `feature_${i + 1}`), "target"],
            dataType,
            type,
        });
        setRanKey(nextKey);
        setShowPreview(false);
    };

    useEffect(() => {
        if (dataset) resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, [dataset]);

    const downloadDataset = () => {
        if (!dataset) return;
        const csv = [dataset.headers, ...dataset.rows].map((row) => row.join(",")).join("\n");
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        link.download = "mlforge-dataset.csv";
        link.click();
        URL.revokeObjectURL(link.href);
    };

    /* derived */
    const missingValues = dataset ? dataset.rows.flat().filter((value) => value === "").length : 0;
    const cards = dataset
        ? [["Rows", dataset.rows.length], ["Columns", dataset.headers.length], ["Missing values", missingValues], ["Value type", dataset.dataType]]
        : [];

    const plan = [
        `Create ${rowCount} rows with ${columnCount} ${dataType} feature columns and a target`,
        type === "regression"
            ? `Make the target a number: ${slope} × average feature + ${constant}`
            : `Make the target one of ${classCount} classes (${buildLabels().join(", ")})`,
        missingRate > 0 ? `Leave about ${missingRate}% of feature cells empty` : "Leave no feature cells empty",
        `Add ${noiseLevel}% noise`,
    ];

    return (
        <div className="t-page page-no-overscroll min-h-screen overflow-x-clip overscroll-none px-4 py-4 font-mono md:px-8 scrollbar-thin scrollbar-thumb-[#7aa88a] scroll-smooth">
            <section className="mx-auto max-w-5xl">
                <header className="t-card-line mb-4 border-b pb-5">
                    <p className="t-accent mb-2 text-xs uppercase tracking-[0.3em]">MlForge</p>
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Data Creator</h1>
                            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-400">Describe the dataset you want, generate it, then download it for testing.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <ThemeButton theme={theme} onSelect={onSelectTheme} />
                            <button onClick={() => onNavigate("/home")} className="no-underline rounded-lg border border-red-600 bg-red-600/10 px-4 py-2 text-sm text-red-300 transition hover:bg-red-600/30">Back</button>
                        </div>
                    </div>
                </header>

                <div className="flex flex-col gap-5">
                    {/* ---------------- Step 1: configure ---------------- */}
                    <section className="rounded-xl border border-[#243724] bg-[#0e140e]/80 p-5 shadow-2xl shadow-[#172617]/20">
                        <StepHeader n="1" title="Describe your dataset" sub="Open any section to change it. The defaults already work." />

                        <div className="space-y-2">
                            <Collapse title="Shape and values" badge={`${rowCount} × ${columnCount}, ${dataType}`} open={showShape} onToggle={() => setShowShape((v) => !v)}>
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <NumberField label="Rows" value={rowCount} min={1} max={500} hint="1 to 500." onChange={setRowCount} />
                                    <NumberField label="Feature columns" value={columnCount} min={1} max={12} hint="1 to 12. A target column is added." onChange={setColumnCount} />
                                    <Select label="Value type" value={dataType} options={VALUE_TYPES} onChange={setDataType} />
                                </div>
                            </Collapse>

                            <Collapse title="Messiness" badge={`${missingRate}% missing, ${noiseLevel}% noise`} open={showMessiness} onToggle={() => setShowMessiness((v) => !v)}>
                                <div className="grid gap-5 sm:grid-cols-2">
                                    <Slider label="Missing values" value={missingRate} onChange={setMissingRate} hint="Share of feature cells left empty. Good for testing the cleaner." />
                                    <Slider label="Noise" value={noiseLevel} onChange={setNoiseLevel} hint="Higher noise makes patterns harder to learn." />
                                </div>
                            </Collapse>

                            <Collapse title="Target behavior" badge={type} open={showTarget} onToggle={() => setShowTarget((v) => !v)}>
                                <div className="space-y-4">
                                    <div className="max-w-sm">
                                        <Select label="Task type" value={type} options={TASK_TYPES} onChange={setType} />
                                    </div>
                                    {type === "regression" && (
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <NumberField label="Slope" value={slope} step={0.1} hint="How strongly the target follows the features." onChange={setSlope} />
                                            <NumberField label="Constant" value={constant} step={0.1} hint="A fixed amount added to every target." onChange={setConstant} />
                                        </div>
                                    )}
                                    {type === "classification" && (
                                        <div className="grid gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                                            <NumberField label="Number of classes" value={classCount} min={2} max={10} hint="2 to 10." onChange={(v) => setClassCount(clamp(v, 2, 10))} />
                                            <label className="block">
                                                <span className="mb-1 block text-[11px] text-gray-400">Class labels (comma separated)</span>
                                                <input type="text" value={classLabels} onChange={(e) => setClassLabels(e.target.value)} placeholder="class_0, class_1" className={inputCls} />
                                                <span className="mt-1 block text-[10px] leading-4 text-gray-500">Missing labels are filled in as class_N.</span>
                                            </label>
                                        </div>
                                    )}
                                </div>
                            </Collapse>
                        </div>

                        <div className="mt-4 rounded-lg border border-[#243724] bg-[#101a10] p-4">
                            <p className="text-xs font-semibold text-[#adc9ae]">When you click Generate, we will:</p>
                            <ul className="mt-2 space-y-1 text-xs leading-5 text-gray-400">
                                {plan.map((t) => <li key={t} className="flex gap-2"><span className="text-[#7aa88a]">✓</span>{t}</li>)}
                            </ul>
                            {dataType === "categorical" && type === "regression" && (
                                <p className="mt-3 text-[11px] leading-5 text-[#d9b45a]">Categorical features have no numeric average, so the regression target will only be the constant plus noise.</p>
                            )}
                        </div>

                        <button type="button" onClick={generateDataset} className="mt-5 w-full rounded-lg border border-green-400/60 bg-green-400/10 px-4 py-3 text-sm font-semibold text-white transition hover:border-green-300 hover:bg-green-300/20">{dataset ? (dirty ? "Generate again with these settings" : "Generate a fresh dataset") : "Generate dataset"}</button>
                    </section>

                    {/* ---------------- Step 2: overview ---------------- */}
                    {dataset && (
                        <section ref={resultsRef} className="scroll-mt-4 rounded-xl border border-[#243724] bg-[#101a10] p-5 shadow-2xl shadow-[#172617]/10">
                            <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                                <StepHeader n="2" title="Dataset overview" sub={`${dataset.rows.length} rows, ${dataset.headers.length} columns, ${dataset.type} features, ${dataset.type === "categorical" ? "" : ""}${taskInfoLabel(dataset.type, type)}`} />
                                <button type="button" onClick={downloadDataset} className="shrink-0 rounded-lg border border-blue-400 bg-blue-400/10 px-4 py-2 text-sm font-semibold text-[#d4e6d5] transition hover:bg-blue-500">Download CSV</button>
                            </div>

                            {dirty && <p className="mb-4 rounded-lg border border-[#d9b45a]/40 bg-[#d9b45a]/10 p-3 text-xs text-[#d9b45a]">You changed the settings after this run. Click "Generate again" above to update this dataset.</p>}

                            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                                {cards.map(([label, value]) => (
                                    <div key={label} className="rounded-lg border border-[#243724] bg-[#0e140e] p-4">
                                        <p className="text-xs text-gray-500">{label}</p>
                                        <p className="mt-2 truncate text-2xl font-bold capitalize text-[#adc9ae]">{value}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-4">
                                <Collapse title="Preview rows" badge={`first ${Math.min(dataset.rows.length, 8)} of ${dataset.rows.length}`} open={showPreview} onToggle={() => setShowPreview((v) => !v)}>
                                    <div className="overflow-x-auto rounded-lg border border-[#243724] bg-[#070a07]">
                                        <table className="w-full min-w-[520px] text-left text-sm">
                                            <thead className="bg-[#101a10] text-xs uppercase tracking-widest text-[#adc9ae]">
                                                <tr>{dataset.headers.map((header) => <th key={header} className="px-4 py-3 font-normal">{header}</th>)}</tr>
                                            </thead>
                                            <tbody>
                                                {dataset.rows.slice(0, 8).map((row, rowIndex) => (
                                                    <tr key={rowIndex} className="border-t border-[#243724] hover:bg-[#0e140e]">
                                                        {row.map((value, columnIndex) => (
                                                            <td key={`${rowIndex}-${columnIndex}`} className={`px-4 py-3 ${value === "" ? "text-[#7aa88a]" : "text-gray-300"}`}>{value === "" ? "null" : value}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <p className="mt-2 text-[11px] text-gray-600">Rows are shuffled. Download the CSV for everything.</p>
                                </Collapse>
                            </div>
                        </section>
                    )}
                </div>
            </section>
        </div>
    );
}

function taskInfoLabel(_dataType, type) {
    return type === "regression" ? "regression target" : "classification target";
}