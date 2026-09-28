"use client";

import { useMemo, useState } from "react";
import { runAgentControlStep, type ControlStepResult } from "@/agent/controlLoop";
import { MockAgentRuntime } from "@/agent/mockRuntime";
import { DEMO_NORMALIZED_SAFETY_ENVELOPE } from "@/agent/safetyEnvelope";
import type { AgentProposal, VirtualPlantState } from "@/agent/types";
import type { LanguageCode } from "@/lib/types";

const INITIAL_STATE: VirtualPlantState = {
  temperatureOffsetNorm: 0,
  seedRotationNorm: 0.5,
  crucibleRotationNorm: 0,
  rfPowerNorm: 1,
  magneticFieldNorm: 0.5,
  emergencyStop: false,
};

function makeProposal(state: VirtualPlantState): AgentProposal {
  if (state.seedRotationNorm < 0.7) {
    return {
      proposed_action: {
        type: "seed_rpm_delta_norm",
        value: 0.18,
      },
      reason: "Increase normalized seed rotation to test the safety clamp.",
      evidence: ["demo.state.seedRotationNorm"],
      confidence: 0.86,
    };
  }

  if (state.rfPowerNorm > 1.02) {
    return {
      proposed_action: {
        type: "rf_power_delta_norm",
        value: -0.04,
      },
      reason: "Reduce normalized RF power after the seed-speed target is reached.",
      evidence: ["demo.state.rfPowerNorm"],
      confidence: 0.78,
    };
  }

  return {
    proposed_action: {
      type: "hold",
      value: 0,
    },
    reason: "No demo adjustment is required inside the normalized envelope.",
    evidence: ["demo.state"],
    confidence: 0.9,
  };
}

function formatAction(result: ControlStepResult | null, which: "original" | "applied") {
  const action =
    which === "original"
      ? result?.verdict.originalAction
      : result?.verdict.action;

  if (!action) return "—";
  return `${action.type} · ${action.value.toFixed(3)}`;
}

