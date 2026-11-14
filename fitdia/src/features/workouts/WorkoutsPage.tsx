// Tela de treinos: resumo da semana, fichas, histórico e evolução de carga
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Play, Pencil, Trash2, Flame, Trophy, FileUp, ChevronRight, CalendarDays } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Dot } from 'recharts';
import { useStore } from '@/store/useStore';
import { trainingStreak } from '@/store/selectors';
import type { ExerciseLog, Workout } from '@/store/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/misc';
import { Sheet } from '@/components/ui/sheet';
import { Field } from '@/components/ui/field';
import { EmptyState, PageHeader } from '@/components/layout/common';
import { useSheets } from '@/components/layout/sheets';
import { estimatedOneRepMax, summarizeExercises } from '@/lib/calc/strength';
import { addDays, friendlyDate, fromISODate, shortDate, today } from '@/lib/date';
import { fmt, fmt1 } from '@/lib/utils';
import { nameError } from '@/lib/validation';
import { normalize } from '@/lib/text';
import { toast } from '@/components/ui/toast';
import { ExerciseBuilder, exercisesError } from './ExerciseBuilder';

/** Início da semana (segunda-feira) */
function weekStart(iso: string) {
  const d = fromISODate(iso);
  const dow = (d.getDay() + 6) % 7;
  return addDays(iso, -dow);
}

const SOURCE_LABEL: Record<Workout['source'], string> = { manual: 'Manual', hevy: 'Hevy', ficha: 'Ficha' };

