import type { AppConfig, MarketplaceItem, Offer, Rule } from "./types";

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function integer(value: unknown) {
  return Math.max(0, Math.round(number(value)));
}

function safeUrl(value: unknown) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}

function decodeHtml(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code[0] === "#") {
      const radix = code[1]?.toLowerCase() === "x" ? 16 : 10;
      const raw = code.slice(radix === 16 ? 2 : 1);
      const point = Number.parseInt(raw, radix);
      if (Number.isFinite(point) && point > 0 && point <= 0x10ffff) {
        try {
          return String.fromCodePoint(point);
        } catch {
          return entity;
        }
      }
      return entity;
    }
    return named[code.toLowerCase()] ?? entity;
  });
}

function htmlText(value: string) {
  return decodeHtml(
    value
      .replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  ).replace(/\s+/g, " ").trim();
}

function attribute(value: string, name: string) {
  const match = value.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return decodeHtml(match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim();
}

function localizedNumber(value: string) {
  const clean = decodeHtml(value).replace(/[^\d,.-]/g, "").replace(/^-/, "");
  if (!clean) return 0;
  const comma = clean.lastIndexOf(",");
  const dot = clean.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    const decimal = Math.max(comma, dot);
    const integerPart = clean.slice(0, decimal).replace(/\D/g, "");
    const decimalPart = clean.slice(decimal + 1).replace(/\D/g, "").slice(0, 2);
    return number(`${integerPart || "0"}.${decimalPart || "0"}`);
  }
  const separator = comma >= 0 ? "," : dot >= 0 ? "." : "";
  if (!separator) return number(clean);
  const parts = clean.split(separator);
  const tail = parts.at(-1) || "";
  if (parts.length === 2 && tail.length > 0 && tail.length <= 2) {
    return number(`${parts[0].replace(/\D/g, "") || "0"}.${tail.replace(/\D/g, "")}`);
  }
  return number(clean.replace(/\D/g, ""));
}

function sourceId(value: unknown) {
  const clean = String(value || "").trim();
  const match = clean.match(/\b(MLB-?\d{6,})\b/i);
  return match ? match[1].replace("-", "").toUpperCase() : clean.slice(0, 400);
}

function allowedMarketplaceUrl(value: unknown) {
  try {
    const url = new URL(String(value || "").trim());
    const host = url.hostname.toLowerCase();
    const allowed = host === "meli.la"
      || host === "mercadolivre.com"
      || host.endsWith(".mercadolivre.com")
      || host === "mercadolivre.com.br"
      || host.endsWith(".mercadolivre.com.br");
    return allowed && (url.protocol === "https:" || url.protocol === "http:") ? url : null;
  } catch {
    return null;
  }
}

export function isMarketplaceProductUrl(value: unknown) {
  return Boolean(allowedMarketplaceUrl(value));
}

function friendlyError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  return /internal error|reference\s*=/i.test(message)
    ? "A conexão externa foi recusada temporariamente"
    : message;
}

