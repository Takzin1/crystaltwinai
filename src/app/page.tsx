"use client";

import "./dataset.css";
import "./research-workbench.css";
import "./verification.css";
import "./studio-theme.css";

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
import VerificationLabPanel from "@/components/VerificationLabPanel";
import FalsificationBenchPanel from "@/components/FalsificationBenchPanel";
import PbeNumericalPanel from "@/components/PbeNumericalPanel";
import PbeAccuracyPanel from "@/components/PbeAccuracyPanel";
import SourceEvidenceGallery from "@/components/SourceEvidenceGallery";
import StruviteEvidencePanel from "@/components/StruviteEvidencePanel";
import LovastatinEvidencePanel from "@/components/LovastatinEvidencePanel";
import IbuprofenEvidencePanel from "@/components/IbuprofenEvidencePanel";
import InductionSourceEvidencePanel from "@/components/InductionSourceEvidencePanel";
import EquilibriumReferencePanel from "@/components/EquilibriumReferencePanel";

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
          <div className="studio-brand-line">
            <span className="studio-brand-symbol" aria-hidden="true"><span /></span>
            <div><h1 className="brand">Crystal<span className="accent">Twin</span><span className="brand-ai">AI</span></h1>
            <p className="subtitle">{LABELS.appSubtitle[lang]}</p></div>
          </div>
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
        <a href="#verification"><span>02</span>{lang === "ja" ? "定量検証" : "Verification"}</a>
        <a href="#datasets"><span>03</span>{lang === "ja" ? "データ照合" : "Data comparison"}</a>
        <a href="#bridge"><span>04</span>{lang === "ja" ? "QFabric連携" : "QFabric bridge"}</a>
        <a href="#literature"><span>05</span>{lang === "ja" ? "研究論文" : "Research papers"}</a>
      </nav>
      <div className="studio-hero">
        <div className="studio-hero-content">
          <p className="studio-eyebrow"><span className="studio-live-pulse" aria-hidden="true" />RESEARCH WORKSPACE · VIRTUAL LAB</p>
          <h2>{lang === "ja" ? "結晶化を、" : "Make crystallization"}<span>{lang === "ja" ? "可視化から検証へ。" : "testable."}</span></h2>
          <p className="studio-hero-copy">{lang === "ja"
            ? "パラメータを動かし、異なるモデルを比較し、出典付きデータを吟味する。教育用シミュレーションと研究データを混同しない、透明性を重視した実験ワークスペース。"
            : "Explore hypotheses, compare numerical models and inspect source-attributed observations—while keeping education, provenance and physical validation clearly separated."}</p>
          <div className="studio-hero-actions">
            <a href="#simulation" className="studio-hero-primary">{lang === "ja" ? "シミュレーションを操作" : "Open simulation"} <span aria-hidden="true">↗</span></a>
            <a href="#datasets" className="studio-hero-secondary">{lang === "ja" ? "公開データを見る" : "Inspect published data"} <span aria-hidden="true">→</span></a>
          </div>
        </div>
        <div className="studio-hero-visual" aria-hidden="true">
          <div className="studio-orbit studio-orbit-a" />
          <div className="studio-orbit studio-orbit-b" />
          <div className="studio-orbit studio-orbit-c" />
          <div className="studio-core">◇</div>
          <span className="studio-hero-visual-label">DIGITAL TWIN / EXPERIMENTAL</span>
        </div>
      </div>
      <div className="studio-trust-strip" aria-label={lang === "ja" ? "機能の適用範囲" : "Scope of the workspace"}>
        <span><i aria-hidden="true" />{lang === "ja" ? "教育用モデル" : "Educational models"}</span>
        <span><i aria-hidden="true" />{lang === "ja" ? "独立した数値検証" : "Independent numeric audits"}</span>
        <span><i aria-hidden="true" />{lang === "ja" ? "出典付き公開データ" : "Attributed source records"}</span>
        <strong>{lang === "ja" ? "実設備制御不可" : "NOT FOR EQUIPMENT CONTROL"}</strong>
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

          <div id="verification" className="workbench-section">
            <div className="workbench-section-header">
              <h2>{lang === "ja" ? "02 · モデルを定量検証する" : "02 · Quantitative verification"}</h2>
              <p>{lang === "ja" ? "異種モデル比較・入力感度" : "Model discrepancy and input sensitivity"}</p>
            </div>
            <VerificationLabPanel lang={lang} result={result} />
            <FalsificationBenchPanel lang={lang} input={result.input} />
            <PbeNumericalPanel lang={lang} />
            <PbeAccuracyPanel lang={lang} />
          </div>

          <div id="datasets" className="workbench-section">
            <div className="workbench-section-header">
              <h2>{lang === "ja" ? "03 · データを照合する" : "03 · Examine datasets"}</h2>
              <p>{lang === "ja" ? "単位と由来を確認してから比較" : "Check units and provenance before comparing"}</p>
            </div>
            <DatasetPanel lang={lang} simulated={result.series} input={result.input} />
            <ResearchDatasetPanel lang={lang} />
            <SourceEvidenceGallery lang={lang} />
            <StruviteEvidencePanel lang={lang} />
            <LovastatinEvidencePanel lang={lang} />
            <IbuprofenEvidencePanel lang={lang} />
            <InductionSourceEvidencePanel lang={lang} />
            <EquilibriumReferencePanel lang={lang} />
          </div>

          <div id="bridge" className="workbench-section">
            <div className="workbench-section-header">
              <h2>{lang === "ja" ? "04 · QFabricに接続する" : "04 · QFabric interoperability"}</h2>
              <p>{lang === "ja" ? "オフライン・制御計画のみ" : "Offline and plan-only"}</p>
            </div>
            <QFabricBridgePanel lang={lang} result={result} />
          </div>

          <div id="literature" className="workbench-section">
            <div className="workbench-section-header">
              <h2>{lang === "ja" ? "05 · 研究根拠を確認する" : "05 · Explore research evidence"}</h2>
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
