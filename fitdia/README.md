# FitDia

App web (PWA) em português para acompanhar **gasto calórico, alimentação e treinos**. Funciona offline e não precisa de servidor: os dados ficam salvos no navegador (localStorage).

> ⚠️ Os valores do FitDia são estimativas e não substituem a orientação de um nutricionista ou médico.

## Funcionalidades

- **Questionário inicial** (uma pergunta por tela): rotina de trabalho, deslocamento, passos, tarefas, sono, treinos, objetivo e alimentação. O gasto do dia a dia (NEAT) é calculado **bloco a bloco com valores MET**, não com um fator genérico.
- **Resumo do gasto**: basal (Mifflin-St Jeor e, se informado o % de gordura, Katch-McArdle), dia a dia, exercício e digestão; dias com e sem treino; meta sugerida; fator de atividade equivalente.
- **Ajuste adaptativo**: compara a variação real do peso com o saldo registrado (janela de 28 dias) e corrige a estimativa de gasto.
- **Alimentação**: 712 alimentos, dos mais comuns aos regionais (cupuaçu, pequi, tacacá, maniçoba…), com valores por 100 g baseados na TACO/UNICAMP e no USDA, porções caseiras, quantidade em **porções, gramas ou ml** (líquidos e cremosos, com conversão pela densidade), busca que ignora acentos, alimentos personalizados, refeições favoritas, edição e exclusão.
- **Treinos**: 29 atividades com MET por intensidade, atividades personalizadas, biblioteca de 79 exercícios por grupo muscular, fichas (Treino A/B/C), cálculo automático das calorias da musculação pelo volume, **importação do Hevy** (CSV ou texto compartilhado), gráfico de evolução de carga e recordes pessoais.
- **Painel do dia**: anel de calorias restantes, gasto total, saldo, macros em rosca, água (35 ml/kg) e navegação entre dias.
- **Histórico**: consumidas × gastas (semana/mês), evolução do peso, dias seguidos de treino e backup em JSON.
- Tema claro/escuro, PWA instalável e offline, áreas de toque ≥ 44 px.

## Tecnologias

React 18 + Vite + TypeScript · Tailwind CSS + componentes no padrão shadcn/ui (Radix) · Recharts · Framer Motion · Lucide · Zustand (localStorage) · vite-plugin-pwa · Vitest.

## Estrutura

```
src/
├─ lib/calc/          Fórmulas puras (testadas): bmr, met, neat, energy, strength, macros
├─ lib/               hevy (importador), validation, text (busca), date, backup
├─ data/              foods, activities (MET), exercises
├─ store/             tipos, estado (Zustand) e seletores
├─ components/ui/     componentes base (button, card, field, sheet, toast…)
├─ components/layout/ barra inferior, menu "+", navegação de dias, estados vazios
└─ features/          onboarding, today, food, workouts, history, profile
```

## Como rodar localmente

Pré-requisito: [Node.js](https://nodejs.org) 18 ou mais novo.

```bash
cd fitdia
npm install        # instala as dependências
npm run dev        # abre em http://localhost:5173
npm test           # roda os testes unitários das fórmulas
npm run build      # gera a versão de produção em dist/
npm run preview    # testa a versão de produção (com PWA/offline)
```

Para testar no celular na mesma rede Wi-Fi: `npm run dev -- --host` e abra o endereço "Network" mostrado no terminal.

## Publicar de graça na Vercel

1. Envie o repositório para o GitHub.
2. Acesse [vercel.com](https://vercel.com), entre com o GitHub e clique em **Add New → Project**.
3. Escolha o repositório. Em **Root Directory**, selecione `fitdia`.
4. A Vercel detecta o Vite sozinha (build `npm run build`, saída `dist`). Clique em **Deploy**.
5. Pronto: abra o link no celular e use **"Adicionar à tela inicial"** para instalar o app.

Alternativas gratuitas: Netlify (mesmas configurações) ou Cloudflare Pages.

## Importar do Hevy

- **CSV**: no Hevy, Perfil → Configurações → Exportar e importar dados → Exportar treinos. No FitDia, Treinos → Importar treinos do Hevy → Arquivo CSV.
- **Texto**: no Hevy, abra um treino → Compartilhar → Copiar texto, e cole no FitDia.

Treinos já importados (mesma data e nome) não são duplicados.

## Como os cálculos funcionam

| Parte | Fórmula |
|---|---|
| Basal | Mifflin-St Jeor: 10 × peso + 6,25 × altura − 5 × idade + 5 (homens) / − 161 (mulheres) |
| Dia a dia (NEAT) | Σ (MET do bloco − 1) × peso × horas por dia, na média da semana |
| Treino | MET (pela intensidade) × peso × horas |
| Musculação | intensidade estimada pela densidade (séries/min) e volume relativo ao peso |
| Digestão | 10% das calorias consumidas |
| Meta | gasto num dia sem treino ± ajuste do ritmo (−250/−500/−750 ou +150/+300/+450), com limites seguros (déficit ≤ 25%, mínimo de 1.200/1.500 kcal) |
| Restantes | meta + calorias dos treinos do dia − consumidas |

## Melhorias futuras

- Leitura de código de barras (câmera + Open Food Facts).
- Login e sincronização na nuvem (ex.: Supabase) para usar em vários aparelhos.
- Integração com Apple Saúde / Google Health Connect para passos e treinos.
- Fotos de refeições e reconhecimento de alimentos.
- Lembretes de água e de refeições (notificações push).
- Metas de micronutrientes (fibras, sódio) e relatório para levar ao nutricionista.
- Cronômetro de descanso entre séries e modo "treino ao vivo".
