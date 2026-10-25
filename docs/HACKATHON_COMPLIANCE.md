# Nebius × NVIDIA Global AI Hackathon — compliance map

Rules source: <https://nebiusglobalaihackathon.devpost.com/rules>. The
development container could not open devpost.com (network policy), so the
requirements below were taken from the task brief and from search-indexed
excerpts of the official rules page. **Re-read the official rules before
submitting.**

Key facts used: submission period Aug 26, 2026 9:00 PT – **Oct 30, 2026
10:00 PT**; "runs on" = a runtime call to the Token Factory inference API or
running on Nebius AI Cloud compute; at least one NVIDIA open model; public
repository with an open-source license; pre-existing projects must be
significantly updated during the period and explain how.

Target track: **Best Apps and Agents** (Nemotron via Token Factory).

| Requirement | Evidence in this repository | Status |
|---|---|---|
| Genuine runtime call to Nebius Token Factory | `src/lib/pilot/nemotron.ts` (`POST {base}/chat/completions`, bearer auth), used by `/api/pilot/propose` and `/api/pilot/interpret`; `npm run live:smoke` | **IMPLEMENTED, NOT YET VERIFIED LIVE** — no credentials / host blocked in the build environment |
| Uses at least one NVIDIA open model | Default `nvidia/nemotron-3-super-120b-a12b` (from Nebius's Nemotron page); configurable; `/api/pilot/models` and `live:smoke` list NVIDIA ids from `/v1/models` | **UNVERIFIED** until `live:smoke` confirms the id |
| Functioning, coherent application | `/pilot`: full workflow, Demos A/B/C; E2E 9/9 in offline mode | DONE (offline); live path pending credentials |
| Reproducible and testable | `npm test` (119), `npm run e2e`, `npm run eval`, `npm run verify:evidence`, QFabric `pytest` (422) | DONE |
| Public source repository | github.com/Takzin1/crystaltwinai, github.com/Takzin1/QFabric | Work is on branches `feat/crystalpilot-agent` / `feat/crystalpilot-evidence`; must be merged/visible publicly |
| Open-source license | CrystalTwinAI: MIT (`LICENSE`); QFabric: Apache-2.0. The gate port in `gate.ts` derives from QFabric by the same author and credits its origin | DONE |
| Hosted demo or test build | Deployable Next.js app (Vercel-ready; existing deployment crystaltwinai.vercel.app) | **NOT DONE** — needs deployment with `NEBIUS_API_KEY` set as a server env var |
| English submission | README, docs and UI default to English (Japanese kept) | DONE |
| Public demo video < 3 min | Script: `docs/DEMO_SCRIPT.md` | **NOT DONE** — must be recorded and uploaded |
| Disclose substantial changes during the period | `docs/BUILD_CHANGELOG.md` (commit-level) | DONE (update with final commits) |
| Genuine feedback on Nebius/NVIDIA tooling | `docs/NEBIUS_NVIDIA_FEEDBACK.md` | PARTIAL — only pre-credential experience is real; fill after live use |
| No misrepresentation of the dev assistant | Docs state the product's model is Nemotron via Nebius; the coding assistant is not part of the runtime | DONE |

## What a judge can verify without credentials

1. `npm ci && npm test && npm run build && npm run eval`
2. `npm start` → open `/pilot` → OFFLINE DEMO: Demo A (approve and simulate),
   Demo B (adversarial candidates), Demo C (export, verify, tamper).
3. `python scripts/crystalpilot_verify.py <exported.json>` in QFabric.

## What requires credentials

Live proposal, live interpretation, model listing, the injection probe and
latency/token measurements. Without `NEBIUS_API_KEY` the UI says so and
disables those controls rather than simulating them.
