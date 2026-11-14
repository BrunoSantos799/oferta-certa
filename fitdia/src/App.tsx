import { useEffect } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { useStore } from '@/store/useStore';
import { Onboarding } from '@/features/onboarding/Onboarding';
import { TodayPage } from '@/features/today/TodayPage';
import { FoodPage } from '@/features/food/FoodPage';
import { WorkoutsPage } from '@/features/workouts/WorkoutsPage';
import { HistoryPage } from '@/features/history/HistoryPage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { AddFoodSheet } from '@/features/food/AddFoodSheet';
import { AddWorkoutSheet } from '@/features/workouts/AddWorkoutSheet';
import { HevyImportSheet } from '@/features/workouts/HevyImportSheet';
import { BottomNav } from '@/components/layout/BottomNav';
import { QuickAdd, WaterSheet } from '@/components/layout/QuickAdd';
import { Toaster } from '@/components/ui/toast';
import type { TabId } from '@/store/types';

const PAGES: Record<TabId, () => JSX.Element | null> = {
  hoje: TodayPage,
  alimentacao: FoodPage,
  treinos: WorkoutsPage,
  historico: HistoryPage,
  perfil: ProfilePage,
};

/** Aplica o tema (sistema, claro ou escuro) e acompanha a preferência do sistema */
function useTheme() {
  const theme = useStore((s) => s.settings.theme);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0F1115' : '#F7F8FA');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

export default function App() {
  useTheme();
  const hasProfile = useStore((s) => !!s.profile);
  const redoing = useStore((s) => s.redoingQuestionnaire);
  const tab = useStore((s) => s.tab);
  const Page = PAGES[tab];

  return (
    <MotionConfig reducedMotion="user">
      <Toaster />
      {!hasProfile || redoing ? (
        <Onboarding key={redoing ? 'redo' : 'first'} />
      ) : (
        <>
          <main className="mx-auto max-w-lg px-4 pb-28 pt-safe">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                <Page />
              </motion.div>
            </AnimatePresence>
          </main>
          <BottomNav />
          <QuickAdd />
          <AddFoodSheet />
          <AddWorkoutSheet />
          <HevyImportSheet />
          <WaterSheet />
        </>
      )}
    </MotionConfig>
  );
}
