// Importação de treinos do Hevy (arquivo CSV ou texto compartilhado)
import { useRef, useState } from 'react';
import { FileUp, ClipboardPaste, Check, Info } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Segmented } from '@/components/ui/misc';
import { useSheets } from '@/components/layout/sheets';
import { useStore } from '@/store/useStore';
import { weightOn } from '@/store/selectors';
import { parseHevyCsv, parseHevyText, type ParsedWorkout } from '@/lib/hevy';
import { strengthCalories, summarizeExercises } from '@/lib/calc/strength';
import { EXERCISES } from '@/data/exercises';
import { normalize } from '@/lib/text';
import { fmt } from '@/lib/utils';
import { shortDate } from '@/lib/date';
import { toast } from '@/components/ui/toast';

export function HevyImportSheet() {
  const { hevy: open, setHevy } = useSheets();
  const s = useStore();
  const [mode, setMode] = useState<'csv' | 'texto'>('csv');
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedWorkout[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => { setParsed(null); setError(null); setText(''); };

  // Evita duplicar treinos já importados (mesma data e nome)
  const isDuplicate = (w: ParsedWorkout) => s.workouts.some((x) => x.source === 'hevy' && x.date === w.date && x.name === w.title);

  const handleFile = async (file: File) => {
    setError(null);
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('Arquivo muito grande (máximo 20 MB).');
      setParsed(parseHevyCsv(await file.text()));
    } catch (e) {
      setParsed(null);
      setError((e as Error).message);
    }
  };

  const handleText = () => {
    setError(null);
    try {
      setParsed([parseHevyText(text, s.selectedDate)]);
    } catch (e) {
      setParsed(null);
      setError((e as Error).message);
    }
  };

  /** Liga o nome do exercício do Hevy (em inglês) à biblioteca quando o nome bate */
  const matchExercise = (name: string) => EXERCISES.find((e) => normalize(e.name) === normalize(name))?.id;

  const toImport = (parsed ?? []).filter((w) => !isDuplicate(w));

  const doImport = () => {
    const list = toImport.map((w) => {
      const weight = weightOn(s.weights, w.date);
      const r = strengthCalories(w.exercises, w.durationMin, weight);
      return {
        date: w.date,
        activityId: 'musculacao',
        name: w.title,
        durationMin: r.durationMin,
        intensity: r.intensity,
        kcal: r.kcal,
        exercises: w.exercises.map((e) => ({ ...e, exerciseId: matchExercise(e.name) })),
        source: 'hevy' as const,
      };
    });
    s.addWorkouts(list);
    toast(`${list.length} ${list.length === 1 ? 'treino importado' : 'treinos importados'} do Hevy`);
    reset();
    setHevy(false);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { setHevy(o); if (!o) reset(); }} title="Importar do Hevy" description="As calorias são calculadas com o seu peso e o volume de cada treino.">
      <div className="space-y-4">
        <Segmented ariaLabel="hevy-mode" value={mode} onChange={(m) => { setMode(m); reset(); }} options={[{ value: 'csv', label: 'Arquivo CSV' }, { value: 'texto', label: 'Colar texto' }]} />

        {mode === 'csv' ? (
          <>
            <ol className="space-y-1.5 rounded-lg bg-secondary/60 p-3 text-sm text-muted-foreground">
              <li>1. No Hevy, abra <b className="text-foreground">Perfil → Configurações</b>.</li>
              <li>2. Toque em <b className="text-foreground">Exportar e importar dados → Exportar treinos</b>.</li>
              <li>3. Salve o arquivo <b className="text-foreground">.csv</b> e selecione abaixo.</li>
            </ol>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
            <Button variant="outline" size="lg" className="w-full border-dashed" onClick={() => fileRef.current?.click()}><FileUp /> Selecionar arquivo CSV</Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">No Hevy, abra o treino, toque em <b className="text-foreground">Compartilhar → Copiar texto</b> e cole aqui.</p>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={'Treino A\n\nSupino reto (Barra)\nSet 1: 60 kg x 10\nSet 2: 60 kg x 8'} aria-label="Texto do treino do Hevy" />
            <Button className="w-full" variant="secondary" onClick={handleText} disabled={!text.trim()}><ClipboardPaste /> Interpretar texto</Button>
          </>
        )}

        {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive" role="alert">{error}</p>}

        {parsed && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">{parsed.length} {parsed.length === 1 ? 'treino encontrado' : 'treinos encontrados'}</p>
            <ul className="max-h-72 space-y-1.5 overflow-y-auto">
              {parsed.map((w, i) => {
                const dup = isDuplicate(w);
                const r = strengthCalories(w.exercises, w.durationMin, weightOn(s.weights, w.date));
                const sum = summarizeExercises(w.exercises);
                return (
                  <li key={i} className={`flex items-center justify-between gap-2 rounded-xl bg-card p-3 shadow-soft dark:shadow-none ${dup ? 'opacity-50' : ''}`}>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{w.title}</span>
                      <span className="block text-xs text-muted-foreground">{shortDate(w.date)} · {w.exercises.length} {w.exercises.length === 1 ? 'exercício' : 'exercícios'} · {sum.sets} séries · {r.durationMin} min{dup ? ' · já importado' : ''}</span>
                    </span>
                    <span className="shrink-0 text-sm font-bold text-workout tabular-nums">{fmt(r.kcal)} kcal</span>
                  </li>
                );
              })}
            </ul>
            {mode === 'texto' && !parsed[0]?.durationMin && (
              <p className="flex gap-2 text-xs text-muted-foreground"><Info className="size-4 shrink-0" /> A duração foi estimada pelo número de séries. Depois você pode editar o treino.</p>
            )}
            <Button size="lg" className="w-full" onClick={doImport} disabled={toImport.length === 0}>
              <Check /> {toImport.length === 0 ? 'Nada novo para importar' : `Importar ${toImport.length} ${toImport.length === 1 ? 'treino' : 'treinos'}`}
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
