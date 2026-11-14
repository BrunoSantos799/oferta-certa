import { describe, it, expect } from 'vitest';
import { buildBackup, parseBackup } from '../backup';
import { initialData } from '@/store/useStore';

describe('backup', () => {
  it('exporta e importa sem perder dados', () => {
    const data = { ...initialData, weights: [{ date: '2026-01-02', kg: 80 }, { date: '2026-01-01', kg: 81 }] };
    const back = parseBackup(buildBackup(data));
    expect(back.weights[0].date).toBe('2026-01-01'); // reordena por data
    expect(back.settings.glassMl).toBe(250);
  });
  it('rejeita arquivos inválidos', () => {
    expect(() => parseBackup('{oops')).toThrow('JSON');
    expect(() => parseBackup('{"app":"Outro","data":{}}')).toThrow('FitDia');
    expect(() => parseBackup('{"app":"FitDia","data":{"weights":[{"date":"x","kg":-1}]}}')).toThrow();
  });
});
