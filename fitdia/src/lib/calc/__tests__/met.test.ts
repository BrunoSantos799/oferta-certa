import { describe, it, expect } from 'vitest';
import { metCalories, netMetCalories, metForIntensity } from '../met';

describe('MET', () => {
  it('calorias = MET × peso × horas', () => {
    // corrida 9,8 MET, 70 kg, 30 min → 343 kcal
    expect(metCalories(9.8, 70, 30)).toBeCloseTo(343);
  });
  it('gasto líquido desconta 1 MET de repouso', () => {
    expect(netMetCalories(3.5, 80, 1)).toBeCloseTo(200);
  });
  it('ajusta MET pela intensidade', () => {
    expect(metForIntensity({ leve: 3, moderada: 5, intensa: 6 }, 'intensa')).toBe(6);
    expect(metForIntensity(6, 'leve')).toBeCloseTo(4.5);
    expect(metForIntensity(6, 'intensa')).toBeCloseTo(7.8);
  });
});
