// Estado global do app, salvo no navegador (localStorage) via Zustand
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  CustomActivity, CustomExercise, FavoriteMeal, Food, FoodEntry, Profile, Questionnaire,
  Settings, TabId, WeightEntry, Workout, WorkoutTemplate,
} from './types';
import { today } from '@/lib/date';
import { uid } from '@/lib/utils';

export interface AppData {
  profile: Profile | null;
  questionnaire: Questionnaire | null;
  /** Data e peso de quando o questionário foi respondido (para sugerir refazer) */
  questionnaireDate: string | null;
  questionnaireWeight: number | null;
  weights: WeightEntry[];
  customFoods: Food[];
  foodLog: FoodEntry[];
  favorites: FavoriteMeal[];
  workouts: Workout[];
  customActivities: CustomActivity[];
  customExercises: CustomExercise[];
  templates: WorkoutTemplate[];
  water: Record<string, number>; // ml por data
  settings: Settings;
}

interface UiState {
  tab: TabId;
  selectedDate: string;
  redoingQuestionnaire: boolean;
}

interface Actions {
  setTab: (t: TabId) => void;
  setDate: (d: string) => void;
  setRedoing: (v: boolean) => void;
  completeOnboarding: (p: Profile, q: Questionnaire, weightKg: number) => void;
  updateProfile: (p: Partial<Profile>) => void;
  addWeight: (kg: number, date?: string) => void;
  removeWeight: (date: string) => void;
  addFoodEntry: (e: Omit<FoodEntry, 'id'>) => void;
  updateFoodEntry: (id: string, e: Partial<FoodEntry>) => void;
  removeFoodEntry: (id: string) => void;
  addCustomFood: (f: Omit<Food, 'id' | 'custom'>) => Food;
  removeCustomFood: (id: string) => void;
  saveFavorite: (name: string, items: FavoriteMeal['items']) => void;
  removeFavorite: (id: string) => void;
  addWorkout: (w: Omit<Workout, 'id'>) => void;
  addWorkouts: (w: Array<Omit<Workout, 'id'>>) => void;
  updateWorkout: (id: string, w: Partial<Workout>) => void;
  removeWorkout: (id: string) => void;
  addCustomActivity: (a: Omit<CustomActivity, 'id'>) => CustomActivity;
  addCustomExercise: (e: Omit<CustomExercise, 'id'>) => CustomExercise;
  saveTemplate: (t: Omit<WorkoutTemplate, 'id'> & { id?: string }) => void;
  removeTemplate: (id: string) => void;
  addWater: (ml: number, date?: string) => void;
  updateSettings: (s: Partial<Settings>) => void;
  importData: (d: AppData) => void;
  resetAll: () => void;
}

export type Store = AppData & UiState & Actions;

export const initialData: AppData = {
  profile: null,
  questionnaire: null,
  questionnaireDate: null,
  questionnaireWeight: null,
  weights: [],
  customFoods: [],
  foodLog: [],
  favorites: [],
  workouts: [],
  customActivities: [],
  customExercises: [],
  templates: [],
  water: {},
  settings: { theme: 'system', goalKcalOverride: null, energyMode: 'personalizado', autoAdjust: true, glassMl: 250 },
};

/** Insere/substitui a pesagem do dia e mantém a lista ordenada por data */
function upsertWeight(list: WeightEntry[], date: string, kg: number): WeightEntry[] {
  return [...list.filter((w) => w.date !== date), { date, kg }].sort((a, b) => a.date.localeCompare(b.date));
}

