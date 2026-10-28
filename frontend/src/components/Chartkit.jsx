/* Shared SVG chart pieces for CleanData and DataAnalyzer (no dependencies). */
export const CHART_COLOR = "#172617";
export const BEFORE_COLOR = "#d4a05a";
export const AFTER_COLOR = "#7aa88a";

export const fmt = (n) => {
    if (n === null || n === undefined) return "--";
    if (typeof n !== "number") return String(n);
    if (!Number.isFinite(n)) return "--";
    return Math.abs(n) >= 1000 ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : String(+n.toFixed(3));
};

export const skewColor = (s) => {
    const a = Math.abs(s ?? 0);
    return a < 0.5 ? "#7aa88a" : a < 1 ? "#d9b45a" : "#d46a6a";
};

/* Boxplot. `before` / `after` are stat objects:
   { min, q1, median, q3, max, whisker_low, whisker_high, outliers[], outlier_count }.
   Pass only `before` (with beforeLabel) for a single-row plot. */
export function BoxPlot({ before, after, shared = true, beforeLabel = "Before", afterLabel = "After", beforeColor = BEFORE_COLOR }) {
    const W = 640, padL = 56, padR = 24, rowH = 78;
    const rows = [
        { s: before, label: beforeLabel, color: beforeColor },
        { s: after, label: afterLabel, color: AFTER_COLOR },
    ].filter((r) => r.s && r.s.q1 !== null && r.s.q1 !== undefined);
    if (rows.length === 0) return <p className="py-6 text-center text-xs text-gray-500">No numeric data for this column.</p>;

    const all = rows.flatMap((r) => [r.s.min, r.s.max]);
    const gLo = Math.min(...all), gHi = Math.max(...all);

    return (
        <svg viewBox={`0 0 ${W} ${rows.length * rowH}`} className="w-full" role="img" aria-label="Boxplot">
            {rows.map((r, i) => {
                const lo = shared ? gLo : r.s.min;
                const hi = shared ? gHi : r.s.max;
                const x = (v) => padL + ((v - lo) / (hi - lo || 1)) * (W - padL - padR);
                const cy = i * rowH + 30;
                const s = r.s;
                return (
                    <g key={r.label}>
                        <text x={0} y={cy + 4} fill="#adc9ae" fontSize="12">{r.label}</text>
                        <line x1={x(s.whisker_low)} x2={x(s.whisker_high)} y1={cy} y2={cy} stroke={r.color} strokeWidth="1.5" />
                        <line x1={x(s.whisker_low)} x2={x(s.whisker_low)} y1={cy - 7} y2={cy + 7} stroke={r.color} strokeWidth="1.5" />
                        <line x1={x(s.whisker_high)} x2={x(s.whisker_high)} y1={cy - 7} y2={cy + 7} stroke={r.color} strokeWidth="1.5" />
                        <rect x={x(s.q1)} y={cy - 13} width={Math.max(x(s.q3) - x(s.q1), 1.5)} height="26" fill={r.color} fillOpacity="0.2" stroke={r.color} strokeWidth="1.5" />
                        <line x1={x(s.median)} x2={x(s.median)} y1={cy - 13} y2={cy + 13} stroke="#ffffff" strokeWidth="2" />
                        {(s.outliers || []).map((o, k) => <circle key={k} cx={x(o)} cy={cy} r="2.5" fill="#d46a6a" fillOpacity="0.7" />)}
                        <text x={padL} y={cy + 34} fill="#6b7280" fontSize="10">{fmt(lo)}</text>
                        <text x={W - padR} y={cy + 34} textAnchor="end" fill="#6b7280" fontSize="10">{fmt(hi)}</text>
                        <text x={W / 2} y={cy + 34} textAnchor="middle" fill="#6b7280" fontSize="10">{s.outlier_count} outliers (red dots)</text>
                    </g>
                );
            })}
        </svg>
    );
}

export function Hist({ h, color, title }) {
    if (!h?.counts?.length) return null;
    const W = 300, H = 100;
    const max = Math.max(...h.counts, 1);
    const bw = W / h.counts.length;
    return (
        <div>
            <p className="mb-1 text-xs text-gray-400">{title}</p>
            <svg viewBox={`0 0 ${W} ${H + 14}`} className="w-full" role="img" aria-label={`${title} histogram`}>
                {h.counts.map((c, i) => {
                    const bh = (c / max) * H;
                    return <rect key={i} x={i * bw + 0.5} y={H - bh} width={Math.max(bw - 1, 1)} height={bh} fill={color} fillOpacity="0.75" />;
                })}
                <text x="0" y={H + 11} fill="#6b7280" fontSize="9">{fmt(h.edges[0])}</text>
                <text x={W} y={H + 11} textAnchor="end" fill="#6b7280" fontSize="9">{fmt(h.edges[h.edges.length - 1])}</text>
            </svg>
        </div>
    );
}

/* Centered bar: left of the line is negative skew, right is positive. Full width = |skew| of 3. */
export function SkewBar({ value }) {
    const v = value ?? 0;
    const w = Math.min(Math.abs(v) / 3, 1) * 50;
    return (
        <div className="relative h-2 w-full rounded bg-[#172617]">
            <div className="absolute left-1/2 top-0 h-full w-px bg-[#3a533a]" />
            <div className="absolute top-0 h-full rounded" style={{ width: `${w}%`, left: v >= 0 ? "50%" : `${50 - w}%`, background: skewColor(v) }} />
        </div>
    );
}