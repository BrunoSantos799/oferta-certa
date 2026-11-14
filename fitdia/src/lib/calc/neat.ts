// Gasto com atividades do dia a dia (NEAT) a partir do questionário.
// Em vez de um fator fixo, o dia é dividido em blocos (sono, trabalho, deslocamento,
// tarefas, telas, caminhadas) e cada bloco usa um MET típico e o peso da pessoa.
// Usamos o gasto líquido (MET − 1), pois a taxa basal já cobre o repouso.
import type { Questionnaire, StepsRange, WorkType, HouseworkLevel } from '@/store/types';
import { netMetCalories } from './met';

/** METs de referência para cada bloco do dia (Compendium) */
export const NEAT_MET = {
  sono: 0.95,
  sentado: 1.3, // trabalho sentado, aula, carro/ônibus
  telas: 1.2, // TV, celular, videogame no sofá
  leveLivre: 1.4, // higiene, comer, se arrumar, pequenas tarefas
  caminhada: 3.3, // caminhada em ritmo normal
  bicicleta: 6.0, // pedalar como transporte
  tarefasCasa: 2.8, // limpar, cozinhar, lavar louça
  filhos: 2.5, // cuidar de crianças
  animais: 3.0, // passear com o cachorro
  escadas: 4.0,
} as const;

/** MET da parte do expediente em que a pessoa NÃO está sentada */
export const WORK_MOVING_MET: Record<WorkType, number> = {
  escritorio: 2.0,
  em_pe: 2.3,
  andando: 3.3,
  pesado: 4.5,
  estudante: 2.0,
  nao_trabalha: 1.6,
};

/** Passos médios por faixa (ponto médio). null = não sabe */
export const STEPS_MID: Record<StepsRange, number | null> = {
  nao_sei: null,
  ate3k: 2000,
  '3a6k': 4500,
  '6a9k': 7500,
  '9a12k': 10500,
  mais12k: 13500,
};

const HOUSEWORK_MIN: Record<HouseworkLevel, number> = { nenhuma: 0, leve: 20, moderada: 45, muita: 90 };

/** Aproximadamente 100 passos por minuto de caminhada */
const STEPS_PER_MIN = 100;

/** Horas de sono a partir dos horários de dormir e acordar ("23:00" → "07:00" = 8 h) */
export function sleepHours(bedtime: string, wakeTime: string): number {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m || 0);
  };
  let diff = toMin(wakeTime) - toMin(bedtime);
  if (diff <= 0) diff += 24 * 60;
  return diff / 60;
}

export interface NeatBlock {
  key: string;
  label: string;
  hours: number; // horas médias por dia
  met: number;
  kcal: number; // gasto líquido médio por dia
}

export interface NeatResult {
  total: number;
  blocks: NeatBlock[];
}

/**
 * Calcula o NEAT médio diário (kcal acima da basal) considerando a semana inteira:
 * dias de trabalho × dias/7 + dias de folga × (7 − dias)/7.
 */
export function calculateNeat(q: Questionnaire, weightKg: number): NeatResult {
  const worksOrStudies = q.workType !== 'nao_trabalha';
  const workDays = worksOrStudies ? Math.min(7, Math.max(0, q.workDaysPerWeek)) : 0;
  const workFrac = workDays / 7;
  const workHours = worksOrStudies ? q.workHoursPerDay : 0;

  // Horas médias diárias de cada bloco
  const sleep = sleepHours(q.bedtime, q.wakeTime);
  const sitPct = Math.min(100, Math.max(0, q.sittingPercent)) / 100;
  const workSitting = workHours * sitPct * workFrac;
  const workMoving = workHours * (1 - sitPct) * workFrac;

  const passiveCommute =
    worksOrStudies && (q.commute === 'carro' || q.commute === 'onibus') ? (q.commuteMinutes / 60) * workFrac : 0;

  const activeMinutes = Math.max(0, q.activeTransportMinutes);
  const bikeHours = q.commute === 'bicicleta' ? activeMinutes / 60 : 0;
  const walkTransportHours = q.commute === 'bicicleta' ? 0 : activeMinutes / 60;

  // Caminhada extra estimada pelos passos (descontando o que já foi contado)
  const stepsMid = STEPS_MID[q.steps];
  const workWalkingHours = q.workType === 'andando' ? workMoving : 0;
  let leisureWalkHours: number;
  if (stepsMid === null) {
    leisureWalkHours = 0.25; // 15 min por padrão quando não sabe
  } else {
    const totalWalkHours = stepsMid / STEPS_PER_MIN / 60;
    // ~15% dos passos acontecem dentro de outros blocos (casa, higiene); desconta também
    // a caminhada já contada nos trajetos e no trabalho
    leisureWalkHours = Math.max(0, totalWalkHours * 0.85 - walkTransportHours - workWalkingHours);
  }

  const houseworkHours = HOUSEWORK_MIN[q.housework] / 60;
  const kidsHours = q.extras.includes('filhos') ? 0.75 : 0;
  const petsHours = q.extras.includes('animais') ? 0.33 : 0;
  const stairsHours = q.extras.includes('escadas') ? 0.08 : 0;
  const screens = Math.max(0, q.screenHours);

  const accounted =
    sleep + workSitting + workMoving + passiveCommute + bikeHours + walkTransportHours + leisureWalkHours +
    houseworkHours + kidsHours + petsHours + stairsHours + screens;
  // O resto do dia acordado é considerado atividade leve (higiene, refeições, etc.)
  const leftover = Math.max(0, 24 - accounted);

  const raw: Array<[string, string, number, number]> = [
    ['sono', 'Sono', sleep, NEAT_MET.sono],
    ['trabalho_sentado', 'Trabalho/estudo sentado', workSitting, NEAT_MET.sentado],
    ['trabalho_movimento', 'Trabalho/estudo em movimento', workMoving, WORK_MOVING_MET[q.workType]],
    ['deslocamento', 'Deslocamento (carro/ônibus)', passiveCommute, NEAT_MET.sentado],
    ['transporte_ativo', q.commute === 'bicicleta' ? 'Pedalando' : 'Andando a pé (trajetos)', bikeHours + walkTransportHours, q.commute === 'bicicleta' ? NEAT_MET.bicicleta : NEAT_MET.caminhada],
    ['passos', 'Caminhadas no dia', leisureWalkHours, NEAT_MET.caminhada],
    ['casa', 'Tarefas de casa', houseworkHours, NEAT_MET.tarefasCasa],
    ['filhos', 'Cuidar dos filhos', kidsHours, NEAT_MET.filhos],
    ['animais', 'Passear com animais', petsHours, NEAT_MET.animais],
    ['escadas', 'Subir escadas', stairsHours, NEAT_MET.escadas],
    ['telas', 'Telas no tempo livre', screens, NEAT_MET.telas],
    ['leve', 'Outras atividades leves', leftover, NEAT_MET.leveLivre],
  ];

  const blocks: NeatBlock[] = raw
    .filter(([, , h]) => h > 0)
    .map(([key, label, hours, met]) => ({ key, label, hours, met, kcal: netMetCalories(met, weightKg, hours) }));

  const total = blocks.reduce((s, b) => s + b.kcal, 0);
  return { total: Math.max(0, total), blocks };
}
