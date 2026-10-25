# Feedback on Nebius Token Factory and NVIDIA Nemotron

Honesty note: as of 2026-10-25 the live service has **not** been called from
this project's development environment (no API key in the container, and its
network policy blocked `api.tokenfactory.nebius.com`). Only the experience
below was actually had. Sections marked **[after live use]** must be written
by the team after running `npm run live:smoke` and the hosted demo — do not
fill them with assumptions.

## What we actually experienced

**Documentation discovery.** The API reference at
`api.tokenfactory.nebius.com/docs` could not be fetched from our sandbox, so
we relied on secondary sources. We found two different base URLs in public
material (`api.tokenfactory.nebius.com/v1/` and a region-specific
`api.tokenfactory.us-central1.nebius.com/v1/`). We made the base URL
configurable (`NEBIUS_BASE_URL`) and default to the first. A single canonical
statement of the base URL in the quick-start would remove that ambiguity.

**Model identifiers.** Nebius's Nemotron page names
`nvidia/nemotron-3-super-120b-a12b`, but we did not find a public list of
exact ids for the other Nemotron variants. We therefore list `/v1/models` at
runtime (`/api/pilot/models`, `live:smoke`) instead of hard-coding ids. A
public, stable table of model ids with structured-output support per model
would help.

**OpenAI compatibility.** Because the API is OpenAI-compatible, the client is
~150 lines of `fetch` with no SDK dependency. Uncertainty remained about
`response_format` support per model, so the client falls back once to plain
mode if the provider rejects it, and the parser tolerates a leading
`<think>` block in case a reasoning model emits one.

**Hackathon onboarding.** Credits are distributed through promo codes on the
Devpost page; we could not complete account setup from inside the
development container.

## [after live use] Inference integration

- Did `response_format: json_object` work with the chosen Nemotron model?
- Observed latency (median / p95) and token usage from `live:smoke`.
- Rate-limit behaviour and Retry-After headers.
- Whether reasoning traces appeared in `content`.

## [after live use] What worked / what didn't

## [after live use] Would we use it again?
