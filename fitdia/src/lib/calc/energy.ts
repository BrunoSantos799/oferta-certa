// Composição do gasto energético diário, meta calórica e ajuste adaptativo
import type { Goal, Pace, PlannedActivity, Sex } from '@/store/types';
import { findActivity } from '@/data/activities';
import { metCalories } from './met';

/** Efeito térmico dos alimentos: 10% das calorias consumidas */
export const TEF_RATE = 0.1;

/** Energia aproximada de 1 kg de gordura corporal */
export const KCAL_PER_KG = 7700;

export function thermicEffect(consumedKcal: number): number {
  return Math.max(0, consumedKcal) * TEF_RATE;
}

export const ACTIVITY_LEVELS = [
  { factor: 1.2, label: 'Sedentário', description: 'Pouco ou nenhum exercício, trabalho sentado.' },
  { factor: 1.375, label: 'Pouca atividade', description: 'Exercício leve 1 a 3 vezes por semana.' },
  { factor: 1.55, label: 'Moderado', description: 'Exercício moderado 3 a 5 vezes por semana.' },
  { factor: 1.725, label: 'Intenso', description: 'Exercício pesado 6 a 7 vezes por semana.' },
  { factor: 1.9, label: 'Muito intenso', description: 'Treinos diários pesados ou trabalho físico.' },
] as const;

/** Nível de atividade mais próximo de um fator equivalente */
export function nearestActivityLevel(factor: number) {
  return ACTIVITY_LEVELS.reduce((best, l) => (Math.abs(l.factor - factor) < Math.abs(best.factor - factor) ? l : best));
}

/**
 * Gasto médio por dia com exercício planejado (estimativa inicial):
 * Σ vezes/semana × duração × MET (moderado) ÷ 7
 */
export function plannedExercisePerDay(activities: PlannedActivity[], weightKg: number): number {
  const weekly = activities.reduce((sum, a) => {
    const act = findActivity(a.activityId);
    if (!act) return sum;
    return sum + a.timesPerWeek * metCalories(act.met.moderada, weightKg, a.minutesPerSession);
  }, 0);
  return weekly / 7;
}

/** Calorias de uma sessão típica de treino (média ponderada pela frequência) */
export function typicalSessionKcal(activities: PlannedActivity[], weightKg: number): number {
  const sessions = activities.reduce((s, a) => s + a.timesPerWeek, 0);
  if (sessions === 0) return 0;
  return (plannedExercisePerDay(activities, weightKg) * 7) / sessions;
}

export interface EnergyEstimate {
  bmr: number;
  neat: number;
  exerciseAvg: number;
  tef: number;
  restDay: number;
  trainingDay: number;
  average: number;
  activityFactor: number;
}

/**
 * Estimativa inicial do gasto. Como ainda não há registro do que a pessoa come,
 * supomos que ela come o que gasta: TEF = 10% do total → total = (basal + NEAT + exercício) ÷ 0,9.
 */
export function estimateEnergy(bmr: number, neat: number, activities: PlannedActivity[], weightKg: number): EnergyEstimate {
  const exerciseAvg = plannedExercisePerDay(activities, weightKg);
  const session = typicalSessionKcal(activities, weightKg);
  const withTef = (x: number) => x / (1 - TEF_RATE);
  const average = withTef(bmr + neat + exerciseAvg);
  return {
    bmr,
    neat,
    exerciseAvg,
    tef: average - (bmr + neat + exerciseAvg),
    restDay: withTef(bmr + neat),
    trainingDay: withTef(bmr + neat + session),
    average,
    activityFactor: average / bmr,
  };
}

/** Ajuste diário (kcal) por objetivo e ritmo. Moderado = −500 para perder e +300 para ganhar. */
export const PACE_ADJUSTMENT: Record<'perder' | 'ganhar', Record<Pace, number>> = {
  perder: { lento: -250, moderado: -500, rapido: -750 },
  ganhar: { lento: 150, moderado: 300, rapido: 450 },
};

export interface GoalResult {
  target: number;
  adjustment: number;
  /** Mensagem quando algum limite de segurança foi aplicado */
  limitedBy?: string;
  weeklyKgChange: number;
}

/**
 * Meta diária de calorias com limites seguros:
 * - déficit máximo de 25% do gasto;
 * - nunca abaixo da basal nem de 1.200 kcal (mulheres) / 1.500 kcal (homens);
 * - superávit máximo de 15% do gasto.
 */
