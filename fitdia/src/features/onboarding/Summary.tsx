// Resumo do questionário: de onde vem cada parte do gasto calórico
import { motion } from 'framer-motion';
import { ArrowLeft, Flame, Footprints, Dumbbell, Utensils, Target, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Disclaimer } from '@/components/layout/common';
import { ageFromBirthDate, katchMcArdle, mifflinStJeor } from '@/lib/calc/bmr';
import { calculateNeat } from '@/lib/calc/neat';
import { estimateEnergy, goalCalories, nearestActivityLevel, waterGoalMl, TEF_RATE } from '@/lib/calc/energy';
import { fmt, fmt1 } from '@/lib/utils';
import { draftToData, type Draft } from './Onboarding';

export function Summary({ draft, onBack, onFinish }: { draft: Draft; onBack: () => void; onFinish: (openHevy: boolean) => void }) {
  const { profile, questionnaire, weight } = draftToData(draft);
  const age = ageFromBirthDate(profile.birthDate);
  const bmr = mifflinStJeor(profile.sex, weight, profile.heightCm, age);
  const katch = profile.bodyFatPercent ? katchMcArdle(weight, profile.bodyFatPercent) : null;
  const neat = calculateNeat(questionnaire, weight);
  const e = estimateEnergy(bmr, neat.total, questionnaire.activities, weight);
  const goal = goalCalories(e.restDay, bmr, profile.sex, profile.goal, profile.pace);
  const level = nearestActivityLevel(e.activityFactor);

  const parts = [
    { label: 'Basal', desc: 'Manter o corpo funcionando em repouso', kcal: bmr, color: 'hsl(var(--primary))', icon: Flame },
    { label: 'Dia a dia', desc: 'Trabalho, deslocamento, tarefas e passos', kcal: neat.total, color: 'hsl(var(--food))', icon: Footprints },
    { label: 'Exercício', desc: 'Média dos seus treinos por dia', kcal: e.exerciseAvg, color: 'hsl(var(--workout))', icon: Dumbbell },
    { label: 'Digestão', desc: '10% do que você come', kcal: e.tef, color: 'hsl(var(--water))', icon: Utensils },
  ];
  const total = parts.reduce((s, p) => s + p.kcal, 0);
  const topBlocks = [...neat.blocks].filter((b) => b.kcal > 5).sort((a, b) => b.kcal - a.kcal).slice(0, 5);

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-5 pb-40 pt-safe">
      <div className="flex items-center gap-2 pt-4">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Voltar"><ArrowLeft /></Button>
        <span className="text-sm font-semibold text-muted-foreground">Resumo</span>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Pronto, {profile.name.split(' ')[0]}! 🎉</h1>
        <p className="mt-1 text-muted-foreground">Este é o seu gasto calórico estimado, calculado a partir da sua rotina.</p>

        <Card className="mt-5 p-5">
          <p className="text-sm font-medium text-muted-foreground">Gasto médio por dia</p>
          <p className="text-5xl font-extrabold tracking-tight">{fmt(e.average)}<span className="ml-1 text-lg font-semibold text-muted-foreground">kcal</span></p>
          {/* Barra empilhada com cada parte do gasto */}
          <div className="mt-4 flex h-3 overflow-hidden rounded-full" aria-hidden>
            {parts.map((p, i) => (
              <motion.div key={p.label} style={{ background: p.color }} initial={{ width: 0 }} animate={{ width: `${(p.kcal / total) * 100}%` }} transition={{ delay: 0.15 + i * 0.1, duration: 0.5 }} />
            ))}
          </div>
          <ul className="mt-4 space-y-3">
            {parts.map((p) => (
              <li key={p.label} className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${p.color} 15%, transparent)`, color: p.color }}>
                  <p.icon className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{p.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.desc}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold tabular-nums">{fmt(p.kcal)}</p>
                  <p className="text-xs text-muted-foreground">{fmt((p.kcal / total) * 100)}%</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <Card className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Dia sem treino</p>
            <p className="text-2xl font-bold">{fmt(e.restDay)}</p>
            <p className="text-xs text-muted-foreground">kcal</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Dia com treino</p>
            <p className="text-2xl font-bold text-workout">{fmt(e.trainingDay)}</p>
            <p className="text-xs text-muted-foreground">kcal</p>
          </Card>
        </div>

        <Card className="mt-3 p-5">
          <div className="flex items-center gap-2 text-primary"><Target className="size-5" /><p className="font-bold">Meta sugerida</p></div>
          <p className="mt-1 text-4xl font-extrabold">{fmt(goal.target)} <span className="text-base font-semibold text-muted-foreground">kcal/dia</span></p>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile.goal === 'perder' && `Déficit de ${fmt(-goal.adjustment)} kcal sobre o dia sem treino (≈ ${fmt1(-goal.weeklyKgChange)} kg por semana).`}
            {profile.goal === 'ganhar' && `Superávit de ${fmt(goal.adjustment)} kcal sobre o dia sem treino (≈ ${fmt1(goal.weeklyKgChange)} kg por semana).`}
            {(profile.goal === 'manter' || profile.goal === 'condicionamento') && 'Igual ao seu gasto num dia sem treino.'}
            {' '}Nos dias de treino, as calorias gastas são somadas automaticamente.
          </p>
          {goal.limitedBy && <p className="mt-2 rounded-lg bg-food/10 p-2 text-xs font-medium text-food">{goal.limitedBy}</p>}
        </Card>

        <Card className="mt-3 p-5">
          <p className="font-bold">Como chegamos nesse número</p>
          <dl className="mt-3 space-y-2 text-sm">
            <Row k="Taxa basal (Mifflin-St Jeor)" v={`${fmt(bmr)} kcal`} />
            {katch && <Row k="Taxa basal (Katch-McArdle)" v={`${fmt(katch)} kcal`} />}
            <Row k="Fator de atividade equivalente" v={`${fmt1(e.activityFactor).replace('.', ',')} (${level.label.toLowerCase()})`} />
            <Row k="Meta de água" v={`${fmt1(waterGoalMl(weight) / 1000)} L por dia`} />
          </dl>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Maiores gastos do dia a dia</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {topBlocks.map((b) => (
              <li key={b.key} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{b.label} <span className="text-xs">({fmt1(b.hours)} h)</span></span>
                <span className="font-semibold tabular-nums">+{fmt(b.kcal)} kcal</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Somamos o gasto de cada bloco do seu dia (MET × peso × horas, descontando o repouso já incluído na basal). A digestão
            ({fmt(TEF_RATE * 100)}%) supõe que você come o que gasta; no dia a dia, usamos o que você registrar. Com o tempo, o app compara
            sua variação de peso com o que você registrou e ajusta a estimativa.
          </p>
        </Card>

        <div className="mt-3"><Disclaimer /></div>
      </motion.div>

      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-background via-background to-background/0 pb-safe">
        <div className="mx-auto max-w-lg space-y-2 px-5 pb-5 pt-6">
          {questionnaire.usesHevy === 'hevy' && (
            <Button size="lg" variant="outline" className="w-full" onClick={() => onFinish(true)}>
              <Smartphone /> Começar e importar do Hevy
            </Button>
          )}
          <Button size="lg" className="w-full" onClick={() => onFinish(false)}>Começar a usar o FitDia</Button>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-semibold">{v}</dd>
    </div>
  );
}
