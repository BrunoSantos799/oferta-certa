import { ChevronLeft, ChevronRight, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '@/store/useStore';
import { addDays, friendlyDate, today } from '@/lib/date';
import { Button } from '@/components/ui/button';

/** Cabeçalho das telas */
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 pb-4 pt-6">
      <div>
        {subtitle && <p className="text-sm font-medium text-muted-foreground">{subtitle}</p>}
        <h1 className="text-[26px] font-extrabold leading-tight tracking-tight">{title}</h1>
      </div>
      {action}
    </header>
  );
}

/** Navegação entre dias (ver ou corrigir registros passados) */
export function DayNavigator() {
  const date = useStore((s) => s.selectedDate);
  const setDate = useStore((s) => s.setDate);
  const isToday = date === today();
  return (
    <div className="flex items-center justify-between rounded-xl bg-card p-1 shadow-soft dark:shadow-none">
      <Button variant="ghost" size="icon" onClick={() => setDate(addDays(date, -1))} aria-label="Dia anterior">
        <ChevronLeft />
      </Button>
      <div className="flex flex-col items-center">
        <span className="text-sm font-bold first-letter:uppercase">{friendlyDate(date)}</span>
        {!isToday && (
          <button className="text-xs font-semibold text-primary" onClick={() => setDate(today())}>Voltar para hoje</button>
        )}
      </div>
      <Button variant="ghost" size="icon" onClick={() => setDate(addDays(date, 1))} disabled={isToday} aria-label="Próximo dia">
        <ChevronRight />
      </Button>
    </div>
  );
}

/** Aviso de que os valores são estimativas */
export function Disclaimer() {
  return (
    <p className="flex gap-2 rounded-xl bg-secondary/70 p-3 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0" />
      Os valores do FitDia são estimativas e não substituem a orientação de um nutricionista ou médico.
    </p>
  );
}

/** Estado vazio com ilustração leve e frase motivadora */
export function EmptyState({ title, text, action, illustration = 'plate' }: { title: string; text: string; action?: ReactNode; illustration?: 'plate' | 'dumbbell' | 'chart' }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center px-6 py-8 text-center">
      <Illustration kind={illustration} />
      <h3 className="mt-4 font-bold">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  );
}

function Illustration({ kind }: { kind: 'plate' | 'dumbbell' | 'chart' }) {
  return (
    <svg width="112" height="88" viewBox="0 0 112 88" aria-hidden className="text-primary">
      <ellipse cx="56" cy="80" rx="40" ry="5" fill="currentColor" opacity=".1" />
      {kind === 'plate' && (
        <>
          <circle cx="56" cy="42" r="32" fill="hsl(var(--card))" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
          <circle cx="56" cy="42" r="20" fill="currentColor" opacity=".12" />
          <circle cx="48" cy="38" r="6" fill="hsl(var(--food))" opacity=".8" />
          <circle cx="62" cy="47" r="5" fill="currentColor" opacity=".7" />
          <rect x="14" y="16" width="4" height="44" rx="2" fill="currentColor" opacity=".35" />
          <rect x="94" y="16" width="4" height="44" rx="2" fill="currentColor" opacity=".35" />
        </>
      )}
      {kind === 'dumbbell' && (
        <>
          <rect x="30" y="38" width="52" height="8" rx="4" fill="currentColor" opacity=".35" />
          <rect x="20" y="24" width="14" height="36" rx="5" fill="hsl(var(--workout))" opacity=".85" />
          <rect x="78" y="24" width="14" height="36" rx="5" fill="hsl(var(--workout))" opacity=".85" />
          <circle cx="88" cy="14" r="4" fill="currentColor" opacity=".5" />
          <circle cx="22" cy="12" r="3" fill="hsl(var(--food))" opacity=".6" />
        </>
      )}
      {kind === 'chart' && (
        <>
          <rect x="22" y="48" width="12" height="24" rx="4" fill="currentColor" opacity=".3" />
          <rect x="42" y="34" width="12" height="38" rx="4" fill="currentColor" opacity=".5" />
          <rect x="62" y="22" width="12" height="50" rx="4" fill="currentColor" opacity=".75" />
          <rect x="82" y="12" width="12" height="60" rx="4" fill="hsl(var(--water))" opacity=".7" />
        </>
      )}
    </svg>
  );
}

/** Pequeno rótulo + valor grande usado nos cartões */
export function Stat({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
      <p className="truncate text-lg font-bold tabular-nums" style={color ? { color } : undefined}>
        {value}
        {unit && <span className="ml-0.5 text-xs font-semibold text-muted-foreground">{unit}</span>}
      </p>
    </div>
  );
}
