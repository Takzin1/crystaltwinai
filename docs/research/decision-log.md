# Architecture decision log

## ADR-001 — Open, reproducible physics before agentic control

**Status:** Accepted

**Decision:** Build a reproducible public physics/data layer before adding Nebius/NVIDIA agent control.

**Reason:** The project differentiates on auditability, reproducibility, uncertainty handling, and open benchmarks rather than on reproducing undisclosed industrial process conditions.

---

## ADR-002 — No guessed physical constants

**Status:** Accepted

**Decision:** Numeric material properties remain `null` until a primary source is attached with units, temperature/composition range, and citation metadata.

**Failure mode prevented:** silently converting an educational approximation into a falsely precise SiC process model.

---

## ADR-003 — Two-fidelity synthetic dataset

**Status:** Accepted

**Decision:**
- Stage A: 2D axisymmetric/coarse DOE for volume and smoke/regression coverage.
- Stage B: selected 3D sector/full-domain cases for high-fidelity correction and benchmark gold sets.

**Reason:** Full-3D everywhere is too expensive for the hackathon timeline and is not necessary for every parameter region.

---

## ADR-004 — Trajectory-aware train/test split

**Status:** Accepted

**Decision:** Adjacent snapshots from the same CFD trajectory must never be randomly split between train and test.

**Planned split:**
- Train: Furnace A operating conditions
- Validation: unseen conditions within Furnace A
- Test-ID: held-out parameter regions
- Test-OOD: Furnace B/C

---

## ADR-005 — LLM is not the safety-critical controller

**Status:** Accepted

**Decision:** Nemotron may propose actions and explanations. Deterministic code validates/clamps/rejects proposals before any virtual actuation.

```text
observation → state estimator → agent proposal → safety gate → virtual actuator
```

Rejected proposals fall back to a deterministic controller or no-op policy.
