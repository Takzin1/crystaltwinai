import { LABELS } from "@/config/labels";
import type { LanguageCode, LogEvent } from "@/lib/types";

interface Props {
  lang: LanguageCode;
  log: LogEvent[];
}

export default function SimulationLog({ lang, log }: Props) {
  return (
    <section className="panel" aria-label={LABELS.log[lang]}>
      <h2 className="panel-title">{LABELS.log[lang]}</h2>
      <div className="log-panel" role="log">
        {log.map((e, i) => (
          <div className="log-line" key={i}>
            <span className="log-step">
              [{LABELS.step[lang]} {String(e.step).padStart(3, "0")}]
            </span>
            <span className={`log-${e.level}`}>{e.message[lang]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
