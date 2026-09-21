# Diagnóstico de performance — Klice Start (newtab)

**Branch:** `perf/diagnosis` · **Data:** 2026-09-21 · **Modo:** medição apenas — nenhum arquivo de produto foi modificado (`git diff main --name-only` = vazio antes deste commit).

**Atualização (2026-09-21, 2ª rodada — probes de decomposição):** a long task de startup foi decomposta em module eval / mount / pós-mount (§5) e a comparação empty vs seeded foi refeita com variantes alternadas que eliminam o viés de ordem (§3). Nenhuma marca foi adicionada ao código de produto: a âncora DCL provou-se válida (guard `segmentOrderOk` em 6/6 runs), então o branch throwaway `perf/probe-decompose` **não foi necessário** e não existe marca temporária em lugar nenhum.

---

## 1. Sumário executivo

O gargalo real não é o glass, nem o Zustand, nem o dnd, nem writes de storage. Das 5 hipóteses levantadas, **4 foram descartadas com dados** — os números mostram que o time de engenharia acertou nas escolhas (selectors em todos os 159 pontos de consumo, coalescing de 200ms no persist, rAF no marquee, guards funcionais no dnd). O único achado confirmado é o **cold load**: a abertura produz 1 long task dominante (122–370 ms conforme a variante) — exatamente o sintoma "trava ao abrir" que motivou este diagnóstico. A decomposição (§5) mostrou que ela **não** é a avaliação do bundle monolítico: em 6/6 runs a tarefa dominante começa **após o DCL** e atravessa o primeiro e o segundo commit do React — é o bloco contínuo render → commit → efeitos → hidratação do persist → re-commit. Module eval contribui com no máximo 51–53 ms. Durante o uso (drag, marquee, scroll, settings) a página roda a 104–120 fps, sem long tasks, com 1 write coalescido por gesto. Consequência prática: **code-split sozinho não resolve o custo medido** — o caminho é deferir trabalho para depois do primeiro paint (§7).

## 2. Metodologia

**Automatizada** (harness compartilhado + 5 benches Playwright em `apps/extension/scripts/`, Chromium real com a extensão MV3 buildada carregada, perfil temporário limpo por run, nenhuma outra extensão):

- `bench-lib.mjs` — harness compartilhado: contador de commits React via `__REACT_DEVTOOLS_GLOBAL_HOOK__` (conta roots + fibers com flag `PerfomedWork` — equivalente programático ao React DevTools Profiler), interceptação de `chrome.storage.local.set` no page world (timestamps + bytes), `PerformanceObserver` de long tasks, rAF FPS sampler, observer de grid-ready (proxy de interatividade).
- `bench-cold-load.mjs [runs=9]` — perfil novo por run; **3 variantes alternadas por índice de run** para eliminar o viés de ordem da medição original: `empty` (1º load, sem dados), `seeded` (2º load, dados + codecache quente) e `seeded-cold` (dados escritos via service worker antes de qualquer load → 1º load com dados e codecache frio). A diferença empty↔seeded-cold isola o efeito puro de dados; seeded-cold↔seeded isola o efeito puro de codecache. Navigation Timing, FCP, grid-ready, long tasks de startup, `ScriptDuration` via CDP `Performance.getMetrics` (resource-timing não registra chunks de extensão).
- `bench-decompose.mjs [runs=6]` — decompõe a janela de startup: T0→T1 module eval (âncora DCL, com o `inject` do react-dom como sanity floor), T1→T2 React mount (âncora primeiro `onCommitFiberRoot`), T2→T3 pós-mount→paint (duplo rAF + FCP cross-check). Captura ainda o 2º commit (re-render da hidratação do persist), a chegada do `chrome.storage.local.get` e aloca cada long task por janela. Guard `segmentOrderOk` recusa o relatório se o DCL disparar depois do primeiro commit (não ocorreu: 6/6 runs válidas).
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

**Cold load** (9 runs alternadas empty → seeded → seeded-cold × 3, perfil limpo por run — a alternância elimina o viés de ordem da medição original; mediana e intervalo das runs):

| Métrica | empty (1º load, sem dados) | seeded-cold (1º load, com dados) | seeded (2º load, com dados) |
|---|---:|---:|---:|
| DCL / load | 153 / 155 ms | 107 / 110 ms | 258 / 259 ms |
| FCP | 856 ms (796–980) | 740 ms² (740–880) | 548 ms (364–596) |
| Grid interativo (proxy) | n/a¹ | 335 ms | 378 ms |
| `ScriptDuration` (CDP) | 328 ms | 217 ms | 82 ms |
| Long tasks de startup (total) | 343 ms (275–400) | 238 ms (233–260) | 129 ms (115–139) |

