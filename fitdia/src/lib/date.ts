// Datas no formato local AAAA-MM-DD (sem fuso horário)

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const today = () => toISODate(new Date());

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((fromISODate(b).getTime() - fromISODate(a).getTime()) / 86400000);
}

/** Rótulo amigável: "Hoje", "Ontem", "Amanhã" ou "seg, 12 de nov" */
export function friendlyDate(iso: string): string {
  const diff = daysBetween(today(), iso);
  if (diff === 0) return 'Hoje';
  if (diff === -1) return 'Ontem';
  if (diff === 1) return 'Amanhã';
  return fromISODate(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });
}

export const shortDate = (iso: string) =>
  fromISODate(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

/** Lista de datas de start até end (inclusive) */
export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}
