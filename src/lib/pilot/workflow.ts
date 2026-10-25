/**
 * Explicit experiment workflow state machine.
 *
 * Every transition is checked against TRANSITIONS; anything else throws.
 * A proposal can only reach SIMULATED through AWAITING_REVIEW → APPROVED,
 * and APPROVED is only reachable from a recorded human decision.
 */

export const STATES = [
  "CREATED",
  "PROPOSED",
  "VALIDATED",
  "REJECTED",
  "AWAITING_REVIEW",
  "APPROVED",
  "SIMULATED",
  "VERIFIED",
  "INCONCLUSIVE",
  "FAILED",
] as const;
export type WorkflowState = (typeof STATES)[number];

/** Meaning of each state, shown in the UI and in docs/ARCHITECTURE.md. */
export const STATE_DEFINITIONS: Record<WorkflowState, string> = {
  CREATED: "Baseline educational simulation captured as a hashed snapshot.",
  PROPOSED: "A candidate change was received from the planner (live model or labelled offline fixture).",
  VALIDATED: "The deterministic research gate found the candidate in contract and in range.",
  REJECTED: "The candidate failed the model-output contract or the gate, or the reviewer rejected it. Nothing ran.",
  AWAITING_REVIEW: "Waiting for an explicit, self-attested human decision.",
  APPROVED: "A human approved this exact proposal for educational simulation only.",
  SIMULATED: "The deterministic CrystalTwinAI engine recomputed the approved inputs.",
  VERIFIED: "Independent checks and deterministic replay passed. Computational check only — not scientific validation.",
  INCONCLUSIVE: "The simulation ran, but the interpretation contradicted the computed results or nothing changed.",
  FAILED: "A provider, invariant or replay check failed.",
};

export const TRANSITIONS: Record<WorkflowState, readonly WorkflowState[]> = {
  CREATED: ["PROPOSED", "FAILED"],
  PROPOSED: ["VALIDATED", "REJECTED"],
  VALIDATED: ["AWAITING_REVIEW"],
  AWAITING_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["SIMULATED", "FAILED"],
  SIMULATED: ["VERIFIED", "INCONCLUSIVE", "FAILED"],
  REJECTED: [],
  VERIFIED: [],
  INCONCLUSIVE: [],
  FAILED: [],
};

export const TERMINAL_STATES: readonly WorkflowState[] = ["REJECTED", "VERIFIED", "INCONCLUSIVE", "FAILED"];

export interface StateEntry {
  state: WorkflowState;
  at: string;
  detail: string;
}

export class TransitionError extends Error {
  constructor(from: WorkflowState, to: WorkflowState) {
    super(`Invalid workflow transition ${from} → ${to}.`);
    this.name = "TransitionError";
  }
}

export function canTransition(from: WorkflowState, to: WorkflowState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function startHistory(detail: string, at = new Date().toISOString()): StateEntry[] {
  return [{ state: "CREATED", at, detail }];
}

export function currentState(history: readonly StateEntry[]): WorkflowState {
  if (history.length === 0) throw new Error("Workflow history is empty.");
  return history[history.length - 1].state;
}

/** Returns a new history; never mutates the input. */
export function transition(
  history: readonly StateEntry[],
  to: WorkflowState,
  detail: string,
  at = new Date().toISOString(),
): StateEntry[] {
  const from = currentState(history);
  if (!canTransition(from, to)) throw new TransitionError(from, to);
  return [...history, { state: to, at, detail: detail.slice(0, 500) }];
}

/** Validates a recorded history (e.g. from an imported evidence file). */
export function checkHistory(history: unknown): string | null {
  if (!Array.isArray(history) || history.length === 0) return "history must be a nonempty array";
  if (history.length > 20) return "history is unexpectedly long";
  let previous: WorkflowState | null = null;
  for (const entry of history) {
    if (!entry || typeof entry !== "object") return "history entry must be an object";
    const { state, at, detail } = entry as Record<string, unknown>;
    if (typeof state !== "string" || !(STATES as readonly string[]).includes(state)) {
      return `unknown workflow state: ${String(state)}`;
    }
    if (typeof at !== "string" || Number.isNaN(Date.parse(at))) return "history timestamp is invalid";
    if (typeof detail !== "string") return "history detail must be text";
    if (previous === null) {
      if (state !== "CREATED") return "history must start at CREATED";
    } else if (!canTransition(previous, state as WorkflowState)) {
      return `invalid recorded transition ${previous} → ${state}`;
    }
    previous = state as WorkflowState;
  }
  return null;
}
