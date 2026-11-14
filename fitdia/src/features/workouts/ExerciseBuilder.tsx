// Montagem do treino exercício por exercício: séries, repetições, carga e descanso
import { useMemo, useState } from 'react';
import { Plus, Trash2, Search, Copy, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { Field } from '@/components/ui/field';
import { useStore } from '@/store/useStore';
import type { ExerciseLog, MuscleGroup, SetLog } from '@/store/types';
import { EXERCISES, MUSCLE_GROUPS, groupLabel, type Exercise } from '@/data/exercises';
import { searchByName } from '@/lib/text';
import { cn, parseNum } from '@/lib/utils';
import { nameError, validateNumber } from '@/lib/validation';
import { toast } from '@/components/ui/toast';

/** Valida todas as séries; retorna a primeira mensagem de erro */
export function exercisesError(list: ExerciseLog[]): string | null {
  for (const ex of list) {
    if (ex.sets.length === 0) return `Adicione pelo menos uma série em "${ex.name}"`;
    for (const [i, s] of ex.sets.entries()) {
      if (!validateNumber(s.reps, 'reps').ok) return `Repetições inválidas em "${ex.name}", série ${i + 1} (1 a 200)`;
      if (!validateNumber(s.kg, 'carga').ok) return `Carga inválida em "${ex.name}", série ${i + 1} (0 a 1000 kg)`;
      if (s.restSec !== undefined && !validateNumber(s.restSec, 'descanso').ok) return `Descanso inválido em "${ex.name}" (0 a 900 s)`;
    }
  }
  return null;
}

export function ExerciseBuilder({ value, onChange }: { value: ExerciseLog[]; onChange: (v: ExerciseLog[]) => void }) {
  const [picker, setPicker] = useState(false);

  const updateSet = (ei: number, si: number, p: Partial<SetLog>) =>
    onChange(value.map((ex, i) => (i !== ei ? ex : { ...ex, sets: ex.sets.map((s, j) => (j === si ? { ...s, ...p } : s)) })));
  const addSet = (ei: number) =>
    onChange(value.map((ex, i) => {
      if (i !== ei) return ex;
      const last = ex.sets[ex.sets.length - 1] ?? { reps: 10, kg: 0, restSec: 90 };
      return { ...ex, sets: [...ex.sets, { ...last, type: 'normal' }] };
    }));
  const removeSet = (ei: number, si: number) => onChange(value.map((ex, i) => (i !== ei ? ex : { ...ex, sets: ex.sets.filter((_, j) => j !== si) })));
  const removeEx = (ei: number) => onChange(value.filter((_, i) => i !== ei));

  return (
    <div className="space-y-3">
      {value.map((ex, ei) => (
        <div key={`${ei}-${ex.name}-${value.length}`} className="rounded-lg bg-card p-3 shadow-soft dark:border dark:border-border dark:shadow-none">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate font-semibold">{ex.name}</p>
            <Button size="icon" variant="ghost" aria-label={`Remover ${ex.name}`} onClick={() => removeEx(ei)}><X className="!size-4 text-muted-foreground" /></Button>
          </div>
          <div className="mt-1 grid grid-cols-[28px_1fr_1fr_1fr_40px] items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>#</span><span>Reps</span><span>Kg</span><span>Desc. (s)</span><span />
          </div>
          {ex.sets.map((s, si) => (
            <div key={`${si}-${ex.sets.length}`} className="mt-1.5 grid grid-cols-[28px_1fr_1fr_1fr_40px] items-center gap-1.5">
              <span className={cn('text-sm font-bold', s.type === 'aquecimento' ? 'text-food' : 'text-muted-foreground')}>{s.type === 'aquecimento' ? 'A' : si + 1}</span>
              <NumCell label={`Repetições série ${si + 1}`} value={s.reps} onChange={(v) => updateSet(ei, si, { reps: v })} />
              <NumCell label={`Carga série ${si + 1}`} value={s.kg} decimal onChange={(v) => updateSet(ei, si, { kg: v })} />
              <NumCell label={`Descanso série ${si + 1}`} value={s.restSec ?? 90} onChange={(v) => updateSet(ei, si, { restSec: v })} />
              <button className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary" aria-label={`Remover série ${si + 1}`} onClick={() => removeSet(ei, si)}>
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <Button variant="ghost" size="sm" className="mt-1 w-full text-primary" onClick={() => addSet(ei)}><Copy className="!size-4" /> Adicionar série</Button>
        </div>
      ))}
      <Button variant="secondary" className="w-full" onClick={() => setPicker(true)}><Plus /> Adicionar exercício</Button>
      <ExercisePicker open={picker} onOpenChange={setPicker} onPick={(e) => {
        onChange([...value, { exerciseId: e.id, name: e.name, sets: [{ reps: 10, kg: 0, restSec: 90 }, { reps: 10, kg: 0, restSec: 90 }, { reps: 10, kg: 0, restSec: 90 }] }]);
        setPicker(false);
      }} />
    </div>
  );
}

/** Célula numérica compacta que aceita vírgula */
function NumCell({ value, onChange, decimal, label }: { value: number; onChange: (v: number) => void; decimal?: boolean; label: string }) {
  const [text, setText] = useState(String(value).replace('.', ','));
  const n = parseNum(text);
  const invalid = Number.isNaN(n) || n < 0;
  return (
    <Input
      aria-label={label}
      aria-invalid={invalid}
      inputMode={decimal ? 'decimal' : 'numeric'}
      className="h-10 px-2 text-center text-sm tabular-nums"
      value={text}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        setText(e.target.value);
        const v = parseNum(e.target.value);
        onChange(Number.isNaN(v) ? -1 : v); // -1 marca valor inválido para a validação
      }}
    />
  );
}

/** Biblioteca de exercícios com busca por nome e filtro por grupo muscular */
export function ExercisePicker({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; onPick: (e: Exercise) => void }) {
  const s = useStore();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<MuscleGroup | 'todos'>('todos');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState<MuscleGroup>('peito');
  const [touched, setTouched] = useState(false);

  const all: Exercise[] = useMemo(() => [...s.customExercises.map((e) => ({ ...e, custom: true })), ...EXERCISES], [s.customExercises]);
  const filtered = useMemo(() => searchByName(group === 'todos' ? all : all.filter((e) => e.group === group), q, 200), [all, group, q]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Escolher exercício">
      {creating ? (
        <div className="space-y-3">
          <Field label="Nome do exercício" value={newName} onChange={(e) => setNewName(e.target.value)} error={touched ? nameError(newName) : null} autoFocus maxLength={50} />
          <p className="text-sm font-medium">Grupo muscular</p>
          <div className="flex flex-wrap gap-2">
            {MUSCLE_GROUPS.map((g) => (
              <button key={g.id} onClick={() => setNewGroup(g.id)} aria-pressed={newGroup === g.id} className={cn('min-h-[44px] rounded-full px-4 text-sm font-semibold', newGroup === g.id ? 'bg-primary text-primary-foreground' : 'bg-secondary')}>{g.label}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={() => {
              setTouched(true);
              if (nameError(newName)) return;
              const ex = s.addCustomExercise({ name: newName.trim(), group: newGroup });
              toast('Exercício criado');
              setCreating(false);
              setNewName('');
              setTouched(false);
              onPick(ex);
            }}>Criar e adicionar</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar exercício" className="pl-10" aria-label="Buscar exercício" />
          </div>
          <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 no-scrollbar">
            {[{ id: 'todos' as const, label: 'Todos' }, ...MUSCLE_GROUPS].map((g) => (
              <button key={g.id} onClick={() => setGroup(g.id)} aria-pressed={group === g.id} className={cn('min-h-[40px] shrink-0 rounded-full px-3.5 text-sm font-semibold', group === g.id ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground')}>{g.label}</button>
            ))}
          </div>
          <ul className="space-y-0.5">
            {filtered.map((e) => (
              <li key={e.id}>
                <button onClick={() => onPick(e)} className="flex min-h-[48px] w-full items-center justify-between rounded-xl px-3 text-left hover:bg-secondary">
                  <span className="text-sm font-semibold">{e.name}</span>
                  <span className="text-xs text-muted-foreground">{groupLabel(e.group)}{e.custom ? ' · meu' : ''}</span>
                </button>
              </li>
            ))}
          </ul>
          <Button variant="outline" className="w-full" onClick={() => { setCreating(true); setNewName(q); }}><Plus /> Criar exercício novo</Button>
        </div>
      )}
    </Sheet>
  );
}
