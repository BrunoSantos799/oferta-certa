import { collectMarketplace } from "../../../lib/marketplace";
import { loadData, responseError, saveData } from "../../../lib/store";
import type { AppConfig, Diagnostics } from "../../../lib/types";

async function marketplaceTest(config: AppConfig) {
  try {
    const result = await collectMarketplace("monitor 24 polegadas", { ...config, limitPerTerm: 5 });
    return {
      status: "ok" as const,
      detail: `${result.items.length} produtos reconhecidos pela fonte “${result.source}”.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha de conexão.";
    return {
      status: "warn" as const,
      detail: (/internal error|reference\s*=/i.test(message)
        ? "A fonte externa recusou a conexão temporariamente."
        : message).slice(0, 300),
    };
  }
}

export async function POST(request: Request) {
  try {
    const { config, state } = await loadData(request);
    const marketplace = await marketplaceTest(config);
    const diagnostics: Diagnostics = {
      at: new Date().toISOString(),
      status: marketplace.status === "ok" ? "ok" : marketplace.status === "warn" ? "attention" : "error",
      tests: [
        { id: "site", label: "Site Oferta Certa", status: "ok", detail: "Aplicação web carregada e respondendo." },
        { id: "database", label: "Banco de dados", status: "ok", detail: "Leitura e gravação online disponíveis." },
        { id: "rules", label: "Regras de busca", status: config.rules.some((rule) => rule.active) ? "ok" : "warn", detail: config.rules.some((rule) => rule.active) ? `${config.rules.filter((rule) => rule.active).length} regras ativas.` : "Nenhuma regra ativa." },
        { id: "marketplace", label: "Fonte Mercado Livre", ...marketplace },
      ],
    };
    state.lastDiagnostics = diagnostics;
    await saveData(request, config, state);
    return Response.json({ ok: true, diagnostics });
  } catch (error) {
    return Response.json({ error: responseError(error) }, { status: 500 });
  }
}