export default function AgentControlPanel({ lang }: { lang: LanguageCode }) {
  const [plant, setPlant] = useState<VirtualPlantState>({ ...INITIAL_STATE });
  const [lastResult, setLastResult] = useState<ControlStepResult | null>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  const runtime = useMemo(
    () => new MockAgentRuntime((request) => makeProposal(request.state)),
    [],
  );

  const runStep = async () => {
    setBusy(true);
    try {
      const nextStep = step + 1;
      const result = await runAgentControlStep(
        runtime,
        {
          requestId: `demo-${nextStep}`,
          state: plant,
          objective: "Demonstrate guarded agentic control in normalized space.",
          evidence: ["demo.synthetic-state"],
        },
        plant,
        DEMO_NORMALIZED_SAFETY_ENVELOPE,
      );

      setPlant(result.nextState);
      setLastResult(result);
      setStep(nextStep);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setPlant({ ...INITIAL_STATE });
    setLastResult(null);
    setStep(0);
  };

  const toggleEmergencyStop = () => {
    setPlant((prev) => ({
      ...prev,
      emergencyStop: !prev.emergencyStop,
    }));
  };

  const verdictClass =
    lastResult?.verdict.status === "rejected"
      ? "agent-status rejected"
      : lastResult?.verdict.status === "clamped"
        ? "agent-status clamped"
        : "agent-status allowed";

  return (
    <section className="panel agent-panel" aria-labelledby="agent-control-title">
      <div className="agent-head">
        <div>
          <h2 id="agent-control-title" className="panel-title">
            Agent Control Demo
          </h2>
          <p className="agent-copy">
            {lang === "ja"
              ? "Mock Runtimeの提案を、決定論的Safety Gate経由でのみ仮想状態へ反映します。"
              : "Mock Runtime proposals can affect virtual state only through the deterministic Safety Gate."}
          </p>
        </div>
        <div className="agent-badges">
          <span className="agent-badge runtime">mock · deterministic-mock-v0</span>
          <span className="agent-badge envelope">DEMO_NORMALIZED_ONLY</span>
        </div>
      </div>

      <div className="agent-state-grid" aria-label="Normalized virtual plant state">
        <div className="agent-state-cell">
          <span>temp offset</span>
          <strong>{plant.temperatureOffsetNorm.toFixed(2)}</strong>
        </div>
        <div className="agent-state-cell">
          <span>seed rpm</span>
          <strong>{plant.seedRotationNorm.toFixed(2)}</strong>
        </div>
        <div className="agent-state-cell">
          <span>crucible rpm</span>
          <strong>{plant.crucibleRotationNorm.toFixed(2)}</strong>
        </div>
        <div className="agent-state-cell">
          <span>rf power</span>
          <strong>{plant.rfPowerNorm.toFixed(2)}</strong>
        </div>
        <div className="agent-state-cell">
          <span>mag field</span>
          <strong>{plant.magneticFieldNorm.toFixed(2)}</strong>
        </div>
        <div className="agent-state-cell">
          <span>e-stop</span>
          <strong className={plant.emergencyStop ? "agent-danger" : "agent-safe"}>
            {plant.emergencyStop ? "ON" : "OFF"}
          </strong>
        </div>
      </div>

      <div className="agent-actions">
        <button
          type="button"
          className="agent-primary-btn"
          onClick={runStep}
          disabled={busy}
        >
          {busy
            ? lang === "ja"
              ? "実行中…"
              : "Running…"
            : lang === "ja"
              ? "Agent Stepを実行"
              : "Run Agent Step"}
        </button>
        <button
          type="button"
          className={plant.emergencyStop ? "agent-estop-btn active" : "agent-estop-btn"}
          onClick={toggleEmergencyStop}
        >
          {plant.emergencyStop
            ? lang === "ja"
              ? "E-Stop解除"
              : "Release E-Stop"
            : "E-Stop"}
        </button>
        <button type="button" className="agent-reset-btn" onClick={reset}>
          {lang === "ja" ? "デモをリセット" : "Reset demo"}
        </button>
      </div>

      <div className="agent-flow">
        <div>
          <span className="agent-kicker">01 · proposal</span>
          <strong>{formatAction(lastResult, "original")}</strong>
        </div>
        <div className="agent-arrow" aria-hidden="true">→</div>
        <div>
          <span className="agent-kicker">02 · safety gate</span>
          <strong className={lastResult ? verdictClass : "agent-status"}>
            {lastResult?.verdict.status ?? "waiting"}
          </strong>
          <small>
            {lastResult?.verdict.reasonCodes.join(" · ") ?? "—"}
          </small>
        </div>
        <div className="agent-arrow" aria-hidden="true">→</div>
        <div>
          <span className="agent-kicker">03 · applied</span>
          <strong>{formatAction(lastResult, "applied")}</strong>
        </div>
      </div>

      <div className="agent-evidence">
        <div>
          <span>request</span>
          <strong>{lastResult?.runtimeEvidence.requestId ?? "—"}</strong>
        </div>
        <div>
          <span>runtime status</span>
          <strong>{lastResult?.runtimeEvidence.status ?? "—"}</strong>
        </div>
        <div>
          <span>latency</span>
          <strong>
            {lastResult
              ? `${lastResult.runtimeEvidence.latencyMs.toFixed(0)} ms`
              : "—"}
          </strong>
        </div>
        <div>
          <span>provider request</span>
          <strong>{lastResult?.runtimeEvidence.providerRequestId ?? "—"}</strong>
        </div>
      </div>

      <p className="agent-footnote">
        {lang === "ja"
          ? "このパネルは正規化されたデモ空間のみを扱い、実設備の運転条件・安全限界を表しません。"
          : "This panel operates only in normalized demo space and does not represent real equipment operating or safety limits."}
      </p>
    </section>
  );
}
