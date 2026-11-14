// Questionário inicial: uma pergunta por tela, com barra de progresso e botão de voltar
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, Laptop, PersonStanding, Footprints, HardHat, GraduationCap, Coffee, Car, Bus, Bike, Home,
  Baby, PawPrint, TrendingUp, Moon, Dumbbell, Flame, Scale, HeartPulse, Sprout, Turtle, Rabbit, Gauge,
  Sparkles, Check, X, Smartphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { OptionCard, Progress, Stepper } from '@/components/ui/misc';
import { useStore } from '@/store/useStore';
import type { Goal, Pace, Profile, Questionnaire, Sex, StepsRange, WorkType, CommuteMode, HouseworkLevel, SleepQuality, TrainingLevel, PlannedActivity } from '@/store/types';
import { birthDateError, nameError, numberError } from '@/lib/validation';
import { parseNum, cn } from '@/lib/utils';
import { ACTIVITIES } from '@/data/activities';
import { Summary } from './Summary';
import { useSheets } from '@/components/layout/sheets';

/** Rascunho das respostas (campos de texto ficam como string até validar) */
export interface Draft {
  name: string;
  sex: Sex | null;
  birthDate: string;
  weight: string;
  height: string;
  bodyFat: string;
  workType: WorkType | null;
  workHoursPerDay: number;
  workDaysPerWeek: number;
  sittingPercent: number;
  commute: CommuteMode | null;
  commuteMinutes: number;
  activeTransportMinutes: number;
  steps: StepsRange | null;
  housework: HouseworkLevel | null;
  extras: Questionnaire['extras'];
  screenHours: number;
  bedtime: string;
  wakeTime: string;
  sleepQuality: SleepQuality | null;
  trainingLevel: TrainingLevel | null;
  activities: PlannedActivity[];
  usesHevy: Questionnaire['usesHevy'] | null;
  goal: Goal | null;
  targetWeight: string;
  pace: Pace;
  mealsPerDay: number;
  restrictions: string[];
  waterLitersHabit: number;
}

const emptyDraft: Draft = {
  name: '', sex: null, birthDate: '', weight: '', height: '', bodyFat: '',
  workType: null, workHoursPerDay: 8, workDaysPerWeek: 5, sittingPercent: 80,
  commute: null, commuteMinutes: 40, activeTransportMinutes: 10, steps: null,
  housework: null, extras: [], screenHours: 3, bedtime: '23:00', wakeTime: '07:00', sleepQuality: null,
  trainingLevel: null, activities: [], usesHevy: null, goal: null, targetWeight: '', pace: 'moderado',
  mealsPerDay: 4, restrictions: [], waterLitersHabit: 1.5,
};

/** Converte o rascunho em perfil + questionário definitivos */
export function draftToData(d: Draft): { profile: Profile; questionnaire: Questionnaire; weight: number } {
  const profile: Profile = {
    name: d.name.trim(),
    sex: d.sex!,
    birthDate: d.birthDate,
    heightCm: parseNum(d.height),
    bodyFatPercent: d.bodyFat ? parseNum(d.bodyFat) : null,
    goal: d.goal!,
    targetWeightKg: d.targetWeight ? parseNum(d.targetWeight) : null,
    pace: d.pace,
    activityFactor: 1.375,
  };
  const questionnaire: Questionnaire = {
    workType: d.workType!, workHoursPerDay: d.workHoursPerDay, workDaysPerWeek: d.workDaysPerWeek,
    sittingPercent: d.sittingPercent, commute: d.commute ?? 'home_office', commuteMinutes: d.commuteMinutes,
    activeTransportMinutes: d.activeTransportMinutes, steps: d.steps!, housework: d.housework!, extras: d.extras,
    screenHours: d.screenHours, bedtime: d.bedtime, wakeTime: d.wakeTime, sleepQuality: d.sleepQuality!,
    trainingLevel: d.trainingLevel!, activities: d.activities, usesHevy: d.usesHevy ?? 'nao',
    mealsPerDay: d.mealsPerDay, restrictions: d.restrictions, waterLitersHabit: d.waterLitersHabit,
  };
  return { profile, questionnaire, weight: parseNum(d.weight) };
}

