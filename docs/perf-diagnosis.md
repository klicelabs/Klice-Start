# Diagnóstico de performance — Klice Start (newtab)

**Branch:** `perf/diagnosis` · **Data:** 2026-09-21 · **Modo:** medição apenas — nenhum arquivo de produto foi modificado (`git diff main --name-only` = vazio antes deste commit).

**Atualização (2026-09-21, 2ª rodada — probes de decomposição):** a long task de startup foi decomposta em module eval / mount / pós-mount (§5) e a comparação empty vs seeded foi refeita com variantes alternadas que eliminam o viés de ordem (§3). Nenhuma marca foi adicionada ao código de produto: a âncora DCL provou-se válida (guard `segmentOrderOk` em 6/6 runs), então o branch throwaway `perf/probe-decompose` **não foi necessário** e não existe marca temporária em lugar nenhum.

**Atualização (2026-09-21, 3ª rodada — probe de re-render):** as interações reportadas como travadas foram decompostas em timeline (input → commits → settle, §6) e a identidade dos componentes re-renderizados foi obtida com build não minificado throwaway (`perf/probe-rerender-sourcemap`, não commitado). O teste de comentar o empty-landing foi executado em branch throwaway e o resultado está na §6.2. Nenhum arquivo de produto foi commitado nesta branch.

**Atualização (2026-09-21, 4ª rodada — probe de atribuição + A/B de overlays, branch `perf/probe-overlay-isolation`):** o bloco dominante de ~110–145 ms foi atribuído por CPU profile fatiado ao gap inter-commit (§6.5) e as duas variantes de isolamento de overlays (unmount vs isolate) foram medidas em branches throwaway contra baseline fresco (§6.6). O probe também revelou um erro metodológico do probe anterior, corrigido em §6.7: a contagem de fibers por `PerformedWork` inclui flags antigas (stale) de fibers não revisitadas — ela mede largura de árvore (fresh+stale), não re-renders do gesto. Nenhum arquivo de produto foi commitado nesta branch (`git diff main --name-only` = só `docs/` e `apps/extension/scripts/bench-*`).

---

## 1. Sumário executivo

O gargalo real não é o glass, nem o Zustand, nem o dnd, nem writes de storage. Das 5 hipóteses levantadas, **4 foram descartadas com dados** — os números mostram que o time de engenharia acertou nas escolhas (selectors em todos os 159 pontos de consumo, coalescing de 200ms no persist, rAF no marquee, guards funcionais no dnd). O único achado confirmado é o **cold load**: a abertura produz 1 long task dominante (122–370 ms conforme a variante) — exatamente o sintoma "trava ao abrir" que motivou este diagnóstico. A decomposição (§5) mostrou que ela **não** é a avaliação do bundle monolítico: em 6/6 runs a tarefa dominante começa **após o DCL** e atravessa o primeiro e o segundo commit do React — é o bloco contínuo render → commit → efeitos → hidratação do persist → re-commit. Module eval contribui com no máximo 51–53 ms. Durante o uso (drag, marquee, scroll, settings) a página roda a 104–120 fps, sem long tasks, com 1 write coalescido por gesto. Consequência prática: **code-split sozinho não resolve o custo medido** — o caminho é deferir trabalho para depois do primeiro paint (§8).

**Achado da 3ª rodada (§6): o cold load não é o único gargalo relevante.** As transições reportadas como travadas (abrir/fechar Preferences, trocar de pasta, voltar) têm 0 long tasks >50 ms, mas decompõem-se em **cascata de 4–9 commits de 1–3k fibers cada, com um trecho bloqueado de ~110–145 ms no meio** — janelas reais de 165–405 ms (a tabela antiga da §3 somava 300–700 ms de espera programática do harness à janela). A identidade dos componentes (build unminified throwaway) mostra a causa-raiz comum nos dois sintomas: **uma árvore larga em que overlays fechados (painel de settings, menu de contexto, popovers) permanecem montados e re-renderizam a cada mudança de estado** — inclusive na navegação de pastas, que nada tem a ver com eles. O empty-landing foi testado diretamente e **excluído** como culpado (§6.2). Consequência: um só programa de fix com duas táticas — não montar/isolar overlays fechados (transições + re-commit de hidratação) e deferir o primeiro mount (cold load) — §8.

## 2. Metodologia

**Automatizada** (harness compartilhado + 5 benches Playwright em `apps/extension/scripts/`, Chromium real com a extensão MV3 buildada carregada, perfil temporário limpo por run, nenhuma outra extensão):

- `bench-lib.mjs` — harness compartilhado: contador de commits React via `__REACT_DEVTOOLS_GLOBAL_HOOK__` (conta roots + fibers com flag `PerfomedWork` — equivalente programático ao React DevTools Profiler), interceptação de `chrome.storage.local.set` no page world (timestamps + bytes), `PerformanceObserver` de long tasks, rAF FPS sampler, observer de grid-ready (proxy de interatividade). A 3ª rodada adicionou o `TIMELINE_SCRIPT`: cada commit registra **timestamp, nº de fibers e nomes dos componentes** (walk de `PerformedWork` dentro de `onCommitFiberRoot` — os nomes pertencem ao commit exato, pois o React limpa a flag no início de cada render), marcas de input **trusted** (pointerdown/keydown em capture), watchdog de gaps de frame >16 ms e log de writes de storage.
- `bench-cold-load.mjs [runs=9]` — perfil novo por run; **3 variantes alternadas por índice de run** para eliminar o viés de ordem da medição original: `empty` (1º load, sem dados), `seeded` (2º load, dados + codecache quente) e `seeded-cold` (dados escritos via service worker antes de qualquer load → 1º load com dados e codecache frio). A diferença empty↔seeded-cold isola o efeito puro de dados; seeded-cold↔seeded isola o efeito puro de codecache. Navigation Timing, FCP, grid-ready, long tasks de startup, `ScriptDuration` via CDP `Performance.getMetrics` (resource-timing não registra chunks de extensão).
- `bench-decompose.mjs [runs=6]` — decompõe a janela de startup: T0→T1 module eval (âncora DCL, com o `inject` do react-dom como sanity floor), T1→T2 React mount (âncora primeiro `onCommitFiberRoot`), T2→T3 pós-mount→paint (duplo rAF + FCP cross-check). Captura ainda o 2º commit (re-render da hidratação do persist), a chegada do `chrome.storage.local.get` e aloca cada long task por janela. Guard `segmentOrderOk` recusa o relatório se o DCL disparar depois do primeiro commit (não ocorreu: 6/6 runs válidas).
- `bench-rerender-names.mjs [runs=3]` — **Frente A do probe de re-render**: nomes e contagens por commit no first-run empty, com foco no re-commit de hidratação (commit1→commit2). Identidade de componentes citada da rodada contra build **unminified throwaway** (contagens verificadas idênticas ao build de produção; timings não são citados do build throwaway).
- `bench-transition-timeline.mjs [reps=3] [sufixo]` — **Frente B do probe de re-render**: para cada interação reportada como travada (abrir Preferences, fechar Preferences, navegar tabbar, abrir pasta do grid, voltar), fatia a janela input→commit1→commitN→settle, com jank >16 ms (watchdog de frames), writes de storage e nomes de componentes agregados por janela. O settle medido é a **última atividade** da janela — não o prazo de detecção de quietude.
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