export function goalCalories(maintenance: number, bmr: number, sex: Sex, goal: Goal, pace: Pace): GoalResult {
  let adjustment = goal === 'perder' || goal === 'ganhar' ? PACE_ADJUSTMENT[goal][pace] : 0;
  let limitedBy: string | undefined;

  if (adjustment < 0) {
    const maxDeficit = -0.25 * maintenance;
    if (adjustment < maxDeficit) {
      adjustment = maxDeficit;
      limitedBy = 'Déficit limitado a 25% do seu gasto para preservar massa magra.';
    }
    const floor = Math.max(bmr, sex === 'feminino' ? 1200 : 1500);
    if (maintenance + adjustment < floor) {
      adjustment = Math.min(0, floor - maintenance);
      limitedBy = 'Meta ajustada para não ficar abaixo do mínimo seguro.';
    }
  } else if (adjustment > 0) {
    const maxSurplus = 0.15 * maintenance;
    if (adjustment > maxSurplus) {
      adjustment = maxSurplus;
      limitedBy = 'Superávit limitado a 15% do seu gasto para evitar ganho de gordura.';
    }
  }

  const target = Math.round(maintenance + adjustment);
  return { target, adjustment: Math.round(adjustment), limitedBy, weeklyKgChange: (adjustment * 7) / KCAL_PER_KG };
}

export interface DayEnergyInput {
  bmr: number;
  neat: number;
  workoutKcal: number;
  consumedKcal: number;
  adaptiveAdjustment?: number;
}

export interface DayEnergy {
  bmr: number;
  neat: number;
  workout: number;
  tef: number;
  adaptive: number;
  total: number;
  consumed: number;
  balance: number; // consumido − gasto (negativo = déficit)
}

/** Gasto total do dia = basal + dia a dia + treinos + 10% do consumido (+ ajuste adaptativo) */
export function dayEnergy(i: DayEnergyInput): DayEnergy {
  const tef = thermicEffect(i.consumedKcal);
  const adaptive = i.adaptiveAdjustment ?? 0;
  const total = i.bmr + i.neat + i.workoutKcal + tef + adaptive;
  return {
    bmr: i.bmr,
    neat: i.neat,
    workout: i.workoutKcal,
    tef,
    adaptive,
    total,
    consumed: i.consumedKcal,
    balance: i.consumedKcal - total,
  };
}

// ----- Ajuste adaptativo -----

export interface AdaptiveInput {
  /** Pesagens no período (data AAAA-MM-DD) */
  weights: Array<{ date: string; kg: number }>;
  /** Dias com registro de alimentação: consumo e gasto previsto pelo app */
  days: Array<{ date: string; consumed: number; predictedExpenditure: number }>;
  /** Tamanho da janela em dias */
  windowDays?: number;
}

export interface AdaptiveResult {
  ready: boolean;
  reason?: string;
  adjustment: number; // kcal/dia a somar ao gasto previsto
  observedExpenditure?: number;
  predictedExpenditure?: number;
  weightTrendKgPerWeek?: number;
}

/** Inclinação (kg/dia) por regressão linear simples */
export function linearSlope(points: Array<{ x: number; y: number }>): number {
  const n = points.length;
  if (n < 2) return 0;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  const num = points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
  const den = points.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  return den === 0 ? 0 : num / den;
}

const dayNumber = (iso: string) => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000);

/**
 * Compara a variação real do peso com o saldo calórico registrado.
 * Gasto observado = consumo médio − (tendência de peso kg/dia × 7.700).
 * O ajuste é metade da diferença (suavização), limitado a ±400 kcal/dia.
 * Exige ≥ 14 dias de janela com pesagens, e alimentação registrada em ≥ 70% dos dias.
 */
export function adaptiveAdjustment(input: AdaptiveInput): AdaptiveResult {
  const windowDays = input.windowDays ?? 28;
  const weights = [...input.weights].sort((a, b) => a.date.localeCompare(b.date));
  if (weights.length < 3) return { ready: false, reason: 'Registre o peso pelo menos 3 vezes.', adjustment: 0 };

  const last = dayNumber(weights[weights.length - 1].date);
  const inWindow = weights.filter((w) => last - dayNumber(w.date) < windowDays);
  const span = last - dayNumber(inWindow[0].date);
  if (inWindow.length < 3 || span < 14) {
    return { ready: false, reason: 'São necessárias pesagens cobrindo pelo menos 14 dias.', adjustment: 0 };
  }

  const start = last - span;
  const days = input.days.filter((d) => {
    const n = dayNumber(d.date);
    return n >= start && n <= last && d.consumed > 0;
  });
  if (days.length < (span + 1) * 0.7) {
    return { ready: false, reason: 'Registre a alimentação em pelo menos 70% dos dias.', adjustment: 0 };
  }

  const slope = linearSlope(inWindow.map((w) => ({ x: dayNumber(w.date), y: w.kg })));
  const avgConsumed = days.reduce((s, d) => s + d.consumed, 0) / days.length;
  const avgPredicted = days.reduce((s, d) => s + d.predictedExpenditure, 0) / days.length;
  const observed = avgConsumed - slope * KCAL_PER_KG;
  const raw = (observed - avgPredicted) * 0.5;
  const adjustment = Math.round(Math.max(-400, Math.min(400, raw)));

  return {
    ready: true,
    adjustment,
    observedExpenditure: observed,
    predictedExpenditure: avgPredicted,
    weightTrendKgPerWeek: slope * 7,
  };
}

/** Meta diária de água: 35 ml por kg de peso */
export function waterGoalMl(weightKg: number): number {
  return Math.round(weightKg * 35);
}
