import assert from "node:assert/strict";
import test from "node:test";

import { collectMarketplace, isMarketplaceProductUrl, parsePublicCards } from "../lib/marketplace.ts";
import type { AppConfig } from "../lib/types.ts";

const config: AppConfig = {
  autoScan: false,
  scanIntervalMinutes: 30,
  limitPerTerm: 20,
  globalMinScore: 42,
  requeuePriceDropPercent: 5,
  accessToken: "",
  rules: [],
  templates: { normal: "{produto}", drop: "{produto}" },
};

test("lê os cartões públicos atuais do Mercado Livre", () => {
  const html = `
    <ol>
      <li class="ui-search-layout__item" data-id="MLB-1234567890">
        <div class="poly-card">
          <img class="poly-component__picture" data-src="https://http2.mlstatic.com/D_123.jpg" />
          <a class="poly-component__title" href="https://www.mercadolivre.com.br/monitor-gamer/p/MLB1234567890" title="Monitor Gamer &amp; Pro">Monitor Gamer</a>
          <s class="andes-money-amount andes-money-amount--previous">
            <span class="andes-money-amount__fraction">1.499</span>
          </s>
          <div class="poly-price__current">
            <span class="andes-money-amount andes-money-amount--cents-superscript">
              <span class="andes-money-amount__fraction">1.199</span>
              <span class="andes-money-amount__cents">90</span>
            </span>
          </div>
          <span class="poly-reviews__rating">4,8</span>
          <span class="poly-reviews__total">(1.234)</span>
          <span>Frete grátis</span>
        </div>
      </li>
      <li class="ui-search-layout__item" data-id="MLB-9876543210">
        <a class="ui-search-link" href="https://produto.mercadolivre.com.br/MLB-9876543210-monitor-_JM" title="Segundo monitor">Segundo monitor</a>
        <div class="ui-search-price__second-line">
          <span class="andes-money-amount--cents-superscript"><span class="andes-money-amount__fraction">899</span></span>
        </div>
      </li>
    </ol>`;

  const items = parsePublicCards(html, 20);
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], {
    sourceId: "MLB1234567890",
    title: "Monitor Gamer & Pro",
    price: 1199.9,
    oldPrice: 1499,
    rating: 4.8,
    reviews: 1234,
    soldQuantity: 0,
    freeShipping: true,
    permalink: "https://www.mercadolivre.com.br/monitor-gamer/p/MLB1234567890",
    image: "https://http2.mlstatic.com/D_123.jpg",
    source: "Página pública",
  });
  assert.equal(items[1].price, 899);
});

test("aceita somente links conhecidos do marketplace", () => {
  assert.equal(isMarketplaceProductUrl("https://produto.mercadolivre.com.br/MLB-1234567890-item-_JM"), true);
  assert.equal(isMarketplaceProductUrl("https://meli.la/abc123"), true);
  assert.equal(isMarketplaceProductUrl("https://example.com/MLB-1234567890"), false);
});

test("importa um anúncio diretamente pelo link", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    id: "MLB1234567890",
    title: "Monitor importado",
    price: 799.9,
    original_price: 999.9,
    permalink: "https://produto.mercadolivre.com.br/MLB-1234567890-item-_JM",
    secure_thumbnail: "https://http2.mlstatic.com/D_456.jpg",
    shipping: { free_shipping: true },
  }), { status: 200, headers: { "Content-Type": "application/json" } });
  try {
    const result = await collectMarketplace("https://produto.mercadolivre.com.br/MLB-1234567890-item-_JM", config);
    assert.equal(result.source, "Anúncio importado");
    assert.equal(result.items[0].title, "Monitor importado");
    assert.equal(result.items[0].oldPrice, 999.9);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