function stableId(source: string, title: string) {
  const ml = sourceId(source);
  if (/^MLB\d{6,}$/i.test(ml)) return `ml-${ml.toUpperCase()}`;
  const input = (ml || title).toLocaleLowerCase("pt-BR");
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `ml-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function normalizeApiItem(raw: Record<string, unknown>): MarketplaceItem | null {
  const reviews = typeof raw.reviews === "object" && raw.reviews ? raw.reviews as Record<string, unknown> : {};
  const shipping = typeof raw.shipping === "object" && raw.shipping ? raw.shipping as Record<string, unknown> : {};
  const title = String(raw.title || raw.name || "").trim().slice(0, 500);
  const price = number(raw.price || raw.sale_price);
  if (!title || price <= 0) return null;
  const oldPrice = number(raw.original_price) > price ? number(raw.original_price) : 0;
  const permalink = safeUrl(raw.permalink || raw.url);
  const pictures = Array.isArray(raw.pictures) ? raw.pictures : [];
  const firstPicture = pictures.find((value) => value && typeof value === "object") as Record<string, unknown> | undefined;
  return {
    sourceId: sourceId(raw.id || raw.catalog_product_id || permalink || title),
    title,
    price,
    oldPrice,
    rating: Math.max(0, Math.min(5, number(reviews.rating_average || raw.rating_average))),
    reviews: integer(reviews.total || raw.reviews_total),
    soldQuantity: integer(raw.sold_quantity),
    freeShipping: shipping.free_shipping === true,
    permalink,
    image: safeUrl(firstPicture?.secure_url || firstPicture?.url || raw.secure_thumbnail || raw.thumbnail),
    source: "API Mercado Livre",
  };
}

function normalizeCatalogProduct(raw: Record<string, unknown>): MarketplaceItem | null {
  const winner = raw.buy_box_winner && typeof raw.buy_box_winner === "object"
    ? raw.buy_box_winner as Record<string, unknown>
    : {};
  const shipping = winner.shipping && typeof winner.shipping === "object"
    ? winner.shipping as Record<string, unknown>
    : {};
  const pictures = Array.isArray(raw.pictures) ? raw.pictures : [];
  const firstPicture = pictures.find((value) => value && typeof value === "object") as Record<string, unknown> | undefined;
  const thumbnail = raw.thumbnail && typeof raw.thumbnail === "object"
    ? raw.thumbnail as Record<string, unknown>
    : {};
  const title = String(raw.name || raw.family_name || raw.title || "").trim().slice(0, 500);
  const price = number(winner.price || raw.price);
  const oldPrice = number(winner.original_price || raw.original_price);
  const permalink = safeUrl(raw.permalink || winner.permalink);
  if (!title || price <= 0 || !permalink) return null;
  return {
    sourceId: sourceId(winner.item_id || raw.id || permalink),
    title,
    price,
    oldPrice: oldPrice > price ? oldPrice : 0,
    rating: 0,
    reviews: 0,
    soldQuantity: integer(winner.sold_quantity || raw.sold_quantity),
    freeShipping: shipping.free_shipping === true,
    permalink,
    image: safeUrl(firstPicture?.secure_url || firstPicture?.url || thumbnail.secure_url || thumbnail.url),
    source: "Catálogo oficial",
  };
}

function flatten(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.flatMap(flatten);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const nested = ["@graph", "itemListElement", "item", "items", "results"]
    .flatMap((key) => key in record ? flatten(record[key]) : []);
  return [record, ...nested];
}

function normalizeJsonLd(raw: Record<string, unknown>): MarketplaceItem | null {
  const item = raw.item && typeof raw.item === "object" ? raw.item as Record<string, unknown> : raw;
  const rawOffers = item.offers;
  const offers = Array.isArray(rawOffers)
    ? (rawOffers[0] || {}) as Record<string, unknown>
    : rawOffers && typeof rawOffers === "object" ? rawOffers as Record<string, unknown> : {};
  const aggregate = item.aggregateRating && typeof item.aggregateRating === "object"
    ? item.aggregateRating as Record<string, unknown> : {};
  const title = String(item.name || item.title || "").trim().slice(0, 500);
  const price = number(offers.price || item.price || item.current_price);
  const permalink = safeUrl(item.url || offers.url);
  if (!title || price <= 0 || !permalink) return null;
  const imageRaw = Array.isArray(item.image) ? item.image[0] : item.image || item.thumbnail;
  const oldPrice = number(item.original_price || item.old_price);
  return {
    sourceId: sourceId(item.productID || item.sku || item.id || permalink),
    title,
    price,
    oldPrice: oldPrice > price ? oldPrice : 0,
    rating: Math.max(0, Math.min(5, number(aggregate.ratingValue))),
    reviews: integer(aggregate.reviewCount || aggregate.ratingCount),
    soldQuantity: integer(item.sold_quantity),
    freeShipping: item.free_shipping === true,
    permalink,
    image: safeUrl(imageRaw),
    source: "Página pública",
  };
}

function cardStarts(html: string, marker: string) {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<(?:li|div|article)\\b[^>]*class\\s*=\\s*(?:"[^"]*${escaped}[^"]*"|'[^']*${escaped}[^']*')[^>]*>`,
    "gi",
  );
  return [...html.matchAll(pattern)].map((match) => match.index ?? 0);
}

