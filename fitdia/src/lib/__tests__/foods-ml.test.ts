import { describe, it, expect } from 'vitest';
import { FOODS, findFood, nutrientsFor } from '@/data/foods';
import { gramsFromMl } from '@/data/foodHelpers';
import { entryAmountLabel } from '@/store/selectors';
import { searchByName } from '@/lib/text';

describe('banco ampliado', () => {
  it('toda bebida aceita ml (tem densidade plausível)', () => {
    const drinks = FOODS.filter((f) => f.category === 'Bebidas');
    expect(drinks.length).toBeGreaterThan(50);
    for (const d of drinks) {
      expect(d.density).toBeGreaterThan(0.8);
      expect(d.density).toBeLessThan(1.5);
    }
  });
  it('acha itens comuns e regionais sem acento', () => {
    expect(searchByName(FOODS, 'cupuacu')[0].id).toBe('cupuacu');
    expect(searchByName(FOODS, 'pequi').some((f) => f.id === 'pequi')).toBe(true);
    expect(searchByName(FOODS, 'tacaca')[0].id).toBe('tacaca');
    expect(searchByName(FOODS, 'x-bacon')[0].id).toBe('x_bacon');
  });
});

describe('conversão ml ↔ g', () => {
  it('usa a densidade do alimento', () => {
    const leite = findFood('leite_integral')!;
    const g = gramsFromMl(200, leite.density!);
    expect(g).toBeCloseTo(206);
    // 200 ml de leite integral ≈ 126 kcal
    expect(nutrientsFor(leite, g).kcal).toBeCloseTo(125.7, 0);
    const azeite = findFood('azeite')!;
    expect(nutrientsFor(azeite, gramsFromMl(15, azeite.density!)).kcal).toBeCloseTo(122, 0);
  });
});

describe('texto da quantidade', () => {
  it('mostra porção, ml ou gramas', () => {
    expect(entryAmountLabel({ grams: 300, portionLabel: 'copo (200 ml)', portionQty: 1.5 })).toBe('1,5 × copo (200 ml) (300 g)');
    expect(entryAmountLabel({ grams: 309, unit: 'ml', ml: 300 })).toBe('300 ml');
    expect(entryAmountLabel({ grams: 150.5, unit: 'g' })).toBe('150,5 g');
  });
});
