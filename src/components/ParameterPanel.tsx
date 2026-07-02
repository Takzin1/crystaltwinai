"use client";

import { PARAMETERS } from "@/config/parameters";
import { SCENARIOS } from "@/config/scenarios";
import { LABELS } from "@/config/labels";
import type { LanguageCode, ParameterId, SimulationInput } from "@/lib/types";

interface Props {
  lang: LanguageCode;
  input: SimulationInput;
  scenarioId: string;
  onChange: (id: ParameterId, value: number) => void;
  onScenario: (id: string) => void;
  onReset: () => void;
}

export default function ParameterPanel({ lang, input, scenarioId, onChange, onScenario, onReset }: Props) {
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];

  return (
    <section className="panel" aria-label={LABELS.controls[lang]}>
      <h2 className="panel-title">{LABELS.controls[lang]}</h2>

      <label className="score-label" htmlFor="scenario">
        {LABELS.scenario[lang]}
      </label>
      <select
        id="scenario"
        className="scenario-select"
        value={scenarioId}
        onChange={(e) => onScenario(e.target.value)}
      >
        {SCENARIOS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name[lang]}
          </option>
        ))}
      </select>
      <p className="scenario-desc">{scenario.description[lang]}</p>

      {PARAMETERS.map((p) => {
        const value = input[p.id];
        const fill = ((value - p.min) / (p.max - p.min)) * 100;
        const decimals = p.step < 1 ? 2 : 0;
        return (
          <div className="param" key={p.id}>
            <div className="param-head">
              <label className="param-label" htmlFor={p.id} title={p.description[lang]}>
                {p.label[lang]}
              </label>
              <span className="param-value">
                {value.toFixed(decimals)}
                <span className="unit">{p.unit}</span>
              </span>
            </div>
            <input
              id={p.id}
              type="range"
              min={p.min}
              max={p.max}
              step={p.step}
              value={value}
              style={{ ["--fill" as string]: `${fill}%` }}
              onChange={(e) => onChange(p.id, Number(e.target.value))}
              aria-label={p.label[lang]}
            />
          </div>
        );
      })}

      <button type="button" className="reset-btn" onClick={onReset}>
        {LABELS.reset[lang]}
      </button>
    </section>
  );
}
