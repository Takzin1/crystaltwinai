# CrystalPilot architecture

CrystalPilot is the `/pilot` route of this Next.js app. It is an evidence-gated
experiment agent: an NVIDIA Nemotron model on Nebius Token Factory proposes a
change to an **educational** crystallization simulation, deterministic code
validates it, a person approves it, the engine recomputes it, and the whole
run is exported as a verifiable evidence file.

This document describes what actually executes, and where.

## Component map

```text
 Browser (/pilot, React client)                    Server (Next.js route handlers, Node runtime)
 ─────────────────────────────                     ──────────────────────────────────────────────
 Scenario selector ──POST /api/pilot/propose──▶  A Scenario Reader   captureSnapshot(): runs the engine,
                                                                    serializes crystaltwin-qfabric-snapshot/1,
                                                                    SHA-256 of the exact bytes
                                                 B Experiment Planner buildProposalMessages() → chatCompletion()
                                                    (live: Nebius Token Factory, NVIDIA Nemotron)
                                                    (offline: labelled fixture, no call)
                                                    buildProposalFromModel(): strict JSON, server-owned
                                                    envelope, falsifiable prediction
                                                 C Research Gate      makeAssessment(): TypeScript port of
                                                                    QFabric qfabric.orchestration
                                    ◀── PilotRun (state AWAITING_REVIEW or REJECTED/FAILED)
 D Review Gate   reviewRun(): makeReview(), self-attested, requires the educational-use attestation
 E Runner        simulateRun() → runApprovedExperiment(): refuses unless the approval recomputes
 F Checker       8 independent checks + prediction check (in runApprovedExperiment)
 G Interpreter   deterministic (local)  ──or── POST /api/pilot/interpret ──▶ server re-runs E/F itself,
                                                    calls Nemotron, checkModelInterpretation()
 H Evidence      buildEvidence(): crystalpilot-evidence/1 with canonical-JSON SHA-256
 I Verifier      verifyEvidence(): integrity + planner/gate/review recomputation + simulation replay
                 (also: npm run verify:evidence, and QFabric's Python crystalpilot_verify.py)
```

All modules live in `src/lib/pilot/`:

| File | Responsibility |
|---|---|
| `workflow.ts` | State machine, transition table, recorded-history validation |
| `snapshot.ts` | Baseline capture, snapshot serialization, engine fingerprint |
| `planner.ts` | Prompt construction, model-output contract, proposal envelope |
| `nemotron.ts` | Server-only Nebius Token Factory client (OpenAI-compatible) |
| `gate.ts` | TypeScript port of QFabric's research gate |
| `strict-json.ts` | Parser that rejects duplicate keys / NaN / trailing text like Python's gate |
| `experiment.ts` | Runner, independent checker, prediction check, interpreter and contradiction check |
| `evidence.ts` | Evidence document, canonical hashing, verifier |
| `agent.ts` | Orchestration of A–I through the state machine |
| `server.ts` | Request limits, input validation, rate limits, optional HMAC attestation |
| `fixtures.ts` | Labelled OFFLINE DEMO fixtures (plausible + adversarial) |
| `../portable-math.ts` | Cross-runtime bit-identical `exp/log/pow` used by the engine |

## Workflow states

| State | Meaning | Allowed next |
|---|---|---|
| CREATED | Baseline captured and hashed | PROPOSED, FAILED |
| PROPOSED | Candidate received (live model or labelled fixture) | VALIDATED, REJECTED |
| VALIDATED | Gate: in contract and in range (not an approval) | AWAITING_REVIEW |
| AWAITING_REVIEW | Waiting for a human | APPROVED, REJECTED |
| APPROVED | Self-attested human approval of these exact bytes | SIMULATED, FAILED |
| SIMULATED | Engine recomputed the approved inputs | VERIFIED, INCONCLUSIVE, FAILED |
| VERIFIED | All checks + replay passed (computational only) | — |
| INCONCLUSIVE | Ran, but interpretation contradicted numbers or nothing changed | — |
| REJECTED | Contract/gate/reviewer refusal; nothing ran | — |
| FAILED | Provider, invariant or replay failure | — |

Any other transition throws `TransitionError`. Recorded histories are
re-validated by both verifiers.

## Trust boundaries