export const useStore = create<Store>()(
  persist(
    (set) => ({
      ...initialData,
      tab: 'hoje',
      selectedDate: today(),
      redoingQuestionnaire: false,

      setTab: (tab) => set({ tab }),
      setDate: (selectedDate) => set({ selectedDate }),
      setRedoing: (redoingQuestionnaire) => set({ redoingQuestionnaire }),

      completeOnboarding: (profile, questionnaire, weightKg) =>
        set((s) => ({
          profile,
          questionnaire,
          questionnaireDate: today(),
          questionnaireWeight: weightKg,
          weights: upsertWeight(s.weights, today(), weightKg),
          redoingQuestionnaire: false,
          settings: { ...s.settings, energyMode: 'personalizado', goalKcalOverride: null },
          tab: 'hoje',
        })),

      updateProfile: (p) => set((s) => (s.profile ? { profile: { ...s.profile, ...p } } : {})),
      addWeight: (kg, date = today()) => set((s) => ({ weights: upsertWeight(s.weights, date, kg) })),
      removeWeight: (date) => set((s) => ({ weights: s.weights.length > 1 ? s.weights.filter((w) => w.date !== date) : s.weights })),

      addFoodEntry: (e) => set((s) => ({ foodLog: [...s.foodLog, { ...e, id: uid() }] })),
      updateFoodEntry: (id, e) => set((s) => ({ foodLog: s.foodLog.map((f) => (f.id === id ? { ...f, ...e } : f)) })),
      removeFoodEntry: (id) => set((s) => ({ foodLog: s.foodLog.filter((f) => f.id !== id) })),
      addCustomFood: (f) => {
        const food: Food = { ...f, id: 'custom_' + uid(), custom: true };
        set((s) => ({ customFoods: [...s.customFoods, food] }));
        return food;
      },
      removeCustomFood: (id) => set((s) => ({ customFoods: s.customFoods.filter((f) => f.id !== id) })),
      saveFavorite: (name, items) => set((s) => ({ favorites: [...s.favorites, { id: uid(), name, items }] })),
      removeFavorite: (id) => set((s) => ({ favorites: s.favorites.filter((f) => f.id !== id) })),

      addWorkout: (w) => set((s) => ({ workouts: [...s.workouts, { ...w, id: uid() }] })),
      addWorkouts: (ws) => set((s) => ({ workouts: [...s.workouts, ...ws.map((w) => ({ ...w, id: uid() }))] })),
      updateWorkout: (id, w) => set((s) => ({ workouts: s.workouts.map((x) => (x.id === id ? { ...x, ...w } : x)) })),
      removeWorkout: (id) => set((s) => ({ workouts: s.workouts.filter((x) => x.id !== id) })),
      addCustomActivity: (a) => {
        const act = { ...a, id: 'custom_' + uid() };
        set((s) => ({ customActivities: [...s.customActivities, act] }));
        return act;
      },
      addCustomExercise: (e) => {
        const ex = { ...e, id: 'custom_' + uid() };
        set((s) => ({ customExercises: [...s.customExercises, ex] }));
        return ex;
      },
      saveTemplate: (t) =>
        set((s) => {
          if (t.id && s.templates.some((x) => x.id === t.id)) {
            return { templates: s.templates.map((x) => (x.id === t.id ? { ...x, ...t, id: x.id } : x)) };
          }
          return { templates: [...s.templates, { ...t, id: uid() }] };
        }),
      removeTemplate: (id) => set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),

      addWater: (ml, date = today()) =>
        set((s) => ({ water: { ...s.water, [date]: Math.max(0, Math.min(10000, (s.water[date] ?? 0) + ml)) } })),

      updateSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
      importData: (d) => set({ ...initialData, ...d, settings: { ...initialData.settings, ...d.settings } }),
      resetAll: () => set({ ...initialData, tab: 'hoje', selectedDate: today(), redoingQuestionnaire: false }),
    }),
    {
      name: 'fitdia-v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Só os dados são salvos; a aba aberta e a data voltam ao padrão
      partialize: (s) => {
        const { tab: _t, selectedDate: _d, redoingQuestionnaire: _r, ...rest } = s;
        const data: Partial<Store> = {};
        for (const k of Object.keys(initialData) as Array<keyof AppData>) (data as Record<string, unknown>)[k] = rest[k];
        return data as AppData;
      },
    },
  ),
);

/** Extrai só os dados (para backup) */
export function pickData(s: Store): AppData {
  const out = {} as Record<string, unknown>;
  for (const k of Object.keys(initialData) as Array<keyof AppData>) out[k] = s[k];
  return out as unknown as AppData;
}
