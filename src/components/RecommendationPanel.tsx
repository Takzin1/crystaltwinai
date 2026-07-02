import { LABELS } from "@/config/labels";
import type { LanguageCode, Recommendation } from "@/lib/types";

interface Props {
  lang: LanguageCode;
  recommendations: Recommendation[];
}

export default function RecommendationPanel({ lang, recommendations }: Props) {
  return (
    <section className="panel" aria-label={LABELS.aiRecommendation[lang]}>
      <h2 className="panel-title">{LABELS.aiRecommendation[lang]}</h2>
      {recommendations.map((r) => (
        <div className="reco" key={r.id}>
          <p className="reco-message">{r.message[lang]}</p>
          <p className="reco-reason">
            <span className="why">{LABELS.aiWhy[lang]}</span>
            {r.reason[lang]}
          </p>
        </div>
      ))}
      <p className="ai-note">{LABELS.aiDisclaimer[lang]}</p>
    </section>
  );
}
