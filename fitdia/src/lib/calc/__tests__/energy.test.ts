import { describe, it, expect } from 'vitest';
import {
  estimateEnergy, goalCalories, dayEnergy, thermicEffect, nearestActivityLevel,
  plannedExercisePerDay, adaptiveAdjustment, waterGoalMl, linearSlope,
} from '../energy';
import { addDays } from '@/lib/date';

describe('efeito térmico', () => {
  it('é 10% do consumido', () => {
    expect(thermicEffect(2000)).toBe(200);
    expect(thermicEffect(-5)).toBe(0);
  });
});

describe('exercício planejado', () => {
  it('frequência × duração × MET ÷ 7', () => {
    // musculação moderada 5 MET, 70 kg, 60 min, 3×/semana → 3×350/7 = 150
    expect(plannedExercisePerDay([{ activityId: 'musculacao', timesPerWeek: 3, minutesPerSession: 60 }], 70)).toBeCloseTo(150);
  });
});

describe('estimativa de energia', () => {
  it('compõe basal + NEAT + exercício + TEF', () => {
    const e = estimateEnergy(1700, 500, [{ activityId: 'musculacao', timesPerWeek: 3, minutesPerSession: 60 }], 70);
    expect(e.average).toBeCloseTo((1700 + 500 + 150) / 0.9);
    expect(e.tef).toBeCloseTo(e.average * 0.1);
    expect(e.trainingDay).toBeGreaterThan(e.restDay);
    expect(e.activityFactor).toBeCloseTo(e.average / 1700);
  });
  it('acha o nível de atividade equivalente', () => {
    expect(nearestActivityLevel(1.5).label).toBe('Moderado');
    expect(nearestActivityLevel(1.21).label).toBe('Sedentário');
  });
});

describe('meta calórica', () => {
  it('déficit de 500 no ritmo moderado', () => {
    expect(goalCalories(2500, 1700, 'masculino', 'perder', 'moderado').target).toBe(2000);
  });
  it('superávit de 300 para ganhar', () => {
    expect(goalCalories(2500, 1700, 'masculino', 'ganhar', 'moderado').target).toBe(2800);
  });
  it('manter não altera', () => {
    expect(goalCalories(2300, 1600, 'feminino', 'manter', 'moderado').target).toBe(2300);
  });
  it('limita o déficit a 25%', () => {
    const r = goalCalories(2000, 1200, 'masculino', 'perder', 'rapido');
    expect(r.target).toBeGreaterThanOrEqual(1500);
    expect(r.limitedBy).toBeTruthy();
  });
  it('nunca abaixo de 1.200 kcal para mulheres', () => {
    const r = goalCalories(1500, 1150, 'feminino', 'perder', 'rapido');
    expect(r.target).toBeGreaterThanOrEqual(1200);
  });
});

describe('energia do dia', () => {
  it('saldo = consumido − gasto total', () => {
    const d = dayEnergy({ bmr: 1700, neat: 500, workoutKcal: 300, consumedKcal: 2000 });
    expect(d.tef).toBe(200);
    expect(d.total).toBe(2700);
    expect(d.balance).toBe(-700);
  });
});

describe('água', () => {
  it('35 ml por kg', () => {
    expect(waterGoalMl(80)).toBe(2800);
  });
});

describe('ajuste adaptativo', () => {
  it('inclinação linear', () => {
    expect(linearSlope([{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }])).toBeCloseTo(2);
  });

  it('não ajusta sem dados suficientes', () => {
    const r = adaptiveAdjustment({ weights: [{ date: '2026-01-01', kg: 80 }], days: [] });
    expect(r.ready).toBe(false);
    expect(r.adjustment).toBe(0);
  });

  it('aumenta o gasto quando a pessoa perde mais peso que o previsto', () => {
    const start = '2026-01-01';
    // Consome 2000, app prevê gasto 2200 (déficit 200/dia ≈ 0,18 kg/sem)
    // mas o peso cai 0,5 kg/sem → gasto real ≈ 2000 + 550 = 2550
    const weights = Array.from({ length: 5 }, (_, i) => ({ date: addDays(start, i * 7), kg: 80 - i * 0.5 }));
    const days = Array.from({ length: 29 }, (_, i) => ({ date: addDays(start, i), consumed: 2000, predictedExpenditure: 2200 }));
    const r = adaptiveAdjustment({ weights, days });
    expect(r.ready).toBe(true);
    expect(r.observedExpenditure).toBeCloseTo(2550, 0);
    expect(r.adjustment).toBe(175); // metade da diferença (350)
  });

  it('limita o ajuste a ±400 kcal', () => {
    const start = '2026-01-01';
    const weights = Array.from({ length: 5 }, (_, i) => ({ date: addDays(start, i * 7), kg: 80 + i * 2 }));
    const days = Array.from({ length: 29 }, (_, i) => ({ date: addDays(start, i), consumed: 2000, predictedExpenditure: 2500 }));
    expect(adaptiveAdjustment({ weights, days }).adjustment).toBe(-400);
  });
});
