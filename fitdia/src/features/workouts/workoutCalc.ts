// Junta atividade (padrão ou personalizada), duração e intensidade para calcular calorias
import type { CustomActivity, Intensity } from '@/store/types';
import { ACTIVITIES, findActivity } from '@/data/activities';
import { metCalories, metForIntensity } from '@/lib/calc/met';

export interface ActivityOption {
  id: string;
  name: string;
  strength?: boolean;
  custom?: boolean;
}

export function activityOptions(custom: CustomActivity[]): ActivityOption[] {
  return [...ACTIVITIES.map((a) => ({ id: a.id, name: a.name, strength: a.strength })), ...custom.map((c) => ({ id: c.id, name: c.name, custom: true }))];
}

export function activityName(id: string, custom: CustomActivity[]): string {
  return findActivity(id)?.name ?? custom.find((c) => c.id === id)?.name ?? 'Atividade';
}

/** MET da atividade na intensidade escolhida (personalizadas usam o MET informado como "moderado") */
export function activityMet(id: string, intensity: Intensity, custom: CustomActivity[]): number {
  const a = findActivity(id);
  if (a) return a.met[intensity];
  const c = custom.find((x) => x.id === id);
  return metForIntensity(c?.met ?? 4, intensity);
}

export function activityKcal(id: string, intensity: Intensity, durationMin: number, weightKg: number, custom: CustomActivity[]): number {
  return Math.round(metCalories(activityMet(id, intensity, custom), weightKg, durationMin));
}
