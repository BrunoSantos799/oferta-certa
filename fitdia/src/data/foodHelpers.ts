// Auxiliares do banco de alimentos: porções caseiras e conversão entre ml e gramas
import type { Portion } from '@/store/types';

/**
 * Linha do banco: valores por 100 g.
 * density (opcional) = gramas por ml; quando existe, o alimento aceita quantidade em ml.
 */
export type Row = [id: string, name: string, kcal: number, protein: number, carbs: number, fat: number, category: string, portions: Portion[], density?: number];

export const p = (label: string, grams: number): Portion => ({ label, grams });
export const COLHER_ARROZ = [p('colher de sopa', 25), p('escumadeira', 90), p('prato raso (porção)', 150)];
export const CONCHA = [p('concha média', 140), p('colher de sopa', 20)];
export const FILE = [p('filé médio', 100), p('pedaço pequeno', 60)];
export const COLHER_SOPA = (g: number) => [p('colher de sopa', g)];
export const UNIDADE = (g: number, extra: Portion[] = []) => [p('unidade', g), ...extra];
export const FATIA = (g: number) => [p('fatia', g)];
export const COPO = (g = 200) => [p('copo (200 ml)', g), p('xícara (240 ml)', 240)];

/** Porções em ml convertidas para gramas pela densidade */
export const ML = (density: number, ...items: Array<[label: string, ml: number]>) =>
  items.map(([label, ml]) => p(label, Math.round(ml * density)));

/** Densidades (g/ml) de alimentos líquidos ou cremosos do banco principal */
export const DENSITY_BY_ID: Record<string, number> = {
  leite_integral: 1.03, leite_desnatado: 1.035, leite_semidesnatado: 1.03, leite_sem_lactose: 1.03,
  iogurte_natural: 1.04, iogurte_desnatado: 1.04, iogurte_grego: 1.1, iogurte_proteico: 1.05,
  creme_leite: 1.0, leite_condensado: 1.3, requeijao: 1.0, requeijao_light: 1.0,
  azeite: 0.92, oleo_soja: 0.92, mel: 1.42, geleia: 1.3, doce_leite: 1.3,
  ketchup: 1.1, molho_tomate: 1.03, molho_shoyu: 1.15, maionese: 0.95, vinagrete: 1.0,
  sopa_legumes: 1.0, caldo_feijao: 1.03, acai: 1.0, acai_puro: 1.0, sorvete: 0.6, feijoada: 1.05,
  feijao_carioca: 1.05, feijao_preto: 1.05, lentilha: 1.05, moqueca: 1.03, pasta_amendoim: 1.08,
};

/** Categorias tratadas como líquidas por padrão (1 ml ≈ 1 g) */
export const LIQUID_CATEGORIES = new Set(['Bebidas']);

export const gramsFromMl = (ml: number, density: number) => ml * density;
export const mlFromGrams = (grams: number, density: number) => grams / density;
