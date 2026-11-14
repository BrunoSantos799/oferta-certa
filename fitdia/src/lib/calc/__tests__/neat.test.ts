import { describe, it, expect } from 'vitest';
import { calculateNeat, sleepHours } from '../neat';
import type { Questionnaire } from '@/store/types';

const base: Questionnaire = {
  workType: 'escritorio', workHoursPerDay: 8, workDaysPerWeek: 5, sittingPercent: 90,
  commute: 'carro', commuteMinutes: 40, activeTransportMinutes: 10, steps: 'nao_sei',
  housework: 'leve', extras: [], screenHours: 3, bedtime: '23:00', wakeTime: '07:00',
  sleepQuality: 'boa', trainingLevel: 'iniciante', activities: [], usesHevy: 'nao',
  mealsPerDay: 4, restrictions: [], waterLitersHabit: 1.5,
};

describe('sono', () => {
  it('atravessa a meia-noite', () => {
    expect(sleepHours('23:00', '07:00')).toBe(8);
    expect(sleepHours('00:30', '06:30')).toBe(6);
  });
});

describe('NEAT por blocos', () => {
  it('soma 24 horas no dia', () => {
    const r = calculateNeat(base, 75);
    const hours = r.blocks.reduce((s, b) => s + b.hours, 0);
    expect(hours).toBeCloseTo(24, 5);
  });

  it('escritório fica numa faixa plausível (≈ 300–700 kcal)', () => {
    const r = calculateNeat(base, 75);
    expect(r.total).toBeGreaterThan(300);
    expect(r.total).toBeLessThan(700);
  });

  it('trabalho pesado gasta mais que escritório', () => {
    const office = calculateNeat(base, 75).total;
    const heavy = calculateNeat({ ...base, workType: 'pesado', sittingPercent: 10 }, 75).total;
    expect(heavy).toBeGreaterThan(office + 400);
  });

  it('mais passos aumentam o gasto', () => {
    const few = calculateNeat({ ...base, steps: 'ate3k' }, 75).total;
    const many = calculateNeat({ ...base, steps: 'mais12k' }, 75).total;
    expect(many).toBeGreaterThan(few + 200);
  });

  it('escala com o peso', () => {
    expect(calculateNeat(base, 100).total).toBeGreaterThan(calculateNeat(base, 60).total);
  });
});
