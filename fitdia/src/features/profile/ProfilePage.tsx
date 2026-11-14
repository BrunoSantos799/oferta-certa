// Perfil: dados pessoais, peso, objetivo, meta, modo de cálculo e preferências
import { useState } from 'react';
import { RefreshCw, Pencil, Trash2, Sun, Moon, Monitor, Scale, Target, Activity, Sparkles, ChevronRight } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { shouldRedoQuestionnaire, useEnergyModel } from '@/store/selectors';
import type { Goal, Pace, Sex, Theme } from '@/store/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { OptionCard, Segmented, Switch } from '@/components/ui/misc';
import { Sheet } from '@/components/ui/sheet';
import { Disclaimer, PageHeader } from '@/components/layout/common';
import { ACTIVITY_LEVELS, nearestActivityLevel } from '@/lib/calc/energy';
import { birthDateError, nameError, numberError } from '@/lib/validation';
import { fmt, fmt1, parseNum, cn } from '@/lib/utils';
import { friendlyDate, today } from '@/lib/date';
import { toast } from '@/components/ui/toast';
import { BackupCard } from '@/features/history/HistoryPage';

const GOALS: Array<{ value: Goal; label: string }> = [
  { value: 'perder', label: 'Perder' },
  { value: 'manter', label: 'Manter' },
  { value: 'ganhar', label: 'Ganhar' },
  { value: 'condicionamento', label: 'Condic.' },
];

