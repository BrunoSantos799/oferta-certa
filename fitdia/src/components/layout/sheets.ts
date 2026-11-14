// Controle global das folhas (sheets) de adicionar registros
import { create } from 'zustand';
import type { MealId } from '@/store/types';

interface SheetState {
  food: { open: boolean; meal: MealId; editId?: string };
  workout: { open: boolean; editId?: string; templateId?: string };
  water: boolean;
  quick: boolean;
  hevy: boolean;
  openFood: (meal?: MealId, editId?: string) => void;
  openWorkout: (opts?: { editId?: string; templateId?: string }) => void;
  setFood: (open: boolean) => void;
  setWorkout: (open: boolean) => void;
  setWater: (open: boolean) => void;
  setQuick: (open: boolean) => void;
  setHevy: (open: boolean) => void;
}

/** Sugere a refeição pelo horário atual */
export function mealByTime(d = new Date()): MealId {
  const h = d.getHours();
  if (h < 10) return 'cafe';
  if (h < 15) return 'almoco';
  if (h < 18) return 'lanche';
  if (h < 22) return 'jantar';
  return 'ceia';
}

export const useSheets = create<SheetState>((set) => ({
  food: { open: false, meal: 'cafe' },
  workout: { open: false },
  water: false,
  quick: false,
  hevy: false,
  openFood: (meal, editId) => set({ food: { open: true, meal: meal ?? mealByTime(), editId }, quick: false }),
  openWorkout: (opts) => set({ workout: { open: true, ...opts }, quick: false }),
  setFood: (open) => set((s) => ({ food: { ...s.food, open, editId: open ? s.food.editId : undefined } })),
  setWorkout: (open) => set((s) => ({ workout: open ? { ...s.workout, open } : { open: false } })),
  setWater: (water) => set({ water, quick: false }),
  setQuick: (quick) => set({ quick }),
  setHevy: (hevy) => set({ hevy, quick: false }),
}));
