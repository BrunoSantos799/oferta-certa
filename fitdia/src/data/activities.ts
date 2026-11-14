// Atividades físicas com valores MET por intensidade
// Referência: Compendium of Physical Activities (Ainsworth et al., 2011/2024)
import type { MetByIntensity } from '@/lib/calc/met';

export interface Activity {
  id: string;
  name: string;
  met: MetByIntensity;
  icon: string; // nome do ícone Lucide
  /** Musculação permite registrar exercícios, séries e cargas */
  strength?: boolean;
}

export const ACTIVITIES: Activity[] = [
  { id: 'musculacao', name: 'Musculação', met: { leve: 3.5, moderada: 5.0, intensa: 6.0 }, icon: 'Dumbbell', strength: true },
  { id: 'caminhada', name: 'Caminhada', met: { leve: 2.8, moderada: 3.5, intensa: 4.3 }, icon: 'Footprints' },
  { id: 'esteira', name: 'Esteira caminhando', met: { leve: 3.0, moderada: 4.3, intensa: 5.3 }, icon: 'Footprints' },
  { id: 'corrida', name: 'Corrida', met: { leve: 7.0, moderada: 9.8, intensa: 11.5 }, icon: 'Zap' },
  { id: 'bicicleta', name: 'Bicicleta', met: { leve: 4.0, moderada: 6.8, intensa: 10.0 }, icon: 'Bike' },
  { id: 'bike_ergometrica', name: 'Bicicleta ergométrica', met: { leve: 3.5, moderada: 6.8, intensa: 8.8 }, icon: 'Bike' },
  { id: 'eliptico', name: 'Elíptico', met: { leve: 4.0, moderada: 5.0, intensa: 6.5 }, icon: 'Activity' },
  { id: 'natacao', name: 'Natação', met: { leve: 5.8, moderada: 7.0, intensa: 9.8 }, icon: 'Waves' },
  { id: 'hidroginastica', name: 'Hidroginástica', met: { leve: 3.0, moderada: 4.0, intensa: 5.3 }, icon: 'Waves' },
  { id: 'futebol', name: 'Futebol', met: { leve: 5.0, moderada: 7.0, intensa: 10.0 }, icon: 'Trophy' },
  { id: 'futsal', name: 'Futsal', met: { leve: 6.0, moderada: 8.0, intensa: 10.0 }, icon: 'Trophy' },
  { id: 'volei', name: 'Vôlei', met: { leve: 3.0, moderada: 4.0, intensa: 6.0 }, icon: 'Trophy' },
  { id: 'basquete', name: 'Basquete', met: { leve: 4.5, moderada: 6.5, intensa: 8.0 }, icon: 'Trophy' },
  { id: 'tenis', name: 'Tênis', met: { leve: 5.0, moderada: 7.3, intensa: 8.0 }, icon: 'Trophy' },
  { id: 'beach_tennis', name: 'Beach tennis', met: { leve: 5.0, moderada: 6.5, intensa: 8.0 }, icon: 'Trophy' },
  { id: 'funcional', name: 'Treino funcional', met: { leve: 3.8, moderada: 5.5, intensa: 8.0 }, icon: 'Flame' },
  { id: 'hiit', name: 'HIIT', met: { leve: 6.0, moderada: 8.0, intensa: 10.0 }, icon: 'Flame' },
  { id: 'crossfit', name: 'CrossFit', met: { leve: 5.5, moderada: 7.5, intensa: 9.5 }, icon: 'Flame' },
  { id: 'danca', name: 'Dança', met: { leve: 3.5, moderada: 5.0, intensa: 7.3 }, icon: 'Music' },
  { id: 'zumba', name: 'Zumba', met: { leve: 4.5, moderada: 5.5, intensa: 7.0 }, icon: 'Music' },
  { id: 'yoga', name: 'Yoga', met: { leve: 2.3, moderada: 2.8, intensa: 4.0 }, icon: 'Flower2' },
  { id: 'pilates', name: 'Pilates', met: { leve: 2.8, moderada: 3.0, intensa: 4.0 }, icon: 'Flower2' },
  { id: 'alongamento', name: 'Alongamento', met: { leve: 2.0, moderada: 2.3, intensa: 2.8 }, icon: 'Flower2' },
  { id: 'lutas', name: 'Lutas (jiu-jitsu, muay thai, boxe)', met: { leve: 5.5, moderada: 7.8, intensa: 10.3 }, icon: 'Swords' },
  { id: 'spinning', name: 'Spinning', met: { leve: 6.0, moderada: 8.5, intensa: 11.0 }, icon: 'Bike' },
  { id: 'remo', name: 'Remo ergômetro', met: { leve: 4.8, moderada: 7.0, intensa: 8.5 }, icon: 'Waves' },
  { id: 'escada', name: 'Escada / step', met: { leve: 4.0, moderada: 6.0, intensa: 8.8 }, icon: 'TrendingUp' },
  { id: 'trilha', name: 'Trilha / caminhada em subida', met: { leve: 5.3, moderada: 6.0, intensa: 7.8 }, icon: 'Mountain' },
  { id: 'patins', name: 'Patins / skate', met: { leve: 5.0, moderada: 7.0, intensa: 9.8 }, icon: 'Zap' },
];

export function findActivity(id: string): Activity | undefined {
  return ACTIVITIES.find((a) => a.id === id);
}
