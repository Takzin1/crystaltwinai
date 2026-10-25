# Demo video script (target 2:45, hard limit < 3:00)

Record at 1440×900, browser zoom 100%, `/pilot` in English. Record with
**LIVE NEMOTRON** configured; if a live call fails during recording, say so
on screen rather than switching to an offline fixture silently.

| Time | Screen | Voice-over |
|---|---|---|
| 0:00–0:15 | `/pilot` hero: stepper + legend | "AI agents are starting to run experiments. CrystalPilot shows how to let an NVIDIA Nemotron model propose them — without letting it run anything unchecked." |
| 0:15–0:30 | Scenario: *Unstable run*; baseline panel (risk high, quality 38) | "This is an educational crystallization simulator. The baseline run is unstable: fast cooling causes nucleation bursts. Every number here is simulated, and labelled that way." |
| 0:30–0:55 | Click **Generate proposal**; LIVE NEMOTRON badge with model id, latency, tokens, response id | "The server sends the hashed snapshot to Nemotron on Nebius Token Factory. Here's its hypothesis, the parameter changes, and a falsifiable prediction. Model output is treated as untrusted data." |
| 0:55–1:10 | Gate box: *Ready for human review (not approved)*; open raw output | "A deterministic gate — ported from our QFabric project and tested against the Python original — checks schema, whitelist, ranges and the snapshot hash. Passing the gate is not approval." |
| 1:10–1:30 | Tick attestation → **Approve** → before/after table + chart | "Only a person can approve. The engine then recomputes. Quality and stability rise, nucleation drops — and the prediction is scored against what the simulator actually did." |
| 1:30–1:50 | Checks list; **Ask Nemotron to interpret**; contradictions/overclaim section | "Eight independent checks, including byte-exact replay. Nemotron's interpretation is checked claim by claim against the numbers — contradictions and overclaims are flagged." |
| 1:50–2:15 | Demo B: select *Prompt injection: self-approval field* → Submit; then *Unrecognized action* | "Now a hostile candidate: a prompt injection trying to pre-approve itself, and one asking for hardware execution. Both are rejected with explicit reasons. Nothing runs." (Optionally: **Injection probe (live)** — show what the real model did with an injected lab note.) |
| 2:15–2:40 | Demo C: **Export evidence**, **Verify** (PASS), **Tamper: inflate quality** (MISMATCH, replay fail); terminal: `python scripts/crystalpilot_verify.py file.json` | "Every run exports as evidence. Change one number and integrity fails; even if you re-hash, replay catches it. QFabric verifies the same file independently in Python. Integrity isn't identity — and we say so." |
| 2:40–2:50 | History → **Propose follow-up** | "Validated results feed the next experiment." |
| 2:50–2:58 | Footer disclaimer | "Educational simulator, not a validated process model. Code and evidence format are open source." |

Checklist before recording: live key set on the deployment; `/api/pilot/status`
shows `liveConfigured: true`; one warm-up call done; screen shows no secrets.
