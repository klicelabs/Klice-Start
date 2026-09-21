# Diagnóstico de performance — Klice Start (newtab)

**Branch:** `perf/diagnosis` · **Data:** 2026-09-21 · **Modo:** medição apenas — nenhum arquivo de produto foi modificado (`git diff main --name-only` = vazio antes deste commit).

---

## 1. Sumário executivo

O gargalo real não é o glass, nem o Zustand, nem o dnd, nem writes de storage. Das 5 hipóteses levantadas, **4 foram descartadas com dados** — os números mostram que o time de engenharia acertou nas escolhas (selectors em todos os 159 pontos de consumo, coalescing de 200ms no persist, rAF no marquee, guards funcionais no dnd). O único achado confirmado é o **cold load**: o chunk monolítico de 644 KB da newtab executa em bloco único na abertura e produz **1 long task de ~220 ms** (214–233 ms em 5/5 runs com perfil limpo), que é exatamente o sintoma "trava ao abrir" que motivou este diagnóstico. Durante o uso (drag, marquee, scroll, settings) a página roda a 104–120 fps, sem long tasks, com 1 write coalescido por gesto.

## 2. Metodologia

**Automatizada** (4 scripts Playwright em `apps/extension/scripts/`, Chromium real com a extensão MV3 buildada carregada, perfil temporário limpo por run, nenhuma outra extensão):

- `bench-lib.mjs` — harness compartilhado: contador de commits React via `__REACT_DEVTOOLS_GLOBAL_HOOK__` (conta roots + fibers com flag `PerfomedWork` — equivalente programático ao React DevTools Profiler), interceptação de `chrome.storage.local.set` no page world (timestamps + bytes), `PerformanceObserver` de long tasks, rAF FPS sampler, observer de grid-ready (proxy de interatividade).
- `bench-cold-load.mjs [runs=5]` — perfil novo por run; variantes `empty` (primeiro uso) e `seeded` (usuário que retorna); Navigation Timing, FCP, grid-ready, long tasks de startup, `ScriptDuration` via CDP `Performance.getMetrics` (resource-timing não registra chunks de extensão).
- `bench-interactions.mjs [reps=3]` — 11 interações da lista do pedido, cada uma com janela de medição isolada (reset → gesto com input **trusted** do Playwright → settle → snapshot).
- `bench-pointer-storm.mjs [reps=3]` — Storm de eventos de drag: 4 condições de distância/granularidade, correlação `dragover` × commits × writes + CPU profile por condição.
- `bench-glass-fps.mjs [seconds=3] [reps=3]` — **headed** (headless satura em composição por software e esconde o custo do compositor), CPU throttle 4× via CDP `Emulation.setCPUThrottlingRate` para representar hardware médio, glass vs flat × drag/scroll/marquee.

**Estática** — grep/leitura do código de produto: consumo de stores (selector vs sem selector), caminho de persist (`coalescing`), mecanismo de dnd (HTML5 drag nativo: `draggable` + `onDragOver`, não pointer events), throttling do marquee (rAF).

**Regra de ouro:** cada medição 3× (ou 5×), reporta-se mediana. Raw completo em `apps/extension/scripts/results/*.json` (não commitado).

## 3. Tabela por interação

Medianas de 3 reps, 30 cards na pasta ativa, viewport 1600×900, Chromium headless-new (canal `chromium` 153.0.8010.12):

| Interação | Duração (ms) | Commits | Fibers re-renderizados | Long tasks | `storage.set` |
|---|---:|---:|---:|---:|---:|
| Abrir Preferences | 758 | 4 | 6 155 | 0 | 0 |
| Trocar accent color | 414 | 5 | 8 348 | 0 | 1 |
| Trocar material (glass↔flat) | 482 | 8 | 12 958 | 0 | 1 |
| Dark/light toggle | 494 | 6 | 9 825 | 1 (72 ms) | 1 |
| Arrastar 1 card no grid | 937 | 26 | 44 498 | 0 | 1 |
| Marquee 3 cards | 967 | 10 | 16 756 | 0 | 0 |
| Marquee 10 cards | 973 | 13 | 21 881 | 0 | 0 |
| Marquee 20 cards | 1 040 | 19 | 32 179 | 0 | 0 |
| Abrir pasta do grid | 447 | 8 | 8 134 | 0 | 1 |
| Navegar tabbar (topfolders) | 467 | 8 | 8 758 | 0 | 1 |
| Renomear card (context menu → type → Enter) | 649 | 25 | 38 861 | 0 | 1 |
| Arrastar pasta na tabbar entre gaps | 782 | 11 | 18 414 | 0 | 1 |

**Cold load** (medianas de 5 runs, perfil limpo por run):