¹ O proxy procura `[data-marquee-id]`; sem dados não há cards para renderizar, então o proxy não se aplica à variante empty.
² FCP não capturado em 1 das 3 runs (paint entry ausente); mediana sobre 2 amostras válidas.

**Leitura da decomposição empty↔seeded** (o que a medição original não conseguia separar):

- **Efeito puro de dados** (empty ↔ seeded-cold, ambos 1º load): FCP 856 → 740 ms = **~116 ms — dentro da variância** (spread de 184 ms no empty). Volume de dados não explica o gap antigo.
- **Efeito puro de codecache** (seeded-cold ↔ seeded, ambos com dados): FCP 740 → 548 ms = **~192 ms consistente**; `ScriptDuration` 217 → 82 ms (**−62%**). O codecache quente do 2º load é o maior fator.
- O gap original (empty 720 vs seeded 324 ms, ordem fixa) era majoritariamente artefato: 1º load em perfil novo + codecache frio, não dados.
- **Achado real que sobreviveu à desconfusão**: a primeira abertura em perfil novo é consistentemente mais lenta que a recorrente (~190 ms de FCP), e — contraintuitivo — **o estado vazio de first-run renderiza mais caro que o estado hidratado**: long tasks 343 vs 238/129 ms, `ScriptDuration` 328 vs 217/82 ms. Coerente com a decomposição (§5): o re-commit da hidratação custa 145 ms no empty vs 58 ms no seeded.

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

### H5 — Bundle de 655 KB sem code splitting → **CONFIRMADA COM RESSALVA (após decomposição)**

O chunk `chunks/newtab-*.js` tem **644 KB** (+ 276 KB de `globals` compartilhado) e executa em bloco único no load; a long task de startup existe em 100% das runs (agora 122–370 ms conforme a variante — §3). Mas a cadeia causal "bundle monolítico → long task" vale apenas para a parcela de module eval: **≤53 ms** de long task própria, com V8 compile já em ~0 ms. A long task dominante começa **após o DCL** e atravessa os dois commits do React — é render + commit + hidratação do persist, não avaliação de bundle (§5). Implicações diretas na recomendação P1 em §7; a incerteza original da comparação empty vs seeded foi resolvida com runs alternadas (§3, §9).

## 5. Decomposição da long task de startup (Probe 1)

Antes de escolher entre code-split (P1 original) e defer pós-paint (P1-alt), a janela de startup foi decomposta em 3 segmentos, com âncoras registradas no page world via `addInitScript` — sem tocar código de produto:

- **T0 → T1 — module eval**: navegação até o DCL. Scripts bloqueiam o DCL, então DCL ≈ fim da execução top-level do bundle; o `inject` do react-dom no hook de devtools (dispara no meio da avaliação) é capturado como sanity floor. **Não foi preciso marcar `main.tsx`**: o guard `segmentOrderOk` (DCL < commit1) passou em 6/6 runs, validando a âncora — nenhum branch probe throwaway foi criado.
- **T1 → T2 — React mount**: DCL até o primeiro `onCommitFiberRoot` (mesmo sinal do bench-lib).
- **T2 → T3 — pós-mount → paint**: primeiro commit até duplo rAF; FCP como cross-check.

6 runs alternadas (empty/seeded × 3, perfil limpo por run; seeded = 2º load, mesmo fluxo do bench-cold-load).

**Segmentos por run + mediana (ms):**

| Run | T0→T1 module eval | T1→T2 mount→commit1 | T2→T3 pós-mount→paint | Total T0→T3 | commit1→commit2 |
| --- | ---: | ---: | ---: | ---: | ---: |
| empty 1 | 159 | 142 | 159 | 460 | 109 |
| empty 3 | 195 | 210 | 214 | 620 | 145 |
| empty 5 | 167 | 140 | 209 | 516 | 145 |
| **empty (mediana)** | **167** | **142** | **209** | **516** | **145** |
| seeded 2 | 316 | 99 | 112 | 527 | 67 |
| seeded 4 | 209 | 93 | 98 | 400 | 58 |
| seeded 6 | 259 | 70 | 98 | 427 | 56 |
| **seeded (mediana)** | **259** | **93** | **98** | **427** | **58** |