interface Step {
  id: string;
  title: string;
  subtitle?: string;
  skip?: (d: Draft) => boolean;
  /** Retorna mensagem de erro ou null quando a resposta é válida */
  validate?: (d: Draft) => string | null;
  /** Avança sozinho ao escolher uma opção */
  autoNext?: boolean;
  optional?: boolean;
  render: (d: Draft, set: (p: Partial<Draft>) => void, err: string | null) => ReactNode;
}

const RESTRICTIONS = ['Vegetariano', 'Vegano', 'Sem lactose', 'Sem glúten', 'Low carb', 'Diabetes', 'Hipertensão'];

const choose = <T,>(v: T | null, msg = 'Escolha uma opção'): string | null => (v === null ? msg : null);

// ---------- Definição das perguntas ----------
const STEPS: Step[] = [
  {
    id: 'nome', title: 'Como podemos te chamar?', subtitle: 'Seu nome aparece só aqui no seu celular.',
    validate: (d) => nameError(d.name),
    render: (d, set, err) => <Field label="Nome" value={d.name} onChange={(e) => set({ name: e.target.value })} error={err} autoFocus autoComplete="given-name" maxLength={60} placeholder="Seu nome" />,
  },
  {
    id: 'sexo', title: 'Qual seu sexo biológico?', subtitle: 'Usamos para calcular sua taxa metabólica basal.', autoNext: true,
    validate: (d) => choose(d.sex),
    render: (d, set) => (
      <div className="space-y-3">
        <OptionCard selected={d.sex === 'feminino'} onClick={() => set({ sex: 'feminino' })} icon={<span className="text-xl font-bold" aria-hidden>♀</span>} title="Feminino" />
        <OptionCard selected={d.sex === 'masculino'} onClick={() => set({ sex: 'masculino' })} icon={<span className="text-xl font-bold" aria-hidden>♂</span>} title="Masculino" />
      </div>
    ),
  },
  {
    id: 'nascimento', title: 'Quando você nasceu?', subtitle: 'A idade influencia o seu gasto em repouso.',
    validate: (d) => birthDateError(d.birthDate),
    render: (d, set, err) => <Field label="Data de nascimento" type="date" value={d.birthDate} onChange={(e) => set({ birthDate: e.target.value })} error={err} max={new Date().toISOString().slice(0, 10)} />,
  },
  {
    id: 'peso', title: 'Quanto você pesa hoje?', subtitle: 'Pode ser aproximado. Você atualiza depois.',
    validate: (d) => numberError(d.weight, 'peso'),
    render: (d, set, err) => <Field label="Peso atual" inputMode="decimal" value={d.weight} onChange={(e) => set({ weight: e.target.value })} error={err} suffix="kg" placeholder="Ex.: 72,5" autoFocus />,
  },
  {
    id: 'altura', title: 'E a sua altura?',
    validate: (d) => numberError(d.height, 'altura'),
    render: (d, set, err) => <Field label="Altura" inputMode="numeric" value={d.height} onChange={(e) => set({ height: e.target.value })} error={err} suffix="cm" placeholder="Ex.: 170" autoFocus />,
  },
  {
    id: 'gordura', title: 'Sabe seu percentual de gordura?', subtitle: 'Opcional. Se souber (bioimpedância, dobras), calculamos também pela fórmula de Katch-McArdle.', optional: true,
    validate: (d) => (d.bodyFat ? numberError(d.bodyFat, 'gordura') : null),
    render: (d, set, err) => <Field label="Percentual de gordura (opcional)" inputMode="decimal" value={d.bodyFat} onChange={(e) => set({ bodyFat: e.target.value })} error={err} suffix="%" placeholder="Deixe em branco se não souber" />,
  },
  {
    id: 'trabalho', title: 'Como é seu trabalho ou estudo?', autoNext: true,
    validate: (d) => choose(d.workType),
    render: (d, set) => {
      const opts: Array<[WorkType, string, string, ReactNode, number]> = [
        ['escritorio', 'Sentado no escritório', 'Computador, reuniões, atendimento', <Laptop key="a" />, 85],
        ['em_pe', 'Em pé com pouco movimento', 'Balcão, caixa, laboratório, salão', <PersonStanding key="b" />, 25],
        ['andando', 'Andando bastante', 'Vendas externas, garçom, enfermagem', <Footprints key="c" />, 20],
        ['pesado', 'Trabalho físico pesado', 'Obra, carga, agricultura', <HardHat key="d" />, 10],
        ['estudante', 'Estudante', 'Aulas e estudo na maior parte do tempo', <GraduationCap key="e" />, 80],
        ['nao_trabalha', 'Não trabalho no momento', 'Aposentado(a), em casa ou procurando', <Coffee key="f" />, 0],
      ];
      return (
        <div className="space-y-2.5">
          {opts.map(([v, t, desc, icon, sit]) => (
            <OptionCard key={v} selected={d.workType === v} onClick={() => set({ workType: v, sittingPercent: sit })} icon={icon} title={t} description={desc} />
          ))}
        </div>
      );
    },
  },
  {
    id: 'horas', title: 'Quanto tempo de trabalho ou estudo?', skip: (d) => d.workType === 'nao_trabalha',
    render: (d, set) => (
      <div className="space-y-4">
        <p className="text-sm font-medium">Horas por dia</p>
        <Stepper label="horas por dia" value={d.workHoursPerDay} onChange={(v) => set({ workHoursPerDay: v })} min={1} max={16} suffix="h" />
        <p className="text-sm font-medium">Dias por semana</p>
        <Stepper label="dias por semana" value={d.workDaysPerWeek} onChange={(v) => set({ workDaysPerWeek: v })} min={1} max={7} suffix="dias" />
      </div>
    ),
  },
  {
    id: 'sentado', title: 'Quanto do expediente você passa sentado?', skip: (d) => d.workType === 'nao_trabalha',
    render: (d, set) => (
      <div className="space-y-4">
        <div className="text-center text-5xl font-extrabold text-primary">{d.sittingPercent}%</div>
        <input type="range" min={0} max={100} step={5} value={d.sittingPercent} onChange={(e) => set({ sittingPercent: +e.target.value })} className="h-11 w-full accent-[hsl(var(--primary))]" aria-label="Porcentagem do tempo sentado" />
        <div className="flex justify-between text-xs text-muted-foreground"><span>Quase nada</span><span>Metade</span><span>Quase tudo</span></div>
        <p className="text-center text-sm text-muted-foreground">≈ {Math.round((d.workHoursPerDay * d.sittingPercent) / 10) / 10} h sentado por dia de trabalho</p>
      </div>
    ),
  },
  {
    id: 'deslocamento', title: 'Como você vai ao trabalho ou à aula?', autoNext: true, skip: (d) => d.workType === 'nao_trabalha',
    validate: (d) => choose(d.commute),
    render: (d, set) => {
      const opts: Array<[CommuteMode, string, ReactNode]> = [
        ['carro', 'Carro ou moto', <Car key="1" />], ['onibus', 'Ônibus, metrô ou trem', <Bus key="2" />],
        ['a_pe', 'A pé', <Footprints key="3" />], ['bicicleta', 'Bicicleta', <Bike key="4" />], ['home_office', 'Home office', <Home key="5" />],
      ];
      return <div className="space-y-2.5">{opts.map(([v, t, i]) => <OptionCard key={v} selected={d.commute === v} onClick={() => set({ commute: v })} icon={i} title={t} />)}</div>;
    },
  },
  {
    id: 'tempo_deslocamento', title: 'Quanto tempo no trânsito por dia?', subtitle: 'Somando ida e volta, sentado no carro ou no transporte.',
    skip: (d) => d.workType === 'nao_trabalha' || !(d.commute === 'carro' || d.commute === 'onibus'),
    render: (d, set) => <Stepper label="minutos de trajeto" value={d.commuteMinutes} onChange={(v) => set({ commuteMinutes: v })} min={0} max={300} step={5} suffix="min" />,
  },
  {
    id: 'ativo', title: 'Quantos minutos por dia você anda a pé ou de bicicleta?', subtitle: 'Trajetos do dia a dia: ir ao ponto, ao mercado, à padaria. Não conte o treino.',
    render: (d, set) => <Stepper label="minutos ativos" value={d.activeTransportMinutes} onChange={(v) => set({ activeTransportMinutes: v })} min={0} max={240} step={5} suffix="min" />,
  },
  {
    id: 'passos', title: 'Quantos passos você dá por dia, em média?', subtitle: 'Veja no app de saúde do celular ou no relógio. Se não souber, tudo bem.', autoNext: true,
    validate: (d) => choose(d.steps),
    render: (d, set) => {
      const opts: Array<[StepsRange, string, string]> = [
        ['nao_sei', 'Não sei', 'Vamos estimar pelas outras respostas'], ['ate3k', 'Menos de 3.000', 'Bem pouco movimento'],
        ['3a6k', '3.000 a 6.000', 'Pouco movimento'], ['6a9k', '6.000 a 9.000', 'Moderado'],
        ['9a12k', '9.000 a 12.000', 'Ativo'], ['mais12k', 'Mais de 12.000', 'Muito ativo'],
      ];
      return <div className="space-y-2.5">{opts.map(([v, t, s]) => <OptionCard key={v} selected={d.steps === v} onClick={() => set({ steps: v })} icon={<Footprints />} title={t} description={s} />)}</div>;
    },
  },
  {
    id: 'casa', title: 'E as tarefas de casa?', subtitle: 'Limpar, cozinhar, lavar roupa, arrumar.', autoNext: true,
    validate: (d) => choose(d.housework),
    render: (d, set) => {
      const opts: Array<[HouseworkLevel, string, string]> = [
        ['nenhuma', 'Quase nenhuma', 'Outra pessoa faz'], ['leve', 'Um pouco', 'Cerca de 20 minutos por dia'],
        ['moderada', 'Bastante', 'Cerca de 45 minutos por dia'], ['muita', 'Muita', '1 hora e meia ou mais por dia'],
      ];
      return <div className="space-y-2.5">{opts.map(([v, t, s]) => <OptionCard key={v} selected={d.housework === v} onClick={() => set({ housework: v })} icon={<Home />} title={t} description={s} />)}</div>;
    },
  },
  {
    id: 'extras', title: 'Alguma dessas faz parte do seu dia?', subtitle: 'Marque quantas quiser.', optional: true,
    render: (d, set) => {
      const opts: Array<[Questionnaire['extras'][number], string, string, ReactNode]> = [
        ['filhos', 'Cuidar de filhos pequenos', 'Brincar, carregar, dar banho', <Baby key="1" />],
        ['animais', 'Passear com animais', 'Levar o cachorro para passear', <PawPrint key="2" />],
        ['escadas', 'Subir escadas', 'Vários lances por dia', <TrendingUp key="3" />],
      ];
      const toggle = (v: Questionnaire['extras'][number]) => set({ extras: d.extras.includes(v) ? d.extras.filter((x) => x !== v) : [...d.extras, v] });
      return <div className="space-y-2.5">{opts.map(([v, t, s, i]) => <OptionCard key={v} selected={d.extras.includes(v)} onClick={() => toggle(v)} icon={i} title={t} description={s} />)}</div>;
    },
  },
  {
    id: 'telas', title: 'Quantas horas de tela no tempo livre?', subtitle: 'TV, celular, videogame — fora do trabalho ou estudo.',
    render: (d, set) => <Stepper label="horas de tela" value={d.screenHours} onChange={(v) => set({ screenHours: v })} min={0} max={12} step={0.5} suffix="h/dia" />,
  },
  {
    id: 'sono', title: 'Que horas você costuma dormir e acordar?',
    render: (d, set) => (
      <div className="grid grid-cols-2 gap-3">
        <Field label="Dorme às" type="time" value={d.bedtime} onChange={(e) => set({ bedtime: e.target.value || '23:00' })} />
        <Field label="Acorda às" type="time" value={d.wakeTime} onChange={(e) => set({ wakeTime: e.target.value || '07:00' })} />
      </div>
    ),
  },
  {
    id: 'qualidade_sono', title: 'Como é a qualidade do seu sono?', autoNext: true,
    validate: (d) => choose(d.sleepQuality),
    render: (d, set) => {
      const opts: Array<[SleepQuality, string, string]> = [
        ['ruim', 'Ruim', 'Acordo cansado(a) quase sempre'], ['regular', 'Regular', 'Às vezes durmo mal'],
        ['boa', 'Boa', 'Geralmente acordo bem'], ['otima', 'Ótima', 'Durmo bem e acordo disposto(a)'],
      ];
      return <div className="space-y-2.5">{opts.map(([v, t, s]) => <OptionCard key={v} selected={d.sleepQuality === v} onClick={() => set({ sleepQuality: v })} icon={<Moon />} title={t} description={s} />)}</div>;
    },
  },
  {
    id: 'nivel', title: 'Há quanto tempo você treina?', autoNext: true,
    validate: (d) => choose(d.trainingLevel),
    render: (d, set) => {
      const opts: Array<[TrainingLevel, string, string]> = [
        ['nunca', 'Não treino', 'Ainda não pratico exercícios'], ['iniciante', 'Iniciante', 'Menos de 6 meses'],
        ['intermediario', 'Intermediário', 'De 6 meses a 2 anos'], ['avancado', 'Avançado', 'Mais de 2 anos'],
      ];
      return <div className="space-y-2.5">{opts.map(([v, t, s]) => <OptionCard key={v} selected={d.trainingLevel === v} onClick={() => set({ trainingLevel: v, activities: v === 'nunca' ? [] : d.activities })} icon={<Dumbbell />} title={t} description={s} />)}</div>;
    },
  },
  {
    id: 'atividades', title: 'Quais atividades você pratica?', subtitle: 'Toque para adicionar e ajuste a frequência e a duração.',
    skip: (d) => d.trainingLevel === 'nunca',
    validate: (d) => (d.activities.length === 0 ? 'Adicione pelo menos uma atividade (ou volte e marque "Não treino")' : null),
    render: (d, set, err) => <ActivitiesPicker draft={d} set={set} error={err} />,
  },
  {
    id: 'hevy', title: 'Você usa algum app para registrar treinos?', autoNext: true,
    skip: (d) => d.trainingLevel === 'nunca',
    validate: (d) => choose(d.usesHevy),
    render: (d, set) => (
      <div className="space-y-2.5">
        <OptionCard selected={d.usesHevy === 'hevy'} onClick={() => set({ usesHevy: 'hevy' })} icon={<Smartphone />} title="Uso o Hevy" description="Dá para importar seus treinos logo no início" />
        <OptionCard selected={d.usesHevy === 'outro'} onClick={() => set({ usesHevy: 'outro' })} icon={<Smartphone />} title="Uso outro app" description="Você poderá registrar aqui manualmente" />
        <OptionCard selected={d.usesHevy === 'nao'} onClick={() => set({ usesHevy: 'nao' })} icon={<X />} title="Não uso" />
      </div>
    ),
  },
  {
    id: 'objetivo', title: 'Qual é o seu objetivo?', autoNext: true,
    validate: (d) => choose(d.goal),
    render: (d, set) => (
      <div className="space-y-2.5">
        <OptionCard selected={d.goal === 'perder'} onClick={() => set({ goal: 'perder' })} icon={<Flame />} title="Perder gordura" description="Comer um pouco menos do que gasta" />
        <OptionCard selected={d.goal === 'manter'} onClick={() => set({ goal: 'manter' })} icon={<Scale />} title="Manter o peso" description="Equilíbrio entre o que come e gasta" />
        <OptionCard selected={d.goal === 'ganhar'} onClick={() => set({ goal: 'ganhar' })} icon={<Dumbbell />} title="Ganhar massa" description="Pequeno superávit com treino de força" />
        <OptionCard selected={d.goal === 'condicionamento'} onClick={() => set({ goal: 'condicionamento' })} icon={<HeartPulse />} title="Melhorar o condicionamento" description="Foco em desempenho e saúde" />
      </div>
    ),
  },
  {
    id: 'peso_desejado', title: 'Qual peso você quer alcançar?', optional: true,
    skip: (d) => d.goal !== 'perder' && d.goal !== 'ganhar',
    validate: (d) => {
      if (!d.targetWeight) return null;
      const e = numberError(d.targetWeight, 'peso');
      if (e) return e;
      const t = parseNum(d.targetWeight);
      const w = parseNum(d.weight);
      if (d.goal === 'perder' && t >= w) return 'Para perder peso, a meta precisa ser menor que o peso atual';
      if (d.goal === 'ganhar' && t <= w) return 'Para ganhar massa, a meta precisa ser maior que o peso atual';
      const h = parseNum(d.height) / 100;
      if (t / (h * h) < 18.5) return 'Esse peso fica abaixo da faixa saudável para sua altura';
      return null;
    },
    render: (d, set, err) => <Field label="Peso desejado (opcional)" inputMode="decimal" value={d.targetWeight} onChange={(e) => set({ targetWeight: e.target.value })} error={err} suffix="kg" hint={`Hoje: ${d.weight} kg`} />,
  },
  {
    id: 'ritmo', title: 'Em que ritmo?', subtitle: 'Ritmos mais lentos são mais fáceis de manter. Aplicamos limites de segurança.',
    skip: (d) => d.goal !== 'perder' && d.goal !== 'ganhar',
    autoNext: true,
    render: (d, set) => {
      const lose = d.goal === 'perder';
      const opts: Array<[Pace, string, string, ReactNode]> = [
        ['lento', 'Lento', lose ? '≈ 0,25 kg por semana (−250 kcal/dia)' : '≈ 0,15 kg por semana (+150 kcal/dia)', <Turtle key="1" />],
        ['moderado', 'Moderado (recomendado)', lose ? '≈ 0,5 kg por semana (−500 kcal/dia)' : '≈ 0,25 kg por semana (+300 kcal/dia)', <Gauge key="2" />],
        ['rapido', 'Rápido', lose ? '≈ 0,75 kg por semana (−750 kcal/dia)' : '≈ 0,4 kg por semana (+450 kcal/dia)', <Rabbit key="3" />],
      ];
      return <div className="space-y-2.5">{opts.map(([v, t, s, i]) => <OptionCard key={v} selected={d.pace === v} onClick={() => set({ pace: v })} icon={i} title={t} description={s} />)}</div>;
    },
  },
  {
    id: 'refeicoes', title: 'Quantas refeições você faz por dia?',
    render: (d, set) => <Stepper label="refeições por dia" value={d.mealsPerDay} onChange={(v) => set({ mealsPerDay: v })} min={1} max={8} suffix="refeições" />,
  },
  {
    id: 'restricoes', title: 'Alguma restrição ou preferência?', subtitle: 'Opcional. Marque quantas quiser.', optional: true,
    render: (d, set) => (
      <div className="flex flex-wrap gap-2">
        {RESTRICTIONS.map((r) => {
          const on = d.restrictions.includes(r);
          return (
            <button key={r} type="button" aria-pressed={on} onClick={() => set({ restrictions: on ? d.restrictions.filter((x) => x !== r) : [...d.restrictions, r] })}
              className={cn('flex min-h-[44px] items-center gap-1.5 rounded-full border-2 px-4 text-sm font-semibold transition-colors', on ? 'border-primary bg-primary/10 text-primary' : 'border-transparent bg-card shadow-soft dark:border-border')}>
              {on && <Check className="size-4" />}{r}
            </button>
          );
        })}
      </div>
    ),
  },
  {
    id: 'agua', title: 'Quanta água você bebe por dia?', subtitle: 'Uma estimativa já ajuda. Sua meta será de 35 ml por kg.',
    render: (d, set) => (
      <div className="space-y-3">
        <Stepper label="litros de água" value={d.waterLitersHabit} onChange={(v) => set({ waterLitersHabit: v })} min={0} max={6} step={0.25} suffix="litros" />
        {numberError(d.weight, 'peso') === null && (
          <p className="text-center text-sm text-muted-foreground">Sua meta sugerida: <b className="text-foreground">{String(Math.round(parseNum(d.weight) * 35 / 100) / 10).replace('.', ',')} litros</b></p>
        )}
      </div>
    ),
  },
];

