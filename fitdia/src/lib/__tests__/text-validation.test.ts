import { describe, it, expect } from 'vitest';
import { normalize, searchByName } from '../text';
import { validateNumber, macrosError, birthDateError } from '../validation';
import { FOODS } from '@/data/foods';

describe('busca', () => {
  it('ignora acentos', () => {
    expect(normalize('Feijão Açaí')).toBe('feijao acai');
    expect(searchByName(FOODS, 'feijao')[0].id).toBe('feijao_carioca');
    expect(searchByName(FOODS, 'acai').some((f) => f.id === 'acai')).toBe(true);
    expect(searchByName(FOODS, 'pao frances')[0].id).toBe('pao_frances');
  });
});

describe('banco de alimentos', () => {
  it('tem pelo menos 150 alimentos válidos e ids únicos', () => {
    expect(FOODS.length).toBeGreaterThanOrEqual(150);
    expect(new Set(FOODS.map((f) => f.id)).size).toBe(FOODS.length);
    for (const f of FOODS) {
      expect(f.protein + f.carbs + f.fat).toBeLessThanOrEqual(100.5);
      expect(f.portions.length).toBeGreaterThan(0);
      // Coerência: kcal próxima de 4P + 4C + 9G (tolerância por fibras/álcool)
      const est = 4 * f.protein + 4 * f.carbs + 9 * f.fat;
      if (f.category !== 'Bebidas') expect(Math.abs(est - f.kcal)).toBeLessThan(Math.max(40, f.kcal * 0.25));
    }
  });
});

describe('validação', () => {
  it('rejeita vazio, negativo e absurdo', () => {
    expect(validateNumber('', 'peso').ok).toBe(false);
    expect(validateNumber('-5', 'peso').ok).toBe(false);
    expect(validateNumber('900', 'peso').ok).toBe(false);
    expect(validateNumber('abc', 'peso').ok).toBe(false);
    expect(validateNumber('72,5', 'peso')).toEqual({ ok: true, value: 72.5 });
  });
  it('macros não passam de 100 g', () => {
    expect(macrosError(50, 40, 20)).not.toBeNull();
    expect(macrosError(20, 50, 10)).toBeNull();
  });
  it('idade mínima', () => {
    expect(birthDateError('2020-01-01')).not.toBeNull();
    expect(birthDateError('1990-05-10')).toBeNull();
  });
});
