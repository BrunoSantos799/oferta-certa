import { collectMarketplace, isMarketplaceProductUrl, passesRule, toOffer } from "../../../lib/marketplace";
import { loadData, responseError, saveData } from "../../../lib/store";
import type { Offer, Rule } from "../../../lib/types";

function cleanTerm(value: unknown) {
  return String(value || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 100);
}

function mergeOffer(existing: Offer | undefined, incoming: Offer, requeueDrop: number) {
  if (!existing) return incoming;
  const previousPrice = existing.price;
  const history = Array.isArray(existing.priceHistory) ? [...existing.priceHistory] : [];
  if (Math.abs(previousPrice - incoming.price) >= 0.01) {
    history.push({ at: incoming.updatedAt, price: incoming.price });
  }
  const publishedPrice = existing.lastPublishedPrice || previousPrice;
  const drop = publishedPrice > incoming.price ? ((publishedPrice - incoming.price) / publishedPrice) * 100 : 0;
  return {
    ...existing,
    ...incoming,
    previousPrice: previousPrice !== incoming.price ? previousPrice : existing.previousPrice,
    lowestPrice: Math.min(existing.lowestPrice || previousPrice, incoming.price),
    affiliateUrl: existing.affiliateUrl,
    customPost: existing.customPost,
    createdAt: existing.createdAt,
    lastPublishedPrice: existing.lastPublishedPrice,
    status: existing.status === "published" && drop >= requeueDrop ? "ready" : existing.status,
    priceHistory: history.slice(-60),
  } as Offer;
}

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({})) as { term?: string; automatic?: boolean };
    const manualTerm = cleanTerm(payload.term);
    const automatic = payload.automatic === true && !manualTerm;
    const directImport = isMarketplaceProductUrl(manualTerm);
    const { config, state } = await loadData(request);
    const activeRules = config.rules.filter((rule) => rule.active && rule.terms.length);
    const manualRule: Rule = {
      id: "busca-manual",
      name: directImport ? "Importado por link" : "Busca manual",
      active: true,
      terms: manualTerm ? [manualTerm] : [],
      minPrice: 0,
      maxPrice: 1_000_000,
      minDiscount: 0,
      minRating: 0,
      minReviews: 0,
      minScore: directImport ? 0 : config.globalMinScore,
    };
    const rotation = state.robotRuns.filter((run) => run.term === "Varredura automática").length;
    const jobs = manualTerm
      ? [{ term: manualTerm, rule: manualRule }]
      : activeRules.slice(0, 4).map((rule, index) => ({
          term: rule.terms[(rotation + index) % rule.terms.length],
          rule,
        }));
    if (!jobs.length) {
      return Response.json({ error: "Adicione uma regra ativa ou informe um produto para buscar." }, { status: 400 });
    }

    let collected = 0;
    let accepted = 0;
    let rejected = 0;
    let failures = 0;
    let photosImported = 0;
    const sourceNames = new Set<string>();
    const messages: string[] = [];
    const byId = new Map(state.offers.map((offer) => [offer.id, offer]));

    for (const job of jobs) {
      try {
        const result = await collectMarketplace(job.term, config);
        sourceNames.add(result.source);
        collected += result.items.length;
        photosImported += result.items.filter((item) => Boolean(item.image)).length;
        let termAccepted = 0;
        for (const item of result.items) {
          const check = passesRule(item, job.rule, directImport ? 0 : config.globalMinScore);
          if (!check.accepted) {
            rejected += 1;
            continue;
          }
          const incoming = toOffer(item, job.rule);
          byId.set(incoming.id, mergeOffer(byId.get(incoming.id), incoming, config.requeuePriceDropPercent));
          accepted += 1;
          termAccepted += 1;
        }
        state.robotLogs.unshift({
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          level: termAccepted ? "ok" : "warn",
          term: job.term,
          source: result.source,
          message: `${result.items.length} coletados e ${termAccepted} aprovados pelas regras.`,
        });
      } catch (error) {
        failures += 1;
        const message = error instanceof Error ? error.message : "Falha na busca";
        messages.push(`${job.term}: ${message}`);
        state.robotLogs.unshift({
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          level: "error",
          term: job.term,
          source: "Mercado Livre",
          message,
        });
      }
    }

    state.offers = [...byId.values()].sort((a, b) => b.score - a.score || b.updatedAt.localeCompare(a.updatedAt)).slice(0, 1500);
    state.robotRuns.unshift({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      term: manualTerm || (automatic ? "Varredura automática" : "Regras ativas"),
      collected,
      accepted,
      rejected,
      source: [...sourceNames].join(" + ") || "Mercado Livre",
      success: failures < jobs.length,
      message: messages.join(" ") || "Busca concluída.",
    });
    state.robotRuns = state.robotRuns.slice(0, 100);
    state.robotLogs = state.robotLogs.slice(0, 300);
    state.stats.productsCollected += collected;
    state.stats.offersAccepted += accepted;
    state.stats.offersRejected += rejected;
    state.stats.failedSearches += failures;
    state.stats.lastSource = [...sourceNames].join(" + ") || "—";
    if (failures < jobs.length) state.stats.lastSuccessAt = new Date().toISOString();
    await saveData(request, config, state);

    if (failures === jobs.length) {
      return Response.json({ error: messages.join(" ") || "Todas as fontes falharam." }, { status: 502 });
    }
    return Response.json({
      ok: true,
      collected,
      accepted,
      rejected,
      failures,
      photosImported,
      terms: jobs.map((job) => job.term),
      sources: [...sourceNames],
    });
  } catch (error) {
    return Response.json({ error: responseError(error) }, { status: 500 });
  }
}
