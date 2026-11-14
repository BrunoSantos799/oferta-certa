// Tela inicial: resumo do dia
import { motion } from 'framer-motion';
import { Utensils, Dumbbell, Droplets, Plus, Minus, ChevronRight, RefreshCw, Flame, Sparkles } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { MEALS, entryNutrients, shouldRedoQuestionnaire, useDaySummary, useEnergyModel } from '@/store/selectors';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/misc';
import { ProgressRing } from '@/components/charts/ProgressRing';
import { MacroDonut, MACRO_COLORS } from '@/components/charts/MacroDonut';
import { DayNavigator, Disclaimer, PageHeader } from '@/components/layout/common';
import { useSheets } from '@/components/layout/sheets';
import { macroTargets } from '@/lib/calc/macros';
import { fmt, fmt1 } from '@/lib/utils';
import { toast } from '@/components/ui/toast';

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export function TodayPage() {
  const s = useStore();
  const date = s.selectedDate;
  const day = useDaySummary(date);
  const model = useEnergyModel();
  const sheets = useSheets();
  if (!day || !model || !s.profile) return null;

  const over = day.remaining < 0;
  const ringValue = day.consumed.kcal / Math.max(1, day.goal + day.workoutKcal);
  const workouts = s.workouts.filter((w) => w.date === date);
  const targets = macroTargets(day.goal, model.weight, s.profile.goal);
  const glass = s.settings.glassMl;
  const glasses = Math.round(day.waterMl / glass);
  const glassGoal = Math.ceil(day.waterGoal / glass);
  const redo = shouldRedoQuestionnaire(s);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
      <PageHeader subtitle={`${greeting()}, ${s.profile.name.split(' ')[0]}`} title="Seu dia" />
      <motion.div variants={item}><DayNavigator /></motion.div>

      {/* Anel principal com as calorias restantes */}
      <motion.div variants={item}>
        <Card className="flex flex-col items-center px-4 pb-5 pt-6">
          <ProgressRing value={ringValue} color={over ? 'hsl(var(--food))' : 'hsl(var(--primary))'} label={`${fmt(Math.abs(day.remaining))} kcal ${over ? 'acima da meta' : 'restantes'}`}>
            <motion.span key={Math.round(day.remaining)} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-[44px] font-extrabold leading-none tracking-tight tabular-nums">
              {fmt(Math.abs(day.remaining))}
            </motion.span>
            <span className="mt-1 text-sm font-medium text-muted-foreground">{over ? 'kcal acima da meta' : 'kcal restantes'}</span>
          </ProgressRing>
          <div className="mt-5 grid w-full grid-cols-3 divide-x divide-border text-center">
            <div><p className="text-xs font-medium text-muted-foreground">Consumidas</p><p className="text-lg font-bold text-food tabular-nums">{fmt(day.consumed.kcal)}</p></div>
            <div><p className="text-xs font-medium text-muted-foreground">Treino</p><p className="text-lg font-bold text-workout tabular-nums">+{fmt(day.workoutKcal)}</p></div>
            <div><p className="text-xs font-medium text-muted-foreground">Meta</p><p className="text-lg font-bold tabular-nums">{fmt(day.goal)}</p></div>
          </div>
        </Card>
      </motion.div>

      {/* Gasto total e saldo */}
      <motion.div variants={item}>
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Gasto total estimado</p>
              <p className="text-2xl font-bold tabular-nums">{fmt(day.energy.total)} <span className="text-sm font-semibold text-muted-foreground">kcal</span></p>
            </div>
            <div className={`rounded-xl px-3 py-1.5 text-right ${day.energy.balance <= 0 ? 'bg-primary/10 text-primary' : 'bg-food/10 text-food'}`}>
              <p className="text-[11px] font-semibold uppercase tracking-wide">{day.energy.balance <= 0 ? 'Déficit' : 'Superávit'}</p>
              <p className="text-lg font-bold tabular-nums">{fmt(Math.abs(day.energy.balance))}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[11px] text-muted-foreground">
            <div><p className="font-bold text-foreground tabular-nums">{fmt(day.energy.bmr)}</p>Basal</div>
            <div><p className="font-bold text-foreground tabular-nums">{fmt(day.energy.neat + day.energy.adaptive)}</p>Dia a dia</div>
            <div><p className="font-bold text-foreground tabular-nums">{fmt(day.energy.workout)}</p>Treinos</div>
            <div><p className="font-bold text-foreground tabular-nums">{fmt(day.energy.tef)}</p>Digestão</div>
          </div>
        </Card>
      </motion.div>

      {redo && (
        <motion.div variants={item}>
          <button onClick={() => s.setRedoing(true)} className="flex w-full items-center gap-3 rounded-lg bg-primary/10 p-4 text-left">
            <RefreshCw className="size-5 shrink-0 text-primary" />
            <span className="flex-1 text-sm"><b>Hora de atualizar seu gasto.</b> {redo} Refaça o questionário para manter a estimativa precisa.</span>
            <ChevronRight className="size-5 text-primary" />
          </button>
        </motion.div>
      )}

      {/* Alimentação */}
      <motion.div variants={item}>
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <button className="flex items-center gap-2 font-bold" onClick={() => s.setTab('alimentacao')}>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-food/15 text-food"><Utensils className="size-[18px]" /></span>
              Alimentação
            </button>
            <Button size="sm" variant="secondary" onClick={() => sheets.openFood()}><Plus className="!size-4" /> Adicionar</Button>
          </div>
          <Progress value={(day.consumed.kcal / day.goal) * 100} barClassName="bg-food" label="Calorias consumidas em relação à meta" />
          <ul className="mt-3 divide-y divide-border/70">
            {MEALS.map((m) => {
              const entries = day.entries.filter((e) => e.meal === m.id);
              const kcal = entries.reduce((sum, e) => sum + entryNutrients(e).kcal, 0);
              return (
                <li key={m.id}>
                  <button className="flex min-h-[48px] w-full items-center justify-between gap-2 py-1 text-left" onClick={() => sheets.openFood(m.id)}>
                    <span>
                      <span className="block text-sm font-semibold">{m.label}</span>
                      <span className="block max-w-[220px] truncate text-xs text-muted-foreground">
                        {entries.length ? entries.map((e) => e.food.name).join(', ') : 'Toque para adicionar'}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 text-sm font-bold tabular-nums">
                      {kcal > 0 ? fmt(kcal) : <Plus className="size-4 text-muted-foreground" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      </motion.div>

      <div className="grid grid-cols-2 gap-3">
        {/* Treino */}
        <motion.div variants={item}>
          <Card className="flex h-full flex-col p-4">
            <button className="flex items-center gap-2 text-left font-bold" onClick={() => s.setTab('treinos')}>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-workout/15 text-workout"><Dumbbell className="size-[18px]" /></span>
              Treino
            </button>
            <p className="mt-3 text-2xl font-bold tabular-nums text-workout">{fmt(day.workoutKcal)}<span className="ml-1 text-xs font-semibold text-muted-foreground">kcal</span></p>
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {workouts.length ? workouts.map((w) => `${w.name} · ${w.durationMin} min`).join(', ') : 'Nenhum treino ainda'}
            </p>
            <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={() => sheets.openWorkout()}><Plus className="!size-4" /> Treino</Button>
          </Card>
        </motion.div>

        {/* Água */}
        <motion.div variants={item}>
          <Card className="flex h-full flex-col p-4">
            <div className="flex items-center gap-2 font-bold">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-water/15 text-water"><Droplets className="size-[18px]" /></span>
              Água
            </div>
            <p className="mt-3 text-2xl font-bold tabular-nums text-water">{fmt1(day.waterMl / 1000)}<span className="ml-1 text-xs font-semibold text-muted-foreground">/ {fmt1(day.waterGoal / 1000)} L</span></p>
            <div className="my-2 flex flex-wrap gap-1" aria-label={`${glasses} de ${glassGoal} copos`}>
              {Array.from({ length: Math.min(glassGoal, 16) }, (_, i) => (
                <motion.span key={i} initial={false} animate={{ scale: i < glasses ? 1 : 0.85 }} className={`h-3 w-2.5 rounded-sm ${i < glasses ? 'bg-water' : 'bg-secondary'}`} />
              ))}
            </div>
            <div className="mt-auto flex gap-2">
              <Button size="icon" variant="secondary" className="flex-none" aria-label="Remover um copo" onClick={() => s.addWater(-glass, date)} disabled={day.waterMl <= 0}><Minus className="!size-4" /></Button>
              <Button size="sm" className="flex-1 bg-water text-white hover:bg-water/90" onClick={() => {
                s.addWater(glass, date);
                if (day.waterMl < day.waterGoal && day.waterMl + glass >= day.waterGoal) toast('Meta de água batida! 💧');
              }}>
                <Plus className="!size-4" /> {glass} ml
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Macros */}
      <motion.div variants={item}>
        <Card className="p-4">
          <p className="mb-3 font-bold">Macronutrientes</p>
          <div className="flex items-center gap-4">
            <MacroDonut protein={day.consumed.protein} carbs={day.consumed.carbs} fat={day.consumed.fat} />
            <div className="flex-1 space-y-3">
              {([
                ['Proteína', day.consumed.protein, targets.protein, MACRO_COLORS.protein],
                ['Carboidrato', day.consumed.carbs, targets.carbs, MACRO_COLORS.carbs],
                ['Gordura', day.consumed.fat, targets.fat, MACRO_COLORS.fat],
              ] as const).map(([label, val, target, color]) => (
                <div key={label}>
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold">{label}</span>
                    <span className="text-muted-foreground tabular-nums">{fmt(val)} / {fmt(target)} g</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${Math.min(100, (val / Math.max(1, target)) * 100)}%` }} transition={{ duration: 0.6 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </motion.div>

      {day.entries.length === 0 && workouts.length === 0 && (
        <motion.div variants={item} className="flex items-center gap-3 rounded-lg bg-card p-4 shadow-soft dark:shadow-none">
          <Sparkles className="size-5 shrink-0 text-primary" />
          <p className="text-sm text-muted-foreground">Cada registro conta. Comece pelo café da manhã ou por um copo de água!</p>
        </motion.div>
      )}

      {model.adaptiveApplied !== 0 && (
        <motion.p variants={item} className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <Flame className="size-4 text-primary" /> Gasto ajustado em {model.adaptiveApplied > 0 ? '+' : ''}{fmt(model.adaptiveApplied)} kcal/dia pela sua variação real de peso.
        </motion.p>
      )}

      <motion.div variants={item}><Disclaimer /></motion.div>
    </motion.div>
  );
}
