// Fórmulas de taxa metabólica basal e IMC
import type { Sex } from '@/store/types';

/**
 * Taxa metabólica basal pela fórmula de Mifflin-St Jeor.
 * Homens: 10 × peso + 6,25 × altura − 5 × idade + 5
 * Mulheres: a mesma conta − 161
 */
export function mifflinStJeor(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'masculino' ? base + 5 : base - 161;
}

/**
 * Fórmula de Katch-McArdle (usa a massa magra):
 * 370 + 21,6 × massa magra (kg)
 */
export function katchMcArdle(weightKg: number, bodyFatPercent: number): number {
  const leanMass = weightKg * (1 - bodyFatPercent / 100);
  return 370 + 21.6 * leanMass;
}

/** Índice de massa corporal */
export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export interface BmiRange {
  label: string;
  tone: 'baixo' | 'normal' | 'atencao' | 'alto';
}

/** Faixa do IMC segundo a classificação da OMS */
export function bmiRange(value: number): BmiRange {
  if (value < 18.5) return { label: 'Abaixo do peso', tone: 'baixo' };
  if (value < 25) return { label: 'Peso normal', tone: 'normal' };
  if (value < 30) return { label: 'Sobrepeso', tone: 'atencao' };
  if (value < 35) return { label: 'Obesidade grau I', tone: 'alto' };
  if (value < 40) return { label: 'Obesidade grau II', tone: 'alto' };
  return { label: 'Obesidade grau III', tone: 'alto' };
}

/** Idade em anos completos a partir da data de nascimento (AAAA-MM-DD) */
export function ageFromBirthDate(birthDate: string, today: Date = new Date()): number {
  const [y, m, d] = birthDate.split('-').map(Number);
  let age = today.getFullYear() - y;
  const beforeBirthday = today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d);
  if (beforeBirthday) age--;
  return age;
}