/** Seleção de atividades com frequência e duração */
function ActivitiesPicker({ draft, set, error }: { draft: Draft; set: (p: Partial<Draft>) => void; error: string | null }) {
  const update = (id: string, p: Partial<PlannedActivity>) => set({ activities: draft.activities.map((a) => (a.activityId === id ? { ...a, ...p } : a)) });
  const chosen = new Set(draft.activities.map((a) => a.activityId));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {ACTIVITIES.map((a) => {
          const on = chosen.has(a.id);
          return (
            <button key={a.id} type="button" aria-pressed={on}
              onClick={() => set({ activities: on ? draft.activities.filter((x) => x.activityId !== a.id) : [...draft.activities, { activityId: a.id, timesPerWeek: 3, minutesPerSession: a.id === 'musculacao' ? 60 : 45 }] })}
              className={cn('min-h-[44px] rounded-full border-2 px-3.5 text-sm font-semibold transition-colors', on ? 'border-primary bg-primary/10 text-primary' : 'border-transparent bg-card shadow-soft dark:border-border')}>
              {a.name}
            </button>
          );
        })}
      </div>
      {draft.activities.map((pa) => {
        const a = ACTIVITIES.find((x) => x.id === pa.activityId)!;
        return (
          <div key={pa.activityId} className="space-y-2 rounded-lg bg-card p-3 shadow-soft dark:border dark:border-border dark:shadow-none">
            <p className="font-semibold">{a.name}</p>
            <div className="grid grid-cols-2 gap-2">
              <Stepper label={`vezes por semana de ${a.name}`} value={pa.timesPerWeek} onChange={(v) => update(pa.activityId, { timesPerWeek: v })} min={1} max={14} suffix="×/sem" />
              <Stepper label={`minutos por sessão de ${a.name}`} value={pa.minutesPerSession} onChange={(v) => update(pa.activityId, { minutesPerSession: v })} min={10} max={240} step={5} suffix="min" />
            </div>
          </div>
        );
      })}
      {error && <p className="text-sm font-medium text-destructive" role="alert">{error}</p>}
    </div>
  );
}

