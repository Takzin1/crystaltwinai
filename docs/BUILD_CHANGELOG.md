# Build changelog (hackathon disclosure)

Submission period: **Aug 26, 2026 09:00 PT – Oct 30, 2026 10:00 PT**.
All dates below come from `git log`; verify with
`git log --format='%h %ad %s' --date=short`.

## CrystalTwinAI (this repository)

**Pre-existing baseline (before the period):** commit `c4734be`
(2026-07-06). At that point the project was an educational crystallization
simulator: deterministic engine, rule-based scoring/risk/recommendations,
bilingual UI, deployed at crystaltwinai.vercel.app. It had no LLM, no
Nebius/NVIDIA integration and no experiment workflow.

**Changes during the period, before CrystalPilot** (2026-10-14 … 10-18):

| Commit | Date | Change |
|---|---|---|
| `e45c934` | 10-14 | Secure dataset ingestion and experiment catalog |
| `3b59c7e` | 10-15 | Research Schema v2 |
| `b01d1a4` | 10-16 | Research Schema v2.1 multi-run integrity |
| `de92462` | 10-18 | Offline QFabric bridge panel (synthetic, plan-only) |
| `a7f18a0`, `5ebfeae` | 10-14/18 | GitHub Actions maintenance |

**CrystalPilot (branch `feat/crystalpilot-agent`, 2026-10-25):**

| Commit | Change |
|---|---|
| `78fa3ac` | next 16.4.0 → 16.4.3 (critical advisories; build was blocked) |
| `46b2cb1` | Agent core: gate port + golden tests, strict JSON, state machine, planner, Nebius client, runner/checker/interpreter, evidence + verifier, API routes |
| `d1b6b38` | Engine: cross-runtime bit-identical exp/pow (found by E2E) |
| `9fcf7a1` | `/pilot` UI, Demos A/B/C, EN default, Playwright E2E |
| `0c99ac2` | CLI verifier and evidence-fixture exporter |
| `6ba1a12` | Eval harness, live smoke script, stricter verifier, CI |
| (this commit) | Submission documentation |

Everything under `src/lib/pilot/`, `src/app/pilot/`, `src/app/api/pilot/`,
`src/components/pilot/`, `src/lib/portable-math.ts`, `scripts/`, `eval/`,
`tests/pilot-*`, `tests/portable-math.test.ts`, `tests/e2e/` and the docs
listed in the README's submission section is new in the period.

## QFabric (github.com/Takzin1/QFabric)

First commit `685a29d` is dated 2026-09-29 — the repository was **created
during the period**. CrystalPilot work: commit `1509ff5` on branch
`feat/crystalpilot-evidence` (2026-10-25): gate golden-case exporter,
`qfabric.evidence` verifier, CLI, tests, CI step, docs. Existing
snapshot/proposal/assessment/review contracts were not changed.

## Reused, not new

- CrystalTwinAI's engine, scoring, risk and recommendation modules
  (pre-period), modified only in `scoring.ts` to call portable math.
- QFabric's `qfabric.orchestration` gate (created in the period, before
  CrystalPilot), ported to TypeScript.

## Tools disclosure

Development was assisted by an AI coding assistant (Claude Code). It is a
development tool only: the submitted application's runtime model is NVIDIA
Nemotron served by Nebius Token Factory.
