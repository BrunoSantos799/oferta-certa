import { describe, it, expect } from 'vitest';
import { macroTargets } from '../macros';

describe('metas de macros', () => {
  it('fecha as calorias da meta', () => {
    const m = macroTargets(2000, 70, 'perder');
    expect(m.protein).toBe(140);
    expect(m.fat).toBe(56);
    expect(m.protein * 4 + m.carbs * 4 + m.fat * 9).toBeGreaterThan(1980);
    expect(m.protein * 4 + m.carbs * 4 + m.fat * 9).toBeLessThan(2020);
  });
  it('limita a proteína a 35% das calorias', () => {
    expect(macroTargets(1400, 120, 'perder').protein).toBe(Math.round((1400 * 0.35) / 4));
  });
});
