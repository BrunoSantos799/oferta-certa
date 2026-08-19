import { isMarketplaceProductUrl, toOffer } from "../../../lib/marketplace";
import { loadData, responseError, saveData } from "../../../lib/store";
import type { MarketplaceItem, Rule } from "../../../lib/types";

function text(value: unknown, max = 500) {
  return String(value ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, max);
}

function number(value: unknown, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : 0;
}

function safeImage(value: unknown) {
  const raw = text(value, 3000);
  if (/^\/api\/media\/products\/[a-f0-9-]+\.(jpg|png|webp)$/i.test(raw)) return raw;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    const allowed = host === "mlstatic.com" || host.endsWith(".mlstatic.com")
      || host === "mercadolivre.com.br" || host.endsWith(".mercadolivre.com.br");
    return allowed && (url.protocol === "https:" || url.protocol === "http:") ? url.href : "";
  } catch {
    return "";
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const permalink = text(payload.permalink, 3000);
    const title = text(payload.title);
    const price = number(payload.price, 0, 100_000_000);
    const sourceId = text(payload.sourceId, 120).replace("-", "").toUpperCase();
    if (!isMarketplaceProductUrl(permalink)) {
      return Response.json({ error: "O anúncio precisa ser um link de produto do Mercado Livre." }, { status: 400 });
    }
    if (!/^MLB(?:\d{6,}|SHARE[A-F0-9]{8})$/i.test(sourceId) || title.length < 3 || price <= 0) {
      return Response.json({ error: "O Mercado Livre não devolveu nome, código e preço suficientes." }, { status: 400 });
    }

    const oldPrice = number(payload.oldPrice, 0, 100_000_000);
    const item: MarketplaceItem = {
      sourceId,
      title,
      price,
      oldPrice: oldPrice > price ? oldPrice : 0,
      rating: number(payload.rating, 0, 5),
      reviews: Math.round(number(payload.reviews, 0, 100_000_000)),
      soldQuantity: Math.round(number(payload.soldQuantity, 0, 100_000_000)),
      freeShipping: payload.freeShipping === true,
      permalink,
      image: safeImage(payload.image),
      source: "Importação pelo navegador",
    };
    const rule: Rule = {
      id: "importacao-navegador",
      name: "Importado por link",
      active: true,
      terms: [permalink],
      minPrice: 0,
      maxPrice: 100_000_000,
      minDiscount: 0,
      minRating: 0,
      minReviews: 0,
      minScore: 0,
    };
    const coupon = text(payload.coupon, 80).replace(/[^A-Z0-9_-]/gi, "").toUpperCase();
    const incoming = toOffer(item, rule);
    if (coupon) incoming.customPost = `${incoming.customPost}\n🎟️ Cupom: ${coupon}`;
    const { config, state } = await loadData(request);
    const existing = state.offers.find((offer) => offer.id === incoming.id);
    const customPost = existing && coupon && !existing.customPost.toUpperCase().includes(coupon)
      ? `${existing.customPost}\n🎟️ Cupom: ${coupon}`
      : existing?.customPost;
    const offer = existing ? {
      ...incoming,
      image: existing.originalImage ? existing.image : incoming.image,
      originalImage: existing.originalImage ? (incoming.image || existing.originalImage) : undefined,
      affiliateUrl: existing.affiliateUrl,
      customPost: customPost || existing.customPost,
      createdAt: existing.createdAt,
      lowestPrice: Math.min(existing.lowestPrice || existing.price, incoming.price),
      previousPrice: existing.price !== incoming.price ? existing.price : existing.previousPrice,
      status: existing.status,
      priceHistory: existing.price === incoming.price
        ? existing.priceHistory
        : [...existing.priceHistory, { at: incoming.updatedAt, price: incoming.price }].slice(-60),
    } : incoming;

    state.offers = [offer, ...state.offers.filter((item) => item.id !== offer.id)].slice(0, 1500);
    state.robotRuns.unshift({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      term: title,
      collected: 1,
      accepted: 1,
      rejected: 0,
      source: "Navegador + Mercado Livre",
      success: true,
      message: "Produto, preço e foto importados do anúncio.",
    });
    state.robotRuns = state.robotRuns.slice(0, 100);
    state.robotLogs.unshift({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      level: "ok",
      term: title,
      source: "Importação pelo navegador",
      message: `Produto importado${item.image ? " com foto" : " sem foto"}.`,
    });
    state.robotLogs = state.robotLogs.slice(0, 300);
    state.stats.productsCollected += 1;
    if (!existing) state.stats.offersAccepted += 1;
    state.stats.lastSource = "Importação pelo navegador";
    state.stats.lastSuccessAt = new Date().toISOString();
    await saveData(request, config, state);
    return Response.json({ ok: true, offer, photoImported: Boolean(item.image) });
  } catch (error) {
    return Response.json({ error: responseError(error) }, { status: 500 });
  }
}