function cardBlocks(html: string) {
  const layoutItems = cardStarts(html, "ui-search-layout__item");
  const starts = layoutItems.length ? layoutItems : cardStarts(html, "poly-card");
  return starts.slice(0, 200).map((start, index) => {
    const next = starts[index + 1] ?? Math.min(html.length, start + 120_000);
    return html.slice(start, next);
  });
}

function anchorFromCard(block: string) {
  let best: { score: number; title: string; url: string } | null = null;
  const pattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  for (const match of block.matchAll(pattern)) {
    const attrs = match[1];
    const url = safeUrl(attribute(attrs, "href"));
    if (!url) continue;
    const classes = attribute(attrs, "class");
    const explicitTitle = attribute(attrs, "title");
    const title = (explicitTitle || htmlText(match[2])).slice(0, 500);
    if (!title) continue;
    let score = 0;
    if (/poly-component__title|ui-search-item__group__element|ui-search-link/i.test(classes)) score += 8;
    if (explicitTitle) score += 3;
    if (/\bMLB-?\d{6,}\b/i.test(url)) score += 4;
    if (/mercadolivre\.com/i.test(url)) score += 2;
    if (title.length >= 12) score += 1;
    if (!best || score > best.score) best = { score, title, url };
  }
  return best;
}

function priceFromCard(block: string) {
  let price = 0;
  let oldPrice = 0;
  const fractions = /<span\b([^>]*class\s*=\s*(?:"[^"]*andes-money-amount__fraction[^"]*"|'[^']*andes-money-amount__fraction[^']*')[^>]*)>([\s\S]*?)<\/span>/gi;
  for (const match of block.matchAll(fractions)) {
    let amount = localizedNumber(htmlText(match[2]));
    if (amount <= 0) continue;
    const start = match.index ?? 0;
    const centsArea = block.slice(start + match[0].length, start + match[0].length + 300);
    const centsMatch = centsArea.match(/<span\b[^>]*class\s*=\s*(?:"[^"]*andes-money-amount__cents[^"]*"|'[^']*andes-money-amount__cents[^']*')[^>]*>([\s\S]*?)<\/span>/i);
    const nextFractionAt = centsArea.search(/andes-money-amount__fraction/i);
    if (centsMatch && (nextFractionAt < 0 || (centsMatch.index ?? 0) < nextFractionAt)) {
      amount += integer(htmlText(centsMatch[1])) / 100;
    }

    const context = block.slice(Math.max(0, start - 1_400), start).toLowerCase();
    const previousAt = Math.max(
      context.lastIndexOf("andes-money-amount--previous"),
      context.lastIndexOf("poly-price__previous"),
      context.lastIndexOf("ui-search-price__second-line__label"),
    );
    const currentAt = Math.max(
      context.lastIndexOf("poly-price__current"),
      context.lastIndexOf("andes-money-amount--cents-superscript"),
      context.lastIndexOf("ui-search-price__second-line"),
    );
    if (previousAt > currentAt) {
      if (!oldPrice) oldPrice = amount;
    } else if (!price) {
      price = amount;
    }
  }

  if (!price) {
    const meta = block.match(/<meta\b[^>]*itemprop=["']price["'][^>]*content=["']([\d.,]+)["']/i)
      || block.match(/<meta\b[^>]*content=["']([\d.,]+)["'][^>]*itemprop=["']price["']/i);
    if (meta) price = localizedNumber(meta[1]);
  }
  if (oldPrice <= price) oldPrice = 0;
  return { price, oldPrice };
}

function imageFromCard(block: string) {
  let best: { score: number; url: string } | null = null;
  for (const match of block.matchAll(/<img\b([^>]*)>/gi)) {
    const attrs = match[1];
    const classes = attribute(attrs, "class");
    const srcset = attribute(attrs, "data-srcset") || attribute(attrs, "srcset");
    const candidate = attribute(attrs, "data-src")
      || attribute(attrs, "src")
      || srcset.split(/\s+/)[0]
      || "";
    const url = safeUrl(candidate);
    if (!url) continue;
    let score = 0;
    if (/poly-component__picture|ui-search-result-image/i.test(classes)) score += 5;
    if (/http/i.test(candidate)) score += 1;
    if (!best || score > best.score) best = { score, url };
  }
  return best?.url || "";
}

function classNumber(block: string, classPattern: string) {
  const pattern = new RegExp(
    `<(?:span|div|p)\\b[^>]*class\\s*=\\s*(?:"[^"]*(?:${classPattern})[^"]*"|'[^']*(?:${classPattern})[^']*')[^>]*>([\\s\\S]*?)<\\/(?:span|div|p)>`,
    "i",
  );
  return localizedNumber(htmlText(block.match(pattern)?.[1] || ""));
}

export function parsePublicCards(html: string, limit = 50): MarketplaceItem[] {
  const results: MarketplaceItem[] = [];
  const seen = new Set<string>();
  for (const block of cardBlocks(html)) {
    const anchor = anchorFromCard(block);
    const { price, oldPrice } = priceFromCard(block);
    if (!anchor || price <= 0) continue;
    const rawId = attribute(block.match(/^<[^>]+>/)?.[0] || "", "data-id")
      || block.match(/\bMLB-?\d{6,}\b/i)?.[0]
      || anchor.url;
    const id = sourceId(rawId);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const rating = classNumber(block, "poly-reviews__rating|ui-search-reviews__rating-number|reviews__rating-number");
    const reviews = classNumber(block, "poly-reviews__total|ui-search-reviews__amount|reviews__amount");
    const readable = htmlText(block).toLocaleLowerCase("pt-BR");
    results.push({
      sourceId: id,
      title: anchor.title,
      price,
      oldPrice,
      rating: Math.max(0, Math.min(5, rating)),
      reviews: integer(reviews),
      soldQuantity: 0,
      freeShipping: /frete gr[aá]tis|envio gr[aá]tis|chegar[aá] gr[aá]tis/i.test(readable),
      permalink: anchor.url,
      image: imageFromCard(block),
      source: "Página pública",
    });
    if (results.length >= limit) break;
  }
  return results;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeout = 15_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function collectProductUrl(rawUrl: string, config: AppConfig) {
  const url = allowedMarketplaceUrl(rawUrl);
  if (!url) throw new Error("Cole um link válido de anúncio do Mercado Livre");
  const headers: Record<string, string> = { Accept: "application/json" };
  if (config.accessToken) headers.Authorization = `Bearer ${config.accessToken}`;
  const id = sourceId(url.href);
  let apiError: unknown = new Error("O link não contém o código do anúncio");

  if (/^MLB\d{6,}$/i.test(id)) {
    try {
      const response = await fetchWithTimeout(`https://api.mercadolibre.com/items/${id}`, { headers });
      if (!response.ok) throw new Error(`API do anúncio respondeu HTTP ${response.status}`);
      const item = normalizeApiItem(await response.json() as Record<string, unknown>);
      if (!item) throw new Error("A API não trouxe os dados completos do anúncio");
      return { ...item, source: "Anúncio importado" };
    } catch (error) {
      apiError = error;
    }
  }

  try {
    const response = await fetchWithTimeout(url.href, {
      headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0 OfertaCertaHubWeb/1.1" },
    }, 20_000);
    if (!response.ok) throw new Error(`Página do anúncio respondeu HTTP ${response.status}`);
    const html = await response.text();
    const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    for (const match of html.matchAll(pattern)) {
      try {
        for (const record of flatten(JSON.parse(match[1]))) {
          const item = normalizeJsonLd(record);
          if (item) return { ...item, source: "Anúncio importado" };
        }
      } catch {
        // Continua procurando outro bloco estruturado.
      }
    }
    const card = parsePublicCards(html, 1)[0];
    if (card) return { ...card, source: "Anúncio importado" };
    throw new Error("A página abriu, mas os dados do anúncio não foram reconhecidos");
  } catch (pageError) {
    throw new Error(`${friendlyError(apiError, "API do anúncio indisponível")}. Alternativa: ${friendlyError(pageError, "página do anúncio indisponível")}.`);
  }
}

async function collectPublic(term: string, limit: number) {
  const slug = encodeURIComponent(term.trim().replace(/\s+/g, "-"));
  const response = await fetchWithTimeout(`https://lista.mercadolivre.com.br/${slug}`, {
    headers: { "User-Agent": "Mozilla/5.0 OfertaCertaHubWeb/1.1" },
  });
  if (!response.ok) throw new Error(`A página pública respondeu HTTP ${response.status}`);
  const html = await response.text();
  const results: MarketplaceItem[] = [];
  const seen = new Set<string>();
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    try {
      for (const record of flatten(JSON.parse(match[1]))) {
        const item = normalizeJsonLd(record);
        if (item && !seen.has(item.sourceId)) {
          seen.add(item.sourceId);
          results.push(item);
          if (results.length >= limit) return results;
        }
      }
    } catch {
      // Ignora blocos que não sejam JSON válido.
    }
  }
  for (const item of parsePublicCards(html, limit - results.length)) {
    if (!seen.has(item.sourceId)) {
      seen.add(item.sourceId);
      results.push(item);
      if (results.length >= limit) break;
    }
  }
  if (!results.length) throw new Error("A página abriu, mas os produtos ficaram indisponíveis para leitura");
  return results;
}

async function collectCatalog(term: string, config: AppConfig) {
  if (!config.accessToken) throw new Error("A integração oficial ainda não foi conectada");
  const headers = { Accept: "application/json", Authorization: `Bearer ${config.accessToken}` };
  const params = new URLSearchParams({
    status: "active",
    site_id: "MLB",
    q: term,
    limit: String(Math.min(10, config.limitPerTerm)),
  });
  const response = await fetchWithTimeout(`https://api.mercadolibre.com/products/search?${params}`, { headers });
  if (!response.ok) throw new Error(`Catálogo oficial respondeu HTTP ${response.status}`);
  const payload = await response.json() as { results?: Array<Record<string, unknown>> };
  if (!Array.isArray(payload.results) || !payload.results.length) {
    throw new Error("O catálogo oficial não encontrou produtos para esse termo");
  }

  const details = await Promise.all(payload.results.slice(0, 8).map(async (summary) => {
    const direct = normalizeCatalogProduct(summary);
    if (direct) return direct;
    const id = sourceId(summary.id);
    if (!/^MLB\d{6,}$/i.test(id)) return null;
    try {
      const detail = await fetchWithTimeout(`https://api.mercadolibre.com/products/${id}`, { headers });
      if (!detail.ok) return null;
      return normalizeCatalogProduct(await detail.json() as Record<string, unknown>);
    } catch {
      return null;
    }
  }));
  const items = details.filter((item): item is MarketplaceItem => Boolean(item));
  if (!items.length) throw new Error("O catálogo oficial não trouxe ofertas com preço disponível");
  return items;
}

export async function collectMarketplace(term: string, config: AppConfig) {
  if (isMarketplaceProductUrl(term)) {
    const item = await collectProductUrl(term, config);
    return { items: [item], source: "Anúncio importado" };
  }
  if (/^https?:\/\//i.test(term.trim())) {
    throw new Error("Esse link não é de um anúncio reconhecido do Mercado Livre");
  }
  let officialError: unknown = new Error("API oficial não conectada");
  if (config.accessToken) {
    try {
      const items = await collectCatalog(term, config);
      return { items, source: "Catálogo oficial" };
    } catch (catalogError) {
      officialError = catalogError;
    }

    const params = new URLSearchParams({ q: term, limit: String(config.limitPerTerm) });
    const headers = { Accept: "application/json", Authorization: `Bearer ${config.accessToken}` };
    try {
      const response = await fetchWithTimeout(`https://api.mercadolibre.com/sites/MLB/search?${params}`, { headers });
      if (!response.ok) throw new Error(`Busca oficial respondeu HTTP ${response.status}`);
      const payload = await response.json() as { results?: Array<Record<string, unknown>> };
      if (!Array.isArray(payload.results)) throw new Error("A API mudou o formato da resposta");
      const items = payload.results.map(normalizeApiItem).filter((item): item is MarketplaceItem => Boolean(item));
      if (!items.length) throw new Error("A API não retornou produtos reconhecidos");
      return { items, source: "API Mercado Livre" };
    } catch (searchError) {
      officialError = searchError;
    }
  }

  try {
    const items = await collectPublic(term, config.limitPerTerm);
    return { items, source: "Página pública" };
  } catch (publicError) {
    const first = friendlyError(officialError, "API oficial indisponível");
    const second = friendlyError(publicError, "página pública indisponível");
    throw new Error(`${first}. Alternativa: ${second}. Se continuar, cole o link de um anúncio para importá-lo.`);
  }
}

export function discountPercent(item: Pick<MarketplaceItem, "price" | "oldPrice">) {
  return item.oldPrice > item.price && item.price > 0
    ? Math.round(Math.min(95, (1 - item.price / item.oldPrice) * 100))
    : 0;
}

export function scoreItem(item: MarketplaceItem) {
  let score = 35 + Math.min(40, discountPercent(item) * 1.2);
  if (item.rating > 0) score += Math.max(0, Math.min(12, ((item.rating - 3.5) / 1.5) * 12));
  score += item.reviews >= 3000 ? 9 : item.reviews >= 1000 ? 8 : item.reviews >= 300 ? 6 : item.reviews >= 100 ? 4 : item.reviews > 0 ? 1 : 0;
  if (item.freeShipping) score += 6;
  score += item.soldQuantity >= 1000 ? 6 : item.soldQuantity >= 100 ? 4 : item.soldQuantity >= 10 ? 2 : 0;
  if (item.source === "API Mercado Livre" || item.source === "Catálogo oficial") score += 3;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function passesRule(item: MarketplaceItem, rule: Rule, globalMinScore: number) {
  const reasons: string[] = [];
  const score = scoreItem(item);
  const discount = discountPercent(item);
  if (item.price < rule.minPrice) reasons.push("abaixo do preço mínimo");
  if (item.price > rule.maxPrice) reasons.push("acima do preço máximo");
  if (rule.minDiscount > 0 && item.oldPrice <= item.price) reasons.push("desconto não comprovado");
  else if (discount < rule.minDiscount) reasons.push("desconto abaixo do mínimo");
  if (rule.minRating > 0 && item.rating <= 0) reasons.push("avaliação indisponível");
  else if (item.rating < rule.minRating) reasons.push("avaliação abaixo do mínimo");
  if (rule.minReviews > 0 && item.reviews <= 0) reasons.push("avaliações indisponíveis");
  else if (item.reviews < rule.minReviews) reasons.push("poucas avaliações");
  const threshold = Math.max(rule.minScore, globalMinScore);
  if (score < threshold) reasons.push(`score abaixo de ${threshold}`);
  return { accepted: reasons.length === 0, reasons, score, discount };
}

export function toOffer(item: MarketplaceItem, rule: Rule): Offer {
  const now = new Date().toISOString();
  const discount = discountPercent(item);
  return {
    id: stableId(item.sourceId, item.title),
    sourceId: item.sourceId,
    name: item.title,
    category: rule.name,
    marketplace: "Mercado Livre",
    oldPrice: item.oldPrice,
    price: item.price,
    previousPrice: null,
    lowestPrice: item.price,
    rating: item.rating,
    reviews: item.reviews,
    shipping: item.freeShipping ? "Frete grátis" : "Frete a consultar",
    score: scoreItem(item),
    status: "awaiting_link",
    url: item.permalink || "https://www.mercadolivre.com.br/",
    image: item.image,
    affiliateUrl: "",
    customPost: "",
    createdAt: now,
    updatedAt: now,
    discount,
    priceHistory: [{ at: now, price: item.price }],
  };
}

export function renderPost(offer: Offer, config: AppConfig) {
  const template = offer.previousPrice && offer.price < offer.previousPrice
    ? config.templates.drop : config.templates.normal;
  const replacements: Record<string, string> = {
    produto: offer.name,
    preco_antigo: offer.oldPrice ? offer.oldPrice.toFixed(2).replace(".", ",") : "—",
    preco: offer.price.toFixed(2).replace(".", ","),
    avaliacao: offer.rating ? offer.rating.toFixed(1).replace(".", ",") : "não informada",
    frete: offer.shipping,
    desconto: String(offer.discount),
    link: offer.affiliateUrl || offer.url,
  };
  return template.replace(/\{([a-z_]+)\}/gi, (_, key: string) => replacements[key] ?? `{${key}}`);
}