> **Correção de métrica (3ª rodada):** a coluna "Duração (ms)" desta tabela media wall-clock incluindo o settle **programático** do harness (300–700 ms de espera deliberada pós-gesto). As janelas reais de trabalho, medidas pela timeline da §6, são de 165–405 ms. A percepção de travamento é real; o número antigo inflava a janela com a espera do harness.

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

O chunk `chunks/newtab-*.js` tem **644 KB** (+ 276 KB de `globals` compartilhado) e executa em bloco único no load; a long task de startup existe em 100% das runs (agora 122–370 ms conforme a variante — §3). Mas a cadeia causal "bundle monolítico → long task" vale apenas para a parcela de module eval: **≤53 ms** de long task própria, com V8 compile já em ~0 ms. A long task dominante começa **após o DCL** e atravessa os dois commits do React — é render + commit + hidratação do persist, não avaliação de bundle (§5). Implicações diretas na recomendação P1 em §8; a incerteza original da comparação empty vs seeded foi resolvida com runs alternadas (§3, §10).

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

## 6. Decomposição das transições e settings (Probe 2)

O relatório anterior sub-ponderou as interações porque usou long task (>50 ms) como métrica primária — e as interações reportadas como travadas têm 0 long tasks: o trabalho vem fatiado em pedaços que, somados, custam centenas de ms. Este probe instrumentou **timeline completa por interação** (input trusted → cada commit com timestamp → settle) e a **identidade dos componentes re-renderizados** via build não minificado throwaway (`perf/probe-rerender-sourcemap`, `minify: false`, não commitado — desvio do plano de sourcemap documentado na §10: `function.name` em runtime dá a mesma identidade sem maquinaria de source-map; as contagens de fibers são idênticas nos dois builds, verificado run a run, e nenhum número de timing é citado do build throwaway).

### 6.1 Frente A — o que re-renderiza no re-commit de hidratação (commit1→commit2)

3 runs empty contra o build unminified (mesmo protocolo do bench-decompose; mediana commit1→commit2 = 97 ms, coerente com as 101–113 ms dos builds minificados):

- O startup empty produz **9 commits, e todos re-renderizam a árvore inteira**: 637–683 fibers com flag `PerformedWork` em cada um (sequência por run: 655 → 683 → 653 → 639 → 638 → 637 → 640 → 676 → 650). Seis commits nos primeiros ~175 ms e três tardios (+392 a +621 ms, 640–676 fibers cada — após o paint; candidatos: wallpaper/imagens/fonts; não investigados, fora do escopo).
- Top do commit2 (o re-commit da hidratação, 683 fibers) **por nome** (fibers por commit, mediana de 3 runs):

| Componente | fibers/commit |
| --- | ---: |
| Icon | 84 |
| ContextMenuItem + ContextMenuItemBase | 35 + 35 |
| SettingsLabel | 22 |
| AnimatePresence | 20 |
| ContextMenuContent + ContextMenuSeparator | 10 + 10 |
| Switch | 10 |
| RangeSlider | 9 |
| IconModeTile + IconAppTile | 8 + 8 |
| PresenceChild + PopChild + PopChildMeasure | 7 + 7 + 7 |
| SelectRoot | 7 |

**Descoberta central: internos do painel de Settings e do menu de contexto re-renderizam no boot com o painel FECHADO** — Switch, RangeSlider, IconModeTile, SettingsLabel, ContextMenuItem. E o commit1 (montagem inicial) já os contém (SettingsLabel 99, SettingRow 93, ContextMenuTrigger, Tooltips): **a árvore hidratada é inteira — overlays fechados permanecem montados e conectados**. Mecanismo consistente com re-render dirigido por pai: quando um ancestral re-renderiza, a subtree inteira desce — selectors Zustand não impedem re-render propagado de pai. Isso **não contradiz a H2**: o problema não é falta de selector, é estrutura de árvore.

### 6.2 Frente A — teste do empty-landing (hipótese específica)

`<EmptyLanding>` removido do JSX (`emptyState={null}`) em branch throwaway (App.tsx revertido depois; nada commitado), build unminified, 6 runs alternadas (3 empty + 3 seeded), guard `segmentOrderOk` ok nas duas condições:

| Métrica (empty, mediana de 3) | com EmptyLanding | sem EmptyLanding | Δ |
| --- | ---: | ---: | ---: |
| commit1→commit2 | 112,7 ms | 99,0 ms | −13,7 ms (−12%) |
| Total T0→T3 | 446,8 ms | 411,3 ms | −35,5 ms |
| FCP | 800 ms | 748 ms | −52 ms |
| Long tasks na janela | 255 ms | 227 ms | −28 ms |

**Veredito: empty-landing NÃO é o culpado.** O critério do probe era queda de commit1→commit2 para <30 ms; caiu só ~14 ms (12%), ficando perto dos ~99–113 ms das demais medições. O custo do re-commit é o re-render da árvore inteira (§6.1), não o empty state. (EmptyLanding tem custo de montagem one-time modesto: ~35–52 ms no total/FCP.) Cross-check no seeded: 70,5 → 58,8 ms, mesma direção.