export function ProfilePage() {
  const s = useStore();
  const model = useEnergyModel();
  const [weightInput, setWeightInput] = useState('');
  const [weightTouched, setWeightTouched] = useState(false);
  const [editing, setEditing] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [showAllWeights, setShowAllWeights] = useState(false);
  if (!s.profile || !model) return null;
  const p = s.profile;

  const weightErr = numberError(weightInput, 'peso');
  const goalErr = goalInput ? numberError(goalInput, 'metaKcal') : null;
  const redo = shouldRedoQuestionnaire(s);
  const factorLevel = nearestActivityLevel(model.estimate.activityFactor);
  const weightsDesc = [...s.weights].reverse();

  return (
    <div className="space-y-3">
      <PageHeader title="Perfil" />

      {/* Cartão do usuário */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl font-extrabold text-primary-foreground">{p.name.charAt(0).toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold">{p.name}</p>
            <p className="text-sm text-muted-foreground">{p.sex === 'feminino' ? 'Feminino' : 'Masculino'} · {model.age} anos · {p.heightCm} cm</p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Editar dados pessoais" onClick={() => setEditing(true)}><Pencil /></Button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-secondary/70 p-2"><p className="text-lg font-bold tabular-nums">{fmt1(model.weight)}</p><p className="text-[11px] text-muted-foreground">kg</p></div>
          <div className="rounded-xl bg-secondary/70 p-2"><p className="text-lg font-bold tabular-nums">{fmt1(model.bmi)}</p><p className="text-[11px] text-muted-foreground">IMC</p></div>
          <div className="rounded-xl bg-secondary/70 p-2"><p className="truncate pt-1 text-sm font-bold">{model.bmiLabel}</p><p className="text-[11px] text-muted-foreground">faixa do IMC</p></div>
        </div>
      </Card>

      {/* Peso */}
      <Card className="p-4">
        <p className="flex items-center gap-2 font-bold"><Scale className="size-5 text-primary" /> Atualizar peso</p>
        <div className="mt-3 flex items-start gap-2">
          <Field className="flex-1" label="Peso de hoje" inputMode="decimal" suffix="kg" value={weightInput} onChange={(e) => setWeightInput(e.target.value)} error={weightTouched ? weightErr : null} placeholder={fmt1(model.weight)} />
          <Button className="mt-[26px]" onClick={() => {
            setWeightTouched(true);
            if (weightErr) return;
            s.addWeight(parseNum(weightInput), today());
            setWeightInput('');
            setWeightTouched(false);
            toast('Peso registrado');
          }}>Salvar</Button>
        </div>
        {weightsDesc.length > 0 && (
          <ul className="mt-3 divide-y divide-border/70">
            {(showAllWeights ? weightsDesc : weightsDesc.slice(0, 4)).map((w) => (
              <li key={w.date} className="flex items-center justify-between py-1">
                <span className="text-sm first-letter:uppercase text-muted-foreground">{friendlyDate(w.date)}</span>
                <span className="flex items-center gap-1">
                  <span className="text-sm font-bold tabular-nums">{fmt1(w.kg)} kg</span>
                  {s.weights.length > 1 && <Button size="icon" variant="ghost" aria-label={`Excluir pesagem de ${friendlyDate(w.date)}`} onClick={() => s.removeWeight(w.date)}><Trash2 className="!size-4 text-muted-foreground" /></Button>}
                </span>
              </li>
            ))}
          </ul>
        )}
        {weightsDesc.length > 4 && <Button variant="ghost" className="w-full" onClick={() => setShowAllWeights(!showAllWeights)}>{showAllWeights ? 'Mostrar menos' : `Ver histórico completo (${weightsDesc.length})`}</Button>}
      </Card>

      {/* Objetivo e meta */}
      <Card className="space-y-4 p-4">
        <p className="flex items-center gap-2 font-bold"><Target className="size-5 text-primary" /> Objetivo e meta</p>
        <Segmented ariaLabel="objetivo" value={p.goal} onChange={(goal) => s.updateProfile({ goal })} options={GOALS} />
        {(p.goal === 'perder' || p.goal === 'ganhar') && (
          <Segmented<Pace> ariaLabel="ritmo" value={p.pace} onChange={(pace) => s.updateProfile({ pace })} options={[{ value: 'lento', label: 'Lento' }, { value: 'moderado', label: 'Moderado' }, { value: 'rapido', label: 'Rápido' }]} />
        )}
        <div className="rounded-xl bg-primary/10 p-3">
          <p className="text-xs font-semibold text-primary">Meta diária {s.settings.goalKcalOverride ? '(personalizada)' : '(sugerida)'}</p>
          <p className="text-3xl font-extrabold tabular-nums">{fmt(model.goalTarget)} <span className="text-sm font-semibold text-muted-foreground">kcal</span></p>
          {s.settings.goalKcalOverride ? (
            <button className="text-xs font-semibold text-primary underline" onClick={() => s.updateSettings({ goalKcalOverride: null })}>Voltar para a sugerida ({fmt(model.suggestedTarget)} kcal)</button>
          ) : (
            <p className="text-xs text-muted-foreground">
              {p.goal === 'perder' ? `≈ ${fmt1(-model.weeklyKgChange)} kg a menos por semana` : p.goal === 'ganhar' ? `≈ ${fmt1(model.weeklyKgChange)} kg a mais por semana` : 'Equilíbrio entre consumo e gasto'}
            </p>
          )}
          {model.goalLimitedBy && !s.settings.goalKcalOverride && <p className="mt-1 text-xs font-medium text-food">{model.goalLimitedBy}</p>}
        </div>
        <div className="flex items-start gap-2">
          <Field className="flex-1" label="Definir meta manualmente" inputMode="numeric" suffix="kcal" value={goalInput} onChange={(e) => setGoalInput(e.target.value)} error={goalErr} placeholder={String(model.goalTarget)} />
          <Button variant="secondary" className="mt-[26px]" disabled={!goalInput || !!goalErr} onClick={() => {
            s.updateSettings({ goalKcalOverride: Math.round(parseNum(goalInput)) });
            setGoalInput('');
            toast('Meta atualizada');
          }}>Aplicar</Button>
        </div>
      </Card>

      {/* Como o gasto é calculado */}
      <Card className="space-y-3 p-4">
        <p className="flex items-center gap-2 font-bold"><Activity className="size-5 text-primary" /> Seu gasto calórico</p>
        <dl className="space-y-1.5 text-sm">
          <Row k="Taxa basal (Mifflin-St Jeor)" v={`${fmt(model.bmr)} kcal`} />
          {model.katch && <Row k="Taxa basal (Katch-McArdle)" v={`${fmt(model.katch)} kcal`} />}
          <Row k="Gasto do dia a dia" v={`${fmt(model.neatKcal)} kcal`} />
          <Row k="Gasto num dia sem treino" v={`${fmt(model.restDayExpenditure)} kcal`} />
          <Row k="Fator de atividade equivalente" v={`${fmt1(model.estimate.activityFactor)} · ${factorLevel.label}`} />
        </dl>

        <Segmented ariaLabel="modo" value={s.settings.energyMode} onChange={(energyMode) => s.updateSettings({ energyMode })}
          options={[{ value: 'personalizado', label: 'Pela minha rotina' }, { value: 'fator', label: 'Nível de atividade' }]} />

        {s.settings.energyMode === 'fator' ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Gasto = basal × fator. Como os treinos registrados são somados à parte, prefira um nível que não conte seus treinos.</p>
            {ACTIVITY_LEVELS.map((l) => (
              <OptionCard key={l.factor} selected={p.activityFactor === l.factor} onClick={() => s.updateProfile({ activityFactor: l.factor })} title={`${l.label} (${String(l.factor).replace('.', ',')})`} description={l.description} />
            ))}
          </div>
        ) : (
          <ul className="space-y-1 text-sm">
            {[...model.neat.blocks].filter((b) => b.kcal > 3).sort((a, b) => b.kcal - a.kcal).map((b) => (
              <li key={b.key} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{b.label} <span className="text-xs">({fmt1(b.hours)} h/dia)</span></span>
                <span className="font-semibold tabular-nums">+{fmt(b.kcal)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary/60 p-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="size-4 text-primary" /> Ajuste automático pelo peso</p>
            <p className="text-xs text-muted-foreground">
              {model.adaptive.ready
                ? `Seu peso real indica ${model.adaptive.adjustment >= 0 ? '+' : ''}${fmt(model.adaptive.adjustment)} kcal/dia em relação ao previsto${s.settings.autoAdjust ? ' (aplicado)' : ''}.`
                : model.adaptive.reason || 'Precisa de mais dados de peso e alimentação.'}
            </p>
          </div>
          <Switch checked={s.settings.autoAdjust} onCheckedChange={(autoAdjust) => s.updateSettings({ autoAdjust })} label="Ajuste automático pelo peso" />
        </div>

        <button onClick={() => s.setRedoing(true)} className={cn('flex w-full items-center gap-3 rounded-xl p-3 text-left', redo ? 'bg-primary/10' : 'bg-secondary/60')}>
          <RefreshCw className="size-5 shrink-0 text-primary" />
          <span className="flex-1 text-sm">
            <b>Refazer questionário</b>
            <span className="block text-xs text-muted-foreground">{redo ?? `Último: ${s.questionnaireDate ? friendlyDate(s.questionnaireDate) : '—'}. Sugerimos a cada 30 dias.`}</span>
          </span>
          <ChevronRight className="size-5 text-muted-foreground" />
        </button>
      </Card>

      {/* Preferências */}
      <Card className="space-y-4 p-4">
        <p className="font-bold">Preferências</p>
        <div>
          <p className="mb-2 text-sm font-medium">Aparência</p>
          <div className="grid grid-cols-3 gap-2">
            {([['system', 'Sistema', Monitor], ['light', 'Claro', Sun], ['dark', 'Escuro', Moon]] as Array<[Theme, string, typeof Sun]>).map(([v, l, Icon]) => (
              <button key={v} onClick={() => s.updateSettings({ theme: v })} aria-pressed={s.settings.theme === v}
                className={cn('flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border-2 text-sm font-semibold', s.settings.theme === v ? 'border-primary bg-primary/5 text-primary' : 'border-transparent bg-secondary/70')}>
                <Icon className="size-5" />{l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Tamanho do copo de água</p>
          <Segmented ariaLabel="copo" value={String(s.settings.glassMl)} onChange={(v) => s.updateSettings({ glassMl: Number(v) })}
            options={[{ value: '200', label: '200 ml' }, { value: '250', label: '250 ml' }, { value: '300', label: '300 ml' }, { value: '500', label: '500 ml' }]} />
        </div>
      </Card>

      <BackupCard />

      <Button variant="ghost" className="w-full text-destructive" onClick={() => setConfirmReset(true)}><Trash2 /> Apagar todos os dados</Button>
      <Disclaimer />
      <p className="pb-2 text-center text-xs text-muted-foreground">FitDia 1.0 · funciona offline · seus dados ficam no seu aparelho</p>

      <EditProfileSheet open={editing} onOpenChange={setEditing} />
      <Sheet open={confirmReset} onOpenChange={setConfirmReset} title="Apagar todos os dados?" description="Isso remove perfil, refeições, treinos e pesagens deste aparelho. Não dá para desfazer.">
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setConfirmReset(false)}>Cancelar</Button>
          <Button variant="destructive" className="flex-1" onClick={() => { s.resetAll(); setConfirmReset(false); }}>Apagar tudo</Button>
        </div>
      </Sheet>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-semibold tabular-nums">{v}</dd>
    </div>
  );
}

/** Edição dos dados pessoais */
function EditProfileSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const s = useStore();
  const p = s.profile!;
  const init = () => ({
    name: p.name, sex: p.sex as Sex, birthDate: p.birthDate, height: String(p.heightCm),
    bodyFat: p.bodyFatPercent ? String(p.bodyFatPercent).replace('.', ',') : '',
    target: p.targetWeightKg ? String(p.targetWeightKg).replace('.', ',') : '',
  });
  const [f, setF] = useState(init);
  const [touched, setTouched] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) { setF(init()); setTouched(false); }
  }
  const errors = {
    name: nameError(f.name),
    birthDate: birthDateError(f.birthDate),
    height: numberError(f.height, 'altura'),
    bodyFat: f.bodyFat ? numberError(f.bodyFat, 'gordura') : null,
    target: f.target ? numberError(f.target, 'peso') : null,
  };
  const valid = Object.values(errors).every((e) => !e);
  const show = (e: string | null) => (touched ? e : null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Dados pessoais"
      footer={<Button size="lg" className="w-full" onClick={() => {
        setTouched(true);
        if (!valid) return;
        s.updateProfile({
          name: f.name.trim(), sex: f.sex, birthDate: f.birthDate, heightCm: parseNum(f.height),
          bodyFatPercent: f.bodyFat ? parseNum(f.bodyFat) : null, targetWeightKg: f.target ? parseNum(f.target) : null,
        });
        toast('Perfil atualizado');
        onOpenChange(false);
      }}>Salvar</Button>}>
      <div className="space-y-3">
        <Field label="Nome" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={show(errors.name)} maxLength={60} />
        <div>
          <p className="mb-1.5 text-sm font-medium">Sexo</p>
          <Segmented<Sex> ariaLabel="sexo" value={f.sex} onChange={(sex) => setF({ ...f, sex })} options={[{ value: 'feminino', label: 'Feminino' }, { value: 'masculino', label: 'Masculino' }]} />
        </div>
        <Field label="Data de nascimento" type="date" value={f.birthDate} onChange={(e) => setF({ ...f, birthDate: e.target.value })} error={show(errors.birthDate)} />
        <Field label="Altura" inputMode="numeric" suffix="cm" value={f.height} onChange={(e) => setF({ ...f, height: e.target.value })} error={show(errors.height)} />
        <Field label="Percentual de gordura (opcional)" inputMode="decimal" suffix="%" value={f.bodyFat} onChange={(e) => setF({ ...f, bodyFat: e.target.value })} error={show(errors.bodyFat)} />
        <Field label="Peso desejado (opcional)" inputMode="decimal" suffix="kg" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} error={show(errors.target)} />
        <p className="text-xs text-muted-foreground">Para mudar o peso atual, use “Atualizar peso”. Para mudar a rotina, refaça o questionário.</p>
      </div>
    </Sheet>
  );
}
