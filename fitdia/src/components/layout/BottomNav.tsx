import { Home, Utensils, Dumbbell, BarChart3, User, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useStore } from '@/store/useStore';
import type { TabId } from '@/store/types';
import { cn } from '@/lib/utils';
import { useSheets } from './sheets';

const TABS: Array<{ id: TabId; label: string; icon: typeof Home }> = [
  { id: 'hoje', label: 'Hoje', icon: Home },
  { id: 'alimentacao', label: 'Alimentação', icon: Utensils },
  { id: 'treinos', label: 'Treinos', icon: Dumbbell },
  { id: 'historico', label: 'Histórico', icon: BarChart3 },
  { id: 'perfil', label: 'Perfil', icon: User },
];

// Barra inferior fixa com botão central "+" em destaque
export function BottomNav() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const setQuick = useSheets((s) => s.setQuick);

  const item = (t: (typeof TABS)[number]) => {
    const active = tab === t.id;
    const Icon = t.icon;
    return (
      <button
        key={t.id}
        onClick={() => {
          setTab(t.id);
          window.scrollTo({ top: 0 });
        }}
        aria-current={active ? 'page' : undefined}
        className={cn('relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold transition-colors', active ? 'text-primary' : 'text-muted-foreground')}
      >
        <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 2} />
        <span className="max-w-full truncate px-0.5">{t.label}</span>
        {active && <motion.span layoutId="nav-dot" className="absolute top-1 h-1 w-1 rounded-full bg-primary" />}
      </button>
    );
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-card/90 pb-safe backdrop-blur-xl" aria-label="Navegação principal">
      <div className="mx-auto flex max-w-lg items-center px-1">
        {TABS.slice(0, 2).map(item)}
        <div className="flex flex-1 justify-center">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setQuick(true)}
            className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lift"
            aria-label="Adicionar refeição, treino ou água"
          >
            <Plus className="size-7" strokeWidth={2.6} />
          </motion.button>
        </div>
        {TABS.slice(2).map(item)}
      </div>
    </nav>
  );
}
