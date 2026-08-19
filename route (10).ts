import { renderPost } from "../../../lib/marketplace";
import { loadData, responseError, saveData } from "../../../lib/store";
import type { OfferStatus } from "../../../lib/types";

function clean(value: unknown, max = 20_000) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max);
}

function validUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function validImage(value: string) {
  return /^\/api\/media\/products\/[a-z0-9-]+\.(?:png|jpe?g|webp)$/i.test(value) || validUrl(value);
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as {
      id?: string;
      action?: "update" | "publish";
      affiliateUrl?: string;
      customPost?: string;
      status?: OfferStatus;
      image?: string;
    };
    const { config, state } = await loadData(request);
    const offer = state.offers.find((item) => item.id === clean(payload.id, 120));
    if (!offer) return Response.json({ error: "Oferta não encontrada." }, { status: 404 });

    if (payload.affiliateUrl !== undefined) {
      const affiliateUrl = clean(payload.affiliateUrl, 3000);
      if (!validUrl(affiliateUrl)) {
        return Response.json({ error: "O link precisa começar com http:// ou https://" }, { status: 400 });
      }
      offer.affiliateUrl = affiliateUrl;
    }
    if (payload.customPost !== undefined) offer.customPost = clean(payload.customPost);
    if (payload.image !== undefined) {
      const image = clean(payload.image, 3000);
      if (!validImage(image)) {
        return Response.json({ error: "A imagem final não possui um endereço válido." }, { status: 400 });
      }
      if (!offer.originalImage && offer.image) offer.originalImage = offer.image;
      offer.image = image;
    }
    if (payload.status && ["awaiting_link", "ready", "published", "discarded"].includes(payload.status)) {
      offer.status = payload.status;
    }

    if (payload.action === "publish") {
      if (!offer.affiliateUrl) {
        return Response.json({ error: "Adicione seu link de afiliado antes de publicar." }, { status: 400 });
      }
      if (offer.status !== "published") {
        offer.status = "published";
        offer.lastPublishedPrice = offer.price;
        state.history.unshift({
          id: crypto.randomUUID(),
          offerId: offer.id,
          offerName: offer.name,
          price: offer.price,
          score: offer.score,
          publishedAt: new Date().toISOString(),
          destination: "Seleção Oferta Certa",
        });
        state.history = state.history.slice(0, 2000);
      }
    } else if (offer.status !== "discarded" && offer.status !== "published") {
      offer.status = offer.affiliateUrl ? "ready" : "awaiting_link";
    }
    offer.updatedAt = new Date().toISOString();
    await saveData(request, config, state);
    return Response.json({ ok: true, offer: { ...offer, postText: offer.customPost || renderPost(offer, config) } });
  } catch (error) {
    return Response.json({ error: responseError(error) }, { status: 500 });
  }
}
