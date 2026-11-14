// Folha para adicionar ou editar alimentos de uma refeição
import { useEffect, useMemo, useState } from 'react';
import { Search, ChevronLeft, Star, Plus, Trash2 } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Segmented } from '@/components/ui/misc';
import { useSheets } from '@/components/layout/sheets';
import { useStore } from '@/store/useStore';
import { MEALS } from '@/store/selectors';
import type { Food, MealId } from '@/store/types';
import { FOODS, nutrientsFor } from '@/data/foods';
import { searchByName } from '@/lib/text';
import { macrosError, nameError, numberError } from '@/lib/validation';
import { cn, fmt, fmt1, parseNum } from '@/lib/utils';
import { toast } from '@/components/ui/toast';

type View = 'buscar' | 'favoritas' | 'criar';

export function AddFoodSheet() {
  const { food: state, setFood } = useSheets();
  const s = useStore();
  const editing = state.editId ? s.foodLog.find((e) => e.id === state.editId) : undefined;

  const [view, setView] = useState<View>('buscar');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Food | null>(null);
  const [meal, setMeal] = useState<MealId>(state.meal);

  // Reinicia ao abrir
  useEffect(() => {
    if (!state.open) return;
    setMeal(editing?.meal ?? state.meal);
    setQuery('');
    setView('buscar');
    if (editing) {
      const base = s.customFoods.find((f) => f.id === editing.foodId) ?? FOODS.find((f) => f.id === editing.foodId);
      setSelected(base ?? { id: editing.foodId, ...editing.food, category: '', portions: [] });
    } else setSelected(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.open, state.editId]);

  const allFoods = useMemo(() => [...s.customFoods, ...FOODS], [s.customFoods]);
  const results = useMemo(() => searchByName(allFoods, query, 40), [allFoods, query]);

  // Alimentos usados recentemente aparecem primeiro quando a busca está vazia
  const recent = useMemo(() => {
    const seen = new Set<string>();
    const out: Food[] = [];
    for (let i = s.foodLog.length - 1; i >= 0 && out.length < 8; i--) {
      const id = s.foodLog[i].foodId;
      if (seen.has(id)) continue;
      seen.add(id);
      const f = allFoods.find((x) => x.id === id);
      if (f) out.push(f);
    }
    return out;
  }, [s.foodLog, allFoods]);

  const title = editing ? 'Editar alimento' : selected ? selected.name : 'Adicionar alimento';

  return (
    <Sheet open={state.open} onOpenChange={setFood} title={title} description={selected ? undefined : MEALS.find((m) => m.id === meal)?.label}>
      {selected ? (
        <QuantityForm
          key={selected.id + (editing?.id ?? '')}
          food={selected}
          meal={meal}
          setMeal={setMeal}
          initialGrams={editing?.grams}
          initialPortion={editing?.portionLabel}
          initialQty={editing?.portionQty}
          onBack={editing ? undefined : () => setSelected(null)}
          onSave={(grams, portionLabel, portionQty) => {
            const data = { meal, foodId: selected.id, food: { name: selected.name, kcal: selected.kcal, protein: selected.protein, carbs: selected.carbs, fat: selected.fat }, grams, portionLabel, portionQty };
            if (editing) {
              s.updateFoodEntry(editing.id, data);
              toast('Alimento atualizado');
            } else {
              s.addFoodEntry({ ...data, date: s.selectedDate });
              toast(`${selected.name} adicionado`);
            }
            setFood(false);
          }}
          onDelete={editing ? () => { s.removeFoodEntry(editing.id); toast('Alimento removido'); setFood(false); } : undefined}
        />
      ) : (
        <div className="space-y-4">
          <Segmented ariaLabel="food-view" value={view} onChange={setView} options={[{ value: 'buscar', label: 'Buscar' }, { value: 'favoritas', label: 'Favoritas' }, { value: 'criar', label: 'Criar' }]} />

          {view === 'buscar' && (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar: arroz, feijão, açaí..." className="pl-10" aria-label="Buscar alimento" role="combobox" aria-expanded="true" aria-controls="food-results" />
              </div>
              {!query && recent.length > 0 && <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recentes</p>}
              <ul id="food-results" role="listbox" className="space-y-1">
                {(query ? results : recent.length ? recent : results).map((f) => (
                  <li key={f.id}>
                    <button role="option" aria-selected="false" onClick={() => setSelected(f)} className="flex min-h-[52px] w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-secondary">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{f.name}{f.custom && <span className="ml-1.5 rounded bg-primary/10 px-1.5 text-[10px] font-bold text-primary">MEU</span>}</span>
                        <span className="block text-xs text-muted-foreground">P {fmt1(f.protein)} · C {fmt1(f.carbs)} · G {fmt1(f.fat)} por 100 g</span>
                      </span>
                      <span className="shrink-0 text-sm font-bold tabular-nums">{fmt(f.kcal)}<span className="text-xs font-medium text-muted-foreground"> kcal</span></span>
                    </button>
                  </li>
                ))}
              </ul>
              {query && results.length === 0 && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Nada encontrado para “{query}”.
                  <Button variant="link" onClick={() => setView('criar')}>Cadastrar este alimento</Button>
                </div>
              )}
            </>
          )}

          {view === 'favoritas' && <FavoritesList meal={meal} onDone={() => setFood(false)} />}
          {view === 'criar' && <CustomFoodForm initialName={query} onCreated={(f) => setSelected(f)} />}
        </div>
      )}
    </Sheet>
  );
}

