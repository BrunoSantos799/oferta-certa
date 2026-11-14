// Histórico e relatórios: calorias consumidas × gastas, peso, sequência de treinos e backup
import { useMemo, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, ReferenceLine } from 'recharts';
import { Download, Upload, Flame, CalendarDays, Scale, TrendingDown, TrendingUp } from 'lucide-react';
import { useStore, pickData } from '@/store/useStore';
import { computeDay, trainingStreak, useEnergyModel } from '@/store/selectors';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/misc';
import { Sheet } from '@/components/ui/sheet';
import { EmptyState, PageHeader } from '@/components/layout/common';
import { addDays, dateRange, fromISODate, shortDate, today } from '@/lib/date';
import { fmt, fmt1 } from '@/lib/utils';
import { buildBackup, downloadFile, parseBackup } from '@/lib/backup';
import type { AppData } from '@/store/useStore';
import { toast } from '@/components/ui/toast';

const tooltipStyle = { background: 'hsl(var(--card))', border: 'none', borderRadius: 12, boxShadow: '0 4px 16px rgb(0 0 0 / .12)', fontSize: 12 };
const tick = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };

export function HistoryPage() {
  const s = useStore();
  const model = useEnergyModel();
  const [range, setRange] = useState<'semana' | 'mes'>('semana');

  const days = range === 'semana' ? 7 : 30;
  const end = today();
  const start = addDays(end, -(days - 1));

  // Calorias consumidas × gastas por dia
  const series = useMemo(() => {
    if (!model) return [];
    return dateRange(start, end).map((d) => {
      const day = computeDay(s, d, model);
      return {
        date: d,
        label: range === 'semana' ? fromISODate(d).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '') : shortDate(d),
        consumido: Math.round(day.consumed.kcal),
        gasto: Math.round(day.energy.total),
        logged: day.entries.length > 0,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, s.foodLog, s.workouts, start, end, range]);

  const logged = series.filter((d) => d.logged);
  const avgConsumed = logged.length ? logged.reduce((a, d) => a + d.consumido, 0) / logged.length : 0;
  const avgBalance = logged.length ? logged.reduce((a, d) => a + d.consumido - d.gasto, 0) / logged.length : 0;

  const streak = trainingStreak(s.workouts);
  const weekStart = addDays(end, -((fromISODate(end).getDay() + 6) % 7));
  const weekCount = s.workouts.filter((w) => w.date >= weekStart && w.date <= end).length;
  const periodCount = s.workouts.filter((w) => w.date >= start && w.date <= end).length;

  const weightData = s.weights.map((w) => ({ label: shortDate(w.date), kg: w.kg }));
  const weightDelta = s.weights.length > 1 ? s.weights[s.weights.length - 1].kg - s.weights[0].kg : 0;

  return (
    <div className="space-y-3">
      <PageHeader title="Histórico" />
      <Segmented ariaLabel="periodo" value={range} onChange={setRange} options={[{ value: 'semana', label: 'Semana' }, { value: 'mes', label: 'Mês' }]} />

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3">
          <Flame className="size-5 text-food" />
          <p className="mt-1 text-2xl font-extrabold tabular-nums">{streak}</p>
          <p className="text-[11px] font-medium text-muted-foreground">dias seguidos de treino</p>
        </Card>
        <Card className="p-3">
          <CalendarDays className="size-5 text-workout" />
          <p className="mt-1 text-2xl font-extrabold tabular-nums">{weekCount}</p>
          <p className="text-[11px] font-medium text-muted-foreground">treinos nesta semana</p>
        </Card>
        <Card className="p-3">
          {avgBalance <= 0 ? <TrendingDown className="size-5 text-primary" /> : <TrendingUp className="size-5 text-food" />}
          <p className="mt-1 text-2xl font-extrabold tabular-nums">{logged.length ? fmt(Math.abs(avgBalance)) : '—'}</p>
          <p className="text-[11px] font-medium text-muted-foreground">{avgBalance <= 0 ? 'déficit médio/dia' : 'superávit médio/dia'}</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="font-bold">Consumidas × gastas</p>
            <p className="text-xs text-muted-foreground">{logged.length} {logged.length === 1 ? 'dia registrado' : 'dias registrados'} · média {fmt(avgConsumed)} kcal · {periodCount} treinos</p>
          </div>
        </div>
        {logged.length === 0 ? (
          <EmptyState illustration="chart" title="Ainda sem dados" text="Registre suas refeições por alguns dias e veja seu progresso ganhar forma." />
        ) : (
          <>
            <div className="mt-3 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 8, right: 0, left: -14, bottom: 0 }} barGap={2}>
                  <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} interval={range === 'mes' ? 4 : 0} />
                  <YAxis tick={tick} axisLine={false} tickLine={false} width={44} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'hsl(var(--secondary))', radius: 8 }} formatter={(v: number, n: string) => [`${fmt(v)} kcal`, n === 'consumido' ? 'Consumidas' : 'Gasto total']} />
                  {model && <ReferenceLine y={model.goalTarget} stroke="hsl(var(--primary))" strokeDasharray="4 4" strokeOpacity={0.7} />}
                  <Bar dataKey="consumido" fill="hsl(var(--food))" radius={[6, 6, 2, 2]} maxBarSize={18} />
                  <Bar dataKey="gasto" fill="hsl(var(--workout))" radius={[6, 6, 2, 2]} maxBarSize={18} fillOpacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex justify-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-food" />Consumidas</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-workout" />Gasto total</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-primary" />Meta</span>
            </div>
          </>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-bold">Evolução do peso</p>
            <p className="text-xs text-muted-foreground">{s.weights.length} {s.weights.length === 1 ? 'pesagem' : 'pesagens'}</p>
          </div>
          {s.weights.length > 1 && (
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${weightDelta <= 0 ? 'bg-primary/10 text-primary' : 'bg-food/10 text-food'}`}>
              {weightDelta > 0 ? '+' : ''}{fmt1(weightDelta)} kg
            </span>
          )}
        </div>
        {weightData.length > 1 ? (
          <div className="mt-3 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} />
                <YAxis tick={tick} axisLine={false} tickLine={false} domain={['dataMin - 1', 'dataMax + 1']} width={44} tickFormatter={(v: number) => fmt1(v)} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${fmt1(v)} kg`, 'Peso']} />
                {s.profile?.targetWeightKg && <ReferenceLine y={s.profile.targetWeightKg} stroke="hsl(var(--primary))" strokeDasharray="4 4" />}
                <Line type="monotone" dataKey="kg" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 3, fill: 'hsl(var(--primary))', strokeWidth: 0 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Scale className="size-4" /> Atualize seu peso no Perfil para ver a evolução.</p>
        )}
      </Card>

      <BackupCard />
    </div>
  );
}

