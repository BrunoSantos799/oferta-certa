export type SharedPromotion = {
  raw: string;
  link: string;
  title: string;
  price: string;
  oldPrice: string;
  coupon: string;
};

function money(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function formatInput(value: number) {
  return value ? value.toFixed(2).replace(".", ",") : "";
}

export function extractSharedPromotion(rawValue: string): SharedPromotion {
  const raw = String(rawValue || "").replace(/\r/g, "").trim().slice(0, 12_000);
  const urls = raw.match(/https?:\/\/[^\s<>"']+/gi) || [];
  const link = urls.map((value) => value.replace(/[),.;!?]+$/g, "")).find((value) => {
    try {
      const host = new URL(value).hostname.toLowerCase();
      return host === "meli.la" || host === "mercadolivre.com.br" || host.endsWith(".mercadolivre.com.br") || host === "mercadolivre.com" || host.endsWith(".mercadolivre.com");
    } catch {
      return false;
    }
  }) || "";
  const values = [...raw.matchAll(/R\$\s*([\d.]+(?:,\d{1,2})?)/gi)].map((match) => money(match[1])).filter(Boolean);
  const price = values.length ? Math.min(...values) : 0;
  const oldPrice = values.length > 1 ? Math.max(...values) : 0;
  const couponMatch = raw.match(/(?:cupom|c[oó]digo)\s*(?:de\s*desconto)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9_-]{2,29})/i);
  const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean);
  const titleLine = lines.find((line) => !/https?:\/\//i.test(line) && !/^\s*(?:cupom|c[oó]digo|de\s+R\$|por\s+R\$|R\$)/i.test(line)) || "";
  const title = titleLine
    .replace(/^[\s🔥⚡🚨📢🛒💥✅⭐🎁🏷️]+/u, "")
    .replace(/^(?:(?:oferta|promoç[aã]o)\s+imperd[ií]vel|oferta|promoç[aã]o|achadinho|imperd[ií]vel)\s*[:\-–—]?\s*/i, "")
    .trim()
    .slice(0, 180);
  return {
    raw,
    link,
    title,
    price: formatInput(price),
    oldPrice: oldPrice > price ? formatInput(oldPrice) : "",
    coupon: (couponMatch?.[1] || "").toUpperCase(),
  };
}

export function sharedSourceId(value: string) {
  let hash = 2166136261;
  const input = value.trim().toLowerCase();
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `MLBSHARE${(hash >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
}