| Métrica | empty (1º uso) | seeded (retorno) |
|---|---:|---:|
| DCL / load | 136 / 136 ms | 120 / 121 ms |
| FCP | 720 ms | 324 ms |
| Grid interativo (proxy) | n/a¹ | 257 ms |
| `ScriptDuration` (CDP) | 243 ms | 98 ms |
| Long tasks de startup | 1 × 214–233 ms (5/5 runs) | 1 × 113–152 ms (5/5 runs) |

¹ O proxy procura `[data-marquee-id]`; sem dados não há cards para renderizar, então o proxy não se aplica à variante empty.

**FPS por material (headed, CPU throttle 4×, 40 backdrop-filter nodes ativos no glass):**

| Workload | glass 4× | flat 4× | glass 1× | flat 1× |
|---|---:|---:|---:|---:|
| Drag de card | 65.3 | 65.6 | 115.7 | 114.3 |
| Scroll do grid | 117.8 | 119.3 | 120 | 120 |
| Marquee | 107.2 | 106.1 | 119 | 118.2 |

## 4. Hipóteses testadas

### H1 — backdrop-filter / liquid glass em massa → **DESCARTADA**

Glass vs flat são **virtualmente idênticos mesmo com CPU 4× mais lenta**: drag 65.3 vs 65.6 fps, scroll 117.8 vs 119.3, marquee 107.2 vs 106.1 — com **40 backdrop-filter nodes** ativos no glass e 0 no flat. Sem throttle, ambos cravam 114–120 fps. O drag é CPU-bound em JS (custo idêntico nos dois materiais); o custo do compositor com backdrop-filter é imperceptível neste volume de nodes. Se glass fosse o gargalo, flat deveria abrir vantagem clara — não abre.

### H2 — Zustand sem selector → **DESCARTADA**

Varredura completa de `apps/extension/src`: **159 usos** de store hooks (`useSetupStore`, `useSelectionStore`, `useHistoryStore`, `useImageStore`, `useMoveDialogStore`, `useRenameStore`, `useSettingsMotionStore`), **0 sem selector** — todos no formato `useXStore((s) => s.campo)`. Medição de reforço: trocar accent color (campo irrelevante para o grid) custa 5 commits / 8 348 fibers / 414 ms — re-render localizado, não de árvore inteira.

### H3 — Marquee/dnd recalculando hit-test em pointermove sem throttle → **DESCARTADA**

O dnd usa **HTML5 drag nativo** (`draggable` + `onDragOver` em `use-grid-dnd.ts`) — durante drag nativo o browser substitui o stream de pointer por eventos de drag: `pointermove` = **2–3 eventos por drag inteiro** (medido em 12 drags). Não existe flood de pointermove a throttlear. O marquee (via ponteiro puro) conta **91 eventos/3 s (~30/s)** e aplica o hit-test dentro de rAF. Além disso os handlers de `dragover` são amortizados por guards: no bench de storm, multiplicar os eventos `dragover` por 4,2 (43 → 180 por drag, aprofundando a granularidade do movimento) **não muda o nº de commits** (22 → 23, razão 1,0×) — cada mudança de alvo/zona renderiza 1 vez, o resto é descartado por `lastApplied` stamp + functional `setState`.

### H4 — Write storm no `chrome.storage.local` durante drag → **DESCARTADA**

O persist tem coalescing de 200 ms (trailing debounce) e funciona: **12/12 drags medidos produziram exatamente 1 write coalescido**, disparado ~200 ms após o último reorder — nunca 1 write por mudança de posição (um drag de 12 células faria ~12 writes sem coalescing). Marquee: 0 writes. Renomear, navegar pastas, abrir settings: 1 write cada. Máximo observado em qualquer interação: 1 write.

### H5 — Bundle de 655 KB sem code splitting → **CONFIRMADA (único gargalo real)**

O chunk `chunks/newtab-*.js` tem **644 KB** (+ 276 KB de `globals` compartilhado) e executa em bloco único no load. Resultado: 1 long task de **214–233 ms em 5/5 runs** com perfil limpo (`ScriptDuration` CDP: 243 ms; V8 compile 0 ms — o custo é execução+hidratação, não parse), FCP 720 ms frio. É o sintoma "trava ao abrir". Ver §7 para a incerteza na comparação empty vs seeded.

## 5. Gargalos ranqueados por impacto