/** Exportar e importar dados em JSON */
export function BackupCard() {
  const s = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card className="p-4">
      <p className="font-bold">Backup dos dados</p>
      <p className="text-xs text-muted-foreground">Seus dados ficam só neste aparelho. Exporte um arquivo para guardar ou levar para outro celular.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => {
          downloadFile(`fitdia-backup-${today()}.json`, buildBackup(pickData(s)));
          toast('Backup exportado');
        }}><Download /> Exportar</Button>
        <Button variant="secondary" onClick={() => fileRef.current?.click()}><Upload /> Importar</Button>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        try {
          setError(null);
          setPending(parseBackup(await f.text()));
        } catch (err) {
          setError((err as Error).message);
        }
      }} />
      {error && <p className="mt-2 text-sm font-medium text-destructive" role="alert">{error}</p>}
      <Sheet open={!!pending} onOpenChange={(o) => !o && setPending(null)} title="Substituir dados?" description="Os dados atuais deste aparelho serão substituídos pelos do backup.">
        {pending && (
          <div className="space-y-3">
            <ul className="text-sm text-muted-foreground">
              <li>• {pending.foodLog.length} registros de alimentação</li>
              <li>• {pending.workouts.length} treinos</li>
              <li>• {pending.weights.length} pesagens</li>
              <li>• Perfil: {pending.profile?.name ?? 'não informado'}</li>
            </ul>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPending(null)}>Cancelar</Button>
              <Button variant="destructive" className="flex-1" onClick={() => { s.importData(pending); setPending(null); toast('Dados importados'); }}>Substituir</Button>
            </div>
          </div>
        )}
      </Sheet>
    </Card>
  );
}
