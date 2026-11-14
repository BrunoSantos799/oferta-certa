// Seletores: juntam os dados salvos com as fórmulas para gerar os números do app
import { useMemo } from 'react';
import { useStore, type AppData } from './useStore';
import type { FoodEntry, MealId } from './types';
import { ageFromBirthDate, bmi, bmiRange, katchMcArdle, mifflinStJeor } from '@/lib/calc/bmr';
import { calculateNeat, type NeatResult } from '@/lib/calc/neat';
import { adaptiveAdjustment, dayEnergy, estimateEnergy, goalCalories, waterGoalMl, TEF_RATE, type AdaptiveResult } from '@/lib/calc/energy';
import { nutrientsFor } from '@/data/foods';
import { addDays, daysBetween, today } from '@/lib/date';

export const MEALS: Array<{ id: MealId; label: string }> = [
  { id: 'cafe', label: 'Café da manhã' },
  { id: 'almoco', label: 'Almoço' },
  { id: 'lanche', label: 'Lanche' },
  { id: 'jantar', label: 'Jantar' },
  { id: 'ceia', label: 'Ceia' },
];

/** Peso vigente numa data: última pesagem até a data (ou a primeira registrada) */
export function weightOn(weights: AppData['weights'], date: string): number {
  if (weights.length === 0) return 70;
  let w = weights[0].kg;
  for (const e of weights) {
    if (e.date <= date) w = e.kg;
    else break;
  }
  return w;
}

export function entryNutrients(e: FoodEntry) {
  return nutrientsFor(e.food, e.grams);
}