/** Quantidade em gramas ou porções, com cálculo na hora */
function QuantityForm({ food, meal, setMeal, initialGrams, initialPortion, initialQty, onBack, onSave, onDelete }: {
  food: Food;
  meal: MealId;
  setMeal: (m: MealId) => void;
  initialGrams?: number;
  initialPortion?: string;
  initialQty?: number;
  onBack?: () => void;
  onSave: (grams: number, portionLabel?: string, portionQty?: number) => void;
  onDelete?: () => void;
}) {
  const hasPortions = food.portions.length > 0;
  const [mode, setMode] = useState<'porcao' | 'gramas'>(initialPortion && hasPortions ? 'porcao' : initialGrams || !hasPortions ? 'gramas' : 'porcao');
  const [portionIdx, setPortionIdx] = useState(Math.max(0, food.portions.findIndex((p) => p.label === initialPortion)));
  const [qty, setQty] = useState(initialQty ? String(initialQty).replace('.', ',') : '1');
  const [grams, setGrams] = useState(initialGrams ? String(initialGrams).replace('.', ',') : '100');
  const [touched, setTouched] = useState(false);

  const portion = food.portions[portionIdx];
  const err = mode === 'gramas' ? numberError(grams, 'gramas') : numberError(qty, 'porcoes');
  const totalGrams = mode === 'gramas' ? parseNum(grams) : parseNum(qty) * (portion?.grams ?? 0);
  const n = nutrientsFor(food, err ? 0 : totalGrams);

  const save = () => {
    setTouched(true);
    if (err) return;
    if (mode === 'gramas') onSave(Math.round(parseNum(grams) * 10) / 10);
    else onSave(Math.round(totalGrams * 10) / 10, portion.label, parseNum(qty));
  };

  return (
    <div className="space-y-4">
      {onBack && (
        <button onClick={onBack} className="-ml-1 flex min-h-[44px] items-center gap-1 text-sm font-semibold text-primary"><ChevronLeft className="size-4" /> Voltar à busca</button>
      )}

      {/* Resultado calculado na hora */}
      <div className="grid grid-cols-4 gap-2 rounded-lg bg-card p-3 text-center shadow-soft dark:shadow-none">
        <div><p className="text-2xl font-extrabold text-food tabular-nums">{fmt(n.kcal)}</p><p className="text-[11px] text-muted-foreground">kcal</p></div>
        <div><p className="text-lg font-bold tabular-nums">{fmt1(n.protein)}</p><p className="text-[11px] text-muted-foreground">Proteína (g)</p></div>
        <div><p className="text-lg font-bold tabular-nums">{fmt1(n.carbs)}</p><p className="text-[11px] text-muted-foreground">Carbo (g)</p></div>
        <div><p className="text-lg font-bold tabular-nums">{fmt1(n.fat)}</p><p className="text-[11px] text-muted-foreground">Gordura (g)</p></div>
      </div>

      {hasPortions && (
        <Segmented ariaLabel="qty-mode" value={mode} onChange={setMode} options={[{ value: 'porcao', label: 'Porções' }, { value: 'gramas', label: 'Gramas' }]} />
      )}

      {mode === 'porcao' && portion ? (
        <>
          <div className="flex flex-wrap gap-2">
            {food.portions.map((p, i) => (
              <button key={p.label} onClick={() => setPortionIdx(i)} aria-pressed={i === portionIdx}
                className={cn('min-h-[44px] rounded-full border-2 px-3.5 text-sm font-semibold', i === portionIdx ? 'border-primary bg-primary/10 text-primary' : 'border-transparent bg-secondary')}>
                {p.label} <span className="font-normal opacity-70">({fmt(p.grams)} g)</span>
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <Field className="flex-1" label="Quantidade" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} error={touched ? err : null} hint={`= ${fmt(totalGrams || 0)} g`} />
            {['0,5', '1', '2'].map((q) => (
              <Button key={q} variant="secondary" className="mb-[22px] w-12 px-0" onClick={() => setQty(q)}>{q}</Button>
            ))}
          </div>
        </>
      ) : (
        <Field label="Quantidade em gramas" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} error={touched ? err : null} suffix="g" />
      )}

      <div>
        <p className="mb-2 text-sm font-medium">Refeição</p>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {MEALS.map((m) => (
            <button key={m.id} onClick={() => setMeal(m.id)} aria-pressed={meal === m.id}
              className={cn('min-h-[40px] shrink-0 rounded-full px-3 text-sm font-semibold', meal === m.id ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground')}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        {onDelete && <Button variant="outline" size="icon" onClick={onDelete} aria-label="Excluir alimento"><Trash2 className="text-destructive" /></Button>}
        <Button size="lg" className="flex-1" onClick={save}>{onDelete ? 'Salvar alterações' : 'Adicionar'}</Button>
      </div>
    </div>
  );
}

/** Refeições favoritas: adiciona tudo com um toque */
function FavoritesList({ meal, onDone }: { meal: MealId; onDone: () => void }) {
  const s = useStore();
  if (s.favorites.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        <Star className="mx-auto mb-2 size-8 text-food/60" />
        Nenhuma refeição favorita ainda. Na aba Alimentação, toque na estrela de uma refeição para salvá-la.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {s.favorites.map((f) => {
        const kcal = f.items.reduce((sum, i) => sum + nutrientsFor(i.food, i.grams).kcal, 0);
        return (
          <li key={f.id} className="flex items-center gap-2 rounded-lg bg-card p-3 shadow-soft dark:shadow-none">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{f.name}</p>
              <p className="truncate text-xs text-muted-foreground">{f.items.map((i) => i.food.name).join(', ')} · {fmt(kcal)} kcal</p>
            </div>
            <Button size="icon" variant="ghost" aria-label={`Excluir favorita ${f.name}`} onClick={() => s.removeFavorite(f.id)}><Trash2 className="text-muted-foreground" /></Button>
            <Button size="icon" aria-label={`Adicionar ${f.name}`} onClick={() => {
              f.items.forEach((i) => s.addFoodEntry({ ...i, date: s.selectedDate, meal }));
              toast(`${f.name} adicionada`);
              onDone();
            }}><Plus /></Button>
          </li>
        );
      })}
    </ul>
  );
}

/** Cadastro de alimento personalizado (valores por 100 g) */
export function CustomFoodForm({ initialName = '', onCreated }: { initialName?: string; onCreated: (f: Food) => void }) {
  const add = useStore((s) => s.addCustomFood);
  const [f, setF] = useState({ name: initialName, kcal: '', protein: '', carbs: '', fat: '', portionLabel: '', portionGrams: '' });
  const [touched, setTouched] = useState(false);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));

  const errors = {
    name: nameError(f.name),
    kcal: numberError(f.kcal, 'kcal100'),
    protein: numberError(f.protein, 'macro100'),
    carbs: numberError(f.carbs, 'macro100'),
    fat: numberError(f.fat, 'macro100'),
    portionGrams: f.portionLabel ? numberError(f.portionGrams, 'gramas') : null,
  };
  const macroErr = !errors.protein && !errors.carbs && !errors.fat ? macrosError(parseNum(f.protein), parseNum(f.carbs), parseNum(f.fat)) : null;
  const valid = Object.values(errors).every((e) => !e) && !macroErr;
  const show = (e: string | null) => (touched ? e : null);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Informe os valores por 100 g (veja a tabela nutricional da embalagem).</p>
      <Field label="Nome do alimento" value={f.name} onChange={(e) => set({ name: e.target.value })} error={show(errors.name)} maxLength={60} />
      <Field label="Calorias" inputMode="decimal" suffix="kcal" value={f.kcal} onChange={(e) => set({ kcal: e.target.value })} error={show(errors.kcal)} />
      <div className="grid grid-cols-3 gap-2">
        <Field label="Proteína" inputMode="decimal" suffix="g" value={f.protein} onChange={(e) => set({ protein: e.target.value })} error={show(errors.protein)} />
        <Field label="Carbo" inputMode="decimal" suffix="g" value={f.carbs} onChange={(e) => set({ carbs: e.target.value })} error={show(errors.carbs)} />
        <Field label="Gordura" inputMode="decimal" suffix="g" value={f.fat} onChange={(e) => set({ fat: e.target.value })} error={show(errors.fat)} />
      </div>
      {touched && macroErr && <p className="text-xs font-medium text-destructive" role="alert">{macroErr}</p>}
      <div className="grid grid-cols-[1fr_110px] gap-2">
        <Field label="Porção caseira (opcional)" placeholder="Ex.: unidade, fatia" value={f.portionLabel} onChange={(e) => set({ portionLabel: e.target.value })} maxLength={30} />
        <Field label="Gramas" inputMode="decimal" suffix="g" value={f.portionGrams} onChange={(e) => set({ portionGrams: e.target.value })} error={show(errors.portionGrams)} />
      </div>
      <Button size="lg" className="w-full" onClick={() => {
        setTouched(true);
        if (!valid) return;
        const food = add({
          name: f.name.trim(), kcal: parseNum(f.kcal), protein: parseNum(f.protein), carbs: parseNum(f.carbs), fat: parseNum(f.fat), category: 'Meus alimentos',
          portions: f.portionLabel.trim() ? [{ label: f.portionLabel.trim(), grams: parseNum(f.portionGrams) }] : [],
        });
        toast('Alimento cadastrado');
        onCreated(food);
      }}>Salvar alimento</Button>
    </div>
  );
}
