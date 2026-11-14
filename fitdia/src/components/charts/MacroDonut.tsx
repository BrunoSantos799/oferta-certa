import { motion } from 'framer-motion';
import { useState } from 'react';
import { fmt } from '@/lib/utils';

// Rosca com a divisão de proteína, carboidrato e gordura (em calorias)
export const MACRO_COLORS = {
  protein: 'hsl(var(--primary))',
  carbs: 'hsl(var(--food))',
  fat: 'hsl(var(--workout))',
};

export function MacroDonut({ protein, carbs, fat, size = 120 }: { protein: number; carbs: number; fat: number; size?: number }) {
  const [active, setActive] = useState<number | null>(null);
  const parts = [
    { key: 'protein', label: 'Proteína', grams: protein, kcal: protein * 4, color: MACRO_COLORS.protein },
    { key: 'carbs', label: 'Carboidrato', grams: carbs, kcal: carbs * 4, color: MACRO_COLORS.carbs },
    { key: 'fat', label: 'Gordura', grams: fat, kcal: fat * 9, color: MACRO_COLORS.fat },
  ];
  const total = parts.reduce((s, p) => s + p.kcal, 0);
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const gap = total > 0 ? 3 : 0;
  const shown = active !== null ? parts[active] : null;

  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={parts.map((p) => `${p.label} ${fmt(p.grams)} g`).join(', ')}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--secondary))" strokeWidth={stroke} />
        {total > 0 &&
          parts.map((p, i) => {
            const len = (p.kcal / total) * c;
            const dash = Math.max(0, len - gap);
            const el = (
              <motion.circle
                key={p.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={p.color}
                strokeWidth={active === i ? stroke + 4 : stroke}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
                initial={{ opacity: 0 }}
                animate={{ opacity: active === null || active === i ? 1 : 0.35 }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onClick={() => setActive(active === i ? null : i)}
                className="cursor-pointer"
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        {shown ? (
          <>
            <span className="text-lg font-bold">{fmt((shown.kcal / total) * 100)}%</span>
            <span className="text-[11px] text-muted-foreground">{shown.label}</span>
          </>
        ) : (
          <>
            <span className="text-lg font-bold">{fmt(total)}</span>
            <span className="text-[11px] text-muted-foreground">kcal</span>
          </>
        )}
      </div>
    </div>
  );
}
