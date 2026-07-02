import { LABELS } from "@/config/labels";
import type { LanguageCode, SimulationSummary } from "@/lib/types";

/**
 * Crystal twin view — the "digital twin" of the grown crystal.
 *
 * A faceted hexagonal crystal whose size tracks yield, whose colour
 * tracks quality, and which is surrounded by fines when nucleation
 * bursts occurred. Fully deterministic (no randomness) so the same
 * inputs always render the same twin.
 */

function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

function qualityColor(quality: number): { main: string; glow: string } {
  if (quality >= 70) return { main: "#6fd5e3", glow: "rgba(111,213,227,0.35)" };
  if (quality >= 45) return { main: "#e8a94e", glow: "rgba(232,169,78,0.3)" };
  return { main: "#f06d88", glow: "rgba(240,109,136,0.3)" };
}

interface Props {
  lang: LanguageCode;
  summary: SimulationSummary;
}

export default function CrystalViz({ lang, summary }: Props) {
  const cx = 120;
  const cy = 105;
  const r = 26 + Math.min(60, summary.finalYield * 0.62);
  const { main, glow } = qualityColor(summary.qualityScore);

  const fines = Math.min(18, summary.nucleationEvents * 5);
  const fineDots = Array.from({ length: fines }, (_, i) => {
    const a = i * 2.399; // golden angle — deterministic scatter
    const rr = r + 18 + (i % 4) * 9;
    return {
      x: cx + rr * Math.cos(a),
      y: cy + rr * Math.sin(a) * 0.82,
      s: 2 + (i % 3),
    };
  });

  return (
    <section className="panel crystal-panel" aria-label={LABELS.digitalTwin[lang]}>
      <h2 className="panel-title">{LABELS.digitalTwin[lang]}</h2>
      <div className="crystal-stage">
        <svg width="240" height="210" viewBox="0 0 240 210" role="img" aria-label={LABELS.digitalTwin[lang]}>
          <circle cx={cx} cy={cy} r={r + 14} fill={glow} opacity="0.25" />
          <polygon
            points={hexPoints(cx, cy, r)}
            fill={glow}
            stroke={main}
            strokeWidth="2"
            style={{ transition: "all 0.4s ease" }}
          />
          <polygon points={hexPoints(cx, cy, r * 0.62)} fill="none" stroke={main} strokeWidth="1" opacity="0.55" />
          <polygon points={hexPoints(cx, cy, r * 0.3)} fill="none" stroke={main} strokeWidth="1" opacity="0.35" />
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const a = (Math.PI / 3) * i - Math.PI / 2;
            return (
              <line
                key={i}
                x1={cx + r * 0.3 * Math.cos(a)}
                y1={cy + r * 0.3 * Math.sin(a)}
                x2={cx + r * Math.cos(a)}
                y2={cy + r * Math.sin(a)}
                stroke={main}
                strokeWidth="0.8"
                opacity="0.4"
              />
            );
          })}
          {fineDots.map((d, i) => (
            <polygon
              key={i}
              points={hexPoints(d.x, d.y, d.s)}
              fill="none"
              stroke="var(--amber)"
              strokeWidth="0.8"
              opacity="0.7"
            />
          ))}
        </svg>
      </div>
      <div className="crystal-meta">
        <div>
          {LABELS.supersaturationNow[lang]}
          <strong>{summary.maxSupersaturation.toFixed(2)}</strong>
        </div>
        <div>
          {LABELS.nucleationEvents[lang]}
          <strong>{summary.nucleationEvents}</strong>
        </div>
        <div>
          {LABELS.yield[lang]}
          <strong>{summary.finalYield.toFixed(1)}</strong>
        </div>
      </div>
    </section>
  );
}