export function sumNutrients(entries: FoodEntry[]) {
  return entries.reduce(
    (acc, e) => {
      const n = entryNutrients(e);
      acc.kcal += n.kcal;
      acc.protein += n.protein;
      acc.carbs += n.carbs;
      acc.fat += n.fat;
      return acc;
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export interface EnergyModel {
  age: number;
  weight: number;
  bmr: number;
  katch: number | null;
  bmi: number;
  bmiLabel: string;
  neat: NeatResult;
  /** NEAT usado no dia a dia (personalizado ou derivado do fator) */
  neatKcal: number;
  goalTarget: number;
  suggestedTarget: number;
  goalLimitedBy?: string;
  weeklyKgChange: number;
  restDayExpenditure: number;
  estimate: ReturnType<typeof estimateEnergy>;
  adaptive: AdaptiveResult;
  adaptiveApplied: number;
}

/** Calcula o modelo de energia de uma pessoa numa data */
export function computeEnergyModel(d: AppData, date: string = today(), withAdaptive = true): EnergyModel | null {
  const p = d.profile;
  if (!p) return null;
  const weight = weightOn(d.weights, date);
  const age = ageFromBirthDate(p.birthDate);
  const bmr = mifflinStJeor(p.sex, weight, p.heightCm, age);
  const katch = p.bodyFatPercent ? katchMcArdle(weight, p.bodyFatPercent) : null;
  const neat = d.questionnaire ? calculateNeat(d.questionnaire, weight) : { total: 0, blocks: [] };

  // No modo "fator", o fator já inclui ~10% de digestão: dia a dia = basal × fator × 0,9 − basal
  const neatKcal =
    d.settings.energyMode === 'fator' || !d.questionnaire ? Math.max(0, bmr * p.activityFactor * (1 - TEF_RATE) - bmr) : neat.total;

  const estimate = estimateEnergy(bmr, neatKcal, d.questionnaire?.activities ?? [], weight);

  // O ajuste adaptativo compara o previsto (sem ajuste) com a variação real do peso
  let adaptive: AdaptiveResult = { ready: false, adjustment: 0, reason: '' };
  if (withAdaptive) {
    const start = addDays(date, -27);
    const days: Array<{ date: string; consumed: number; predictedExpenditure: number }> = [];
    for (let i = 0; i < 28; i++) {
      const day = addDays(start, i);
      const consumed = sumNutrients(d.foodLog.filter((e) => e.date === day)).kcal;
      if (consumed <= 0) continue;
      const model = computeEnergyModel(d, day, false)!;
      const workoutKcal = d.workouts.filter((w) => w.date === day).reduce((s, w) => s + w.kcal, 0);
      days.push({ date: day, consumed, predictedExpenditure: dayEnergy({ bmr: model.bmr, neat: model.neatKcal, workoutKcal, consumedKcal: consumed }).total });
    }
    adaptive = adaptiveAdjustment({ weights: d.weights.filter((w) => w.date <= date && daysBetween(w.date, date) < 28), days });
  }
  const adaptiveApplied = d.settings.autoAdjust && adaptive.ready ? adaptive.adjustment : 0;

  // Meta: gasto de um dia sem treino (as calorias dos treinos entram no dia em que acontecem)
  const restDayExpenditure = (bmr + neatKcal + adaptiveApplied) / (1 - TEF_RATE);
  const goal = goalCalories(restDayExpenditure, bmr, p.sex, p.goal, p.pace);
  const b = bmi(weight, p.heightCm);

  return {
    age, weight, bmr, katch, bmi: b, bmiLabel: bmiRange(b).label, neat, neatKcal,
    goalTarget: d.settings.goalKcalOverride ?? goal.target,
    suggestedTarget: goal.target,
    goalLimitedBy: goal.limitedBy,
    weeklyKgChange: goal.weeklyKgChange,
    restDayExpenditure, estimate, adaptive, adaptiveApplied,
  };
}

export interface DaySummary {
  date: string;
  entries: FoodEntry[];
  consumed: { kcal: number; protein: number; carbs: number; fat: number };
  workoutKcal: number;
  workoutCount: number;
  energy: ReturnType<typeof dayEnergy>;
  goal: number;
  remaining: number;
  waterMl: number;
  waterGoal: number;
}

export function computeDay(d: AppData, date: string, model: EnergyModel): DaySummary {
  const entries = d.foodLog.filter((e) => e.date === date);
  const consumed = sumNutrients(entries);
  const dayWorkouts = d.workouts.filter((w) => w.date === date);
  const workoutKcal = dayWorkouts.reduce((s, w) => s + w.kcal, 0);
  const energy = dayEnergy({ bmr: model.bmr, neat: model.neatKcal, workoutKcal, consumedKcal: consumed.kcal, adaptiveAdjustment: model.adaptiveApplied });
  return {
    date, entries, consumed, workoutKcal, workoutCount: dayWorkouts.length, energy,
    goal: model.goalTarget,
    remaining: model.goalTarget + workoutKcal - consumed.kcal,
    waterMl: d.water[date] ?? 0,
    waterGoal: waterGoalMl(weightOn(d.weights, date)),
  };
}

/** Hook: modelo de energia atual (recalcula só quando os dados mudam) */
export function useEnergyModel(date?: string) {
  const s = useStore();
  const d = date ?? today();
  return useMemo(
    () => computeEnergyModel(s, d),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.profile, s.questionnaire, s.weights, s.foodLog, s.workouts, s.settings, d],
  );
}

export function useDaySummary(date: string) {
  const s = useStore();
  const model = useEnergyModel();
  return useMemo(
    () => (model ? computeDay(s, date, model) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, s.foodLog, s.workouts, s.water, s.weights, date],
  );
}

/** Dias seguidos com treino (até hoje ou ontem) */
export function trainingStreak(workouts: AppData['workouts'], ref: string = today()): number {
  const days = new Set(workouts.map((w) => w.date));
  let d = days.has(ref) ? ref : addDays(ref, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/** Quando sugerir refazer o questionário: a cada 30 dias ou peso variar mais de 2 kg */
export function shouldRedoQuestionnaire(d: AppData): string | null {
  if (!d.questionnaireDate) return null;
  if (daysBetween(d.questionnaireDate, today()) >= 30) return 'Já faz 30 dias desde o último questionário.';
  const current = weightOn(d.weights, today());
  if (d.questionnaireWeight && Math.abs(current - d.questionnaireWeight) > 2) return 'Seu peso mudou mais de 2 kg desde o questionário.';
  return null;
}