export function WorkoutsPage() {
  const s = useStore();
  const sheets = useSheets();
  const [editTpl, setEditTpl] = useState<{ id?: string; name: string; exercises: ExerciseLog[] } | null>(null);
  const [showAll, setShowAll] = useState(false);

  const ws = weekStart(today());
  const weekWorkouts = s.workouts.filter((w) => w.date >= ws && w.date <= today());
  const weekKcal = weekWorkouts.reduce((sum, w) => sum + w.kcal, 0);
  const streak = trainingStreak(s.workouts);
  const sorted = useMemo(() => [...s.workouts].sort((a, b) => b.date.localeCompare(a.date)), [s.workouts]);
  const visible = showAll ? sorted : sorted.slice(0, 8);

  return (
    <div className="space-y-3">
      <PageHeader title="Treinos" action={<Button size="icon" onClick={() => sheets.openWorkout()} aria-label="Adicionar treino"><Plus /></Button>} />

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3">
          <Flame className="size-5 text-food" />
          <p className="mt-1 text-2xl font-extrabold tabular-nums">{streak}</p>
          <p className="text-[11px] font-medium text-muted-foreground">{streak === 1 ? 'dia seguido' : 'dias seguidos'}</p>
        </Card>
        <Card className="p-3">
          <CalendarDays className="size-5 text-workout" />
          <p className="mt-1 text-2xl font-extrabold tabular-nums">{weekWorkouts.length}</p>
          <p className="text-[11px] font-medium text-muted-foreground">treinos na semana</p>
        </Card>
        <Card className="p-3">
          <Trophy className="size-5 text-primary" />
          <p className="mt-1 text-2xl font-extrabold tabular-nums">{fmt(weekKcal)}</p>
          <p className="text-[11px] font-medium text-muted-foreground">kcal na semana</p>
        </Card>
      </div>

      <Button variant="outline" className="w-full" onClick={() => sheets.setHevy(true)}><FileUp /> Importar treinos do Hevy</Button>

      {/* Fichas de treino */}
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-bold">Fichas de treino</p>
          <Button size="sm" variant="ghost" className="text-primary" onClick={() => setEditTpl({ name: `Treino ${String.fromCharCode(65 + s.templates.length)}`, exercises: [] })}><Plus className="!size-4" /> Nova ficha</Button>
        </div>
        {s.templates.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">Monte fichas como Treino A, B e C para repetir com um toque.</p>
        ) : (
          <ul className="space-y-2">
            {s.templates.map((t) => {
              const sum = summarizeExercises(t.exercises);
              return (
                <li key={t.id} className="flex items-center gap-2 rounded-xl bg-secondary/60 p-2 pl-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{t.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{t.exercises.length} {t.exercises.length === 1 ? 'exercício' : 'exercícios'} · {sum.sets} {sum.sets === 1 ? 'série' : 'séries'}</p>
                  </div>
                  <Button size="icon" variant="ghost" aria-label={`Editar ${t.name}`} onClick={() => setEditTpl({ id: t.id, name: t.name, exercises: structuredClone(t.exercises) })}><Pencil className="!size-4" /></Button>
                  <Button size="icon" className="bg-workout text-white hover:bg-workout/90" aria-label={`Iniciar ${t.name}`} onClick={() => sheets.openWorkout({ templateId: t.id })}><Play className="!size-4" /></Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Histórico de treinos */}
      <Card className="p-4">
        <p className="mb-1 font-bold">Treinos registrados</p>
        {sorted.length === 0 ? (
          <EmptyState illustration="dumbbell" title="Nenhum treino ainda" text="Todo progresso começa com o primeiro treino. Bora?" action={<Button onClick={() => sheets.openWorkout()}><Plus /> Registrar treino</Button>} />
        ) : (
          <>
            <ul className="divide-y divide-border/70">
              {visible.map((w) => {
                const sum = w.exercises?.length ? summarizeExercises(w.exercises) : null;
                return (
                  <motion.li key={w.id} layout className="flex items-center">
                    <button className="flex min-h-[56px] flex-1 items-center justify-between gap-2 py-2 text-left" onClick={() => { s.setDate(w.date); sheets.openWorkout({ editId: w.id }); }}>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold">{w.name}</span>
                          {w.source !== 'manual' && <Badge className="py-0 text-[10px]">{SOURCE_LABEL[w.source]}</Badge>}
                        </span>
                        <span className="block text-xs first-letter:uppercase text-muted-foreground">
                          {friendlyDate(w.date)} · {w.durationMin} min · {w.intensity}{sum ? ` · ${sum.sets} séries` : ''}
                        </span>
                      </span>
                      <span className="flex items-center gap-1 text-sm font-bold text-workout tabular-nums">{fmt(w.kcal)}<ChevronRight className="size-4 text-muted-foreground" /></span>
                    </button>
                    <Button size="icon" variant="ghost" aria-label={`Excluir ${w.name}`} onClick={() => { s.removeWorkout(w.id); toast('Treino excluído'); }}><Trash2 className="!size-4 text-muted-foreground" /></Button>
                  </motion.li>
                );
              })}
            </ul>
            {sorted.length > 8 && <Button variant="ghost" className="w-full" onClick={() => setShowAll(!showAll)}>{showAll ? 'Mostrar menos' : `Ver todos (${sorted.length})`}</Button>}
          </>
        )}
      </Card>

      <ExerciseProgress workouts={s.workouts} />

      <TemplateEditor tpl={editTpl} onClose={() => setEditTpl(null)} />
    </div>
  );
}

/** Edição de ficha de treino */
function TemplateEditor({ tpl, onClose }: { tpl: { id?: string; name: string; exercises: ExerciseLog[] } | null; onClose: () => void }) {
  const s = useStore();
  const [draft, setDraft] = useState(tpl);
  const [touched, setTouched] = useState(false);
  const [lastTpl, setLastTpl] = useState(tpl);
  if (tpl !== lastTpl) {
    setLastTpl(tpl);
    setDraft(tpl);
    setTouched(false);
  }
  if (!draft) return <Sheet open={false} onOpenChange={onClose} title="Ficha">{null}</Sheet>;
  const err = nameError(draft.name, 1, 40) ?? (draft.exercises.length === 0 ? 'Adicione pelo menos um exercício' : exercisesError(draft.exercises));

  return (
    <Sheet open={!!tpl} onOpenChange={(o) => !o && onClose()} title={draft.id ? 'Editar ficha' : 'Nova ficha'}
      footer={
        <div className="flex gap-2">
          {draft.id && <Button variant="outline" size="icon" aria-label="Excluir ficha" onClick={() => { s.removeTemplate(draft.id!); toast('Ficha excluída'); onClose(); }}><Trash2 className="text-destructive" /></Button>}
          <Button size="lg" className="flex-1" onClick={() => {
            setTouched(true);
            if (err) return;
            s.saveTemplate({ id: draft.id, name: draft.name.trim(), exercises: draft.exercises });
            toast('Ficha salva');
            onClose();
          }}>Salvar ficha</Button>
        </div>
      }>
      <div className="space-y-4">
        <Field label="Nome da ficha" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={40} />
        <ExerciseBuilder value={draft.exercises} onChange={(exercises) => setDraft({ ...draft, exercises })} />
        {touched && err && <p className="text-sm font-medium text-destructive" role="alert">{err}</p>}
      </div>
    </Sheet>
  );
}

/** Gráfico de evolução de carga por exercício, com recordes pessoais */
function ExerciseProgress({ workouts }: { workouts: Workout[] }) {
  // Agrupa por nome normalizado do exercício
  const byExercise = useMemo(() => {
    const map = new Map<string, { name: string; points: Array<{ date: string; maxKg: number; e1rm: number; reps: number }> }>();
    for (const w of [...workouts].sort((a, b) => a.date.localeCompare(b.date))) {
      for (const ex of w.exercises ?? []) {
        const valid = ex.sets.filter((st) => st.type !== 'aquecimento' && st.kg > 0 && st.reps > 0);
        if (valid.length === 0) continue;
        const key = normalize(ex.name);
        const entry = map.get(key) ?? { name: ex.name, points: [] };
        const best = valid.reduce((b, st) => (estimatedOneRepMax(st.kg, st.reps) > estimatedOneRepMax(b.kg, b.reps) ? st : b));
        entry.points.push({ date: w.date, maxKg: Math.max(...valid.map((st) => st.kg)), e1rm: Math.round(estimatedOneRepMax(best.kg, best.reps) * 10) / 10, reps: best.reps });
        map.set(key, entry);
      }
    }
    return [...map.values()].sort((a, b) => b.points.length - a.points.length);
  }, [workouts]);

  const [selected, setSelected] = useState<string | null>(null);
  if (byExercise.length === 0) return null;
  const current = byExercise.find((e) => e.name === selected) ?? byExercise[0];

  // Marca os pontos que bateram recorde de carga
  let best = 0;
  const data = current.points.map((p) => {
    const pr = p.maxKg > best;
    if (pr) best = p.maxKg;
    return { ...p, label: shortDate(p.date), pr };
  });
  const prKg = Math.max(...current.points.map((p) => p.maxKg));
  const prE1rm = Math.max(...current.points.map((p) => p.e1rm));

  return (
    <Card className="p-4">
      <p className="font-bold">Evolução de carga</p>
      <div className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 no-scrollbar">
        {byExercise.slice(0, 20).map((e) => (
          <button key={e.name} onClick={() => setSelected(e.name)} aria-pressed={current.name === e.name}
            className={`min-h-[40px] shrink-0 rounded-full px-3 text-sm font-semibold ${current.name === e.name ? 'bg-workout text-white' : 'bg-secondary text-muted-foreground'}`}>
            {e.name}
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-primary/10 p-3">
          <p className="flex items-center gap-1 text-xs font-semibold text-primary"><Trophy className="size-3.5" /> Recorde de carga</p>
          <p className="text-xl font-extrabold tabular-nums">{fmt1(prKg)} kg</p>
        </div>
        <div className="rounded-xl bg-secondary p-3">
          <p className="text-xs font-semibold text-muted-foreground">1RM estimado (Epley)</p>
          <p className="text-xl font-extrabold tabular-nums">{fmt1(prE1rm)} kg</p>
        </div>
      </div>
      {data.length > 1 ? (
        <div className="mt-3 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} domain={['dataMin - 5', 'dataMax + 5']} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: 'none', borderRadius: 12, boxShadow: '0 4px 16px rgb(0 0 0 / .12)', fontSize: 12 }}
                formatter={(v: number, n: string) => [`${fmt1(v)} kg`, n === 'maxKg' ? 'Carga máxima' : '1RM estimado']}
                labelFormatter={(l) => `Dia ${l}`}
              />
              <Line type="monotone" dataKey="e1rm" stroke="hsl(var(--muted-foreground))" strokeOpacity={0.4} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="maxKg" stroke="hsl(var(--workout))" strokeWidth={3}
                dot={(props: { cx?: number; cy?: number; payload?: { pr: boolean }; index?: number }) => (
                  <Dot key={props.index} cx={props.cx} cy={props.cy} r={props.payload?.pr ? 5 : 3} fill={props.payload?.pr ? 'hsl(var(--primary))' : 'hsl(var(--workout))'} stroke="hsl(var(--card))" strokeWidth={2} />
                )}
                activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-center text-[11px] text-muted-foreground"><span className="inline-block h-2 w-2 rounded-full bg-primary" /> recorde pessoal · linha clara = 1RM estimado</p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Registre este exercício em mais um treino para ver o gráfico.</p>
      )}
    </Card>
  );
}
