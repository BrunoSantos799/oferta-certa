// Metas de macronutrientes a partir da meta calórica
import type { Goal } from '@/store/types';

/** Proteína (g/kg) por objetivo: mais alta no déficit para preservar massa magra */
export const PROTEIN_PER_KG: Record<Goal, number> = { perder: 2.0, manter: 1.6, ganhar: 1.8, condicionamento: 1.6 };

/**
 * Proteína por kg de peso, gordura = 25% das calorias, carboidrato = o restante.
 * Proteína limitada a 35% das calorias para não espremer os outros macros.
 */
export function macroTargets(kcal: number, weightKg: number, goal: Goal) {
  const protein = Math.min(PROTEIN_PER_KG[goal] * weightKg, (kcal * 0.35) / 4);
  const fat = (kcal * 0.25) / 9;
  const carbs = Math.max(0, (kcal - protein * 4 - fat * 9) / 4);
  return { protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat) };
}
