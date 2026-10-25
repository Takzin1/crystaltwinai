"use client";

import "./pilot.css";

import Link from "next/link";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { PARAMETERS } from "@/config/parameters";
import { PILOT_LABELS } from "@/config/pilot-labels";
import { SCENARIOS } from "@/config/scenarios";
import { runSimulation } from "@/lib/engine";
import { DEFAULT_OBJECTIVE, finalizeRun, historyItem, reviewRun, simulateRun } from "@/lib/pilot/agent";
import {
  type InferenceRecord,
  type PilotRun,
  type VerificationReport,
  buildEvidence,
  serializeEvidence,
  verifyEvidence,
} from "@/lib/pilot/evidence";
import type { Interpretation } from "@/lib/pilot/experiment";
import { ADVERSARIAL_FIXTURES } from "@/lib/pilot/fixtures";
import type { Assessment } from "@/lib/pilot/gate";
import { proposalSummary } from "@/lib/pilot/planner";
import { STATE_DEFINITIONS, currentState, type WorkflowState } from "@/lib/pilot/workflow";
import type { LanguageCode, SimulationInput } from "@/lib/types";
import { CompareChart, ProvenanceBadge, StateChip } from "@/components/pilot/PilotWidgets";

interface Status {
  liveConfigured: boolean;
  proposeModel?: string;
  interpretModel?: string;
  baseUrlHost?: string;
  attestation?: boolean;
}

const STEP_FOR_STATE: Record<WorkflowState, number> = {
  CREATED: 0, PROPOSED: 1, VALIDATED: 2, REJECTED: 2, AWAITING_REVIEW: 3,
  APPROVED: 4, SIMULATED: 5, VERIFIED: 6, INCONCLUSIVE: 6, FAILED: 5,
};

