import { describe, it, expect } from 'vitest';
import { mifflinStJeor, katchMcArdle, bmi, bmiRange, ageFromBirthDate } from '../bmr';

describe('Mifflin-St Jeor', () => {
  it('calcula a basal de um homem', () => {
    // 10×80 + 6,25×180 − 5×30 + 5 = 1780
    expect(mifflinStJeor('masculino', 80, 180, 30)).toBe(1780);
  });
  it('calcula a basal de uma mulher (−161)', () => {
    // 10×60 + 6,25×165 − 5×25 − 161 = 1345,25
    expect(mifflinStJeor('feminino', 60, 165, 25)).toBeCloseTo(1345.25);
  });
});

describe('Katch-McArdle', () => {
  it('usa a massa magra', () => {
    // 80 kg com 20% de gordura → 64 kg magros → 370 + 21,6×64 = 1752,4
    expect(katchMcArdle(80, 20)).toBeCloseTo(1752.4);
  });
});

describe('IMC', () => {
  it('calcula o IMC e a faixa', () => {
    const v = bmi(70, 175);
    expect(v).toBeCloseTo(22.86, 2);
    expect(bmiRange(v).label).toBe('Peso normal');
    expect(bmiRange(17).label).toBe('Abaixo do peso');
    expect(bmiRange(27).label).toBe('Sobrepeso');
    expect(bmiRange(32).label).toBe('Obesidade grau I');
    expect(bmiRange(41).label).toBe('Obesidade grau III');
  });
});

describe('idade', () => {
  it('considera se o aniversário já passou', () => {
    const ref = new Date(2026, 10, 14); // 14/11/2026
    expect(ageFromBirthDate('1996-11-14', ref)).toBe(30);
    expect(ageFromBirthDate('1996-11-15', ref)).toBe(29);
  });
});
