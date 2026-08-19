import { loadData, publicConfig, responseError } from "../../../lib/store";

export async function GET(request: Request) {
  try {
    const { config, state } = await loadData(request);
    return Response.json({
    app: { name: "Oferta Certa Hub", version: "App 2.2" },
      config: publicConfig(config),
      state,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: responseError(error) }, { status: 500 });
  }
}