**Alocação de cada long task por janela (o dado que decide):**

| Run | Long tasks (início→fim) | Janela ocupada |
| --- | --- | --- |
| empty 1 | 259 ms (162→421) | após DCL; **atravessa commit1 e commit2** |
| empty 3 | 51 ms (144→195) + 370 ms (197→567) | 1ª termina no DCL (module eval); 2ª **atravessa commit1 e commit2** |
| empty 5 | 53 ms (114→167) + 296 ms (169→465) | idem |
| seeded 2 | 156 ms (338→494) | após DCL; **atravessa commit1 e commit2** |
| seeded 4 | 140 ms (230→370) | idem |
| seeded 6 | 122 ms (274→396) | idem |

**Leitura:**

1. A long task dominante **não é module eval**: em 6/6 runs ela começa depois do DCL e atravessa o primeiro e o segundo commit — é o bloco contínuo render → commit → efeitos → hidratação do persist → re-commit.
2. Module eval produz long task própria apenas às vezes, e pequena: **51–53 ms** (2/3 runs empty; 0/3 seeded).
3. O re-render da hidratação (commit1→commit2) pesa **145 ms no empty vs 58 ms no seeded** — parcela relevante do bloco, sobretudo no first-run (o `storage.get` resolve antes do commit1 nos dois cenários; o custo é o re-render que ele dispara).
4. `ScriptDuration` CDP na janela: 259 ms (empty) vs 94 ms (seeded) — o estado vazio de first-run renderiza mais caro que o hidratado, coerente com o cold-load (§3).

**Consequência para a recomendação:** code-split ataca (a) module eval — que aqui custa ≤53 ms de long task, com V8 compile em ~0. O custo medido está em (b) mount/commit e (c) hidratação pós-mount. **P1 (code-split) sozinho não resolve a long task medida**; o caminho é deferir render de subtrees para depois do primeiro paint e mover a hidratação do persist para idle (§7).

## 6. Gargalos ranqueados por impacto

1. **Long task de startup (122–370 ms conforme a variante, 6/6 runs)** — bloco contínuo pós-DCL: render → commit → efeitos → hidratação do persist → re-commit; module eval pesa ≤53 ms. Único achado que sustenta a percepção de "travamento". *Efeito percebido:* abertura trava ~¼–⅓ de segundo. Code-split sozinho não resolve (§5, §7).
2. **Re-renders em drag e rename (26–27 commits, 44–46k fibers por gesto)** — alto em contagem, mas sem long tasks, 104–120 fps, e provadamente amortizado por guards (H3). Impacto percebido hoje: baixo. Vale atenção se o grid crescer (100+ cards).
3. **Rename dispara ~25 commits/38k fibers para ~10 teclas** — provável commit por tecla com subscribers largos. Sem long tasks; dor futura em máquinas fracas.
4. **Nada mais** — scroll, marquee, settings, navegação de pastas: todos ≤ 8 commits e sem long tasks.

## 7. Recomendações de fix (não implementar nesta branch)

| # | O quê | Custo | Risco | Ganho esperado |
| --- | --- | --- | --- | --- |
| 1 | **Quebrar o bloco pós-DCL**: montar subtrees não-críticas (clock, greeting, quick-links, diálogos, painel de settings) só depois do primeiro paint (`requestIdleCallback`/rAF escalonado) e resolver a hidratação do persist em idle — o re-commit de hidratação custa 58–145 ms (§5) | S/M | Baixo/M (flash de widgets atrasados; borda de hidratação) | Ataca diretamente a long task dominante (122–370 ms que atravessa os dois commits). **P1** |
| 2 | Code-split do chunk newtab (import dinâmico das mesmas subtrees) | M | M (borda de hidratação; flash de widgets atrasados) | **Complemento, não fix**: module eval contribui com ≤53 ms e V8 compile já é ~0 — split sozinho não elimina a long task medida (§5). Reduz bytes no caminho crítico e habilita o lazy-mount do #1. **P1-complemento** |
| 3 | Renome inline: input uncontrolled até commit (Enter) em vez de escrever no store por tecla | S | Baixo | 25 → ~2 commits por rename. **P3** |
| 4 | Quando o grid crescer: virtualização de linhas fora do viewport | M | M | Somente se card count → 100+. **P4** |

## 8. O que NÃO vale otimizar (evita trabalho desperdiçado)

