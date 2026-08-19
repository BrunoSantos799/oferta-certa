import { loadData, responseError, saveData } from "../../../lib/store";

export async function DELETE(request: Request) {
  try {
    const { config, state } = await loadData(request);
    state.robotLogs = [];
    await saveData(request, config, state);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: responseError(error) }, { status: 500 });
  }
}
