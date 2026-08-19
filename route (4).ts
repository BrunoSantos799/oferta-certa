import { DEFAULT_STATE, loadData, responseError, saveData } from "../../../../lib/store";

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { confirm?: string };
    if (payload.confirm !== "LIMPAR") {
      return Response.json({ error: "Confirmação inválida." }, { status: 400 });
    }
    const { config } = await loadData(request);
    await saveData(request, config, JSON.parse(JSON.stringify(DEFAULT_STATE)));
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: responseError(error) }, { status: 500 });
  }
}