1. **Model output is data.** Only `hypothesis`, `rationale`, `changes`,
   `requestedAction` (+ optional `prediction`) come from the model. The server
   writes `schemaVersion`, `kind`, `proposalId`, `snapshotSha256` and
   `source`; a model that tries to set them is rejected. No prose is
   executed, evaluated or used to select code paths. No text is "scraped" out
   of surrounding prose: the content must be exactly one JSON object (a
   leading `<think>` block or a single code fence is removed and noted).
2. **The gate binds bytes.** A proposal names the SHA-256 of the exact
   snapshot bytes; the assessment names the proposal's SHA-256; the review
   names the assessment's SHA-256. Editing any of them breaks recomputation.
3. **Human approval cannot be skipped in the app.** The runner re-derives the
   approval from the recorded bytes and refuses anything else; the
   `/api/pilot/interpret` route does the same server-side. Approval is
   self-attested, not authenticated identity.
4. **The server never trusts client metrics.** `/propose` recomputes the
   baseline from the six validated inputs; `/interpret` recomputes the whole
   experiment before showing numbers to the model.
5. **Secrets stay on the server.** `NEBIUS_API_KEY` is read only in route
   handlers; it is never returned, logged or echoed (provider error text is
   redacted and truncated).

## Live vs offline

| | LIVE NEMOTRON | OFFLINE DEMO |
|---|---|---|
| Trigger | `NEBIUS_API_KEY` set on the server | default without a key, and all Demo B candidates |
| Model call | `POST {NEBIUS_BASE_URL}/chat/completions` | none |
| Proposal `source` | `unverified_model / nebius-token-factory / <response model id>` | `synthetic_fixture / offline / none` |
| Evidence `inference.mode` | `live_nebius` with response id, latency, usage | `offline_fixture` with fixture id; content must equal the fixture |
| Attestation | optional HMAC (`EVIDENCE_ATTESTATION_SECRET`) | n/a |

## Why a TypeScript port of the QFabric gate

The hosted demo is a single Next.js deployment. QFabric's gate is a Python
package and does not execute inside that deployment. Rather than adding a
second service, the gate was ported and tied to the Python implementation by
**39 golden cases generated by the real Python module** (QFabric
`scripts/export_gate_golden.py`): accept, reject and refusal paths including
NaN, overflow, duplicate keys, extra fields, hardware actions and forged
provenance. `tests/pilot-gate-golden.test.ts` requires exact equality of
results and error messages.

**What QFabric executes for real:** its Python gate generates the golden
cases, and `scripts/crystalpilot_verify.py` independently re-runs
`make_assessment` / `make_review` on the bytes embedded in exported evidence.
QFabric's QICK plan and synthetic-IQ bridge are **not** used by CrystalPilot.

## Cross-runtime determinism

`Math.log`/`Math.pow` are implementation-approximated in JavaScript. The
browser E2E test found a 1-ULP difference between Node 22 and Chromium 153
(`Math.log(3)`), which made server snapshots non-replayable in the browser.
The engine now uses `src/lib/portable-math.ts` (only correctly-rounded IEEE
basic operations), and the E2E test re-verifies browser-exported evidence in
Node. Engine outputs changed by at most a few ULP.

## Evidence format (`crystalpilot-evidence/1`)

```json
{ "schemaVersion": "crystalpilot-evidence/1",
  "kind": "crystalpilot_experiment_evidence",
  "body": { "app": {"name","version","engineFingerprint"}, "exportedAt",
            "run": { snapshotText, proposalText, assessmentText, reviewText,
                     inference{rawContent,…}, experiment, interpretation, history, … },
            "limitations": [...] },
  "integrity": { "algorithm": "sha256/canonical-json", "bodySha256", "scope": "file_integrity_only" } }
```

Snapshot, proposal, assessment and review are stored as **exact text** so
their byte hashes can be recomputed. Canonical JSON: keys sorted by UTF-16
code units, no whitespace, ECMAScript number formatting (implemented
identically in `canonical.ts` and QFabric `qfabric/evidence.py`).

## Deployment shape

- One Next.js 16 app (Vercel or any Node host). Route handlers use the Node
  runtime with `maxDuration = 60`.
- No database. Run state lives in the browser session; evidence is exported
  as a file.
- Abuse controls: 64 KiB request limit, same-origin check, strict input
  schema, per-client (12/10 min) and per-instance (120/h) live-call budgets.
  These counters are in-memory per instance: a cost guard, not a security
  boundary. Configure a spend limit on the Nebius account as well.
