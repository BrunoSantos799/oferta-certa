import { create } from 'zustand';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle } from 'lucide-react';

// Pequeno feedback visual ao concluir um registro
interface ToastState {
  message: string | null;
  kind: 'success' | 'error';
  key: number;
  show: (message: string, kind?: 'success' | 'error') => void;
}

export const useToast = create<ToastState>((set) => ({
  message: null,
  kind: 'success',
  key: 0,
  show: (message, kind = 'success') => {
    const key = Date.now();
    set({ message, kind, key });
    setTimeout(() => set((s) => (s.key === key ? { message: null } : {})), 2400);
  },
}));

export const toast = (m: string, kind?: 'success' | 'error') => useToast.getState().show(m, kind);

export function Toaster() {
  const { message, kind, key } = useToast();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-4 pt-safe" aria-live="polite">
      <AnimatePresence>
        {message && (
          <motion.div
            key={key}
            initial={{ y: -30, opacity: 0, scale: 0.95 }}
            animate={{ y: 12, opacity: 1, scale: 1 }}
            exit={{ y: -30, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.3 }}
            className="flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background shadow-lg"
          >
            {kind === 'success' ? <CheckCircle2 className="size-5 text-primary" /> : <AlertCircle className="size-5 text-destructive" />}
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
