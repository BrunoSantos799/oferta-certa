import { loadData, normalizeConfig, publicConfig, responseError, saveData } from "../../../lib/store";
import type { AppConfig } from "../../../lib/types";

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { config?: Partial<AppConfig>; clearAccessToken?: boolean };
    const { config, state } = await loadData(request);
    const incoming = payload.config || {};
    const next = normalizeConfig({
      ...config,
      ...incoming,
      accessToken: incoming.accessToken?.trim() || config.accessToken,
      rules: incoming.rules || config.rules,
      templates: incoming.templates || config.templates,
    });
    if (payload.clearAccessToken) next.accessToken = "";
    await saveData(request, next, state);
    return Response.json({ ok: true, config: publicConfig(next) });
  } catch (error) {
    return Response.json({ error: responseError(error) }, { status: 500 });
  }
}
