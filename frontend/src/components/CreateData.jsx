import { useState } from "react";
import ThemeButton from "./ThemeButton";

const randomNormal = (mean = 0, std = 1) => {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return mean + z * std;
};


const createRows = (rowCount,columnCount,dataType,missingRate,type,slope,constant,classLabels,noiseLevel) => {
    const rows = [];
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
        const features = [];
        for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
            if (Math.random() < missingRate / 100) {
                features.push("");
                continue;
            }
            if (dataType === "categorical") {
                const categories = ["low","medium","high"];
                features.push(categories[Math.floor(Math.random() * categories.length)]);
                continue;
            }

            if (dataType === "integer") {
                const baseValue =Math.floor(Math.random() * 100) + 1;
                const noise =randomNormal(0, noiseLevel);
                features.push(String(Math.max( 0,Math.round(baseValue + noise))));
                continue;
            }
            const baseValue =Math.random() * 100;
            const noise =randomNormal(0, noiseLevel);
            features.push((baseValue + noise).toFixed(2));
        }

        let target;

        if (type === "regression") {
            let featureSum = 0;
            let validFeatureCount = 0;
            features.forEach((value) => {
                const numericValue = Number(value);
                if (value !== "" && !Number.isNaN(numericValue)) {
                    featureSum += numericValue;
                    validFeatureCount++;
                }
            });
            const averageFeature =validFeatureCount > 0? featureSum / validFeatureCount: 0;
            const targetNoise =randomNormal(0, noiseLevel);
            target = (slope * averageFeature +constant +targetNoise).toFixed(2);
        }

        else {
            let numericSum = 0;
            let validFeatureCount = 0;
            features.forEach((value) => {
                const numericValue = Number(value);
                if (value !== "" && !Number.isNaN(numericValue)) {
                    numericSum += numericValue;
                    validFeatureCount++;
                }
            });

            const averageFeature =validFeatureCount > 0? numericSum / validFeatureCount: Math.random() * 100;
            let classIndex;
            if (classLabels.length === 2) {
                classIndex =averageFeature >= 50? 1: 0;

            } else {
                const normalized =Math.max(0,Math.min(0.9999,averageFeature / 100));
                classIndex =Math.floor(normalized * classLabels.length);
            }


            if (Math.random() < noiseLevel / 100) {
                classIndex =Math.floor(Math.random() * classLabels.length);
            }
            target = classLabels[classIndex];
        }
        rows.push([...features,target]);
    }


    for (let i = rows.length - 1; i > 0; i--) {
        const j =Math.floor(Math.random() * (i + 1));
        [rows[i], rows[j]] =[rows[j], rows[i]];
    }

    return rows;
};

