// Utilitários de texto: busca ignorando acentos e maiúsculas

/** Remove acentos e deixa em minúsculas ("Feijão" → "feijao") */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * Busca com pontuação: todas as palavras da consulta precisam aparecer.
 * Itens que começam com a consulta aparecem primeiro.
 */
export function searchByName<T extends { name: string }>(items: T[], query: string, limit = 30): T[] {
  const q = normalize(query);
  if (!q) return items.slice(0, limit);
  const terms = q.split(/\s+/);
  const scored: Array<{ item: T; score: number }> = [];
  for (const [index, item] of items.entries()) {
    const name = normalize(item.name);
    if (!terms.every((t) => name.includes(t))) continue;
    let score = 0;
    if (name === q) score += 100;
    if (name.startsWith(q)) score += 50;
    if (name.split(/[\s,()]+/).some((w) => w.startsWith(terms[0]))) score += 20;
    score -= index / 1000; // desempate: ordem do banco (itens mais comuns primeiro)
    scored.push({ item, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.item);
}
