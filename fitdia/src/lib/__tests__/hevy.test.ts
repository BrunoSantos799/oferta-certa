import { describe, it, expect } from 'vitest';
import { parseHevyCsv, parseHevyText, parseCsv, parseHevyDate } from '../hevy';

const CSV = `"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"
"Treino A","28 Dec 2023, 10:15","28 Dec 2023, 11:20","","Bench Press (Barbell)","","","0","warmup","40","12","","",""
"Treino A","28 Dec 2023, 10:15","28 Dec 2023, 11:20","","Bench Press (Barbell)","","","1","normal","60","10","","","8"
"Treino A","28 Dec 2023, 10:15","28 Dec 2023, 11:20","","Lateral Raise (Dumbbell)","","nota, com vírgula","0","normal","10","12","","",""
"Treino B","30 Dec 2023, 18:00","30 Dec 2023, 19:00","","Squat (Barbell)","","","0","normal","100","5","","",""
"Treino B","30 Dec 2023, 18:00","30 Dec 2023, 19:00","","Plank","","","0","normal","","","","60",""`;

describe('CSV', () => {
  it('respeita aspas e vírgulas internas', () => {
    expect(parseCsv('a,"b, c",d\n1,2,3')).toEqual([['a', 'b, c', 'd'], ['1', '2', '3']]);
  });
  it('lê datas do Hevy', () => {
    const d = parseHevyDate('28 Dec 2023, 10:15')!;
    expect(d.getFullYear()).toBe(2023);
    expect(d.getMonth()).toBe(11);
    expect(d.getHours()).toBe(10);
  });
});

describe('importação do CSV do Hevy', () => {
  it('agrupa séries em treinos', () => {
    const w = parseHevyCsv(CSV);
    expect(w).toHaveLength(2);
    expect(w[0].title).toBe('Treino A');
    expect(w[0].date).toBe('2023-12-28');
    expect(w[0].durationMin).toBe(65);
    expect(w[0].exercises).toHaveLength(2);
    expect(w[0].exercises[0].sets[0].type).toBe('aquecimento');
    expect(w[0].exercises[0].sets[1]).toMatchObject({ reps: 10, kg: 60 });
    expect(w[1].exercises[1].sets[0].reps).toBe(1); // prancha por tempo
  });
  it('recusa arquivos que não são do Hevy', () => {
    expect(() => parseHevyCsv('nome,idade\nAna,30')).toThrow();
  });
  it('converte libras', () => {
    const csv = `title,start_time,end_time,exercise_title,set_type,weight_lbs,reps\nT,2024-01-04 18:00:00,2024-01-04 19:00:00,Curl,normal,100,10`;
    expect(parseHevyCsv(csv)[0].exercises[0].sets[0].kg).toBeCloseTo(45.4, 1);
  });
});

describe('texto compartilhado do Hevy', () => {
  it('interpreta exercícios e séries', () => {
    const text = `Push Day
Thursday, Jan 4, 2024 at 6:01pm

Bench Press (Barbell)
Warm-up: 40 kg x 12
Set 1: 60 kg x 10
Set 2: 80 kg x 8 [Drop]

D-Handle Row
Set 1: 30 kg x 12

@hevyapp
https://hevy.com/workout/abc`;
    const w = parseHevyText(text, '2026-11-14');
    expect(w.title).toBe('Push Day');
    expect(w.date).toBe('2024-01-04');
    expect(w.exercises.map((e) => e.name)).toEqual(['Bench Press (Barbell)', 'D-Handle Row']);
    expect(w.exercises[0].sets).toHaveLength(3);
    expect(w.exercises[0].sets[0].type).toBe('aquecimento');
    expect(w.exercises[0].sets[2]).toMatchObject({ kg: 80, reps: 8, type: 'drop' });
  });
  it('aceita texto em português e usa a data padrão', () => {
    const w = parseHevyText('Treino A\n\nAgachamento\nSérie 1: 100 kg x 5\nSérie 2: 100 kg x 5', '2026-11-14');
    expect(w.date).toBe('2026-11-14');
    expect(w.exercises[0].sets).toHaveLength(2);
  });
  it('dá erro quando não há séries', () => {
    expect(() => parseHevyText('qualquer coisa', '2026-11-14')).toThrow();
  });
});
