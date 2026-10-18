# QFabric × CrystalTwinAI — NVIDIA research bridge

This is a **synthetic, offline research demonstrator**, not quantum-enabled
crystallization control, validated industrial simulation, or proof of quantum
advantage. The NVIDIA-related path is an optional CuPy-on-CUDA numerical
backend, **not** an NVIDIA NIM or a verified Devpost integration.

## Existing components

- CrystalTwinAI: Next.js educational crystallization engine (local browser).
- QFabric: versioned control protocol and QICK-shaped **plan-only** compiler.
- Bridge: local JSON interchange of simulator snapshots and QFabric reports.
- NVIDIA CUDA: optional GPU processing for explicitly synthetic IQ arrays;
  CPU path is the baseline and works without an NVIDIA GPU.

## Complete walkthrough (offline)

1. Open CrystalTwinAI and adjust the educational simulation.
2. Scroll to **QFabric × CrystalTwinAI · NVIDIA Research Bridge**.
3. Click **Export current twin JSON**. This locally downloads the synthetic
   time-series and current summary.
4. In the separate QFabric checkout, install Python 3.11+ and:
   ```bash
   python -m pip install -e ".[dev]"
   python scripts/crystaltwin_bridge.py path/to/crystaltwin-qfabric-snapshot.json report.json --backend cpu --shots 4096
   ```
   On a machine where CUDA and matching CuPy are actually available, use
   `--backend cuda` or `--backend auto` for explicit fallback.
5. Return to CrystalTwinAI and choose **Import QFabric report**.
6. Confirm the JSON displays the **actual reported** backend, analytic IQ
   summary, provenance, snapshot digest, and `readoutStatus=intent_only`.
7. For a self-contained UI preview, click **Load synthetic example**. The
   included example has `elapsedMs=0` as a placeholder; **never use it
   as evidence of GPU speedup**.

## What the integration does NOT do

- No browser-to-Python network service, API credentials or data transfer.
- No quantum device connection, physical QICK readout or acquisition.
- No measured crystallization signals; the mathematical IQ waveform is
  **not** a measurement of the process being simulated.
- No automatic coupling of quantum data to crystallization parameters.
- No validation that the simplified educational model fits measured data.
- No GPU performance claim until a reproducible run on NVIDIA hardware.
- No verified Devpost contest rule, deadline, or official NVIDIA eligibility
  assertion. Read the exact contest brief before final submission.

## Interface and provenance

Version identifiers:

- CrystalTwin snapshot: `crystaltwin-qfabric-snapshot/1`
- QFabric report: `qfabric-crystaltwin-report/1`

Snapshot includes the selected inputs, key educational outputs and trajectory.
QFabric rejects malformed values, non-finite numbers, incompatible versions
and misleading provenance labels, then emits a control **plan** with readout
**intent only**. Imported reports are read in the browser and locally
schema-checked; the reported source SHA-256 is a *producer claim*, not
independently verified unless the original exact input file is provided.

The mirrored fixture SHA in `tests/qfabric-bridge.test.ts` is checked against
`public/examples/qfabric-snapshot.synthetic.json`. The sample is deliberately
hand-authored, synthetic, and not a CPU/GPU speed benchmark.

## Intended competition presentation

**Proposed title:** Quantum-Classical Research Twin: Auditable Instrument Plans
and CUDA-Accelerated Synthetic Analysis.

**Pitch:** An auditable experiment interoperability prototype that puts
versioned instrument-control plans, educational digital-twin snapshots and
optional NVIDIA CUDA processing into one traceable, reproducible workflow.

**Evidence to show:** one CPU run, one actual CUDA run (if supported by hardware),
identical schema/provenance metadata, screenshot of imported report, genuine
CI logs, and separate limitations slide.

See the [QFabric architecture and readout roadmap](https://github.com/Takzin1/QFabric/blob/main/docs/integrations/crystaltwin-nvidia.md).
