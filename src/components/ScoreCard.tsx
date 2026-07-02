interface Props {
  label: string;
  value: number;
  unit?: string;
  max?: number;
  color: string;
  decimals?: number;
}

export default function ScoreCard({ label, value, unit, max = 100, color, decimals = 0 }: Props) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="score-card">
      <p className="score-label">{label}</p>
      <div className="score-value" style={{ color }}>
        {value.toFixed(decimals)}
        {unit ? <span className="unit">{unit}</span> : null}
      </div>
      <div className="score-bar">
        <span style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
