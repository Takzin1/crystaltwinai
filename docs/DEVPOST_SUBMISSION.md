# Devpost submission draft — CrystalPilot

> Draft. Items marked **[FILL]** need real values after live verification and
> deployment. Do not submit claims about live inference until
> `npm run live:smoke` has succeeded.

## Project title

CrystalPilot — Evidence-Gated AI Experiment Lab

## Short pitch (≤ 200 chars)

An NVIDIA Nemotron research agent that proposes experiments, but can't run one until deterministic code validates it, a human approves it, and every step lands in a verifiable evidence file.

## Problem

AI agents are being connected to labs and simulators, but an LLM's output is
untrusted text: it can be out of range, malformed, prompt-injected, or simply
overconfident. Most "AI copilots" either execute what the model says or give
no audit trail of why something ran. Students and researchers learning
AI-assisted experimentation need to see what a *safe* loop looks like.

## Solution

CrystalPilot wraps a Nemotron planner in an explicit, auditable workflow:

1. A crystallization scenario is simulated and its snapshot SHA-256-hashed.
2. Nemotron (Nebius Token Factory) proposes 1–3 parameter changes plus a
   **falsifiable prediction**.
3. The output is parsed as untrusted data and checked by a deterministic
   research gate (ported from QFabric, tested against its Python original).
4. A human must approve; the runner refuses anything else.
5. The deterministic engine recomputes; 8 independent checks run; the
   prediction is scored against the simulator.
6. Nemotron interprets the numbers; every claim is checked for contradictions
   and overclaims.
7. The run exports as a canonical-hash evidence file that can be verified —
   with full simulation replay — in the browser, Node, or QFabric's Python
   verifier. Follow-up experiments build on validated results.

## Technical implementation

- Next.js 16 / React 19 / TypeScript; server route handlers for inference.
- OpenAI-compatible Nebius client: timeouts, bounded retries with
  Retry-After, key redaction, usage/latency capture, JSON-mode fallback.
- Strict JSON reader (duplicate keys, NaN, trailing prose rejected).
- Explicit 10-state workflow machine with guarded transitions.
- Byte-bound chain: snapshot → proposal → assessment → review hashes.
- Cross-runtime bit-identical engine math (a 1-ULP `Math.log` difference
  between Node and Chromium was found by our E2E test and fixed).
- Canonical-JSON evidence (RFC 8785 style) implemented in TS and Python.
- Tests: 119 TS unit/contract tests, 9-step Playwright E2E, 422 QFabric
  pytest tests, offline eval harness.

## NVIDIA integration

NVIDIA Nemotron is the agent's planner and interpreter. Model id is
configurable per role (`NEBIUS_MODEL_PROPOSE`, `NEBIUS_MODEL_INTERPRET`) so a
smaller Nemotron can handle routine proposals and a larger one the
interpretation. Model used in the demo: **[FILL from live:smoke /v1/models]**.

## Nebius integration

All inference goes through Nebius Token Factory's OpenAI-compatible API from
the server (`/api/pilot/propose`, `/api/pilot/interpret`, `/api/pilot/models`).
Each live record keeps the provider response id, model, latency and token
usage; an optional HMAC lets the deployment attest its own live records.
Measured latency/tokens: **[FILL from live:smoke]**.

## Innovation

- The model must state a falsifiable prediction, which is scored against
  the simulator — LLM suggestions become testable hypotheses.
- "Evidence-gated": a proposal can't become an experiment without passing a
  gate and a human, and the proof of that is replayable by a third party in
  another language.
- Honest provenance UI: LIVE NEMOTRON vs OFFLINE DEMO vs SIMULATED DATA vs
  FILE INTEGRITY vs UNVERIFIED SCIENCE.

## Intended users

Process-engineering and chemistry students, instructors teaching AI-assisted
experimentation, and teams prototyping guardrails for lab agents.

## Impact

A concrete, open template for putting an LLM in an experiment loop without
letting it act unchecked. In our offline evaluation, 10/10 hostile candidates
were rejected with explicit reasons, while a naive parse-and-apply wrapper
executed 5/10 without review. The pattern (byte-bound gate, mandatory
review, replayable evidence) transfers to other simulators and, with real
authentication added, to real lab tooling.

## Limitations

Educational, simplified simulator; not a validated process model. Bounds are
model limits, not safety limits. Self-attested review, not authentication.
Hash integrity ≠ authenticated provenance. No hardware, quantum device or GPU
is driven by this app. See `docs/SCIENTIFIC_LIMITATIONS.md`.

## Testing instructions

- Hosted demo: **[FILL URL]**/pilot (LIVE NEMOTRON if the deployment has a key).
- Local, no key needed: `npm ci && npm run build && npm start` → `/pilot`.
  Demo A: "Unstable run" → Generate proposal → tick attestation → Approve →
  "Use deterministic interpretation". Demo B: pick an adversarial candidate →
  Submit. Demo C: Export evidence → Tamper buttons → see MISMATCH.
- Live: set `NEBIUS_API_KEY`, then `npm run live:smoke`.
- Verify an exported file: `npm run verify:evidence -- file.json`, or in
  QFabric `python scripts/crystalpilot_verify.py file.json`.

## Built with

nebius-token-factory, nvidia-nemotron, next.js, react, typescript, python,
playwright

## Links

- Code: https://github.com/Takzin1/crystaltwinai (CrystalPilot) ·
  https://github.com/Takzin1/QFabric (gate reference + Python verifier)
- Video: **[FILL]**
