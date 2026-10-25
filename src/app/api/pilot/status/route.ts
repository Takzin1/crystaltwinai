import { loadConfig } from "@/lib/pilot/nemotron";
import { attestationAvailable, budgetStatus } from "@/lib/pilot/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reports whether live inference is configured. Never returns the key. */
export async function GET() {
  try {
    const config = loadConfig();
    return Response.json({
      liveConfigured: config.apiKey !== null,
      provider: "nebius-token-factory",
      baseUrlHost: new URL(config.baseUrl).host,
      proposeModel: config.proposeModel,
      interpretModel: config.interpretModel,
      attestation: attestationAvailable(),
      budget: budgetStatus(),
    });
  } catch {
    return Response.json({ liveConfigured: false, error: "Server inference configuration is invalid." }, { status: 500 });
  }
}
