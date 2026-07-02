import { LABELS } from "@/config/labels";
import type { LanguageCode, RiskAssessment } from "@/lib/types";

const LEVEL_LABEL = {
  low: LABELS.riskLow,
  medium: LABELS.riskMedium,
  high: LABELS.riskHigh,
} as const;

interface Props {
  lang: LanguageCode;
  risk: RiskAssessment;
}

export default function RiskBadge({ lang, risk }: Props) {
  return (
    <div className="score-card" style={{ gridColumn: "1 / -1" }}>
      <p className="score-label">{LABELS.riskLevel[lang]}</p>
      <div className={`risk-pill risk-${risk.level}`}>
        <span className="dot" aria-hidden="true" />
        {LEVEL_LABEL[risk.level][lang]}
      </div>
      <ul className="risk-reasons">
        {risk.reasons.map((r, i) => (
          <li key={i}>{r[lang]}</li>
        ))}
      </ul>
    </div>
  );
}
