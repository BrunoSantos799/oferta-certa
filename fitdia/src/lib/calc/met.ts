// Cálculos de gasto com atividades baseados em MET
import type { Intensity } from '@/store/types';

/**
 * Calorias gastas numa atividade = MET × peso (kg) × duração (h)
 */
export function metCalories(met: number, weightKg: number, durationMin: number): number {
  return met * weightKg * (durationMin / 60);
}

/**
 * Gasto LÍQUIDO acima do repouso: (MET − 1) × peso × horas.
 * Usado no NEAT, pois a taxa basal já cobre o equivalente a 1 MET.
 */
export function netMetCalories(met: number, weightKg: number, hours: number): number {
  return (met - 1) * weightKg * hours;
}

/** Multiplicadores para ajustar um MET de referência (moderado) pela intensidade */
export const INTENSITY_FACTOR: Record<Intensity, number> = {
  leve: 0.75,
  moderada: 1,
  intensa: 1.3,
};

export interface MetByIntensity {
  leve: number;
  moderada: number;
  intensa: number;
}

/** Escolhe o MET certo para a intensidade, ou ajusta um MET único pelo fator */
export function metForIntensity(met: number | MetByIntensity, intensity: Intensity): number {
  if (typeof met === 'number') return Math.max(1, met * INTENSITY_FACTOR[intensity]);
  return met[intensity];
}
