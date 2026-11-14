// Importação de treinos do app Hevy
// 1) CSV exportado em Configurações > Exportar dados
// 2) Texto do treino compartilhado pelo app
import type { ExerciseLog, SetLog } from '@/store/types';

export interface ParsedWorkout {
  title: string;
  date: string; // AAAA-MM-DD
  startTime?: string; // ISO local
  durationMin?: number;
  exercises: ExerciseLog[];
}

const LB_TO_KG = 0.45359237;

/** Divide uma linha CSV respeitando aspas ("a, b" fica num campo só) */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, ''); // remove BOM
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row);
  return rows;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, fev: 2, mar: 3, apr: 4, abr: 4, may: 5, mai: 5, jun: 6, jul: 7,
  aug: 8, ago: 8, sep: 9, set: 9, oct: 10, out: 10, nov: 11, dec: 12, dez: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Converte datas usadas pelo Hevy em Date local:
 * "28 Dec 2023, 10:15", "2023-12-28 10:15:00", "2023-12-28T10:15:00Z"
 */
export function parseHevyDate(s: string): Date | null {
  const t = s.trim();
  if (!t) return null;
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/);
  if (m) {
    if (/Z|[+-]\d{2}:?\d{2}$/.test(t)) {
      const d = new Date(t);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  }
  m = t.match(/^(\d{1,2})\s+([A-Za-zç]{3})[a-zç]*\.?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (m) {
    const month = MONTHS[m[2].toLowerCase()];
    if (!month) return null;
    let h = +m[4];
    if (m[6]) {
      const pm = m[6].toLowerCase() === 'pm';
      if (pm && h < 12) h += 12;
      if (!pm && h === 12) h = 0;
    }
    return new Date(+m[3], month - 1, +m[1], h, +m[5]);
  }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return null;
}

const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const num = (s: string | undefined) => {
  if (!s) return 0;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

/** Lê o CSV de exportação do Hevy e agrupa as linhas (uma por série) em treinos */
export function parseHevyCsv(text: string): ParsedWorkout[] {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('Arquivo vazio ou sem treinos.');
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const iTitle = col('title');
  const iStart = col('start_time');
  const iEnd = col('end_time');
  const iEx = col('exercise_title');
  const iType = col('set_type');
  const iKg = col('weight_kg');
  const iLbs = col('weight_lbs');
  const iReps = col('reps');
  const iDur = col('duration_seconds');
  const iDist = col('distance_km');
  if (iTitle < 0 || iStart < 0 || iEx < 0) {
    throw new Error('Este arquivo não parece ser uma exportação do Hevy (faltam as colunas title, start_time e exercise_title).');
  }

  const map = new Map<string, ParsedWorkout>();
  for (const r of rows.slice(1)) {
    const title = r[iTitle]?.trim() || 'Treino';
    const startRaw = r[iStart] ?? '';
    const start = parseHevyDate(startRaw);
    if (!start) continue;
    const key = `${title}|${startRaw}`;
    let w = map.get(key);
    if (!w) {
      const end = iEnd >= 0 ? parseHevyDate(r[iEnd] ?? '') : null;
      const durationMin = end ? Math.round((end.getTime() - start.getTime()) / 60000) : undefined;
      w = {
        title,
        date: toISO(start),
        startTime: `${toISO(start)}T${pad(start.getHours())}:${pad(start.getMinutes())}`,
        durationMin: durationMin && durationMin > 0 && durationMin < 600 ? durationMin : undefined,
        exercises: [],
      };
      map.set(key, w);
    }
    const exName = r[iEx]?.trim() || 'Exercício';
    let ex = w.exercises[w.exercises.length - 1];
    if (!ex || ex.name !== exName) {
      ex = w.exercises.find((e) => e.name === exName) ?? { name: exName, sets: [] };
      if (!w.exercises.includes(ex)) w.exercises.push(ex);
    }
    let kg = iKg >= 0 ? num(r[iKg]) : 0;
    if (!kg && iLbs >= 0) kg = num(r[iLbs]) * LB_TO_KG;
    let reps = iReps >= 0 ? num(r[iReps]) : 0;
    // Exercícios por tempo/distância (prancha, esteira): conta como 1 repetição
    if (!reps && ((iDur >= 0 && num(r[iDur]) > 0) || (iDist >= 0 && num(r[iDist]) > 0))) reps = 1;
    const typeRaw = (iType >= 0 ? r[iType] : 'normal')?.toLowerCase() ?? 'normal';
    const type: SetLog['type'] =
      typeRaw.includes('warm') ? 'aquecimento' : typeRaw.includes('drop') ? 'drop' : typeRaw.includes('fail') ? 'falha' : 'normal';
    ex.sets.push({ reps: Math.round(reps), kg: Math.round(kg * 10) / 10, type });
  }
  const list = [...map.values()].filter((w) => w.exercises.length > 0);
  if (list.length === 0) throw new Error('Nenhum treino válido encontrado no arquivo.');
  return list.sort((a, b) => (a.startTime ?? a.date).localeCompare(b.startTime ?? b.date));
}

/**
 * Interpreta o texto compartilhado pelo Hevy, por exemplo:
 *
 *   Treino A
 *   Thursday, Jan 4, 2024 at 6:01pm
 *
 *   Bench Press (Barbell)
 *   Set 1: 60 kg x 10
 *   Warm-up: 40 kg x 12
 *
 *   @hevyapp
 */
export function parseHevyText(text: string, fallbackDate: string): ParsedWorkout {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const setRe = /^(?:(?:set|s[ée]rie|warm[- ]?up|aquecimento|drop(?:\s*set)?|failure|falha)\s*\d*\s*[:.\-–]|[wdf]\s*\d*\s*:)\s*(.+)$/i;
  const exercises: ExerciseLog[] = [];
  let title = '';
  let date = fallbackDate;
  let durationMin: number | undefined;
  let current: ExerciseLog | null = null;

  for (const line of lines) {
    if (!line) {
      current = null;
      continue;
    }
    if (/^@hevy|hevy\.com|^https?:\/\//i.test(line)) continue;

    // Duração: "Duration: 1h 5min" / "Duração: 65 min"
    const dur = line.match(/^(?:duration|dura[çc][ãa]o)\s*:?\s*(?:(\d+)\s*h)?\s*(?:(\d+)\s*min)?/i);
    if (dur && (dur[1] || dur[2])) {
      durationMin = (+(dur[1] || 0)) * 60 + +(dur[2] || 0);
      continue;
    }

    const setMatch = line.match(setRe);
    if (setMatch && current) {
      const body = setMatch[1];
      const isWarm = /^(warm|aquec|w\b)/i.test(line);
      const isDrop = /^(drop|d\b)/i.test(line) || /\[drop/i.test(body);
      const w = body.match(/(\d+(?:[.,]\d+)?)\s*(kg|lbs?)/i);
      const r = body.match(/(?:x|×)\s*(\d+)/i) ?? body.match(/(\d+)\s*(?:reps?|repeti)/i);
      let kg = w ? Number(w[1].replace(',', '.')) : 0;
      if (w && /lb/i.test(w[2])) kg *= LB_TO_KG;
      const reps = r ? Number(r[1]) : /\d+\s*(s|seg|sec|min)\b/i.test(body) ? 1 : 0;
      if (reps > 0) current.sets.push({ reps, kg: Math.round(kg * 10) / 10, type: isWarm ? 'aquecimento' : isDrop ? 'drop' : 'normal' });
      continue;
    }

    // Linha de data: tenta "Jan 4, 2024" ou "4 de jan de 2024" ou "04/01/2024"
    const parsedDate = parseShareDate(line);
    if (parsedDate && !current) {
      date = parsedDate;
      continue;
    }

    if (!title) {
      title = line;
      continue;
    }
    current = { name: line.replace(/^\d+\.\s*/, ''), sets: [] };
    exercises.push(current);
  }

  const valid = exercises.filter((e) => e.sets.length > 0);
  if (valid.length === 0) throw new Error('Não encontrei séries no texto. Cole o treino como o Hevy compartilha (ex.: "Set 1: 60 kg x 10").');
  return { title: title || 'Treino do Hevy', date, durationMin, exercises: valid };
}

function parseShareDate(line: string): string | null {
  let m = line.match(/([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (m && MONTHS[m[1].toLowerCase()]) return `${m[3]}-${pad(MONTHS[m[1].toLowerCase()])}-${pad(+m[2])}`;
  m = line.match(/(\d{1,2})\s+(?:de\s+)?([A-Za-zç]{3})[a-zç]*\.?\s+(?:de\s+)?(\d{4})/i);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${pad(MONTHS[m[2].toLowerCase()])}-${pad(+m[1])}`;
  m = line.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  return null;
}
