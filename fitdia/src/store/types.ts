// Tipos centrais do FitDia

export type Sex = 'masculino' | 'feminino';
export type Goal = 'perder' | 'manter' | 'ganhar' | 'condicionamento';
export type Pace = 'lento' | 'moderado' | 'rapido';
export type Intensity = 'leve' | 'moderada' | 'intensa';
export type MealId = 'cafe' | 'almoco' | 'lanche' | 'jantar' | 'ceia';
export type Theme = 'system' | 'light' | 'dark';
export type TabId = 'hoje' | 'alimentacao' | 'treinos' | 'historico' | 'perfil';

export type WorkType = 'escritorio' | 'em_pe' | 'andando' | 'pesado' | 'estudante' | 'nao_trabalha';
export type CommuteMode = 'carro' | 'onibus' | 'a_pe' | 'bicicleta' | 'home_office';
export type StepsRange = 'nao_sei' | 'ate3k' | '3a6k' | '6a9k' | '9a12k' | 'mais12k';
export type HouseworkLevel = 'nenhuma' | 'leve' | 'moderada' | 'muita';
export type SleepQuality = 'ruim' | 'regular' | 'boa' | 'otima';
export type TrainingLevel = 'nunca' | 'iniciante' | 'intermediario' | 'avancado';

/** Atividade praticada informada no questionário */
export interface PlannedActivity {
  activityId: string;
  timesPerWeek: number;
  minutesPerSession: number;
}

/** Respostas do questionário inicial (alimentam o cálculo personalizado do NEAT) */
export interface Questionnaire {
  workType: WorkType;
  workHoursPerDay: number;
  workDaysPerWeek: number;
  sittingPercent: number; // 0–100 do expediente sentado
  commute: CommuteMode;
  commuteMinutes: number; // minutos de trajeto passivo (carro/ônibus) por dia útil
  activeTransportMinutes: number; // minutos por dia andando a pé ou de bicicleta
  steps: StepsRange;
  housework: HouseworkLevel;
  extras: Array<'filhos' | 'animais' | 'escadas'>;
  screenHours: number; // horas de tela no tempo livre
  bedtime: string; // "23:00"
  wakeTime: string; // "07:00"
  sleepQuality: SleepQuality;
  trainingLevel: TrainingLevel;
  activities: PlannedActivity[];
  usesHevy: 'hevy' | 'outro' | 'nao';
  mealsPerDay: number;
  restrictions: string[];
  waterLitersHabit: number;
}

export interface Profile {
  name: string;
  sex: Sex;
  birthDate: string; // AAAA-MM-DD
  heightCm: number;
  bodyFatPercent?: number | null;
  goal: Goal;
  targetWeightKg?: number | null;
  pace: Pace;
  /** Fator de atividade manual (usado quando energyMode = 'fator') */
  activityFactor: number;
}

export interface WeightEntry {
  date: string;
  kg: number;
}

export interface Portion {
  label: string;
  grams: number;
}

/** Alimento com valores por 100 g */
export interface Food {
  id: string;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  category: string;
  portions: Portion[];
  /** Gramas por ml. Quando existe, a quantidade também pode ser informada em ml */
  density?: number;
  custom?: boolean;
}

export interface FoodEntry {
  id: string;
  date: string;
  meal: MealId;
  foodId: string;
  /** Cópia dos valores no momento do registro, para o histórico não mudar */
  food: Pick<Food, 'name' | 'kcal' | 'protein' | 'carbs' | 'fat'>;
  grams: number;
  /** Unidade escolhida no registro (gramas, ml ou porção) */
  unit?: 'g' | 'ml';
  /** Quantidade em ml quando registrado em ml */
  ml?: number;
  portionLabel?: string;
  portionQty?: number;
}

export interface FavoriteMeal {
  id: string;
  name: string;
  items: Array<Omit<FoodEntry, 'id' | 'date' | 'meal'>>;
}

export interface SetLog {
  reps: number;
  kg: number;
  restSec?: number;
  type?: 'normal' | 'aquecimento' | 'drop' | 'falha';
}

export interface ExerciseLog {
  exerciseId?: string;
  name: string;
  sets: SetLog[];
}

export interface Workout {
  id: string;
  date: string;
  activityId: string;
  name: string;
  durationMin: number;
  intensity: Intensity;
  kcal: number;
  /** Se verdadeiro, o usuário informou as calorias manualmente */
  manualKcal?: boolean;
  exercises?: ExerciseLog[];
  source: 'manual' | 'hevy' | 'ficha';
  notes?: string;
}

export interface CustomActivity {
  id: string;
  name: string;
  met: number;
}

export interface CustomExercise {
  id: string;
  name: string;
  group: MuscleGroup;
}

export type MuscleGroup = 'peito' | 'costas' | 'pernas' | 'ombros' | 'biceps' | 'triceps' | 'abdomen';

export interface WorkoutTemplate {
  id: string;
  name: string;
  exercises: ExerciseLog[];
}

export interface Settings {
  theme: Theme;
  /** Meta de calorias definida manualmente (null = usar a sugerida) */
  goalKcalOverride: number | null;
  /** 'personalizado' usa o questionário; 'fator' usa basal × fator de atividade */
  energyMode: 'personalizado' | 'fator';
  /** Ajuste automático do gasto pela variação real do peso */
  autoAdjust: boolean;
  glassMl: number;
}
