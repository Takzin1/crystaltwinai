"use client";

import { useMemo, useState } from "react";
import { DEFAULT_INPUT } from "@/config/parameters";
import { SCENARIOS } from "@/config/scenarios";
import { LABELS } from "@/config/labels";
import { runSimulation } from "@/lib/engine";
import type { LanguageCode, ParameterId, SimulationInput } from "@/lib/types";
import ParameterPanel from "@/components/ParameterPanel";
import ScoreCard from "@/components/ScoreCard";
import RiskBadge from "@/components/RiskBadge";
import RecommendationPanel from "@/components/RecommendationPanel";
import TimeSeriesChart from "@/components/TimeSeriesChart";
import SimulationLog from "@/components/SimulationLog";
import CrystalViz from "@/components/CrystalViz";
import AgentControlPanel from "@/components/AgentControlPanel";

export default function Home() {
  const [lang, setLang] = useState<LanguageCode>("ja");
  const [scenarioId, setScenarioId] = useState<string>(SCENARIOS[0].id);
  const [input, setInput] = useState<SimulationInput>({ ...DEFAULT_INPUT });

  const result = useMemo(() => runSimulation(input), [input]);
  const { summary } = result;

  const handleChange = (id: ParameterId, value: number) =>
    setInput((prev) => ({ ...prev, [id]: value }));

  const handleScenario = (id: string) => {
    const scenario = SCENARIOS.find((s) => s.id === id);
    if (!scenario) return;
    setScenarioId(id);
    setInput({ ...scenario.input });
  };

  const handleReset = () => {
    const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];
    setInput({ ...scenario.input });
  };

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand-block">
          <h1 className="brand">
            Crystal<span className="accent">Twin</span>-AI
          </h1>
          <p className="subtitle">{LABELS.appSubtitle[lang]}</p>
        </div>
        <span className="badge">{LABELS.badgeEducational[lang]}</span>
        <div className="lang-toggle" role="group" aria-label="Language">
          <button type="button" className={lang === "ja" ? "active" : ""} onClick={() => setLang("ja")}>
            日本語
          </button>
          <button type="button" className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>
            EN
          </button>
        </div>
      </header>

      <div className="layout">
        <ParameterPanel
          lang={lang}
          input={input}
          scenarioId={scenarioId}
          onChange={handleChange}
          onScenario={handleScenario}
          onReset={handleReset}
        />

        <main className="main-col">
          <div className="row-top">
            <CrystalViz lang={lang} summary={summary} />
            <div className="score-grid">
              <ScoreCard
                label={LABELS.growthRate[lang]}
                value={summary.avgGrowthRate}
                unit={LABELS.growthUnit[lang]}
                max={50}
                color="var(--cyan)"
                decimals={1}
              />
              <ScoreCard label={LABELS.stability[lang]} value={summary.stabilityScore} color="var(--green)" />
              <ScoreCard label={LABELS.quality[lang]} value={summary.qualityScore} color="var(--violet)" />
              <ScoreCard label={LABELS.yield[lang]} value={summary.finalYield} color="var(--amber)" decimals={1} />
              <RiskBadge lang={lang} risk={summary.risk} />
            </div>
          </div>

          <div className="row-mid">
            <TimeSeriesChart lang={lang} series={result.series} />
            <RecommendationPanel lang={lang} recommendations={summary.recommendations} />
          </div>

          <AgentControlPanel lang={lang} />
          <SimulationLog lang={lang} log={result.log} />
        </main>
      </div>

      <footer className="footer">{LABELS.footerDisclaimer[lang]}</footer>
    </div>
  );
}