const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(1) : Math.abs(v) >= 10 ? v.toFixed(2) : v.toFixed(3));
const signed = (v: number) => (v > 0 ? "+" : "") + fmt(v);

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function PilotPage() {
  const [lang, setLang] = useState<LanguageCode>("en");
  const L = PILOT_LABELS[lang];
  const [status, setStatus] = useState<Status | null>(null);
  const [scenarioId, setScenarioId] = useState(SCENARIOS[3].id);
  const [baseInput, setBaseInput] = useState<SimulationInput>({ ...SCENARIOS[3].input });
  const [objective, setObjective] = useState(DEFAULT_OBJECTIVE);
  const [mode, setMode] = useState<"live" | "offline">("offline");
  const [adversarialId, setAdversarialId] = useState(ADVERSARIAL_FIXTURES[0].id);
  const [runs, setRuns] = useState<PilotRun[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewer, setReviewer] = useState("demo-reviewer");
  const [attested, setAttested] = useState(false);
  const [verification, setVerification] = useState<{ label: string; report: VerificationReport } | null>(null);
  const [attestResult, setAttestResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/pilot/status")
      .then((r) => r.json())
      .then((s: Status) => {
        setStatus(s);
        if (s.liveConfigured) setMode("live");
      })
      .catch(() => setStatus({ liveConfigured: false }));
  }, []);

  const run = runs.find((r) => r.runId === activeId) ?? null;
  const state = run ? currentState(run.history) : null;
  const baseline = useMemo(() => runSimulation(baseInput), [baseInput]);
  const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;
  const live = run?.inference?.mode === "live_nebius";

  const update = (next: PilotRun) => {
    setRuns((all) => all.map((r) => (r.runId === next.runId ? next : r)));
    setVerification(null);
    setAttestResult(null);
  };

  async function propose(opts: { fixtureId?: string; probe?: boolean; followUpOf?: PilotRun } = {}) {
    setBusy(true);
    setError(null);
    setVerification(null);
    setAttestResult(null);
    const parent = opts.followUpOf;
    const input = parent?.experiment ? (parent.experiment.approvedInput as SimulationInput) : baseInput;
    const chain = parent ? runs.filter((r) => r.scenarioId === parent.scenarioId) : [];
    const history = chain.map(historyItem).filter((h): h is NonNullable<typeof h> => h !== null).slice(-5);
    try {
      const response = await fetch("/api/pilot/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: opts.fixtureId ? "offline" : opts.probe ? "live" : mode,
          scenarioId,
          input,
          objective,
          fixtureId: opts.fixtureId ?? null,
          probe: opts.probe === true,
          history,
          parentRunId: parent?.runId ?? null,
          iteration: parent ? parent.iteration + 1 : 1,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status}).`);
      const next = body.run as PilotRun;
      if (parent) setBaseInput({ ...input });
      setRuns((all) => [next, ...all].slice(0, 20));
      setActiveId(next.runId);
      setAttested(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Proposal request failed.");
    } finally {
      setBusy(false);
    }
  }

  function decide(decision: "approve" | "reject") {
    if (!run) return;
    setError(null);
    try {
      let next = reviewRun(run, { reviewerLabel: reviewer, decision, attestEducationalOnly: attested });
      if (decision === "approve") next = simulateRun(next);
      update(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed.");
    }
  }

  async function interpret(useLive: boolean) {
    if (!run) return;
    setError(null);
    if (!useLive) {
      update(finalizeRun(run, null));
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/pilot/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshotText: run.snapshotText,
          proposalText: run.proposalText,
          assessmentText: run.assessmentText,
          reviewText: run.reviewText,
          prediction: run.prediction,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status}).`);
      if (!body.interpretation) {
        setError(`${body.rejected} — falling back to deterministic interpretation.`);
        update(finalizeRun(run, null, body.inference as InferenceRecord));
      } else {
        update(finalizeRun(run, body.interpretation as Interpretation, body.inference as InferenceRecord));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Interpretation failed.");
    } finally {
      setBusy(false);
    }
  }

  const evidenceText = run ? serializeEvidence(buildEvidence(run)) : null;

  function verifyText(label: string, text: string) {
    setVerification({ label, report: verifyEvidence(text) });
  }

  function tamper(kind: "input" | "model" | "result") {
    if (!evidenceText) return;
    const doc = JSON.parse(evidenceText);
    const r = doc.body.run;
    if (kind === "input") {
      const snap = JSON.parse(r.snapshotText);
      snap.input.coolingRate = Math.round((snap.input.coolingRate + (snap.input.coolingRate >= 1.95 ? -0.05 : 0.05)) * 100) / 100;
      r.snapshotText = JSON.stringify(snap, null, 2) + "\n";
    } else if (kind === "model") {
      r.inference.mode = r.inference.mode === "live_nebius" ? "offline_fixture" : "live_nebius";
      r.inference.responseModel = "nvidia/claimed-model";
    } else if (r.experiment) {
      r.experiment.resultSummary.qualityScore = 99.9;
    } else {
      r.history.push({ state: "APPROVED", at: new Date().toISOString(), detail: "forged" });
    }
    verifyText(`${kind} tampered`, JSON.stringify(doc, null, 2));
  }

  async function verifyUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setError("Evidence file exceeds 1 MiB.");
      return;
    }
    verifyText(file.name, await file.text());
  }

  async function checkAttestation() {
    if (!evidenceText) return;
    setAttestResult(L.working);
    try {
      const r = await fetch("/api/pilot/attest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evidence: evidenceText }),
      });
      const body = await r.json();
      setAttestResult(r.ok ? `proposal: ${body.proposal} · interpretation: ${body.interpretation}` : body.error);
    } catch {
      setAttestResult("Attestation check failed.");
    }
  }

  const assessment: Assessment | null = run?.assessmentText ? JSON.parse(run.assessmentText) : null;
  const summary = run?.proposalText ? proposalSummary(run.proposalText) : null;
  const step = state ? STEP_FOR_STATE[state] : -1;

  return (
    <div className="shell pilot">
      <header className="topbar">
        <div className="brand-block">
          <h1 className="brand">
            Crystal<span className="accent">Pilot</span>
          </h1>
          <p className="subtitle">{L.subtitle}</p>
        </div>
        <span className="badge">{status?.liveConfigured ? L.liveReady : L.legendOffline}</span>
        <Link className="pilot-link" href="/">{L.backToSim}</Link>
        <div className="lang-toggle" role="group" aria-label="Language">
          <button type="button" className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>EN</button>
          <button type="button" className={lang === "ja" ? "active" : ""} onClick={() => setLang("ja")}>日本語</button>
        </div>
      </header>

      <section className="pilot-hero" aria-label="Overview">
        <p>{L.pitch}</p>
        <ol className="pilot-steps" aria-label="Workflow steps">
          {L.steps.map((label, i) => (
            <li key={label} className={i < step ? "done" : i === step ? (state === "REJECTED" || state === "FAILED" ? "stop" : "now") : ""}>
              <span>{i + 1}</span>{label}
            </li>
          ))}
        </ol>
        <ul className="pilot-legend">
          {[
            ["live", L.legendLive, L.legendLiveHelp],
            ["offline", L.legendOffline, L.legendOfflineHelp],
            ["sim", L.legendSimulated, L.legendSimulatedHelp],
            ["integrity", L.legendIntegrity, L.legendIntegrityHelp],
            ["unverified", L.legendUnverified, L.legendUnverifiedHelp],
          ].map(([cls, name, help]) => (
            <li key={cls}><span className={`tag tag-${cls}`}>{name}</span> {help}</li>
          ))}
        </ul>
      </section>

      <div className="layout">
        <aside className="panel pilot-controls">
          <h2 className="panel-title">{L.scenario}</h2>
          <select
            className="scenario-select"
            aria-label={L.scenario}
            value={scenarioId}
            onChange={(e) => {
              const s = SCENARIOS.find((x) => x.id === e.target.value)!;
              setScenarioId(s.id);
              setBaseInput({ ...s.input });
            }}
          >
            {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.name[lang]}</option>)}
          </select>
          <p className="scenario-desc">{scenario.description[lang]}</p>

          <label className="pilot-field">
            {L.objective}
            <input value={objective} maxLength={300} onChange={(e) => setObjective(e.target.value)} />
          </label>

          <fieldset className="pilot-field">
            <legend>{L.inference}</legend>
            <label><input type="radio" name="mode" checked={mode === "live"} disabled={!status?.liveConfigured}
              onChange={() => setMode("live")} /> {L.modeLive}{status?.proposeModel ? ` · ${status.proposeModel}` : ""}</label>
            <label><input type="radio" name="mode" checked={mode === "offline"} onChange={() => setMode("offline")} /> {L.modeOffline}</label>
            {status && !status.liveConfigured && <p className="pilot-note">{L.liveUnavailable}</p>}
          </fieldset>

          <button type="button" className="pilot-primary" disabled={busy} onClick={() => propose()}>
            {busy ? L.working : L.generate}
          </button>
          <button type="button" className="dataset-clear" disabled={busy || !status?.liveConfigured} onClick={() => propose({ probe: true })}
            title={L.probeHelp}>{L.probe}</button>

          <h2 className="panel-title pilot-gap">{L.adversarial}</h2>
          <p className="pilot-note">{L.adversarialHelp}</p>
          <select className="scenario-select" aria-label={L.adversarial} value={adversarialId} onChange={(e) => setAdversarialId(e.target.value)}>
            {ADVERSARIAL_FIXTURES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
          <button type="button" className="dataset-clear" disabled={busy} onClick={() => propose({ fixtureId: adversarialId })}>
            {L.submitAdversarial}
          </button>

          <h2 className="panel-title pilot-gap">{L.baseline}</h2>
          <table className="pilot-table compact">
            <tbody>
              {PARAMETERS.map((p) => (
                <tr key={p.id}><th>{p.label[lang]}</th><td>{baseInput[p.id]} {p.unit}</td></tr>
              ))}
              <tr><th>{L.risk}</th><td>{baseline.summary.risk.level}</td></tr>
              <tr><th>quality</th><td>{fmt(baseline.summary.qualityScore)}</td></tr>
              <tr><th>stability</th><td>{fmt(baseline.summary.stabilityScore)}</td></tr>
            </tbody>
          </table>
          <span className="tag tag-sim">{L.legendSimulated}</span>
        </aside>

        <main className="main-col">
          {error && <p role="alert" className="pilot-error">{error}</p>}
          {!run && <section className="panel"><p className="dataset-muted">{L.noRuns}</p></section>}

          {run && state && (
            <>
              <section className="panel" aria-label={L.workflow}>
                <h2 className="panel-title">{L.workflow}</h2>
                <div className="pilot-state-line">
                  <StateChip state={state} />
                  <span className="dataset-muted">{STATE_DEFINITIONS[state]}</span>
                </div>
                <ol className="pilot-timeline">
                  {run.history.map((h, i) => (
                    <li key={i}><StateChip state={h.state} small /> <span>{h.detail}</span>
                      <time dateTime={h.at}>{h.at.slice(11, 19)}Z</time></li>
                  ))}
                </ol>
              </section>

              <section className="panel" aria-label={L.proposal}>
                <h2 className="panel-title">{L.proposal}{run.probe ? " · injection probe" : ""}</h2>
                <ProvenanceBadge inference={run.inference} error={run.inferenceError} labels={L} />
                {summary && (
                  <div className="pilot-proposal">
                    <p><strong>{L.hypothesis}:</strong> <span className="inert">{summary.hypothesis}</span></p>
                    <p><strong>{L.rationale}:</strong> <span className="inert">{summary.rationale}</span></p>
                  </div>
                )}
                {summary && (
                  <table className="pilot-table">
                    <thead><tr><th>{L.parameter}</th><th>{L.from}</th><th>{L.to}</th><th>{L.bounds}</th></tr></thead>
                    <tbody>
                      {Object.entries(summary.changes).map(([k, v]) => {
                        const p = PARAMETERS.find((x) => x.id === k);
                        const from = JSON.parse(run.snapshotText).input[k];
                        return (
                          <tr key={k}>
                            <th>{p ? p.label[lang] : <span className="bad">{k} (unknown)</span>}</th>
                            <td>{from ?? "—"}</td>
                            <td>{String(v)}</td>
                            <td>{p ? `${p.min}–${p.max} ${p.unit}` : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                {run.prediction.length > 0 && (
                  <p className="dataset-muted"><strong>{L.prediction}:</strong>{" "}
                    {run.prediction.map((p) => `${p.metric} ${p.direction}`).join(" · ")}</p>
                )}
                <div className={`pilot-gate ${state === "REJECTED" && !run.reviewText ? "rejected" : assessment?.status === "ready_for_review" ? "ok" : ""}`}>
                  <strong>{L.gate}:</strong>{" "}
                  {run.plannerRejection ? `${L.rejectedBecause}. Model-output contract: ${run.plannerRejection}`
                    : assessment?.status === "rejected" ? `${L.rejectedBecause}. ${assessment.rejectionReasons.join("; ")}`
                    : assessment ? L.readyForReview
                    : run.proposalText ? `${L.rejectedBecause}. ${run.history.at(-1)!.detail}`
                    : run.inferenceError ? run.inferenceError.message : "—"}
                </div>
                {run.inference && (
                  <details className="pilot-raw">
                    <summary>{L.rawOutput}</summary>
                    <pre>{run.inference.rawContent}</pre>
                    {run.proposalText && <><p className="dataset-muted">qfabric-research-proposal/1</p><pre>{run.proposalText}</pre></>}
                  </details>
                )}
              </section>

              {state === "AWAITING_REVIEW" && (
                <section className="panel pilot-review" aria-label={L.review}>
                  <h2 className="panel-title">{L.review}</h2>
                  <label className="pilot-field">{L.reviewer}
                    <input value={reviewer} maxLength={120} onChange={(e) => setReviewer(e.target.value)} />
                  </label>
                  <label className="pilot-check">
                    <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)} /> {L.attest}
                  </label>
                  <div className="dataset-actions">
                    <button type="button" className="pilot-primary" disabled={!attested || !reviewer.trim()} onClick={() => decide("approve")}>{L.approve}</button>
                    <button type="button" className="dataset-clear" onClick={() => decide("reject")}>{L.reject}</button>
                  </div>
                  <p className="pilot-note">{L.reviewNote}</p>
                </section>
              )}

              {run.experiment && (
                <section className="panel" aria-label={L.results}>
                  <h2 className="panel-title">{L.results} <span className="tag tag-sim">{L.legendSimulated}</span></h2>
                  <div className="pilot-results">
                    <table className="pilot-table">
                      <thead><tr><th>{L.metric}</th><th>{L.before}</th><th>{L.after}</th><th>{L.delta}</th></tr></thead>
                      <tbody>
                        {run.experiment.comparison.map((c) => (
                          <tr key={c.metric}>
                            <th>{c.metric}</th><td>{fmt(c.before)}</td><td>{fmt(c.after)}</td>
                            <td className={`dir-${c.direction}`}>{c.direction === "no_change" ? "0" : signed(c.delta)}</td>
                          </tr>
                        ))}
                        <tr><th>{L.risk}</th><td>{run.experiment.baselineRisk}</td><td>{run.experiment.resultRisk}</td><td /></tr>
                      </tbody>
                    </table>
                    <CompareChart before={JSON.parse(run.snapshotText).input} after={run.experiment.approvedInput as SimulationInput} />
                  </div>
                  {run.experiment.predictionChecks.length > 0 && (
                    <>
                      <h3 className="pilot-sub">{L.predictionChecks}</h3>
                      <ul className="pilot-checks">
                        {run.experiment.predictionChecks.map((p) => (
                          <li key={p.metric} className={p.outcome === "confirmed" ? "pass" : "fail"}>
                            {p.outcome === "confirmed" ? "✓" : "✗"} {p.metric}: predicted {p.direction}, simulator {p.observed}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <h3 className="pilot-sub">{L.checks}</h3>
                  <ul className="pilot-checks">
                    {run.experiment.checks.map((c) => (
                      <li key={c.id} className={c.passed ? "pass" : "fail"}>{c.passed ? "✓" : "✗"} <code>{c.id}</code> — {c.detail}</li>
                    ))}
                  </ul>

                  <h3 className="pilot-sub">{L.interpretation}</h3>
                  {state === "SIMULATED" ? (
                    <div className="dataset-actions">
                      <button type="button" className="pilot-primary" disabled={busy || !status?.liveConfigured} onClick={() => interpret(true)}>{busy ? L.working : L.interpretLive}</button>
                      <button type="button" className="dataset-clear" onClick={() => interpret(false)}>{L.interpretDeterministic}</button>
                    </div>
                  ) : run.interpretation && (
                    <div className="pilot-interpretation">
                      <span className={`tag ${run.interpretation.origin === "live_model" ? "tag-live" : "tag-offline"}`}>
                        {run.interpretation.origin === "live_model" ? `${L.legendLive} · ${run.interpretationInference?.responseModel ?? run.interpretationInference?.requestedModel}` : "DETERMINISTIC"}
                      </span>
                      <span className="tag tag-unverified">{L.legendUnverified}</span>
                      <p className="inert">{run.interpretation.summary}</p>
                      {run.interpretation.caveats.length > 0 && <ul className="pilot-note">{run.interpretation.caveats.map((c, i) => <li key={i}>{c}</li>)}</ul>}
                      {run.interpretation.contradictions.length > 0 && (
                        <><strong className="bad">{L.contradictions}</strong>
                          <ul className="pilot-checks">{run.interpretation.contradictions.map((c, i) => <li key={i} className="fail">✗ {c}</li>)}</ul></>
                      )}
                      {run.interpretation.overclaimWarnings.length > 0 && (
                        <p className="pilot-note"><strong>{L.overclaims}:</strong> {run.interpretation.overclaimWarnings.join("; ")}</p>
                      )}
                      {run.interpretation.followUpIdea && <p className="dataset-muted">Follow-up idea: <span className="inert">{run.interpretation.followUpIdea}</span></p>}
                    </div>
                  )}
                </section>
              )}

              <section className="panel" aria-label={L.evidence}>
                <h2 className="panel-title">{L.evidence}</h2>
                <p className="dataset-checksum">snapshot sha256 {run.snapshotSha256}
                  {run.proposalSha256 && <><br />proposal sha256 {run.proposalSha256}</>}
                  {evidenceText && <><br />evidence body sha256 {JSON.parse(evidenceText).integrity.bodySha256}</>}
                </p>
                <div className="dataset-actions">
                  <button type="button" className="pilot-primary" onClick={() => evidenceText && download(`crystalpilot-${run.runId}.json`, evidenceText)}>{L.exportEvidence}</button>
                  <button type="button" className="dataset-clear" onClick={() => evidenceText && verifyText("current", evidenceText)}>{L.verifyCurrent}</button>
                  <label className="dataset-upload">{L.verifyFile}<input type="file" accept=".json,application/json" onChange={verifyUpload} /></label>
                </div>
                <div className="dataset-actions">
                  <button type="button" className="dataset-clear" onClick={() => tamper("input")}>{L.tamperInput}</button>
                  <button type="button" className="dataset-clear" onClick={() => tamper("model")}>{L.tamperModel}</button>
                  <button type="button" className="dataset-clear" onClick={() => tamper("result")}>{L.tamperResult}</button>
                  {live && <button type="button" className="dataset-clear" onClick={checkAttestation}>{L.checkAttestation}</button>}
                </div>
                {attestResult && <p className="dataset-muted">Server attestation — {attestResult}</p>}
                {verification && (
                  <div className={`pilot-verify ${verification.report.overall === "PASS" ? "ok" : "rejected"}`} aria-live="polite">
                    <strong>{verification.label}: {verification.report.overall}</strong>{" "}
                    <span className={`tag ${verification.report.integrity === "VERIFIED" ? "tag-integrity" : "tag-bad"}`}>
                      {L.legendIntegrity}: {verification.report.integrity}
                    </span>
                    <ul className="pilot-checks">
                      {verification.report.checks.map((c, i) => (
                        <li key={i} className={c.status}>{c.status === "pass" ? "✓" : c.status === "fail" ? "✗" : c.status === "warn" ? "!" : "–"} <code>{c.id}</code> — {c.detail}</li>
                      ))}
                    </ul>
                    <p className="pilot-note">{verification.report.notice}</p>
                  </div>
                )}
              </section>
            </>
          )}

          <section className="panel" aria-label={L.history}>
            <h2 className="panel-title">{L.history}</h2>
            {runs.length === 0 ? <p className="dataset-muted">{L.noRuns}</p> : (
              <ul className="pilot-history">
                {runs.map((r) => {
                  const s = currentState(r.history);
                  return (
                    <li key={r.runId} className={r.runId === activeId ? "active" : ""}>
                      <button type="button" onClick={() => { setActiveId(r.runId); setVerification(null); setAttestResult(null); }}>
                        <StateChip state={s} small /> #{r.iteration} {r.scenarioName} · {r.inference?.mode === "live_nebius" ? "live" : r.inference ? "offline" : "no inference"}
                        {r.proposalText ? ` · ${Object.entries(proposalSummary(r.proposalText).changes).map(([k, v]) => `${k}→${String(v)}`).join(", ")}` : ""}
                      </button>
                      {(s === "VERIFIED" || s === "INCONCLUSIVE") && r.runId === activeId && (
                        <button type="button" className="dataset-clear" disabled={busy} onClick={() => propose({ followUpOf: r })}>{L.followUp}</button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </main>
      </div>
      <footer className="footer">{L.disclaimer}</footer>
    </div>
  );
}
