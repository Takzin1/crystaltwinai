# Scientific and hardware limitations

CrystalPilot is an educational research-workflow demonstrator. Read this
before interpreting any number it shows.

## The simulator

- CrystalTwinAI's engine is a **simplified pedagogical model**: linear
  solubility, power-law growth, threshold nucleation, rule-based scores. It is
  not calibrated to, or validated against, any experimental crystallization
  data.
- All metrics (growth rate, stability, quality, yield, supersaturation,
  nucleation events, risk) are outputs of that model in arbitrary or
  composite units. They are **simulated data, not measurements**.
- Parameter bounds (e.g. cooling rate 0.05–2.0 °C/min) are **educational
  model input limits**. They are not physical safety limits, equipment
  ratings or process specifications.
- A "VERIFIED" run means the deterministic checks and replay passed —
  a **computational** property. It does not mean the hypothesis is true of
  any real material or process.
- Results do not demonstrate industrial applicability, scale-up behaviour,
  product quality, safety or cost.

## The model (NVIDIA Nemotron via Nebius Token Factory)

- The model proposes hypotheses and parameter changes. A proposal is a
  suggestion, never evidence.
- The "falsifiable prediction" is checked only against **this simulator**.
  A confirmed prediction shows consistency with the pedagogical model, not
  physical validity.
- Model interpretations are checked for direction contradictions against the
  computed numbers and scanned for overclaim phrases (e.g. "proves",
  "validated", "measured"). This scan is a heuristic; it can miss
  overclaims and flag harmless wording.
- Live inference has **not been verified from the development environment**
  (no credentials; provider host blocked by its network policy). See
  `docs/EVALUATION.md` and `docs/HACKATHON_COMPLIANCE.md`.

## Provenance and integrity

- SHA-256 digests show that bytes are unchanged. They do **not** show who
  produced them, or that a live model was really called.
- Evidence files are self-reported. An attacker can edit descriptive fields
  and recompute the digest; the verifier then still catches changes to
  anything bound by recomputation (snapshot, proposal, assessment, review,
  simulation results, history, offline fixture content, live-interpretation
  contradictions) but not to free descriptive fields (timestamps, latency,
  labels). In the offline mutation test, 135 of 169 leaf edits were caught
  after re-hashing; all 169 were caught without re-hashing.
- The optional server HMAC attestation proves only that a record was signed
  by a deployment holding the secret.
- Reviewer identity is **self-declared**. There is no authentication,
  signature or multi-party approval.

## Hardware, quantum and GPU

- No physical device, quantum hardware, QICK board or industrial equipment is
  controlled, triggered or read. CrystalPilot has no code path for it.
- QFabric's QICK plans remain plan-only and are **not used** by CrystalPilot.
  QFabric's synthetic IQ analytics are unrelated to crystallization outcomes
  and are not mixed into CrystalPilot results.
- No NVIDIA GPU is used by this application's own code. Model inference runs
  on Nebius's infrastructure; this project makes no claim about the hardware
  that served a given request beyond what the provider reports.
- No quantum advantage, GPU speedup, energy saving or cost saving is claimed.

## Reproducibility scope

- Offline runs are bit-reproducible across Node and Chromium (portable math,
  engine fingerprint `9d75aa47…16f1` at the time of writing).
- Live model outputs are **not** reproducible: the same prompt can yield a
  different proposal. Evidence files store the exact model output so the
  downstream steps remain reproducible from it.
