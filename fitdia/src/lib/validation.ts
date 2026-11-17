// Validação de campos: sem valores vazios, negativos ou absurdos
import { parseNum } from './utils';
import { ageFromBirthDate } from './calc/bmr';

export type ValidationResult = { ok: true; value: number } | { ok: false; error: string };

/** Limites aceitos para cada tipo de campo numérico */
export const LIMITS = {
  peso: { min: 25, max: 350, unit: 'kg' },
  altura: { min: 100, max: 250, unit: 'cm' },
  gordura: { min: 3, max: 60, unit: '%' },
  gramas: { min: 1, max: 5000, unit: 'g' },
  ml: { min: 1, max: 5000, unit: 'ml' },
  porcoes: { min: 0.1, max: 50, unit: '' },
  duracao: { min: 1, max: 600, unit: 'min' },
  kcalTreino: { min: 1, max: 5000, unit: 'kcal' },
  kcal100: { min: 0, max: 900, unit: 'kcal' },
  macro100: { min: 0, max: 100, unit: 'g' },
  reps: { min: 1, max: 200, unit: '' },
  carga: { min: 0, max: 1000, unit: 'kg' },
  descanso: { min: 0, max: 900, unit: 's' },
  met: { min: 1, max: 25, unit: '' },
  metaKcal: { min: 1000, max: 6000, unit: 'kcal' },
  horasDia: { min: 0, max: 16, unit: 'h' },
  diasSemana: { min: 0, max: 7, unit: '' },
  minutosDia: { min: 0, max: 300, unit: 'min' },
  vezesSemana: { min: 1, max: 14, unit: '' },
  refeicoes: { min: 1, max: 10, unit: '' },
  agua: { min: 0, max: 10, unit: 'L' },
  copo: { min: 50, max: 1000, unit: 'ml' },
} as const;

export type LimitKey = keyof typeof LIMITS;

export function validateNumber(raw: string | number, key: LimitKey): ValidationResult {
  if (raw === '' || raw === null || raw === undefined) return { ok: false, error: 'Campo obrigatório' };
  const n = parseNum(raw);
  if (Number.isNaN(n)) return { ok: false, error: 'Digite um número válido' };
  if (n < 0) return { ok: false, error: 'Não pode ser negativo' };
  const { min, max, unit } = LIMITS[key];
  if (n < min || n > max) {
    return { ok: false, error: `Use um valor entre ${String(min).replace('.', ',')} e ${max}${unit ? ' ' + unit : ''}` };
  }
  return { ok: true, value: n };
}

/** Retorna a mensagem de erro (ou null se válido) */
export function numberError(raw: string | number, key: LimitKey): string | null {
  const r = validateNumber(raw, key);
  return r.ok ? null : r.error;
}

export function nameError(name: string, min = 2, max = 60): string | null {
  const t = name.trim();
  if (!t) return 'Campo obrigatório';
  if (t.length < min) return `Use pelo menos ${min} letras`;
  if (t.length > max) return `Use no máximo ${max} caracteres`;
  return null;
}

/** Data de nascimento válida: idade entre 13 e 100 anos */
export function birthDateError(date: string): string | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Informe a data de nascimento';
  const age = ageFromBirthDate(date);
  if (Number.isNaN(age)) return 'Data inválida';
  if (age < 13) return 'O FitDia é para pessoas a partir de 13 anos';
  if (age > 100) return 'Confira o ano de nascimento';
  return null;
}

/** Macronutrientes por 100 g não podem somar mais de 100 g */
export function macrosError(p: number, c: number, f: number): string | null {
  if (p + c + f > 100) return 'Proteína + carboidrato + gordura não podem passar de 100 g';
  return null;
}