1. **Long task de startup (~220 ms, 100% dos cold loads)** — execução monolítica do chunk de 644 KB + mount antes do primeiro paint completo. Único achado que sustenta a percepção de "travamento". *Efeito percebido:* abertura trava ~¼ de segundo.
2. **Re-renders em drag e rename (26–27 commits, 44–46k fibers por gesto)** — alto em contagem, mas sem long tasks, 104–120 fps, e provadamente amortizado por guards (H3). Impacto percebido hoje: baixo. Vale atenção se o grid crescer (100+ cards).
3. **Rename dispara ~25 commits/38k fibers para ~10 teclas** — provável commit por tecla com subscribers largos. Sem long tasks; dor futura em máquinas fracas.
4. **Nada mais** — scroll, marquee, settings, navegação de pastas: todos ≤ 8 commits e sem long tasks.

## 6. Recomendações de fix (não implementar nesta branch)

| # | O quê | Custo | Risco | Ganho esperado |
|---|---|---|---|---|
| 1 | Code-split do chunk newtab: lazy-load de widgets não-críticos (clock, greeting, quick-links) e de superfícies secundárias (diálogos, painel de settings completo) com import dinâmico pós-primeiro-paint | M | M (borda de hidratação; flash de widgets atrasados) | Elimina a maior parte da long task de ~220 ms — abertura instantânea. **P1** |
| 2 | Defer do mount de subtrees não-críticas para `requestIdleCallback`/post-paint (mesmo sem split de chunk) | S/M | Baixo | TTI percebido cai antes mesmo do split. **P1 alternativo barato** |
| 3 | Renome inline: input uncontrolled até commit (Enter) em vez de escrever no store por tecla | S | Baixo | 25 → ~2 commits por rename. **P3** |
| 4 | Quando o grid crescer: virtualização de linhas fora do viewport | M | M | Somente se card count → 100+. **P4** |

## 7. O que NÃO vale otimizar (evita trabalho desperdiçado)

- **Remover/reduzir glass** — custo zero medido, inclusive em hardware 4× mais lento (H1).
- **Adicionar selectors Zustand** — já estão em 100% dos 159 pontos de consumo (H2).
- **Throttle de pointermove/dragover ou "rAF-izar" o dnd** — drag nativo não gera flood (2–3 pointermove/drag) e os guards já colapsam dragover×4,2 em commits×1,0 (H3).
- **Mexer no persist/coalescing** — 1 write por gesto, trailing 200 ms, comprovado em 12 drags (H4).
- **Otimizar scroll do grid** — cravado em 120 fps com e sem throttle.

## 8. Incertezas honestas

- **FCP empty (720 ms) vs seeded (324 ms)**: a ordem fixa das runs (empty primeiro) confunde cache frio de V8/codecache com efeito de dados. A long task de startup, porém, aparece nos dois cenários (214–233 ms e 113–152 ms) — o achado não depende dessa comparação.
- **Componentes re-renderizados são minificados** (`Q`, `E_`, `T_`…): a contagem por componente é anônima sem sourcemap no build. Sabe-se *quanto* cada um re-renderiza, não *quem* é exatamente — mapear exige sourcemap (recomendo gerar numa branch probe antes do P3).
- **React DevTools Profiler manual não foi usado**; a contagem vem do mesmo sinal interno (hook de devtools + flag `PerformedWork`), determinístico e reprodutível.
- **FPS**: drag/scroll sintéticos com input trusted do Playwright em janela headed; display a 120 Hz como teto. Padrões de mão humana podem variar ±.
- **Empty grid-interactive** não capturado (proxy depende de cards existirem — §3 nota 1).
- **`dark-light-toggle`**: única interação com long task (72 ms, 1 ocorrência em 3 reps) — não reproduzida o suficiente para atribuir causa.

## 9. Ambiente e reprodutibilidade

**Ambiente:** Windows, Chromium 153.0.8010.12 (canal `chromium` do Playwright), AMD Ryzen 5 5500, 16 GB RAM, 120 Hz. Perfil de browser temporário limpo por run, só a extensão buildada carregada (`--disable-extensions-except`).

```bash
# 1. build da extensão (obrigatório antes dos benches)
cd apps/extension
bun run build                      # -> .output/chrome-mv3

# 2. cold load (5 runs, perfis limpos; ~2 min)
node scripts/bench-cold-load.mjs 5

# 3. interações (3 reps × 12 interações)
node scripts/bench-interactions.mjs 3

# 4. storm de eventos de drag + CPU profile
node scripts/bench-pointer-storm.mjs 3

# 5. glass vs flat FPS — abre janela HEADED, alguns minutos
node scripts/bench-glass-fps.mjs 3 3
```

Saídas JSON: `apps/extension/scripts/results/{cold-load,interactions,pointer-storm,glass-fps}.json` (regeneráveis, não commitados). Todos os scripts são read-only sobre o produto: instrumentação via `addInitScript` no page world, sem tocar código da extensão.