### 6.3 Frente B — timeline das interações (input → commit1 → commitN → settle)

Instrumentação nova (`bench-transition-timeline.mjs`): marca de input no evento **trusted** (pointerdown/keydown em capture), timestamp de cada commit, watchdog de frames >16 ms, settle = **última atividade** da janela (commit, gap, write de storage, long task) — não o prazo de detecção de quietude. Build de produção (minificado), 3 reps por interação, intervalo entre reps:

| Interação | input→c1 (ms) | c1→cN (ms · commits) | janela total (ms) | bloqueada >16 ms (ms) | fibers |
| --- | ---: | ---: | ---: | ---: | ---: |
| Abrir Preferences — 1ª vez | 5 | 161 · 4 | 403 | 309 | 6 151 |
| Abrir Preferences — 2ª/3ª | 3 | 161–164 · 4 | 167–238 | 0–33 | 6 155 |
| Fechar Preferences | 3 | 244–249 · 5 | 246–254 | 0–42 | 7 703 |
| Navegar tabbar | 10–14 | 200–206 · 8 | 214–216 | 0–159 | 8 878–12 378 |
| Abrir pasta do grid | 9–11 | 206–214 · 8 | 214–223 | 0–83 | 8 251 |
| Voltar (botão Back) | 15–19 | 207–260 · 8–9 | 226–275 | 65–115 | 11 113–12 474 |

**O dado que decide: cascata com um bloco dominante, não 1 commit grande.** O espaçamento dos commits repete a mesma estrutura em todas as interações (medianas por rep): 1–2 commits rápidos → **um trecho contínuo de ~110–145 ms entre dois commits** (tabbar `[41, 1, 109, 1, 35, 18, 0]`; fechar prefs `[15, 145, 1, 85]`; voltar `[25, 1, 123, 3, 18, 48, 0, 41]`) → 2–4 commits pequenos de cauda. Nenhuma interação se decompõe em 1 commit de ~500 ms — nem em 20 commits uniformes de ~30 ms. Input→commit1 é rápido (3–19 ms): o atraso percebido não está na resposta ao input, está na fila de re-renders que o gesto desencadeia.

Exceção qualitativa: **a 1ª abertura de Preferences** bloqueia 309 ms (maxGap 117 ms) — carregamento do chunk + primeira montagem do painel; nas 2ª/3ª abre, o bloqueado cai para 0–33 ms. (Coerente com a H5: existe code splitting de settings, mas o primeiro mount paga a conta.)

Componentes re-renderizados por interação (build unminified, soma de 3 reps) — **o mesmo elenco em todas**, inclusive nas navegações de pasta, que nada têm a ver com eles:

| Componente (invisível durante o gesto) | tabbar | abrir pasta | voltar | abrir prefs | fechar prefs |
| --- | ---: | ---: | ---: | ---: | ---: |
| Icon | 5 330 | 3 915 | 5 587 | 2 892 | 3 615 |
| ContextMenuItem (+Base) | 5 952 | 3 408 | 6 904 | 4 512 | 5 640 |
| AnimatePresence | 660 | 663 | 688 | 324 | 405 |
| SettingsLabel | 504 | 504 | 525 | 252 | 315 |
| Switch | 240 | 240 | 250 | 120 | 150 |

Menu de contexto (ContextMenuItem — 700–2 800 fibers sinalizados por gesto), internos de settings (Switch, SettingsLabel, Select) e popovers aparecem em cada troca de pasta, cada abrir/fechar de painel e cada voltar. (Correção §6.7: a contagem inclui flags antigas de mount — no close, contadores mostram 0 execuções de itens de menu; na navegação, ~metade das execuções é descida propagada e o resto é mount.)

### 6.4 Resposta às perguntas do probe

- **Mesma causa para cold load e transições? Sim, na causa-raiz** (com correção de mecanismo na §6.7): uma árvore larga e sempre montada, incluindo overlays fechados. No boot ela se manifesta como 1 long task dominante (bloco render→commit→hidratação→re-commit atravessando os 2 commits, §5); nas transições, como cascata de 4–9 commits com um trecho de ~110–145 ms. Nem toda mudança re-renderiza tudo — no close, menus executam 0× (só mantêm flags antigas); na navegação, a descida propagada existe (~metade das execuções de itens) somada a mounts. O empty-landing foi excluído como culpado (§6.2).
- **Fix único ou separado? Um programa, duas táticas (§8)**: (a) **não manter overlays fechados montados/conectados** — desmontar o painel de settings e menus quando fechados, ou isolar a subtree (memo/portal fora da árvore que muda) — ataca as transições e o re-commit de hidratação do boot; (b) **deferir o primeiro mount** de subtrees não-críticas para pós-paint — ataca o cold load (§5). A tática (a) é nova neste probe e não estava em nenhuma recomendação anterior; é a que ataca o sintoma que o usuário reportou.

> **Revisão na 4ª rodada (§6.5–§6.7):** a tática (a) foi testada diretamente e **não move o tempo de transição** — o bloco dominante não é JS de overlay (§6.5), e desmontar 70–86% da árvore sinalizada não muda a janela (§6.6). A causa-raiz "árvore larga" sobrevive (a árvore larga existe e custa mount/commit), mas o alvo do fix muda: fase de commit/efeitos + agendamento, não overlays. Ver §8 reescrita.

### 6.5 Frente A — atribuição do bloco dominante por CPU profile

**Método** (`bench-transition-cpuprofile.mjs`, commit `b4878ae`): para cada gesto, profile de amostragem CDP (200 µs) do pré-gesto ao settle; as amostras são mapeadas ao relógio da página por interpolação linear entre o `performance.now()` registrado logo após `Profiler.start` e logo antes de `Profiler.stop` (±~5 ms de skew IPC nas bordas — irrelevante num gap de ~110–145 ms) e fatiadas ao gap inter-commit dominante (maior espaçamento entre commits da janela, mesma definição da §6.3). Agregação por gap: self time por função, total (inclusivo, amostra creditada a todos os ancestrais) e agrupamento por subtree (frame mais interno da pilha com nome conhecido; sem match = `(unattributed)`, sem inventar). Nomes legíveis exigem o build unminified throwaway (`perf/probe-cpuprofile-unminified`, `minify: false` não commitado, descartado após a medição — mesmo protocolo do probe anterior): **shares e nomes vêm desse build; nenhum timing de janela é citado dele** (os canônicos continuam os do build minificado, §6.3). 3 interações × 3 reps.