export default function CreateData({ onNavigate, theme = "forest", onSelectTheme }) {
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
    
    const [dataset, setDataset] = useState(() =>createRows(12,4,"decimal",0,"regression",2,0,["class_0", "class_1"]));
    const headers = [...Array.from({ length: columnCount }, (_, index) => `feature_${index + 1}`), "target"];
    const missingValues = dataset.flat().filter((value) => value === "").length;

    const generateDataset = () => {
        const labels = classLabels.split(",").map((label) => label.trim()).filter(Boolean).slice(0, classCount);
        while (labels.length < classCount) {
            labels.push(`class_${labels.length}`);
        }
        setClassLabels(labels.join(", "));
        setDataset(createRows(rowCount,columnCount,dataType,missingRate,type,slope,constant,labels,noiseLevel));
    };

    const downloadDataset = () => {
        const csv = [headers, ...dataset].map((row) => row.join(",")).join("\n");
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        link.download = "mlforge-dataset.csv";
        link.click();
        URL.revokeObjectURL(link.href);
    };

    return (
        <div className="t-page page-no-overscroll min-h-screen overflow-x-clip overscroll-none px-4 py-4 font-mono md:px-8 scrollbar-thin scrollbar-thumb-[#7aa88a] scroll-smooth">
            <section className="mx-auto max-w-7xl">
                <header className="t-card-line mb-4 border-b pb-5">
                    <p className="t-accent mb-2 text-xs uppercase tracking-[0.3em]">MlForge</p>
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Data Creator</h1>
                            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-400">Create your own test dataset, tweak its shape, and surface patterns worth exploring.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <ThemeButton theme={theme} onSelect={onSelectTheme} />
                            <button onClick={() => onNavigate("/home")} className="no-underline rounded-lg border border-red-600 bg-red-600/10 px-4 py-2 text-sm text-red-300 transition hover:bg-red-600/30">Back</button>
                        </div>
                    </div>
                </header>

                <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
                    <div className="rounded-xl border border-[#243724] bg-[#0e140e]/80 p-5 shadow-2xl shadow-[#172617]/20">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-[#adc9ae]">01 / Output</p>
                                <h2 className="mt-1 text-lg font-bold">Create your dataset</h2>
                            </div>
                            <span className="rounded border border-[#243724] bg-[#172617] px-2 py-1 text-[10px] text-gray-400">Table</span>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-gray-500">Shape and values</p>
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <label className="text-sm text-gray-400">Rows
                                        <input type="number" min="1" max="500" value={rowCount} onChange={(event) => setRowCount(Number(event.target.value))} className="mt-2 w-full rounded-lg border border-[#243724] bg-[#070a07] px-3 py-2 text-[#d4e6d5] outline-none transition focus:border-[#7aa88a]" />
                                    </label>
                                    <label className="text-sm text-gray-400">Columns
                                        <input type="number" min="1" max="12" value={columnCount} onChange={(event) => setColumnCount(Number(event.target.value))} className="mt-2 w-full rounded-lg border border-[#243724] bg-[#070a07] px-3 py-2 text-[#d4e6d5] outline-none transition focus:border-[#7aa88a]" />
                                    </label>
                                    <label className="text-sm text-gray-400">Value type
                                        <select value={dataType} onChange={(event) => setDataType(event.target.value)} className="mt-2 w-full rounded-lg border border-[#243724] bg-[#070a07] px-3 py-2 text-[#d4e6d5] outline-none transition focus:border-[#7aa88a]"><option value="decimal">Decimal</option><option value="integer">Integer</option><option value="categorical">Categorical</option></select>
                                    </label>
                                </div>
                            </div>
                            <div className="grid gap-4 rounded-lg border border-[#243724] bg-[#101a10] p-4 sm:grid-cols-2">
                                <label className="text-sm text-gray-400"><span className="flex justify-between"><span>Missing values</span><span className="text-[#adc9ae]">{missingRate}%</span></span>
                                    <input type="range" min="0" max="30" value={missingRate} onChange={(event) => setMissingRate(Number(event.target.value))} className="mt-4 w-full accent-[#7aa88a]" />
                                </label>
                                <label className="text-sm text-gray-400"><span className="flex justify-between"><span>Noise</span><span className="text-[#adc9ae]">{noiseLevel}%</span></span>
                                    <input type="range" min="0" max="30" value={noiseLevel} onChange={(event) => setNoiseLevel(Number(event.target.value))} className="mt-4 w-full accent-[#7aa88a]" />
                                </label>
                            </div>
                            <div className="border-t border-[#243724] pt-4">
                                <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-gray-500">Target behavior</p>
                                <label className="text-sm text-gray-400">Task type
                                    <select value={type} onChange={(event) => setType(event.target.value)} className="mt-2 w-full rounded-lg border border-[#243724] bg-[#070a07] px-3 py-2 text-[#d4e6d5] outline-none transition focus:border-[#7aa88a]"><option value="regression">Regression</option><option value="classification">Classification</option></select>
                                </label>
                                {type === "regression" && <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                    <label className="text-sm text-gray-400">Slope
                                        <input type="number" step="0.1" value={slope} onChange={(event) => setSlope(Number(event.target.value))} className="mt-2 w-full rounded-lg border border-[#243724] bg-[#070a07] px-3 py-2 text-[#d4e6d5] outline-none transition focus:border-[#7aa88a]" />
                                    </label>
                                    <label className="text-sm text-gray-400">Constant
                                        <input type="number" step="0.1" value={constant} onChange={(event) => setConstant(Number(event.target.value))} className="mt-2 w-full rounded-lg border border-[#243724] bg-[#070a07] px-3 py-2 text-[#d4e6d5] outline-none transition focus:border-[#7aa88a]" />
                                    </label>
                                </div>}
                                {type === "classification" && <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                                    <label className="text-sm text-gray-400">Number of classes
                                        <input type="number" min="2" max="10" value={classCount} onChange={(event) => setClassCount(Math.max(2, Math.min(10, Number(event.target.value))))} className="mt-2 w-full rounded-lg border border-[#243724] bg-[#070a07] px-3 py-2 text-[#d4e6d5] outline-none transition focus:border-[#7aa88a]" />
                                    </label>
                                    <label className="text-sm text-gray-400">Class labels <span className="text-gray-600">(comma separated)</span>
                                        <input type="text" value={classLabels} onChange={(event) => setClassLabels(event.target.value)} placeholder="class_0, class_1" className="mt-2 w-full rounded-lg border border-[#243724] bg-[#070a07] px-3 py-2 text-[#d4e6d5] outline-none transition focus:border-[#7aa88a]" />
                                    </label>
                                </div>}
                            </div>
                        </div>
                        <button type="button" onClick={generateDataset} className="mt-6 w-full rounded-lg border border-[#7aa88a] bg-[#618c61]/20 px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#618c61]/40">Generate dataset</button>
                    </div>

                    <div className="rounded-xl border border-[#243724] bg-[#101a10] p-5">
                        <div className="mb-5">
                            <p className="text-xs uppercase tracking-[0.2em] text-[#adc9ae]">02 / Snapshot</p>
                            <h2 className="mt-1 text-lg font-bold">Dataset overview</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {[ ["Rows", dataset.length], ["Columns", headers.length], ["Missing", missingValues], ["Type", dataType] ].map(([label, value]) => (
                                <div key={label} className="rounded-lg border border-[#243724] bg-[#0e140e] p-4">
                                    <p className="text-xs text-gray-500">{label}</p>
                                    <p className="mt-2 text-2xl font-bold text-[#adc9ae]">{value}</p>
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 rounded-lg border border-dashed border-[#243724] p-4 text-sm leading-6 text-gray-500">
                            Generate a dataset to populate its quality checks and column-level details.
                        </div>
                        <button type="button" onClick={downloadDataset} className="mt-5 w-full rounded-lg border border-red-500 bg-red-400/10 px-4 py-2 text-sm text-grey-200 transition hover:bg-red-400/30 hover:text-white">Download CSV</button>
                    </div>
                </div>
                <section className="mt-5 rounded-xl border border-[#243724] bg-[#0e140e]/80 p-5">
                    <div className="mb-5 flex flex-col justify-between gap-2 md:flex-row md:items-end">
                        <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-[#adc9ae]">03 / Explore</p>
                            <h2 className="mt-1 text-lg font-bold">Patterns and Tweaking</h2>
                        </div>
                        <p className="text-xs text-gray-500">Showing {Math.min(dataset.length, 8)} of {dataset.length} rows</p>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-[#243724] bg-[#070a07]">
                        <table className="w-full min-w-[520px] text-left text-sm">
                            <thead className="bg-[#101a10] text-xs uppercase tracking-widest text-[#adc9ae]"><tr>{headers.map((header) => <th key={header} className="px-4 py-3">{header}</th>)}</tr></thead>
                            <tbody>{dataset.slice(0, 8).map((row, rowIndex) => <tr key={rowIndex} className="border-t border-[#243724] hover:bg-[#0e140e]">{row.map((value, columnIndex) => <td key={`${rowIndex}-${columnIndex}`} className={`px-4 py-3 ${value === "" ? "text-[#7aa88a]" : "text-gray-300"}`}>{value || "null"}</td>)}</tr>)}</tbody>
                        </table>
                    </div>
                </section>
            </section>
            
        </div>
    );
}