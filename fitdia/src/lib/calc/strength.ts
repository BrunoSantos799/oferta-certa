// Estimativa de calorias da musculação a partir do volume de séries e carga
import type { ExerciseLog, Intensity } from '@/store/types';
import { metCalories } from './met';
import { findActivity } from '@/data/activities';

/** Minutos estimados por série quando a duração não é informada (execução + descanso) */
export const MIN_PER_SET = 2.5;

export interface StrengthSummary {
  sets: number;
  reps: number;
  volumeKg: number; // Σ carga × repetições
}

export function summarizeExercises(exercises: ExerciseLog[]): StrengthSummary {
  let sets = 0;
  let reps = 0;
  let volumeKg = 0;
  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (s.type === 'aquecimento') continue; // aquecimento não conta como série válida
      sets++;
      reps += s.reps;
      volumeKg += s.reps * s.kg;
    }
  }
  return { sets, reps, volumeKg };
}

/** Duração estimada pelo número de séries e descanso informado */
export function estimateDurationMin(exercises: ExerciseLog[]): number {
  let total = 0;
  for (const ex of exercises) {
    for (const s of ex.sets) total += 0.75 + (s.restSec ?? 105) / 60; // ~45 s de execução + descanso
  }
  return Math.max(10, Math.round(total));
}

/**
 * Intensidade estimada pela densidade (séries por minuto) e pelo volume
 * relativo ao peso corporal por minuto.
 */
export function estimateStrengthIntensity(exercises: ExerciseLog[], durationMin: number, bodyWeightKg: number): Intensity {
  const { sets, volumeKg } = summarizeExercises(exercises);
  if (sets === 0 || durationMin <= 0) return 'moderada';
  const density = sets / durationMin; // séries por minuto
  const relVolume = volumeKg / bodyWeightKg / durationMin; // "pesos corporais" levantados por minuto

  let level = density < 0.22 ? 0 : density < 0.4 ? 1 : 2;
  if (relVolume > 3) level++;
  else if (relVolume < 0.8) level--;
  level = Math.max(0, Math.min(2, level));
  return (['leve', 'moderada', 'intensa'] as const)[level];
}

/** Calorias de um treino de musculação: MET (por intensidade) × peso × horas */
export function strengthCalories(exercises: ExerciseLog[], durationMin: number | undefined, bodyWeightKg: number) {
  const duration = durationMin && durationMin > 0 ? durationMin : estimateDurationMin(exercises);
  const intensity = estimateStrengthIntensity(exercises, duration, bodyWeightKg);
  const met = findActivity('musculacao')!.met[intensity];
  return { durationMin: duration, intensity, kcal: Math.round(metCalories(met, bodyWeightKg, duration)) };
}

/** 1RM estimado pela fórmula de Epley: carga × (1 + reps/30) */
export function estimatedOneRepMax(kg: number, reps: number): number {
  if (reps <= 0 || kg <= 0) return 0;
  if (reps === 1) return kg;
  return kg * (1 + reps / 30);
}
