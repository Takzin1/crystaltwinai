import { liveInferenceRecord } from "@/lib/pilot/agent";
import {
  ReviewRequiredError,
  buildInterpretationMessages,
  checkModelInterpretation,
  runApprovedExperiment,
} from "@/lib/pilot/experiment";
import { ProviderError, chatCompletion, loadConfig } from "@/lib/pilot/nemotron";
import { parsePrediction, unwrapModelContent } from "@/lib/pilot/planner";
import { sha256Text } from "@/lib/pilot/sha256";
import { RequestError, attest, clientKey, errorResponse, readJsonBody, reserveLiveCall } from "@/lib/pilot/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const text = (v: unknown, name: string) => {
  if (typeof v !== "string" || v.length > 40_000) throw new RequestError(400, `${name} must be bounded text.`);
  return v;
};

/**
 * Live Result Interpreter. The server re-runs the approved experiment itself
 * (refusing anything without a recomputable approval) so the model only ever
 * sees numbers this server computed. Claims are then checked against them.
 */
export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request, 160 * 1024);
    const args = {
      snapshotText: text(body.snapshotText, "snapshotText"),
      proposalText: text(body.proposalText, "proposalText"),
      assessmentText: text(body.assessmentText, "assessmentText"),
      reviewText: text(body.reviewText, "reviewText"),
      prediction: parsePrediction(body.prediction ?? []),
    };
    if (typeof args.prediction === "string") throw new RequestError(400, args.prediction);
    let outcome;
    try {
      outcome = runApprovedExperiment({ ...args, prediction: args.prediction as Exclude<typeof args.prediction, string> });
    } catch (error) {
      if (error instanceof ReviewRequiredError) throw new RequestError(403, error.message);
      throw new RequestError(400, "Experiment could not be recomputed.");
    }
    const config = loadConfig();
    if (!config.apiKey) throw new RequestError(503, "Live inference is not configured on this deployment.");
    reserveLiveCall(clientKey(request));
    const proposal = JSON.parse(args.proposalText);
    const completion = await chatCompletion(
      config, config.interpretModel, buildInterpretationMessages(outcome, String(proposal.hypothesis ?? ""), proposal.changes),
    );
    const inference = liveInferenceRecord(completion);
    inference.attestation = attest(`interpretation|${sha256Text(args.proposalText)}`, inference);
    try {
      const interpretation = checkModelInterpretation(completion.content, outcome, (c) => unwrapModelContent(c).text);
      return Response.json({ interpretation, inference });
    } catch (error) {
      return Response.json({
        interpretation: null,
        inference,
        rejected: `Model interpretation rejected: ${error instanceof Error ? error.message : "invalid"}`,
      });
    }
  } catch (error) {
    if (error instanceof ProviderError) return Response.json({ error: error.message, kind: error.kind }, { status: 502 });
    return errorResponse(error);
  }
}
