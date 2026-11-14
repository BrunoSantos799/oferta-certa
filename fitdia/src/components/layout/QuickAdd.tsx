// Menu do botão "+": adicionar refeição, treino ou água rapidamente
import { Utensils, Dumbbell, Droplets, FileUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useSheets } from './sheets';
import { useStore } from '@/store/useStore';
import { toast } from '@/components/ui/toast';
import { fmt1 } from '@/lib/utils';

export function QuickAdd() {
  const sh = useSheets();
  const options = [
    { label: 'Refeição', desc: 'Registrar alimentos', icon: Utensils, cls: 'bg-food/15 text-food', onClick: () => sh.openFood() },
    { label: 'Treino', desc: 'Atividade ou musculação', icon: Dumbbell, cls: 'bg-workout/15 text-workout', onClick: () => sh.openWorkout() },
    { label: 'Água', desc: 'Adicionar copos', icon: Droplets, cls: 'bg-water/15 text-water', onClick: () => sh.setWater(true) },
    { label: 'Hevy', desc: 'Importar treinos', icon: FileUp, cls: 'bg-primary/15 text-primary', onClick: () => sh.setHevy(true) },
  ];
  return (
    <Sheet open={sh.quick} onOpenChange={sh.setQuick} title="Adicionar">
      <div className="grid grid-cols-2 gap-3 pb-2">
        {options.map((o, i) => (
          <motion.button
            key={o.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={o.onClick}
            className="flex flex-col items-start gap-3 rounded-lg bg-card p-4 text-left shadow-soft dark:border dark:border-border dark:shadow-none"
          >
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${o.cls}`}><o.icon className="size-5" /></span>
            <span><span className="block font-bold">{o.label}</span><span className="block text-xs text-muted-foreground">{o.desc}</span></span>
          </motion.button>
        ))}
      </div>
    </Sheet>
  );
}

/** Folha rápida de água */
export function WaterSheet() {
  const sh = useSheets();
  const s = useStore();
  const ml = s.water[s.selectedDate] ?? 0;
  const add = (v: number) => {
    s.addWater(v, s.selectedDate);
    toast(`+${v} ml de água 💧`);
  };
  return (
    <Sheet open={sh.water} onOpenChange={sh.setWater} title="Água" description={`Hoje: ${fmt1(ml / 1000)} L`}>
      <div className="grid grid-cols-2 gap-2 pb-2">
        {[150, 200, 250, 300, 500, 750].map((v) => (
          <Button key={v} variant="secondary" size="lg" onClick={() => add(v)}>+{v} ml</Button>
        ))}
        <Button variant="outline" size="lg" className="col-span-2" onClick={() => { s.addWater(-s.settings.glassMl, s.selectedDate); }} disabled={ml <= 0}>
          Desfazer um copo ({s.settings.glassMl} ml)
        </Button>
      </div>
    </Sheet>
  );
}
