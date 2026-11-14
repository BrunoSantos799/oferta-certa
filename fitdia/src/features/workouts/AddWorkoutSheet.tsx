// Folha para adicionar ou editar um treino
import { useEffect, useMemo, useState } from 'react';
import { Trash2, Plus, Save, Sparkles } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Segmented, Switch } from '@/components/ui/misc';
import { useSheets } from '@/components/layout/sheets';
import { useStore } from '@/store/useStore';
import { weightOn } from '@/store/selectors';
import type { ExerciseLog, Intensity } from '@/store/types';
import { strengthCalories, summarizeExercises } from '@/lib/calc/strength';
import { nameError, numberError } from '@/lib/validation';
import { cn, fmt, parseNum } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import { ExerciseBuilder, exercisesError } from './ExerciseBuilder';
import { activityKcal, activityName, activityOptions } from './workoutCalc';

export function AddWorkoutSheet() {
  const { workout: state, setWorkout } = useSheets();
  const s = useStore();
  const editing = state.editId ? s.workouts.find((w) => w.id === state.editId) : undefined;

  const [activityId, setActivityId] = useState('musculacao');
  const [duration, setDuration] = useState('60');
  const [intensity, setIntensity] = useState<Intensity>('moderada');
  const [intensityTouched, setIntensityTouched] = useState(false);
  const [manual, setManual] = useState(false);
  const [manualKcal, setManualKcal] = useState('');
  const [exercises, setExercises] = useState<ExerciseLog[]>([]);
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const [creatingActivity, setCreatingActivity] = useState(false);
  const [newAct, setNewAct] = useState({ name: '', met: '5' });

  // Preenche o formulário ao abrir (novo, edição ou a partir de uma ficha)
  useEffect(() => {
    if (!state.open) return;
    setTouched(false);
    setCreatingActivity(false);
    if (editing) {
      setActivityId(editing.activityId);
      setDuration(String(editing.durationMin));
      setIntensity(editing.intensity);
      setIntensityTouched(true);
      setManual(!!editing.manualKcal);
      setManualKcal(editing.manualKcal ? String(editing.kcal) : '');
      setExercises(editing.exercises ?? []);
      setName(editing.name);
      return;
    }
    const tpl = state.templateId ? s.templates.find((t) => t.id === state.templateId) : undefined;
    setActivityId('musculacao');
    setDuration(tpl ? '' : '60');
    setIntensity('moderada');
    setIntensityTouched(false);
    setManual(false);
    setManualKcal('');
    setExercises(tpl ? structuredClone(tpl.exercises) : []);
    setName(tpl?.name ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.open, state.editId, state.templateId]);

  const weight = weightOn(s.weights, s.selectedDate);
  const options = useMemo(() => activityOptions(s.customActivities), [s.customActivities]);
  const isStrength = activityId === 'musculacao';
  const hasExercises = isStrength && exercises.length > 0;
  const exErr = hasExercises ? exercisesError(exercises) : null;

  // Duração: obrigatória, exceto na musculação com exercícios (estimada pelas séries)
  const durationErr = hasExercises && duration.trim() === '' ? null : numberError(duration, 'duracao');
  const durationNum = duration.trim() === '' ? undefined : parseNum(duration);

  // Cálculo automático das calorias
  const auto = useMemo(() => {
    if (hasExercises && !exErr) {
      const r = strengthCalories(exercises, durationNum && !durationErr ? durationNum : undefined, weight);
      const usedIntensity = intensityTouched ? intensity : r.intensity;
      return { kcal: activityKcal('musculacao', usedIntensity, r.durationMin, weight, []), durationMin: r.durationMin, intensity: usedIntensity, estimated: r.intensity };
    }
    if (durationErr || !durationNum) return null;
    return { kcal: activityKcal(activityId, intensity, durationNum, weight, s.customActivities), durationMin: durationNum, intensity, estimated: null };
  }, [hasExercises, exErr, exercises, durationNum, durationErr, weight, intensityTouched, intensity, activityId, s.customActivities]);

  const manualErr = manual ? numberError(manualKcal, 'kcalTreino') : null;
  const nameErr = name.trim() ? nameError(name, 2, 50) : null;
  const err = exErr ?? durationErr ?? manualErr ?? nameErr;

  const save = () => {
    setTouched(true);
    if (err || !auto) return;
    const data = {
      date: editing?.date ?? s.selectedDate,
      activityId,
      name: name.trim() || activityName(activityId, s.customActivities),
      durationMin: Math.round(auto.durationMin),
      intensity: auto.intensity,
      kcal: manual ? Math.round(parseNum(manualKcal)) : auto.kcal,
      manualKcal: manual,
      exercises: isStrength ? exercises : undefined,
      source: editing?.source ?? (state.templateId ? ('ficha' as const) : ('manual' as const)),
    };
    if (editing) s.updateWorkout(editing.id, data);
    else s.addWorkout(data);
    toast(editing ? 'Treino atualizado' : `Treino salvo · ${fmt(data.kcal)} kcal 💪`);
    setWorkout(false);
  };

  const saveAsTemplate = () => {
    if (exercises.length === 0 || exErr) {
      setTouched(true);
      return;
    }
    s.saveTemplate({ name: name.trim() || `Treino ${String.fromCharCode(65 + s.templates.length)}`, exercises });
    toast('Ficha salva');
  };

  const summary = hasExercises ? summarizeExercises(exercises) : null;

  return (
    <Sheet
      open={state.open}
      onOpenChange={setWorkout}
      title={editing ? 'Editar treino' : 'Adicionar treino'}
      footer={
        <div className="flex items-center gap-2">
          {editing && (
            <Button variant="outline" size="icon" aria-label="Excluir treino" onClick={() => { s.removeWorkout(editing.id); toast('Treino excluído'); setWorkout(false); }}>
              <Trash2 className="text-destructive" />
            </Button>
          )}
          <div className="mr-auto pl-1">
            <p className="text-xs text-muted-foreground">Calorias</p>
            <p className="text-xl font-extrabold text-workout tabular-nums">{manual ? (manualErr ? '—' : fmt(parseNum(manualKcal))) : auto ? fmt(auto.kcal) : '—'} <span className="text-xs font-semibold text-muted-foreground">kcal</span></p>
          </div>
          <Button size="lg" onClick={save}>{editing ? 'Salvar' : 'Adicionar'}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Atividade */}
        <div>
          <p className="mb-2 text-sm font-medium">Atividade</p>
          <div className="flex flex-wrap gap-2">
            {options.map((o) => (
              <button key={o.id} onClick={() => setActivityId(o.id)} aria-pressed={activityId === o.id}
                className={cn('min-h-[40px] rounded-full px-3 text-sm font-semibold transition-colors', activityId === o.id ? 'bg-workout text-white' : 'bg-secondary text-muted-foreground')}>
                {o.name}
              </button>
            ))}
            <button onClick={() => setCreatingActivity(true)} className="flex min-h-[40px] items-center gap-1 rounded-full border-2 border-dashed border-border px-3 text-sm font-semibold text-muted-foreground">
              <Plus className="size-4" /> Personalizada
            </button>
          </div>
        </div>

        {creatingActivity && (
          <div className="space-y-3 rounded-lg bg-card p-3 shadow-soft dark:border dark:border-border dark:shadow-none">
            <p className="text-sm font-semibold">Nova atividade</p>
            <Field label="Nome" value={newAct.name} onChange={(e) => setNewAct({ ...newAct, name: e.target.value })} error={touched ? nameError(newAct.name) : null} maxLength={40} placeholder="Ex.: Altinha, Stand up paddle" />
            <Field label="MET de referência (intensidade moderada)" inputMode="decimal" value={newAct.met} onChange={(e) => setNewAct({ ...newAct, met: e.target.value })} error={numberError(newAct.met, 'met')}
              hint="Leve ≈ 3 · Moderada ≈ 5 · Intensa ≈ 8. Prefere informar as calorias? Use “Informar calorias manualmente”." />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setCreatingActivity(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={() => {
                if (nameError(newAct.name) || numberError(newAct.met, 'met')) { setTouched(true); return; }
                const a = s.addCustomActivity({ name: newAct.name.trim(), met: parseNum(newAct.met) });
                setActivityId(a.id);
                setCreatingActivity(false);
                setNewAct({ name: '', met: '5' });
                toast('Atividade criada');
              }}>Criar</Button>
            </div>
          </div>
        )}

        <Field label="Nome do treino (opcional)" value={name} onChange={(e) => setName(e.target.value)} placeholder={activityName(activityId, s.customActivities)} error={touched ? nameErr : null} maxLength={50} />

        <Field
          label="Duração"
          inputMode="numeric"
          suffix="min"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          error={touched ? durationErr : null}
          hint={hasExercises && !duration.trim() && auto ? `Estimada pelas séries: ${auto.durationMin} min` : undefined}
        />

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">Intensidade</p>
            {hasExercises && auto?.estimated && !intensityTouched && (
              <span className="flex items-center gap-1 text-xs font-semibold text-primary"><Sparkles className="size-3.5" /> Estimada pelo volume</span>
            )}
          </div>
          <Segmented ariaLabel="intensidade" value={hasExercises && !intensityTouched && auto ? auto.intensity : intensity} onChange={(v) => { setIntensity(v); setIntensityTouched(true); }}
            options={[{ value: 'leve', label: 'Leve' }, { value: 'moderada', label: 'Moderada' }, { value: 'intensa', label: 'Intensa' }]} />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg bg-card p-3 shadow-soft dark:border dark:border-border dark:shadow-none">
          <div>
            <p className="text-sm font-semibold">Informar calorias manualmente</p>
            <p className="text-xs text-muted-foreground">Ex.: valor do relógio ou do aparelho</p>
          </div>
          <Switch checked={manual} onCheckedChange={setManual} label="Informar calorias manualmente" />
        </div>
        {manual && <Field label="Calorias gastas" inputMode="numeric" suffix="kcal" value={manualKcal} onChange={(e) => setManualKcal(e.target.value)} error={touched ? manualErr : null} autoFocus />}

        {isStrength && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Exercícios <span className="text-muted-foreground">(opcional)</span></p>
              {summary && <p className="text-xs text-muted-foreground">{summary.sets} séries · {fmt(summary.volumeKg)} kg de volume</p>}
            </div>
            <ExerciseBuilder value={exercises} onChange={setExercises} />
            {touched && exErr && <p className="text-xs font-medium text-destructive" role="alert">{exErr}</p>}
            {exercises.length > 0 && (
              <Button variant="ghost" className="w-full" onClick={saveAsTemplate}><Save /> Salvar como ficha de treino</Button>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Calorias = MET × peso ({fmt(weight)} kg) × horas. Valor somado automaticamente ao gasto do dia.</p>
      </div>
    </Sheet>
  );
}
