# Agent runtime evidence

The agent runtime layer records evidence for each proposal attempt before the
deterministic safety gate decides whether the action may be applied.

Current evidence fields include:

- CrystalTwin request ID,
- runtime ID,
- model identifier,
- provider request ID when available,
- success / timeout / error status,
- start/end timestamps and latency,
- raw model text when available,
- token usage when exposed by the provider,
- runtime error string on failure.

## Nebius integration boundary

`NebiusTokenFactoryRuntime` depends on an internal
`TokenFactoryInferenceClient` interface.

This repository intentionally does **not** guess the current Nebius HTTP
endpoint, SDK method name, authentication header, or response envelope. The
official verified Nebius integration should implement that client interface and
preserve the same downstream safety gate.

## Non-bypassable flow

```text
Nebius / Mock runtime
        ↓
structured proposal
        ↓
deterministic safety gate
        ↓
virtual actuator
```

Timeouts and provider exceptions fail closed and leave virtual plant state
unchanged.
