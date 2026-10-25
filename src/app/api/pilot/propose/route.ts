import { proposeExperiment } from "@/lib/pilot/agent";
import { findFixture } from "@/lib/pilot/fixtures";
import { ProviderError, chatCompletion, loadConfig } from "@/lib/pilot/nemotron";
import {
  RequestError,
  attest,
  clientKey,
  errorResponse,
  parseHistory,
  parseScenarioId,
  parseSimulationInput,
  readJsonBody,
  reserveLiveCall,
} from "@/lib/pilot/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scenario → baseline snapshot → planner (live Nemotron or labelled offline
 * fixture) → model-output contract → research gate. Stops at AWAITING_REVIEW;
 * nothing is approved or simulated here.
 */
export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const mode = body.mode;
    if (mode !== "live" && mode !== "offline") throw new RequestError(400, "mode must be live or offline.");
    const scenarioId = parseScenarioId(body.scenarioId);
    const input = parseSimulationInput(body.input);
    const history = parseHistory(body.history);
    const objective = typeof body.objective === "string" ? body.objective.slice(0, 300) : undefined;
    const fixtureId = typeof body.fixtureId === "string" ? body.fixtureId : null;
    if (fixtureId && (mode !== "offline" || !findFixture(fixtureId))) throw new RequestError(400, "Unknown offline fixture.");
    const iteration = typeof body.iteration === "number" ? body.iteration : 1;
    const parentRunId = typeof body.parentRunId === "string" ? body.parentRunId.slice(0, 80) : null;

    let complete = null;
    if (mode === "live") {
      const config = loadConfig();
      if (!config.apiKey) throw new RequestError(503, "Live inference is not configured on this deployment (NEBIUS_API_KEY missing). Use OFFLINE DEMO mode.");
      reserveLiveCall(clientKey(request));
      complete = (messages: Parameters<typeof chatCompletion>[2]) => chatCompletion(config, config.proposeModel, messages);
    }
    const run = await proposeExperiment(
      { mode, scenarioId, input, objective, fixtureId, probe: body.probe === true, history, iteration, parentRunId },
      complete,
    );
    if (run.inference) run.inference.attestation = attest(`proposal|${run.runId}|${run.snapshotSha256}`, run.inference);
    return Response.json({ run });
  } catch (error) {
    if (error instanceof ProviderError) return Response.json({ error: error.message, kind: error.kind }, { status: 502 });
    return errorResponse(error);
  }
}
