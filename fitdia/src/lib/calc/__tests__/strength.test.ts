import { describe, it, expect } from 'vitest';
import { summarizeExercises, strengthCalories, estimateStrengthIntensity, estimatedOneRepMax, estimateDurationMin } from '../strength';
import type { ExerciseLog } from '@/store/types';

const ex = (sets: number, reps: number, kg: number): ExerciseLog => ({ name: 'X', sets: Array.from({ length: sets }, () => ({ reps, kg })) });

describe('musculação', () => {
  it('resume volume ignorando aquecimento', () => {
    const s = summarizeExercises([{ name: 'Supino', sets: [{ reps: 10, kg: 40, type: 'aquecimento' }, { reps: 8, kg: 60 }, { reps: 8, kg: 60 }] }]);
    expect(s).toEqual({ sets: 2, reps: 16, volumeKg: 960 });
  });

  it('treino denso é mais intenso que treino espaçado', () => {
    const exercises = [ex(4, 10, 50), ex(4, 10, 50), ex(4, 10, 50), ex(4, 10, 50)];
    expect(estimateStrengthIntensity(exercises, 30, 75)).toBe('intensa');
    expect(estimateStrengthIntensity(exercises, 120, 75)).toBe('leve');
  });

  it('calcula calorias com o peso do perfil', () => {
    const r = strengthCalories([ex(4, 10, 40), ex(4, 10, 40), ex(4, 10, 40), ex(4, 10, 40)], 60, 80);
    expect(['leve', 'moderada', 'intensa']).toContain(r.intensity);
    expect(r.kcal).toBeGreaterThan(250);
    expect(r.kcal).toBeLessThan(500);
  });

  it('estima a duração quando não informada', () => {
    expect(estimateDurationMin([ex(10, 10, 40)])).toBe(25);
    expect(strengthCalories([ex(10, 10, 40)], undefined, 80).durationMin).toBe(25);
  });

  it('1RM de Epley', () => {
    expect(estimatedOneRepMax(100, 1)).toBe(100);
    expect(estimatedOneRepMax(100, 10)).toBeCloseTo(133.33, 1);
  });
});
