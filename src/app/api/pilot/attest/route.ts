import { verifyEvidence } from "@/lib/pilot/evidence";
import { sha256Text } from "@/lib/pilot/sha256";
import { checkAttestation, errorResponse, readJsonBody, RequestError } from "@/lib/pilot/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Checks the optional server attestation on live inference records inside an
 * evidence file. Only meaningful on the deployment that holds the secret.
 */
export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request, 1024 * 1024 + 1024);
    if (typeof body.evidence !== "string") throw new RequestError(400, "evidence must be the exported file text.");
    const report = verifyEvidence(body.evidence, { replay: false });
    const run = report.run;
    if (!run || report.integrity !== "VERIFIED") {
      return Response.json({ proposal: "unchecked", interpretation: "unchecked", reason: "File integrity must verify first." });
    }
    const proposal = run.inference
      ? checkAttestation(`proposal|${run.runId}|${run.snapshotSha256}`, run.inference)
      : "absent";
    const interpretation = run.interpretationInference && run.proposalText
      ? checkAttestation(`interpretation|${sha256Text(run.proposalText)}`, run.interpretationInference)
      : "absent";
    return Response.json({ proposal, interpretation });
  } catch (error) {
    return errorResponse(error);
  }
}