**O gap reproduz no unminified** (larguras não-canônicas, estrutura idêntica à §6.3): fechar-prefs 139/145/147 ms; tabbar 100/129/112 ms; abrir-pasta 93/140/231 ms (a rep 3 de abrir-pasta é cauda tardia pós-write de storage, não o bloco inter-commit típico — ver variância abaixo). Amostras no gap: 170–257/close, 175–229/tabbar, 132–410/abrir-pasta. Overhead do próprio harness (`walk` do `PerformedWork` dentro do `onCommitFiberRoot`): ≤0,6% do self no gap (~25% das pilhas perto das bordas por skew, ~35 ms totais em 3 reps no close — registrado, não muda o veredito).

**Top self time no gap (soma de 3 reps; o bloco NÃO é JS de overlay):**

| Interação (amostras no gap) | Top self |
| --- | --- |
| fechar-prefs (678) | `(idle)` 515 (76%), `(program)` 73 (10,8%), `getBoundingClientRect` 43 (6,3%, sob `measure` do `LiquidGlass`) — resto: crumbs de 1–6 amostras (`query`, `elementsFromPoint`, `removeChild`, `measureScroll`, 1 amostra cada de `processBatch`, `scheduleTaskForRootDuringMicrotask`, `createWorkInProgress`) |
| tabbar-nav (600) | `(idle)` 221 (36,8%), `(program)` 179 (29,8%), `measureScroll` 35 (5,8%, `GoToTopButton`), `toDataURL` 29 (4,8%, sob `createDisplacementMap` do `LiquidGlass`), `setAttribute` 11, resto ≤3 |
| abrir-pasta (786) | `(idle)` 572 (72,8%), `(program)` 68 (8,7%), `toDataURL` 48 (6,1%, sob `createDisplacementMap`), `elementsFromPoint` 7, `measureScroll` 6, `getBoundingClientRect` 5, resto crumbs |

Por rep, o `(idle)` varia 64–80% (close), 23–52% (tabbar), 20–90% (abrir-pasta, rep 3 = cauda de 231 ms majoritariamente idle). `(program)` = trabalho nativo na main thread (style/layout/paint). O único JS de produto com self mensurável são leitores de layout em efeitos passivos (`LiquidGlass.measure` → `getBoundingClientRect`/`getComputedStyle` com `setGeometry` → `createDisplacementMap` → canvas `toDataURL` com cache por geometria; `GoToTopButton.secondRowCells` via `offsetTop`) e escritas DOM do próprio react-dom (`setAttribute`/`setProp`).

**Top total (inclusivo) — a maquinaria de commit do react-dom domina:** `commitPassiveMountOnFiber`/`recursivelyTraversePassiveMountEffects`, `commitMutationEffectsOnFiber`/`recursivelyTraverseMutationEffects`, `commitLayoutEffectOnFiber`, `performWorkOnRoot`. Funções de render de componentes (`renderWithHooks`, `workLoopSync`) aparecem com 1–3 amostras: o render do próximo commit é barato; o gap é efeitos de commit + nativo + idle.

**Subtrees (share das amostras do gap):** fechar-prefs — `(unattributed)` 89,4%, react-dom-internals 8,7%, popover/dialog 1,2%, motion 0,4%, **settings-overlay 0,1%, toolbar 0,1%**; tabbar — 77,2% / 18,7% / motion 2,5% / **context-menu 0,7% / grid-card-icon 0,7%** / ambient 0,3%; abrir-pasta — 85,2% / 12,5% / motion 0,9% / context-menu 0,5% / popover 0,5% / ambient 0,3% / settings 0,1%. **Nenhum componente de produto passa de ~1% das amostras em nenhuma interação.** 91–93% do trabalho nativo não tem ancestral no bundle (`(no-bundle-ancestor)` — callbacks internas do browser).

**Veredito da Frente A: o bloco dominante NÃO é overlay.** Se overlays dominassem, veríamos `ContextMenuItem`, `Settings*`, `Icon`, `DialCard` no top self — vemos `(idle)` + `(program)` + travessia de efeitos do react-dom. Overlays participam como **largura da árvore (combustível)**, não como **executor nomeado**: a travessia de efeitos (`recursivelyTraverse*`) e o style/layout visitam a árvore inteira, e os únicos JS de produto no gap são medições de layout pós-mutação e regeneração de displacement maps do glass em superfícies recém-montadas. Desmontar overlays pode encolher a fração JS+layout do bloco, mas **não toca a maioria idle** — expectativa de ganho parcial, nunca eliminação. Isso decide o fix #1: ele ataca o alvo errado como P1 (§8 reescrita).

### 6.6 Frente B — A/B de isolamento de overlays (unmount vs isolate)

**Variantes** (branches throwaway a partir de `perf/probe-rerender`, nunca mergeadas, deletáveis sem impacto):

- **V1 `perf/probe-overlay-unmount` (`2c6374c`)** — desmonta quando fechado: `SettingsMotionSidebar` retorna `null` com `phase === "closed"`; `ContextMenuContent` (motion, `@klice-start/ui`) retorna `null` com `!context.open`. Inclui um ajuste obrigatório descoberto no probe: montar-aberto nunca dispara o `transitionend` do transform, então o `inert` do slot ficaria armado para sempre (painel visível-porém-morto — botões sem hit-test); o mount-aberto pula o `inert` inicial. Popovers/tooltips seguem o caminho original (Base UI já monta `Popup` sob demanda; tooltips não aparecem nos tops). Sem warm-up em idle (não testado — risco residual).
- **V2 `perf/probe-overlay-isolate` (`313aac0` + `2ec8a4b`)** — mantém montado, bloqueia o re-render propagado: `SettingsMotionSidebar` vira boundary `memo` sem props (o re-render do `App` na navegação não desce; os seletores zustand internos continuam disparando em mudanças genuínas); `ContextMenuContent` vira `memo` com comparador na raiz do overlay (descidas do pai bloqueadas; mudanças de `open` continuam re-renderizando via propagação de contexto, sempre com props atuais — aberturas seguem frescas). Estratégia escolhida por ser a mais cirúrgica (2 arquivos, DOM quente preservado). Uma primeira tentativa (retornar o portal escondido por referência cacheada) mostrou-se insuficiente sozinha; o `memo` na raiz conteve.

