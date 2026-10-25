"use client";

import { useMemo, useState } from "react";
import type { PILOT_LABELS } from "@/config/pilot-labels";
import { runSimulation } from "@/lib/engine";
import type { InferenceRecord } from "@/lib/pilot/evidence";
import type { WorkflowState } from "@/lib/pilot/workflow";
import type { SimulationInput, StepState } from "@/lib/types";

const TONE: Record<WorkflowState, string> = {
  CREATED: "neutral", PROPOSED: "neutral", VALIDATED: "info", AWAITING_REVIEW: "warn",
  APPROVED: "info", SIMULATED: "info", VERIFIED: "good", INCONCLUSIVE: "warn",
  REJECTED: "bad", FAILED: "bad",
};

export function StateChip({ state, small }: { state: WorkflowState; small?: boolean }) {
  return <span className={`state-chip tone-${TONE[state]}${small ? " small" : ""}`}>{state}</span>;
}

export function ProvenanceBadge({
  inference,
  error,
  labels: L,
}: {
  inference: InferenceRecord | null;
  error: { kind: string; message: string } | null;
  labels: (typeof PILOT_LABELS)["en"];
}) {
  if (!inference) {
    return (
      <p className="pilot-provenance">
        <span className="tag tag-bad">NO INFERENCE</span> {error ? `${error.kind}: ${error.message}` : ""}
      </p>
    );
  }
  if (inference.mode === "offline_fixture") {
    return (
      <p className="pilot-provenance">
        <span className="tag tag-offline">{L.legendOffline}</span> {L.fixture}: <code>{inference.fixtureId}</code> · {L.legendOfflineHelp}
      </p>
    );
  }
  const u = inference.usage;
  return (
    <p className="pilot-provenance">
      <span className="tag tag-live">{L.legendLive}</span>{" "}
      {L.modelLabel}: <code>{inference.responseModel ?? inference.requestedModel}</code> · {inference.baseUrlHost} ·{" "}
      {L.latency}: {inference.latencyMs} ms · {L.tokens}: {u?.promptTokens ?? "?"}→{u?.completionTokens ?? "?"} ·{" "}
      {L.responseId}: <code>{inference.responseId ?? "none"}</code>
      {inference.attempts > 1 ? ` · attempts ${inference.attempts}` : ""}
      {inference.estimatedCostUsd !== null ? ` · ≈$${inference.estimatedCostUsd.toFixed(6)}` : ""}
      {inference.attestation ? " · server-attested" : ""}
    </p>
  );
}

const METRICS: (keyof StepState)[] = ["quality", "stability", "crystalYield", "supersaturation", "temperature"];

/** Trajectories recomputed from the two inputs; nothing here is stored or measured. */
export function CompareChart({ before, after }: { before: SimulationInput; after: SimulationInput }) {
  const [metric, setMetric] = useState<keyof StepState>("quality");
  const [a, b] = useMemo(() => [runSimulation(before).series, runSimulation(after).series], [before, after]);
  const W = 360;
  const H = 170;
  const P = 28;
  const values = [...a, ...b].map((s) => s[metric] as number);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const steps = Math.max(a.length, b.length);
  const path = (series: StepState[]) =>
    series
      .map((s, i) => `${i ? "L" : "M"}${(P + (i / Math.max(1, steps - 1)) * (W - 2 * P)).toFixed(1)},${(H - P - (((s[metric] as number) - lo) / span) * (H - 2 * P)).toFixed(1)}`)
      .join(" ");
  return (
    <figure className="pilot-chart">
      <label>
        <span className="sr-only">Trajectory metric</span>
        <select value={metric} onChange={(e) => setMetric(e.target.value as keyof StepState)} aria-label="Trajectory metric">
          {METRICS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${metric} before and after, simulated`}>
        <line x1={P} y1={H - P} x2={W - P} y2={H - P} className="axis" />
        <line x1={P} y1={P} x2={P} y2={H - P} className="axis" />
        <text x={P - 4} y={P + 4} textAnchor="end" className="tick">{hi.toFixed(1)}</text>
        <text x={P - 4} y={H - P} textAnchor="end" className="tick">{lo.toFixed(1)}</text>
        <text x={W - P} y={H - 8} textAnchor="end" className="tick">step {steps}</text>
        <path d={path(a)} className="line-before" />
        <path d={path(b)} className="line-after" />
      </svg>
      <figcaption><span className="swatch before" /> before <span className="swatch after" /> after · simulated</figcaption>
    </figure>
  );
}