/** Monta o rascunho a partir de um perfil existente (ao refazer o questionário) */
function draftFromStore(): Draft {
  const s = useStore.getState();
  if (!s.profile || !s.questionnaire) return emptyDraft;
  const p = s.profile;
  const q = s.questionnaire;
  const w = s.weights.length ? s.weights[s.weights.length - 1].kg : '';
  return {
    ...emptyDraft, ...q,
    name: p.name, sex: p.sex, birthDate: p.birthDate, weight: String(w).replace('.', ','), height: String(p.heightCm),
    bodyFat: p.bodyFatPercent ? String(p.bodyFatPercent).replace('.', ',') : '', goal: p.goal,
    targetWeight: p.targetWeightKg ? String(p.targetWeightKg).replace('.', ',') : '', pace: p.pace,
  };
}

export function Onboarding() {
  const redoing = useStore((s) => s.redoingQuestionnaire);
  const setRedoing = useStore((s) => s.setRedoing);
  const complete = useStore((s) => s.completeOnboarding);
  const setHevy = useSheets((s) => s.setHevy);
  const setTab = useStore((s) => s.setTab);

  const [draft, setDraft] = useState<Draft>(() => (redoing ? draftFromStore() : emptyDraft));
  const [index, setIndex] = useState(-1); // -1 = boas-vindas
  const [dir, setDir] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  const visible = useMemo(() => STEPS.filter((s) => !s.skip?.(draft)), [draft]);
  const step = index >= 0 ? visible[Math.min(index, visible.length - 1)] : null;
  const advancing = useRef(false);
  const set = (p: Partial<Draft>) => {
    const next = { ...draft, ...p };
    setDraft(next);
    setError(null);
    // Avança sozinho nas perguntas de escolha única (com proteção contra toque duplo)
    if (step?.autoNext && !step.validate?.(next) && !advancing.current) {
      advancing.current = true;
      setTimeout(() => {
        advancing.current = false;
        goNext(next);
      }, 220);
    }
  };

  function goNext(d: Draft = draft) {
    if (!step) {
      setDir(1);
      setIndex(0);
      return;
    }
    const err = step.validate?.(d) ?? null;
    if (err) {
      setError(err);
      return;
    }
    const vis = STEPS.filter((s) => !s.skip?.(d));
    const pos = vis.findIndex((s) => s.id === step.id);
    setDir(1);
    if (pos >= vis.length - 1) setShowSummary(true);
    else setIndex(pos + 1);
  }

  function goBack() {
    setError(null);
    setDir(-1);
    if (showSummary) return setShowSummary(false);
    setIndex(Math.max(-1, index - 1));
  }

  const finish = (openHevy: boolean) => {
    const { profile, questionnaire, weight } = draftToData(draft);
    complete(profile, questionnaire, weight);
    if (openHevy) {
      setTab('treinos');
      setTimeout(() => setHevy(true), 300);
    }
  };

  if (showSummary) {
    return <Summary draft={draft} onBack={goBack} onFinish={finish} />;
  }

  const progress = index < 0 ? 0 : ((index + 1) / (visible.length + 1)) * 100;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 pt-safe">
      <div className="flex items-center gap-3 pb-2 pt-4">
        <Button variant="ghost" size="icon" onClick={goBack} disabled={index < 0} aria-label="Voltar" className={index < 0 ? 'invisible' : ''}>
          <ArrowLeft />
        </Button>
        <Progress value={progress} className="flex-1" label="Progresso do questionário" />
        {redoing ? (
          <Button variant="ghost" size="icon" onClick={() => setRedoing(false)} aria-label="Cancelar e voltar ao app"><X /></Button>
        ) : (
          <span className="w-11 text-right text-xs font-semibold text-muted-foreground">{index < 0 ? '' : `${index + 1}/${visible.length}`}</span>
        )}
      </div>

      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={step?.id ?? 'intro'}
            custom={dir}
            initial={{ x: dir * 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: dir * -60, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="pb-32 pt-4"
          >
            {step ? (
              <>
                <h1 className="text-2xl font-extrabold leading-tight tracking-tight">{step.title}</h1>
                {step.subtitle && <p className="mt-2 text-muted-foreground">{step.subtitle}</p>}
                <div className="mt-6">{step.render(draft, set, error)}</div>
                {error && !['nome', 'nascimento', 'peso', 'altura', 'gordura', 'peso_desejado', 'atividades'].includes(step.id) && (
                  <p className="mt-3 text-sm font-medium text-destructive" role="alert">{error}</p>
                )}
              </>
            ) : (
              <Welcome redoing={redoing} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-background via-background to-background/0 pb-safe">
        <div className="mx-auto max-w-lg px-5 pb-5 pt-6">
          <Button size="lg" className="w-full" onClick={() => goNext()}>
            {!step ? (redoing ? 'Refazer questionário' : 'Vamos começar') : step.optional && isEmptyOptional(step.id, draft) ? 'Pular' : 'Continuar'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function isEmptyOptional(id: string, d: Draft) {
  if (id === 'gordura') return !d.bodyFat;
  if (id === 'peso_desejado') return !d.targetWeight;
  if (id === 'extras') return d.extras.length === 0;
  if (id === 'restricoes') return d.restrictions.length === 0;
  return false;
}

function Welcome({ redoing }: { redoing: boolean }) {
  return (
    <div className="flex flex-col items-center pt-10 text-center">
      <motion.div initial={{ scale: 0.6, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', bounce: 0.5 }}
        className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-primary text-primary-foreground shadow-lift">
        {redoing ? <Sparkles className="size-11" /> : <Sprout className="size-11" />}
      </motion.div>
      <h1 className="mt-8 text-3xl font-extrabold tracking-tight">{redoing ? 'Vamos atualizar seu perfil' : 'Bem-vindo ao FitDia'}</h1>
      <p className="mt-3 max-w-sm text-muted-foreground">
        Responda algumas perguntas rápidas sobre sua rotina. Com elas calculamos o seu gasto calórico de forma personalizada — não um número genérico.
      </p>
      <ul className="mt-8 w-full max-w-sm space-y-3 text-left">
        {[
          ['Leva uns 3 minutos', 'Uma pergunta por vez'],
          ['Seus dados ficam no seu celular', 'Nada é enviado para servidores'],
          ['Você pode refazer quando quiser', 'No Perfil, a qualquer momento'],
        ].map(([t, s]) => (
          <li key={t} className="flex items-start gap-3 rounded-lg bg-card p-3 shadow-soft dark:shadow-none">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Check className="size-4" /></span>
            <span><span className="block text-sm font-semibold">{t}</span><span className="block text-xs text-muted-foreground">{s}</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