**Medição:** um build minificado limpo por variante (`.output/` apagado entre builds) + baseline fresco na mesma máquina/era; `bench-transition-timeline.mjs 3 <baseline|unmount|isolate>`; comparação por `bench-overlay-ab.mjs` (commit `d9c222d`). `open-preferences` separada em rep 0 (fria: chunk + 1º mount) vs reps 1–2 (mornas) — a série misturada esconderia exatamente o trade-off que discrimina as variantes. Execuções reais (contadores de corpo de função, n=1 por condição, builds com contadores sem mudança de comportamento) complementam as contagens de flags (ver §6.7 por que flags sozinhas enganam).

**Tabela comparativa (medianas de 3 reps; fibers = contagem de flags fresh+stale, ver §6.7):**

| Métrica | baseline | V1 unmount | V2 isolate |
|---|---:|---:|---:|
| Navegar tabbar — janela (ms) | 222 | 215 (−3%) | 215 (−3%) |
| Navegar tabbar — fibers | 11 018 | 1 579 (−86%) | 11 022 (+0%) |
| Abrir pasta — janela (ms) | 221 | 214 (−3%) | 222 (+0%) |
| Abrir pasta — fibers | 8 251 | 1 519 (−82%) | 8 251 (+0%) |
| Voltar — janela (ms) | 233 | 216 (−7%) | 226 (−3%) |
| Voltar — fibers | 11 113 | 1 668 (−85%) | 11 117 (+0%) |
| Fechar Preferences — janela (ms) | 249 | 249 (0%) | 247 (−1%) |
| Fechar Preferences — fibers | 7 703 | 2 280 (−70%) | 7 708 (+0%) |
| 1ª abertura Preferences — janela (ms) | 393 | 275 (**−30%**) | 392 (0%) |
| 1ª abertura — bloqueado (ms) | 366 | 266 (−27%) | 342 (−7%) |
| 2ª/3ª abertura — janela (ms) | 203,5 | 164,5 (−19%)¹ | 200 (−2%) |
| Commits no close / no open | 5 / 4 | 6 (+1) / 7 (+3) | 5 / 4 |

¹ Variância alta no warm do baseline (reps 244/163 ms); ler o −19% como ausência de regressão, não como vitória provada.

**Execuções reais (contadores, baseline vs V2):** no close, itens de menu executam **0× nas duas variantes** — menus nunca re-renderizaram no close; os ~5 600 fibers de `ContextMenuItem` na janela são flags antigas de mount (§6.7). No tabbar-nav, baseline executa +118 itens (60 mounts + 58 por descida propagada) vs V2 +60 (só mounts) — o `memo` bloqueia ~50% das execuções de itens na navegação. No open, 0 execuções de menu em todas as condições.

**Veredito da Frente B — nenhuma variante ganha na transição; cada ponta tem um vencedor diferente, e a ponta principal (transição) não se move:**
- **Transições (tabbar/pasta/voltar/fechar): V1 −3% e V2 −2% na média das janelas — dentro do ruído.** Cortar 70–86% da árvore sinalizada (V1) ou ~50% das execuções de itens (V2) não move o relógio. A cascata de 8 commits mantém os mesmos espaçamentos; o tempo é dirigido por agendamento/efeitos, não por trabalho de render (converge com §6.5).
- **1ª abertura de Preferences: V1 vence folgado (−30% janela, −27% bloqueado)** — contraintuitivo e a favor do unmount: montar fresco sem a cascata da árvore montada custa menos que montar sobre ela. V2 empata o baseline (esperado: mesma árvore).
- **Re-abertura morna: V1 164,5 vs baseline 203,5 (sem regressão; ver nota ¹), V2 200 (=).** O trade-off temido do unmount ("re-pagar o mount toda vez") **não se materializou**: com o chunk em cache, montar custa ~165 ms de janela — igual ou melhor que reutilizar o painel morno.
- **Custos da V1:** +1 commit no close e +3 no open (efeitos de mount/unmount); acoplamento com o ciclo de vida do `inert`/transição (footgun real encontrado neste probe — unmount ingênuo embarca painel morto); latência de abertura de **menu de contexto** não medida (nenhum gesto do bench abre menu — risco residual); warm-up em idle não testado.
- **V2:** mudança de comportamento zero fora do alvo (mesmos commits, mesmas janelas), isolamento de execução comprovado por contadores, DOM quente preservado — mas sem nenhum ganho mensurável em 4 métricas de 5.

**Resposta direta à pergunta do probe:** a variante que "ganha nas duas pontas" é a **V1** (transição empatada, aberturas melhores), mas a conclusão honesta é maior que o A/B: **o fix #1, em qualquer variante, não ataca o gargalo das transições.** Implementá-lo como P1 de transição seria otimizar a métrica errada (flags/execuções) enquanto o relógio não se move.

### 6.7 Correção metodológica: flags `PerformedWork` antigas (stale) — fibers ≠ re-renders

**Achado:** no mesmo build, com o mesmo gesto de fechar Preferences (fechamento verificado via `data-settings-open`), os contadores de execução marcam **0 renders** de providers/contents/itens de menu — mas o walk por `flags & 1` sinaliza **2 820 `ContextMenuItem` + 2 820 `ContextMenuItemBase`** na janela. A aritmética fecha exatamente como stale de mount: ~188 itens montados × 2 fibers (wrapper + base) × 5 commits = ~1 880/rep ≈ 940+940 medidos. O bit 1 é o marcador "rendered" do próprio Profiler do React (`0 !== (flags & 1) && logComponentRender` no `react-dom` embarcado) — mas ele **persiste em fibers não revisitadas**: o React só limpa/redefine flags ao longo do caminho visitado pelo render; subtrees isoladas (ex.: pelo `memo` da V2) ou fora do caminho de atualização mantêm as flags do mount. O walk conta **fresh + stale**.

