import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/** Barra de progresso animada */
export function Progress({ value, className, barClassName, label }: { value: number; className?: string; barClassName?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-secondary', className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <motion.div className={cn('h-full rounded-full bg-primary', barClassName)} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} />
    </div>
  );
}

/** Controle segmentado (abas compactas) */
export function Segmented<T extends string>({ value, onChange, options, className, ariaLabel }: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn('flex gap-1 rounded-xl bg-secondary p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'relative min-h-[40px] flex-1 rounded-lg px-2 text-sm font-semibold transition-colors',
            value === o.value ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {value === o.value && <motion.span layoutId={'seg-' + ariaLabel} className="absolute inset-0 rounded-lg bg-card shadow-sm" transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold', className)} {...props} />;
}

/** Interruptor liga/desliga acessível */
export function Switch({ checked, onCheckedChange, label }: { checked: boolean; onCheckedChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className={cn('relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors', checked ? 'bg-primary' : 'bg-input')}
    >
      <motion.span layout className={cn('mx-1 h-5 w-5 rounded-full bg-white shadow', checked && 'ml-6')} transition={{ type: 'spring', duration: 0.25 }} />
    </button>
  );
}

/** Botão de opção grande (cartão clicável) */
export function OptionCard({ selected, onClick, icon, title, description, className }: {
  selected: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border-2 bg-card p-4 text-left transition-all active:scale-[0.98]',
        selected ? 'border-primary bg-primary/5 shadow-sm' : 'border-transparent shadow-soft dark:shadow-none dark:border-border',
        className,
      )}
    >
      {icon && (
        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors [&_svg]:size-5', selected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground')}>
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        {description && <span className="block text-sm text-muted-foreground">{description}</span>}
      </span>
    </button>
  );
}

/** Seletor numérico com botões − e + */
export function Stepper({ value, onChange, min, max, step = 1, suffix, label }: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  label: string;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(v / step) * step));
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-card p-2 shadow-soft dark:shadow-none dark:border dark:border-border" role="group" aria-label={label}>
      <button type="button" className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-xl font-bold disabled:opacity-40" onClick={() => onChange(clamp(value - step))} disabled={value <= min} aria-label={`Diminuir ${label}`}>−</button>
      <div className="text-center" aria-live="polite">
        <span className="text-2xl font-bold tabular-nums">{String(value).replace('.', ',')}</span>
        {suffix && <span className="ml-1 text-sm text-muted-foreground">{suffix}</span>}
      </div>
      <button type="button" className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-xl font-bold disabled:opacity-40" onClick={() => onChange(clamp(value + step))} disabled={value >= max} aria-label={`Aumentar ${label}`}>+</button>
    </div>
  );
}
