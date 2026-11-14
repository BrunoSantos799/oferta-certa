// Exportação e importação dos dados em JSON (backup)
import type { AppData } from '@/store/useStore';
import { initialData } from '@/store/useStore';

export const BACKUP_VERSION = 1;

export function buildBackup(data: AppData): string {
  return JSON.stringify({ app: 'FitDia', version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data }, null, 2);
}

/** Lê e valida um backup; lança erro com mensagem amigável se algo estiver errado */
export function parseBackup(text: string): AppData {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('O arquivo não é um JSON válido.');
  }
  const obj = json as { app?: string; data?: Partial<AppData> };
  if (!obj || obj.app !== 'FitDia' || typeof obj.data !== 'object' || obj.data === null) {
    throw new Error('Este arquivo não é um backup do FitDia.');
  }
  const d = obj.data;
  const arrays: Array<keyof AppData> = ['weights', 'customFoods', 'foodLog', 'favorites', 'workouts', 'customActivities', 'customExercises', 'templates'];
  for (const k of arrays) {
    if (d[k] !== undefined && !Array.isArray(d[k])) throw new Error(`Backup corrompido: campo "${k}" inválido.`);
  }
  if (d.weights?.some((w) => typeof w?.date !== 'string' || typeof w?.kg !== 'number' || w.kg <= 0 || w.kg > 400)) {
    throw new Error('Backup corrompido: pesagens inválidas.');
  }
  if (d.foodLog?.some((e) => typeof e?.date !== 'string' || typeof e?.grams !== 'number' || !e?.food)) {
    throw new Error('Backup corrompido: registros de alimentação inválidos.');
  }
  if (d.workouts?.some((w) => typeof w?.date !== 'string' || typeof w?.kcal !== 'number')) {
    throw new Error('Backup corrompido: treinos inválidos.');
  }
  return {
    ...initialData,
    ...d,
    weights: [...(d.weights ?? [])].sort((a, b) => a.date.localeCompare(b.date)),
    settings: { ...initialData.settings, ...(d.settings ?? {}) },
  } as AppData;
}

/** Baixa um arquivo de texto no navegador */
export function downloadFile(name: string, content: string, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
