import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Junta classes do Tailwind resolvendo conflitos (padrão shadcn/ui) */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Gera um identificador único curto */
export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/** Formata número inteiro no padrão brasileiro (1.234) */
export const fmt = (n: number) => nf0.format(Math.round(n));
/** Formata com até 1 casa decimal (72,5) */
export const fmt1 = (n: number) => nf1.format(n);

/** Converte texto digitado ("72,5") em número; retorna NaN se inválido */
export function parseNum(v: string | number): number {
  if (typeof v === 'number') return v;
  const s = v.trim().replace(/\s/g, '').replace(',', '.');
  if (s === '' || !/^-?\d*\.?\d+$/.test(s)) return NaN;
  return Number(s);
}
