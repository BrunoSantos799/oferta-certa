// Tela de alimentação: refeições do dia, favoritas e alimentos personalizados
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Star, Trash2, ChevronRight } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { MEALS, entryAmountLabel, entryNutrients, useDaySummary } from '@/store/selectors';
import type { MealId } from '@/store/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/misc';
import { Sheet } from '@/components/ui/sheet';
import { Field } from '@/components/ui/field';
import { DayNavigator, EmptyState, PageHeader } from '@/components/layout/common';
import { useSheets } from '@/components/layout/sheets';
import { fmt, fmt1 } from '@/lib/utils';
import { nameError } from '@/lib/validation';
import { toast } from '@/components/ui/toast';

export function FoodPage() {
  const s = useStore();
  const day = useDaySummary(s.selectedDate);
  const openFood = useSheets((x) => x.openFood);
  const [favMeal, setFavMeal] = useState<MealId | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  if (!day) return null;

  return (
    <div className="space-y-3">
      <PageHeader title="Alimentação" action={<Button size="icon" onClick={() => openFood()} aria-label="Adicionar alimento"><Plus /></Button>} />
      <DayNavigator />

      <Card className="p-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Consumido no dia</p>
            <p className="text-3xl font-extrabold tabular-nums">{fmt(day.consumed.kcal)} <span className="text-sm font-semibold text-muted-foreground">/ {fmt(day.goal + day.workoutKcal)} kcal</span></p>
          </div>
          <p className="text-sm font-semibold text-muted-foreground">{fmt(Math.min(999, (day.consumed.kcal / Math.max(1, day.goal + day.workoutKcal)) * 100))}%</p>
        </div>
        <Progress className="mt-3 h-2.5" value={(day.consumed.kcal / Math.max(1, day.goal + day.workoutKcal)) * 100} barClassName="bg-food" label="Progresso da meta de calorias" />
        <div className="mt-3 flex justify-between text-xs text-muted-foreground">
          <span>Proteína <b className="text-foreground">{fmt(day.consumed.protein)} g</b></span>
          <span>Carbo <b className="text-foreground">{fmt(day.consumed.carbs)} g</b></span>
          <span>Gordura <b className="text-foreground">{fmt(day.consumed.fat)} g</b></span>
        </div>
      </Card>

      {day.entries.length === 0 && (
        <Card>
          <EmptyState title="Seu prato está vazio" text="Registrar o que você come é o primeiro passo para entender seu corpo." action={<Button onClick={() => openFood()}><Plus /> Registrar refeição</Button>} />
        </Card>
      )}

      {MEALS.map((m) => {
        const entries = day.entries.filter((e) => e.meal === m.id);
        const totals = entries.reduce((acc, e) => {
          const n = entryNutrients(e);
          return { kcal: acc.kcal + n.kcal, protein: acc.protein + n.protein };
        }, { kcal: 0, protein: 0 });
        return (
          <Card key={m.id} className="overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 pt-3">
              <div>
                <p className="font-bold">{m.label}</p>
                <p className="text-xs text-muted-foreground">{entries.length ? `${fmt(totals.kcal)} kcal · ${fmt(totals.protein)} g proteína` : 'Nada registrado'}</p>
              </div>
              <div className="flex">
                {entries.length > 0 && (
                  <Button size="icon" variant="ghost" aria-label={`Salvar ${m.label} como favorita`} onClick={() => setFavMeal(m.id)}><Star className="text-food" /></Button>
                )}
                <Button size="icon" variant="ghost" aria-label={`Adicionar em ${m.label}`} onClick={() => openFood(m.id)}><Plus className="text-primary" /></Button>
              </div>
            </div>
            <ul className="px-2 pb-2">
              <AnimatePresence initial={false}>
                {entries.map((e) => {
                  const n = entryNutrients(e);
                  return (
                    <motion.li key={e.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center">
                      <button className="flex min-h-[52px] flex-1 items-center justify-between gap-2 rounded-xl px-2 text-left hover:bg-secondary" onClick={() => openFood(m.id, e.id)}>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{e.food.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {entryAmountLabel(e)}
                          </span>
                        </span>
                        <span className="flex items-center gap-1 text-sm font-bold tabular-nums">{fmt(n.kcal)}<ChevronRight className="size-4 text-muted-foreground" /></span>
                      </button>
                      <Button size="icon" variant="ghost" aria-label={`Excluir ${e.food.name}`} onClick={() => { s.removeFoodEntry(e.id); toast('Alimento removido'); }}>
                        <Trash2 className="!size-4 text-muted-foreground" />
                      </Button>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </Card>
        );
      })}

      <Button variant="outline" className="w-full" onClick={() => setShowCustom(true)}>Meus alimentos personalizados ({s.customFoods.length})</Button>

      <SaveFavoriteSheet meal={favMeal} onClose={() => setFavMeal(null)} />
      <CustomFoodsSheet open={showCustom} onOpenChange={setShowCustom} />
    </div>
  );
}

function SaveFavoriteSheet({ meal, onClose }: { meal: MealId | null; onClose: () => void }) {
  const s = useStore();
  const label = MEALS.find((m) => m.id === meal)?.label ?? '';
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const err = nameError(name);
  const entries = s.foodLog.filter((e) => e.date === s.selectedDate && e.meal === meal);
  return (
    <Sheet open={meal !== null} onOpenChange={(o) => { if (!o) { onClose(); setName(''); setTouched(false); } }} title="Salvar como favorita" description={`${entries.length} itens do ${label.toLowerCase()}`}>
      <div className="space-y-3">
        <Field label="Nome da refeição" placeholder="Ex.: Café de sempre" value={name} onChange={(e) => setName(e.target.value)} error={touched ? err : null} autoFocus maxLength={40} />
        <ul className="text-sm text-muted-foreground">{entries.map((e) => <li key={e.id}>• {e.food.name} ({entryAmountLabel(e)})</li>)}</ul>
        <Button size="lg" className="w-full" onClick={() => {
          setTouched(true);
          if (err) return;
          s.saveFavorite(name.trim(), entries.map(({ id: _i, date: _d, meal: _m, ...rest }) => rest));
          toast('Refeição favorita salva ⭐');
          onClose();
          setName('');
          setTouched(false);
        }}>Salvar favorita</Button>
      </div>
    </Sheet>
  );
}

function CustomFoodsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const s = useStore();
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Meus alimentos" description="Para criar um novo, use o botão + e a aba Criar.">
      {s.customFoods.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Você ainda não cadastrou alimentos.</p>
      ) : (
        <ul className="space-y-1">
          {s.customFoods.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 rounded-xl px-2 py-1 hover:bg-secondary">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{f.name}</span>
                <span className="text-xs text-muted-foreground">{fmt(f.kcal)} kcal · P {fmt1(f.protein)} C {fmt1(f.carbs)} G {fmt1(f.fat)} /100 g</span>
              </span>
              <Button size="icon" variant="ghost" aria-label={`Excluir ${f.name}`} onClick={() => { s.removeCustomFood(f.id); toast('Alimento excluído'); }}><Trash2 className="!size-4 text-muted-foreground" /></Button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
