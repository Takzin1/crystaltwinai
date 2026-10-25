import { ProviderError, isNvidiaModel, listModels, loadConfig } from "@/lib/pilot/nemotron";
import { RequestError, clientKey, errorResponse, reserveLiveCall } from "@/lib/pilot/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lists NVIDIA/Nemotron model ids actually returned by the provider's /v1/models. */
export async function GET(request: Request) {
  try {
    const config = loadConfig();
    if (!config.apiKey) throw new RequestError(503, "Live inference is not configured on this deployment.");
    reserveLiveCall(clientKey(request));
    const ids = await listModels(config);
    return Response.json({ nvidiaModels: ids.filter(isNvidiaModel), totalModels: ids.length });
  } catch (error) {
    if (error instanceof ProviderError) return Response.json({ error: error.message, kind: error.kind }, { status: 502 });
    return errorResponse(error);
  }
}