**Impacto no relatório anterior:** as contagens "fibers re-renderizados" da §6.1/§6.3 são na verdade **largura de árvore sinalizada (fresh+stale)** — superestimam o trabalho de re-render do gesto. O que sobrevive: a árvore larga existe e permanece montada (a V1 prova a composição ao encolhê-la 70–86%); os timings (janelas, gaps, commits) e o CPU profile (§6.5, que mede execução real por amostragem) **não são afetados**. A identidade dos componentes por janela continua válida como "quem está montado e ativo na janela", não como "quem executou no gesto". Para execução real, usar contadores (§6.6) ou profile.

## 7. Gargalos ranqueados por impacto

1. **Long task de startup (122–370 ms conforme a variante, 6/6 runs)** — bloco contínuo pós-DCL: render → commit → efeitos → hidratação do persist → re-commit; module eval pesa ≤53 ms. Um dos dois achados que sustentam a percepção de "travamento". *Efeito percebido:* abertura trava ~¼–⅓ de segundo. Code-split sozinho não resolve (§5, §8).
2. **Cascata de commits nas transições (Probes 2–4, §6.5–§6.7)** — abrir/fechar Preferences, navegar tabbar, abrir pasta e voltar: 4–9 commits com um trecho contínuo de ~110–145 ms no meio; janelas reais de 165–405 ms; 0 long tasks >50 ms (por isso invisível à métrica antiga). O bloco dominante **não é JS de overlay**: o CPU profile (§6.5) mostra travessia de efeitos do react-dom + trabalho nativo (style/layout/paint) + maioria idle/agendamento, com componentes de produto em ≤1% das amostras; e o A/B (§6.6) mostra que encolher a árvore sinalizada em 70–86% não move a janela. A árvore larga com overlays montados existe e custa mount/commit (combustível), mas o relógio é dirigido por agendamento e fase de commit — e as contagens de fibers da §6 incluem flags antigas (§6.7). *Efeito percebido:* cada transição engasga ~¼ de segundo. Alvo do fix: §8 nova P1.
3. **Re-renders em drag e rename (26–27 commits, 44–46k fibers por gesto)** — alto em contagem, mas sem long tasks, 104–120 fps, e provadamente amortizado por guards (H3). Impacto percebido hoje: baixo. Vale atenção se o grid crescer (100+ cards).
4. **Rename dispara ~25 commits/38k fibers para ~10 teclas** — provável commit por tecla com subscribers largos. Sem long tasks; dor futura em máquinas fracas.
5. **Nada mais** — scroll e marquee: cravados em ~120 fps, commits amortizados.

## 8. Recomendações de fix (não implementar nesta branch)

**Reescrita na 4ª rodada.** O programa do Probe 2 mandava atacar overlays como P1 das transições. A 4ª rodada testou a hipótese duas vezes, com dois métodos independentes, e a hipótese perdeu nas duas: o executor do bloco não é overlay (CPU profile, §6.5) e remover 70–86% da árvore sinalizada não move a janela (A/B, §6.6). Manter o #1 antigo como P1 seria implementar contra o dado. Abaixo, o programa corrigido.

| # | O quê | Custo | Risco | Ganho esperado |
| --- | --- | --- | --- | --- |
| 1 | **Atacar a fase de commit/efeitos das transições (alvo novo, vindo do dado)**: (a) eliminar leituras forçadas de layout dentro de efeitos — `LiquidGlass.measure` (`getBoundingClientRect` + `getComputedStyle` por superfície a cada commit que a toca) e `GoToTopButton.measureScroll`/`secondRowCells` (`offsetTop`); medir uma vez por geometria e assinar `ResizeObserver` só onde muda; (b) conter a regeneração de displacement maps do glass (`createDisplacementMap` + `toDataURL` por geometria nova em cada navegação que monta cards — cache por chave já existe, mas misses em massa no mount; considerar mapa compartilhado por classe de tamanho ou caminho GPU); (c) reduzir a cascata 8→menos commits por gesto, agrupando atualizações de store que hoje se encadeiam via efeitos passivos (o espaçamento dos commits não mudou com árvore 86% menor — é agendamento, não trabalho); (d) tirar a cauda de `storage.set` do caminho crítico percebido (a rep anômala de 231 ms em abrir-pasta é espera pós-write). Instrumentar com o próprio `bench-transition-cpuprofile.mjs`: o fix funciona se o self `(program)`+efeitos por gap cair, não se as flags caírem | M | M (regressão visual do glass se o mapa for reutilizado errado; batching de store muda semântica de undo — cobrir com os testes de history) | Único candidato com apoio causal ao sintoma reportado (transições travadas): ataca o executor medido em §6.5. **P1 nova** |
| 2 | **Quebrar o bloco pós-DCL**: montar subtrees não-críticas (clock, greeting, quick-links, diálogos, painel de settings) só depois do primeiro paint (`requestIdleCallback`/rAF escalonado) e resolver a hidratação do persist em idle — o re-commit de hidratação custa 58–145 ms e re-renderiza a árvore inteira (§5, §6.1) | S/M | Baixo/M (flash de widgets atrasados; borda de hidratação) | Ataca diretamente a long task dominante (122–370 ms que atravessa os dois commits). **P1 (mantida)** |
| 3 | Code-split do chunk newtab (import dinâmico das mesmas subtrees) | M | M (borda de hidratação; flash de widgets atrasados) | **Complemento, não fix**: module eval contribui com ≤53 ms e V8 compile já é ~0 — split sozinho não elimina a long task medida (§5). Reduz bytes no caminho crítico e habilita o lazy-mount do #2. **P1-complemento (mantido)** |
| 4 | **Higiene de árvore: desmontar overlays fechados, estilo V1 (rebaixado de P1 para P2)**: vence a 1ª abertura de Preferences (−30% janela, −27% bloqueado) e não regride a re-abertura morna; encolhe a árvore sinalizada 70–86%. NÃO esperar ganho em transições (medido: 0). Condições de embarque: resolver o acoplamento com o ciclo `inert`/transição (mount-aberto sem `transitionend` = painel morto — footgun documentado em §6.6), medir a latência de abertura de menu de contexto (não coberta por este probe) e decidir warm-up em idle com dado, não com medo | S (a variante throwaway tem ~15 linhas em 2 arquivos) | M (os três itens das condições de embarque) | Ganho real porém localizado: abertura de Preferences + árvore menor para o commit atravessar. **P2** |
| 5 | Renome inline: input uncontrolled até commit (Enter) em vez de escrever no store por tecla | S | Baixo | 25 → ~2 commits por rename. **P3 (mantido)** |
| 6 | Quando o grid crescer: virtualização de linhas fora do viewport | M | M | Somente se card count → 100+. **P4 (mantido)** |

