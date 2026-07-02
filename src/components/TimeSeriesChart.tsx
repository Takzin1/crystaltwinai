import { LABELS } from "@/config/labels";
import type { LanguageCode, StepState } from "@/lib/types";

/**
 * Dependency-free SVG time-series chart.
 * Each series is normalised to its own range so trends stay legible.
 */

const W = 680;
const H = 240;
const PAD = { top: 12, right: 12, bottom: 26, left: 12 };

function toPolyline(values: number[], min: number, max: number): string {
  const span = max - min || 1;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  return values
    .map((v, i) => {
      const x = PAD.left + (i / Math.max(1, values.length - 1)) * innerW;
      const y = PAD.top + innerH - ((v - min) / span) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

interface Props {
  lang: LanguageCode;
  series: StepState[];
}

export default function TimeSeriesChart({ lang, series }: Props) {
  const growth = series.map((p) => p.growthRate);
  const quality = series.map((p) => p.quality);
  const temp = series.map((p) => p.temperature);
  const ss = series.map((p) => p.supersaturation);

  const gMax = Math.max(1, ...growth);
  const tMin = Math.min(...temp);
  const tMax = Math.max(...temp);
  const sMax = Math.max(1.6, ...ss);

  const gridY = [0.25, 0.5, 0.75].map((f) => PAD.top + (H - PAD.top - PAD.bottom) * f);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    x: PAD.left + (W - PAD.left - PAD.right) * f,
    label: Math.round(f * (series.length - 1) + 1),
  }));

  const legend: Array<{ key: string; color: string; dash?: string }> = [
    { key: LABELS.chartGrowth[lang], color: "var(--cyan)" },
    { key: LABELS.chartQuality[lang], color: "var(--violet)" },
    { key: LABELS.chartTemperature[lang], color: "var(--amber)" },
    { key: LABELS.chartSupersaturation[lang], color: "var(--green)", dash: "4 4" },
  ];

  return (
    <section className="panel" aria-label={LABELS.chartTitle[lang]}>
      <h2 className="panel-title">{LABELS.chartTitle[lang]}</h2>
      <div className="chart-legend">
        {legend.map((l) => (
          <span key={l.key}>
            <i style={{ background: l.dash ? "transparent" : l.color, borderTop: l.dash ? `2px dashed ${l.color}` : "none" }} />
            {l.key}
          </span>
        ))}
      </div>
      <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={LABELS.chartTitle[lang]}>
        {gridY.map((y) => (
          <line key={y} x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="rgba(94,140,184,0.14)" />
        ))}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={H - PAD.bottom}
          y2={H - PAD.bottom}
          stroke="rgba(94,140,184,0.35)"
        />
        {ticks.map((t) => (
          <text key={t.x} x={t.x} y={H - 8} fontSize="10" fill="var(--text-faint)" textAnchor="middle" fontFamily="var(--mono)">
            {t.label}
          </text>
        ))}
        <polyline points={toPolyline(temp, tMin, tMax)} fill="none" stroke="var(--amber)" strokeWidth="1.5" opacity="0.8" />
        <polyline points={toPolyline(ss, 0, sMax)} fill="none" stroke="var(--green)" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.8" />
        <polyline points={toPolyline(quality, 0, 100)} fill="none" stroke="var(--violet)" strokeWidth="2" />
        <polyline points={toPolyline(growth, 0, gMax)} fill="none" stroke="var(--cyan)" strokeWidth="2" />
      </svg>
    </section>
  );
}
