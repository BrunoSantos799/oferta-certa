import assert from "node:assert/strict";
import test from "node:test";
import { extractSharedPromotion, sharedSourceId } from "../lib/share.ts";

test("extrai link, título, preços e cupom de uma mensagem do WhatsApp", () => {
  const result = extractSharedPromotion(`
🔥 OFERTA IMPERDÍVEL: Air Fryer 4 litros
De R$ 349,90 por R$ 219,90
Cupom: COZINHA20
https://produto.mercadolivre.com.br/MLB-6881930104-air-fryer-_JM
  `);
  assert.equal(result.title, "Air Fryer 4 litros");
  assert.equal(result.price, "219,90");
  assert.equal(result.oldPrice, "349,90");
  assert.equal(result.coupon, "COZINHA20");
  assert.match(result.link, /MLB-6881930104/);
});

test("aceita link curto e gera um código estável para importação assistida", () => {
  const first = sharedSourceId("https://meli.la/exemplo");
  const second = sharedSourceId("https://meli.la/exemplo");
  assert.equal(first, second);
  assert.match(first, /^MLBSHARE[A-F0-9]{8}$/);
  assert.equal(extractSharedPromotion("Potes por R$ 99,90\nhttps://meli.la/exemplo").link, "https://meli.la/exemplo");
});
