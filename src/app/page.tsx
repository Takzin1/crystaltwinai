"use client";

import "./dataset.css";
import "./research-workbench.css";

import { useMemo, useState } from "react";
import { DEFAULT_INPUT } from "@/config/parameters";
import { SCENARIOS } from "@/config/scenarios";
import { LABELS } from "@/config/labels";
import { runSimulation } from "@/lib/engine";
import type { LanguageCode, ParameterId, SimulationInput, SimulationResult } from "@/lib/types";
import ParameterPanel from "@/components/ParameterPanel";
import ScoreCard from "@/components/ScoreCard";
import RiskBadge from "@/components/RiskBadge";
import RecommendationPanel from "@/components/RecommendationPanel";
import TimeSeriesChart from "@/components/TimeSeriesChart";
import SimulationLog from "@/components/SimulationLog";
import CrystalViz from "@/components/CrystalViz";
import DatasetPanel from "@/components/DatasetPanel";
import ResearchDatasetPanel from "@/components/ResearchDatasetPanel";
import QFabricBridgePanel from "@/components/QFabricBridgePanel";
import QuantumTheoryEvidencePanel from "@/components/QuantumTheoryEvidencePanel";
import BaselineComparisonPanel from "@/components/BaselineComparisonPanel";

export default function Home() {
  const [lang, setLang] = useState<LanguageCode>("ja");
  const [scenarioId, setScenarioId] = useState<string>(SCENARIOS[0].id);
  const [input, setInput] = useState<SimulationInput>({ ...DEFAULT_INPUT });
  const [baseline, setBaseline] = useState<SimulationResult | null>(null);

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

      <nav className="workbench-nav" aria-label={lang === "ja" ? "研究ワークスペースの移動" : "Research workspace navigation"}>
        <a href="#simulation"><span>01</span>{lang === "ja" ? "シミュレーション" : "Simulation"}</a>
        <a href="#datasets"><span>02</span>{lang === "ja" ? "データ照合" : "Data comparison"}</a>
        <a href="#bridge"><span>03</span>{lang === "ja" ? "QFabric連携" : "QFabric bridge"}</a>
        <a href="#literature"><span>04</span>{lang === "ja" ? "研究論文" : "Research papers"}</a>
      </nav>
      <div className="workbench-intro">
        <strong>{lang === "ja" ? "操作 → 比較 → 検証 → 出典確認" : "Experiment → Compare → Validate → Examine evidence"}</strong>
        <p>{lang === "ja"
          ? "まずパラメータを変更し、結果を比較します。研究データ・量子計算の論文は別の検証段階で扱い、実機や物理モデルの妥当性は推定しません。"
          : "Explore input changes and simulated outcomes. Research data and quantum literature remain separate evidence layers; no physical process validation is implied."}</p>
      </div>
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
          <div id="simulation" className="workbench-section" aria-label={lang === "ja" ? "シミュレーション結果" : "Simulation results"}>
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

          <SimulationLog lang={lang} log={result.log} />
          <BaselineComparisonPanel lang={lang} baseline={baseline} current={result}
            onCapture={() => setBaseline(result)} onClear={() => setBaseline(null)}
            onRestore={(saved) => setInput({ ...saved })} />
          </div>

          <div id="datasets" className="workbench-section">
            <div className="workbench-section-header">
              <h2>{lang === "ja" ? "02 · データを照合する" : "02 · Examine datasets"}</h2>
              <p>{lang === "ja" ? "単位と由来を確認してから比較" : "Check units and provenance before comparing"}</p>
            </div>
            <DatasetPanel lang={lang} simulated={result.series} input={result.input} />
            <ResearchDatasetPanel lang={lang} />
          </div>

          <div id="bridge" className="workbench-section">
            <div className="workbench-section-header">
              <h2>{lang === "ja" ? "03 · QFabricに接続する" : "03 · QFabric interoperability"}</h2>
              <p>{lang === "ja" ? "オフライン・制御計画のみ" : "Offline and plan-only"}</p>
            </div>
            <QFabricBridgePanel lang={lang} result={result} />
          </div>

          <div id="literature" className="workbench-section">
            <div className="workbench-section-header">
              <h2>{lang === "ja" ? "04 · 研究根拠を確認する" : "04 · Explore research evidence"}</h2>
              <p>{lang === "ja" ? "一次原典・引用数・適用限界" : "Original DOI, citation provenance, limitations"}</p>
            </div>
            <QuantumTheoryEvidencePanel lang={lang} />
          </div>
        </main>
      </div>

      <footer className="footer">{LABELS.footerDisclaimer[lang]}</footer>
    </div>
  );
}
