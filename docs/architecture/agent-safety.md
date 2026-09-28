# Agent safety boundary

CrystalTwinAI treats model output as **untrusted input**.

```text
sensor/state
    ↓
agent / Nemotron proposal
    ↓
runtime validation
    ↓
deterministic safety gate
    ↓
virtual actuator
```

The model never receives an API that directly mutates the virtual plant.

## Current envelope

The initial envelope is explicitly marked:

```text
DEMO_NORMALIZED_ONLY
```

It mirrors normalized DOE coordinates and is **not** a source-verified physical
operating envelope for SiC equipment.

## Gate behavior

The deterministic gate:

- rejects malformed proposals,
- rejects non-finite numbers,
- rejects confidence outside [0,1],
- rejects all actuation during emergency stop,
- clamps per-step action magnitude,
- clamps target state to absolute normalized bounds,
- converts `hold` to a zero action,
- emits machine-readable reason codes.

The actuator accepts only a successful `SafetyVerdict`. Rejected proposals
cannot be applied through the supported actuation path.

## Future promotion

When source-verified physical control limits become available, a physical
safety envelope can be introduced as a separate versioned artifact. The demo
normalized envelope must remain clearly distinguishable from real equipment
limits.