**Unificação (resposta à 4ª rodada):** cold load e transições NÃO compartilham o alvo — compartilham apenas o tema "árvore larga". O boot é bloco render→commit→hidratação (atacar com #2); as transições são cascata agendada + efeitos de commit + nativo (atacar com a nova #1). Overlays viraram #4 (P2): higiene válida, sem promessa de transição. A correção metodológica da §6.7 redefine como medir o progresso: **o critério de um fix de transição é a janela input→settle e o self por gap no CPU profile, nunca a contagem de flags** — flags caem 86% sem o relógio se mover.

**Riscos residuais honestos:** (a) o `(idle)` majoritário no gap (20–90% por rep) não está distinguido entre espera em fence do compositor e ociosidade do agendador — um trace (`chrome://tracing`) decide, fora do escopo; se for fence de raster em software (headless), parte do gap pode evaporar em hardware real; (b) latência de abertura de menu de contexto nas variantes: não medida; (c) warm-up em idle da V1: não testado; (d) `blockedMs` do watchdog tem variância alta com n=3 (ex.: tabbar baseline 108 ms vs V1 0 ms) — as janelas são o sinal robusto, os gaps são contexto.

## 9. O que NÃO vale otimizar (evita trabalho desperdiçado)

- **Remover/reduzir glass** — custo zero medido, inclusive em hardware 4× mais lento (H1).
- **Adicionar selectors Zustand** — já estão em 100% dos 159 pontos de consumo (H2).
- **Throttle de pointermove/dragover ou "rAF-izar" o dnd** — drag nativo não gera flood (2–3 pointermove/drag) e os guards já colapsam dragover×4,2 em commits×1,0 (H3).
- **Mexer no persist/coalescing** — 1 write por gesto, trailing 200 ms, comprovado em 12 drags (H4).
- **Otimizar scroll do grid** — cravado em 120 fps com e sem throttle.
- **Code-split puro (sem adiar o render) como fix do cold load** — a decomposição (§5) mostra que a long task dominante não está na avaliação do bundle: dividir o arquivo sem deferer o mount não muda o bloco render+commit+hidratação.
- **Reescrever/otimizar o EmptyLanding** — removê-lo por inteiro do boot muda commit1→commit2 em apenas −12% (112,7→99,0 ms, §6.2). Não é o gargalo do boot nem das transições.

## 10. Incertezas honestas

- **Empty vs seeded no cold load (antigo FCP 720 vs 324 ms)** — **resolvido nesta rodada**: com runs alternadas, a diferença se decompõe em ~192 ms de codecache quente (2º load; `ScriptDuration` 217→82 ms) + ~116 ms de "efeito de dados" que está dentro da variância (§3). A direção real é contraintuitiva: o estado vazio de first-run renderiza mais caro que o hidratado (long tasks e `ScriptDuration` maiores no empty — §3, §5).
- **Segmentos absolutos da decomposição têm variância alta com n=3** (ex.: T0→DCL 167 ms no empty vs 259 ms no seeded — o wall-clock de navegação domina a amostra pequena). O sinal robusto é a **alocação das long tasks por janela**, consistente em 6/6 runs: dominante sempre pós-DCL atravessando os dois commits; module eval ≤53 ms quando existe.
- **FCP no bench-decompose** só capturou parte das runs (paint entry ausente) e, no empty, caiu depois do duplo rAF (884 ms vs T3 516 ms) — rAF não garante paint efetivo. Os FCPs canônicos do relatório são os do cold-load (paint entries lidas ao fim da run).
- **O decompose não tem a variante `seeded-cold`** — a interação codecache × hidratação dentro dos segmentos não foi isolada; a alocação de long tasks por janela não depende disso.
- **Componentes re-renderizados** — **resolvido na 3ª rodada**: a identidade foi obtida com build unminified throwaway (`perf/probe-rerender-sourcemap`, `minify: false` — desvio do plano de sourcemap: `function.name` em runtime dá a mesma identidade sem maquinaria de source-map). Contagens verificadas idênticas entre os builds (fibers iguais run a run); **nenhum número de timing é citado do build throwaway** (§6).
- **O bloco dominante de ~110–145 ms entre commits não está atribuído a funções** — a timeline mostra QUANDO o trabalho acontece, não QUEM o executa (sem CPU profile na janela das interações). O harness já tem `startCpuProfile` pronto para esse próximo probe.
- **n=3 reps por interação, com variância alta no tempo bloqueado** (tabbar 0–159 ms; voltar 65–115 ms). O padrão estrutural — cascata de 4–9 commits + bloco dominante + elenco de overlays fechados — é consistente em todas as reps e nos dois builds.
- **input→commit1 tem piso de latência CDP** (~5–15 ms entre o dispatch do Playwright e o pointerdown visto no page world) — os 3–19 ms medidos são teto aproximado, não valor absoluto.
- **Settle = última atividade instrumentada** (commit, gap de frame, write de storage, long task); o paint efetivo por janela não é observado diretamente (o duplo rAF do decompose cobre só o startup).
- **A 1ª rodada da Frente B foi descartada por contaminação**: importar o seed de `bench-interactions.mjs` executou o `main()` dele (top-level sem guard), rodando um 2º Chromium em paralelo — detectada pelas janelas anômalas (12 s, 143–159 "commits"), corrigida ao mover `buildInteractionSeed` para o `bench-lib.mjs`. Os números citados são da rodada limpa. Os gaps >16 ms do watchdog são quantizados pelo rAF (limiar ~16,9 ms): blocos menores não aparecem.
- **React DevTools Profiler manual não foi usado**; a contagem vem do mesmo sinal interno (hook de devtools + flag `PerformedWork`), determinístico e reprodutível.
- **FPS**: drag/scroll sintéticos com input trusted do Playwright em janela headed; display a 120 Hz como teto. Padrões de mão humana podem variar ±.
- **Empty grid-interactive** não capturado (proxy depende de cards existirem — §3 nota 1).
- **`dark-light-toggle`**: única interação com long task (72 ms, 1 ocorrência em 3 reps) — não reproduzida o suficiente para atribuir causa.
- **Flags `PerformedWork` antigas (4ª rodada, §6.7)** — correção aplicada: contagens de fibers das rodadas anteriores misturam renders frescos com flags de mount em fibers não revisitadas (evidência: 0 execuções vs 2 820 sinalizações no mesmo build/gesto; aritmética exata 188 itens × 2 fibers × 5 commits). Timings, CPU profile e conclusões de tree-shrink não são afetados; a linguagem "fibers re-renderizados" das §6.1/§6.3 deve ser lida como "árvore sinalizada".
- **`(idle)` vs rAF-bloqueado (4ª rodada)** — paradoxo aberto: o watchdog não vê rAF no gap (thread ocupada) enquanto o profiler vê 20–90% de amostras sem pilha JS. Candidatos: espera em fence do compositor/GPU (headless usa raster em software) vs ociosidade do agendador entre efeitos. Distinguir exige trace de sistema, fora do escopo — o veredito "não é overlay" independe da resposta.
- **Mapeamento de relógio do CPU profile** — interpolação linear start/stop com skew IPC de ~5 ms nas bordas; amostras a <5 ms da borda do gap são limítrofes. O gap tem 93–147 ms; o skew não move shares.
- **Cauda de storage em abrir-pasta rep 3 (unminified)** — gap dominante de 231 ms pós-write, 90% idle, natureza distinta do bloco inter-commit (reps 1–2: 93/140 ms). Mantida no agregado sem cherry-pick; a mediana (140 ms) a absorve sem distorcer.
- **Nomes minificados entre builds** — a atribuição de nomes a letras minificadas muda com o grafo de módulos (ex.: `E_`↔`D_` permutam entre baseline e V2); comparar contagens por posto, nunca letras entre builds. Identidades de componente vêm do run unminified (§6.3/§6.5).
- **`blockedMs` com n=3** — variância alta (tabbar baseline 108 ms, V1 0 ms, V2 25 ms); janelas input→settle são o sinal, gaps são contexto.
- **Contadores de execução n=1 por condição** — suficientes para o veredito qualitativo (0 vs 60 vs 118), insuficientes para quantificar o bloqueio da V2 com precisão.
- **Abertura de menu de contexto e warm-up em idle da V1** — não medidos (nenhum gesto do bench abre menu); risco residual registrado na §8.

## 11. Ambiente e reprodutibilidade

**Ambiente:** Windows, Chromium 153.0.8010.12 (canal `chromium` do Playwright), AMD Ryzen 5 5500, 16 GB RAM, 120 Hz. Perfil de browser temporário limpo por run, só a extensão buildada carregada (`--disable-extensions-except`).

```bash
# 1. build da extensão (obrigatório antes dos benches)
cd apps/extension
bun run build                      # -> .output/chrome-mv3

# 2. cold load — 9 runs alternadas empty/seeded/seeded-cold (~3 min)
node scripts/bench-cold-load.mjs 9

# 3. decomposição da long task de startup — 6 runs alternadas
node scripts/bench-decompose.mjs 6

# 3b. nomes dos componentes do re-commit de hidratação (3 runs empty)
node scripts/bench-rerender-names.mjs 3

# 3c. timeline das transições (5 interações × 3 reps)
node scripts/bench-transition-timeline.mjs 3

# 3d. atribuição do bloco dominante por CPU profile — 3 interações × 3 reps
# (nomes legíveis exigem o build unminified throwaway; janelas desse run NÃO
# são canônicas). Saída: results/transition-cpuprofile-<sufixo>.json
node scripts/bench-transition-cpuprofile.mjs 3 names

# 3e. A/B de isolamento de overlays — um build limpo por condição, mesmo bench
node scripts/bench-transition-timeline.mjs 3 baseline
node scripts/bench-transition-timeline.mjs 3 unmount
node scripts/bench-transition-timeline.mjs 3 isolate
node scripts/bench-overlay-ab.mjs baseline unmount isolate

# 4. interações (3 reps × 12 interações)
node scripts/bench-interactions.mjs 3

# 5. storm de eventos de drag + CPU profile
node scripts/bench-pointer-storm.mjs 3

# 6. glass vs flat FPS — abre janela HEADED, alguns minutos
node scripts/bench-glass-fps.mjs 3 3
```

Saídas JSON: `apps/extension/scripts/results/{cold-load,decompose,rerender-names,transition-timeline,interactions,pointer-storm,glass-fps}.json` (regeneráveis, não commitados). Todos os scripts são read-only sobre o produto: instrumentação via `addInitScript` no page world, sem tocar código da extensão.

**Identidade de componentes (nomes legíveis)** — build throwaway: a partir de `perf/probe-rerender`, criar branch throwaway, adicionar `build: { minify: false }` em `vite()` no `wxt.config.ts`, `bun run build`, rodar `bench-rerender-names.mjs 3` e `bench-transition-timeline.mjs 3 names` (sufixo separa os JSONs), descartar a branch sem commitar. O build de produção (minificado) permanece o canônico para timings.

**Throwaways da 4ª rodada (todas partindo de `perf/probe-rerender`, nenhuma mergeada, nenhuma com efeito sobre esta branch):**

| Branch | Conteúdo (commits próprios) | Propósito |
| --- | --- | --- |
| `perf/probe-cpuprofile-unminified` | sem commits — só `minify: false` não commitado + build | nomes legíveis p/ §6.5; descartada após `transition-cpuprofile-names.json` |
| `perf/probe-overlay-unmount` | `2c6374c` (+16/−1 em 3 arquivos) | variante V1 p/ §6.6 (`transition-timeline-unmount.json`) |
| `perf/probe-overlay-isolate` | `313aac0`, `959cf23`, `2ec8a4b`, `d7168aa`, `aeb0701` | variante V2 + marcadores + contadores de diagnóstico p/ §6.6/§6.7 |
| `perf/probe-baseline-counters` | `9ba6a27` (só contadores, sem mudança de comportamento) | referência de execuções baseline + `transition-timeline-baseline.json` |