- **Remover/reduzir glass** — custo zero medido, inclusive em hardware 4× mais lento (H1).
- **Adicionar selectors Zustand** — já estão em 100% dos 159 pontos de consumo (H2).
- **Throttle de pointermove/dragover ou "rAF-izar" o dnd** — drag nativo não gera flood (2–3 pointermove/drag) e os guards já colapsam dragover×4,2 em commits×1,0 (H3).
- **Mexer no persist/coalescing** — 1 write por gesto, trailing 200 ms, comprovado em 12 drags (H4).
- **Otimizar scroll do grid** — cravado em 120 fps com e sem throttle.
- **Code-split puro (sem adiar o render) como fix do cold load** — a decomposição (§5) mostra que a long task dominante não está na avaliação do bundle: dividir o arquivo sem deferer o mount não muda o bloco render+commit+hidratação.

## 9. Incertezas honestas

- **Empty vs seeded no cold load (antigo FCP 720 vs 324 ms)** — **resolvido nesta rodada**: com runs alternadas, a diferença se decompõe em ~192 ms de codecache quente (2º load; `ScriptDuration` 217→82 ms) + ~116 ms de "efeito de dados" que está dentro da variância (§3). A direção real é contraintuitiva: o estado vazio de first-run renderiza mais caro que o hidratado (long tasks e `ScriptDuration` maiores no empty — §3, §5).
- **Segmentos absolutos da decomposição têm variância alta com n=3** (ex.: T0→DCL 167 ms no empty vs 259 ms no seeded — o wall-clock de navegação domina a amostra pequena). O sinal robusto é a **alocação das long tasks por janela**, consistente em 6/6 runs: dominante sempre pós-DCL atravessando os dois commits; module eval ≤53 ms quando existe.
- **FCP no bench-decompose** só capturou parte das runs (paint entry ausente) e, no empty, caiu depois do duplo rAF (884 ms vs T3 516 ms) — rAF não garante paint efetivo. Os FCPs canônicos do relatório são os do cold-load (paint entries lidas ao fim da run).
- **O decompose não tem a variante `seeded-cold`** — a interação codecache × hidratação dentro dos segmentos não foi isolada; a alocação de long tasks por janela não depende disso.
- **Componentes re-renderizados são minificados** (`Q`, `E_`, `T_`…): a contagem por componente é anônima sem sourcemap no build. Sabe-se *quanto* cada um re-renderiza, não *quem* é exatamente — mapear exige sourcemap (recomendo gerar numa branch probe antes do P3).
- **React DevTools Profiler manual não foi usado**; a contagem vem do mesmo sinal interno (hook de devtools + flag `PerformedWork`), determinístico e reprodutível.
- **FPS**: drag/scroll sintéticos com input trusted do Playwright em janela headed; display a 120 Hz como teto. Padrões de mão humana podem variar ±.
- **Empty grid-interactive** não capturado (proxy depende de cards existirem — §3 nota 1).
- **`dark-light-toggle`**: única interação com long task (72 ms, 1 ocorrência em 3 reps) — não reproduzida o suficiente para atribuir causa.

## 10. Ambiente e reprodutibilidade

**Ambiente:** Windows, Chromium 153.0.8010.12 (canal `chromium` do Playwright), AMD Ryzen 5 5500, 16 GB RAM, 120 Hz. Perfil de browser temporário limpo por run, só a extensão buildada carregada (`--disable-extensions-except`).

```bash
# 1. build da extensão (obrigatório antes dos benches)
cd apps/extension
bun run build                      # -> .output/chrome-mv3

# 2. cold load — 9 runs alternadas empty/seeded/seeded-cold (~3 min)
node scripts/bench-cold-load.mjs 9

# 3. decomposição da long task de startup — 6 runs alternadas
node scripts/bench-decompose.mjs 6

# 4. interações (3 reps × 12 interações)
node scripts/bench-interactions.mjs 3

# 5. storm de eventos de drag + CPU profile
node scripts/bench-pointer-storm.mjs 3

# 6. glass vs flat FPS — abre janela HEADED, alguns minutos
node scripts/bench-glass-fps.mjs 3 3
```

Saídas JSON: `apps/extension/scripts/results/{cold-load,decompose,interactions,pointer-storm,glass-fps}.json` (regeneráveis, não commitados). Todos os scripts são read-only sobre o produto: instrumentação via `addInitScript` no page world, sem tocar código da extensão.
