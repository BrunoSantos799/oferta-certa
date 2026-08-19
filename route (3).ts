import { loadData, responseError } from "../../../../lib/store";

export async function GET(request: Request) {
  try {
    const { config, state } = await loadData(request);
    const safeConfig = { ...config, accessToken: undefined };
    const payload = JSON.stringify({
      app: "Oferta Certa Hub Web",
      exportedAt: new Date().toISOString(),
      config: safeConfig,
      state,
    }, null, 2);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
    return new Response(payload, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="oferta-certa-backup-${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return Response.json({ error: responseError(error) }, { status: 500 });
  }
}
