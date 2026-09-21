# Diagnóstico de performance — Klice Start (newtab)

**Branch:** `perf/diagnosis` · **Data:** 2026-09-21 · **Modo:** medição apenas — nenhum arquivo de produto foi modificado (`git diff main --name-only` = vazio antes deste commit).

**Atualização (2026-09-21, 2ª rodada — probes de decomposição):** a long task de startup foi decomposta em module eval / mount / pós-mount (§5) e a comparação empty vs seeded foi refeita com variantes alternadas que eliminam o viés de ordem (§3). Nenhuma marca foi adicionada ao código de produto: a âncora DCL provou-se válida (guard `segmentOrderOk` em 6/6 runs), então o branch throwaway `perf/probe-decompose` **não foi necessário** e não existe marca temporária em lugar nenhum.

**Atualização (2026-09-21, 3ª rodada — probe de re-render):** as interações reportadas como travadas foram decompostas em timeline (input → commits → settle, §6) e a identidade dos componentes re-renderizados foi obtida com build não minificado throwaway (`perf/probe-rerender-sourcemap`, não commitado). O teste de comentar o empty-landing foi executado em branch throwaway e o resultado está na §6.2. Nenhum arquivo de produto foi commitado nesta branch.

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

Menu de contexto (ContextMenuItem — 700–2 800 fibers por gesto), internos de settings (Switch, SettingsLabel, Select) e popovers re-renderizam a cada troca de pasta, cada abrir/fechar de painel e cada voltar.

### 6.4 Resposta às perguntas do probe

- **Mesma causa para cold load e transições? Sim, na causa-raiz**: uma árvore larga em que toda mudança de estado re-renderiza tudo, incluindo overlays fechados. No boot ela se manifesta como 1 long task dominante (bloco render→commit→hidratação→re-commit atravessando os 2 commits, §5); nas transições, como cascata de 4–9 commits com um trecho de ~110–145 ms. O empty-landing foi excluído como culpado (§6.2).
- **Fix único ou separado? Um programa, duas táticas (§8)**: (a) **não manter overlays fechados montados/conectados** — desmontar o painel de settings e menus quando fechados, ou isolar a subtree (memo/portal fora da árvore que muda) — ataca as transições e o re-commit de hidratação do boot; (b) **deferir o primeiro mount** de subtrees não-críticas para pós-paint — ataca o cold load (§5). A tática (a) é nova neste probe e não estava em nenhuma recomendação anterior; é a que ataca o sintoma que o usuário reportou.

## 7. Gargalos ranqueados por impacto

1. **Long task de startup (122–370 ms conforme a variante, 6/6 runs)** — bloco contínuo pós-DCL: render → commit → efeitos → hidratação do persist → re-commit; module eval pesa ≤53 ms. Um dos dois achados que sustentam a percepção de "travamento". *Efeito percebido:* abertura trava ~¼–⅓ de segundo. Code-split sozinho não resolve (§5, §8).
2. **Cascata de re-render nas transições (Probe 2, §6)** — abrir/fechar Preferences, navegar tabbar, abrir pasta e voltar: 4–9 commits de 1–3k fibers cada, com um trecho contínuo de ~110–145 ms no meio; janelas reais de 165–405 ms; 0 long tasks >50 ms (por isso invisível à métrica antiga). O elenco dominante são **overlays fechados** (menu de contexto, internos de settings, popovers) que re-renderizam a cada mudança de estado. *Efeito percebido:* cada transição engasga ~¼ de segundo. Mesma causa-raiz do cold load (árvore larga) — §6.4.
3. **Re-renders em drag e rename (26–27 commits, 44–46k fibers por gesto)** — alto em contagem, mas sem long tasks, 104–120 fps, e provadamente amortizado por guards (H3). Impacto percebido hoje: baixo. Vale atenção se o grid crescer (100+ cards).
4. **Rename dispara ~25 commits/38k fibers para ~10 teclas** — provável commit por tecla com subscribers largos. Sem long tasks; dor futura em máquinas fracas.
5. **Nada mais** — scroll e marquee: cravados em ~120 fps, commits amortizados.

## 8. Recomendações de fix (não implementar nesta branch)

| # | O quê | Custo | Risco | Ganho esperado |
| --- | --- | --- | --- | --- |
| 1 | **Overlays fechados fora da árvore viva**: desmontar painel de settings, menus e popovers quando fechados (ou isolá-los — memo/barreira — para o re-render do pai não descer). Hoje eles re-renderizam a cada mudança de estado: 8–12k fibers por gesto de navegação (§6.3) e o re-commit de hidratação do boot carrega 683 fibers incluindo Settings fechado (§6.1). **Tática nova do Probe 2** | M | M (flash na 1ª abertura — mitigável com warm-up em idle) | Ataca diretamente o sintoma reportado: transições travadas (§6.3) e parte do bloco de boot (§5). **P1** |
| 2 | **Quebrar o bloco pós-DCL**: montar subtrees não-críticas (clock, greeting, quick-links, diálogos, painel de settings) só depois do primeiro paint (`requestIdleCallback`/rAF escalonado) e resolver a hidratação do persist em idle — o re-commit de hidratação custa 58–145 ms e re-renderiza a árvore inteira (§5, §6.1) | S/M | Baixo/M (flash de widgets atrasados; borda de hidratação) | Ataca diretamente a long task dominante (122–370 ms que atravessa os dois commits). **P1** |
| 3 | Code-split do chunk newtab (import dinâmico das mesmas subtrees) | M | M (borda de hidratação; flash de widgets atrasados) | **Complemento, não fix**: module eval contribui com ≤53 ms e V8 compile já é ~0 — split sozinho não elimina a long task medida (§5). Reduz bytes no caminho crítico (incl. a 1ª abertura de Preferences, que bloqueia 309 ms — §6.3) e habilita o lazy-mount do #2. **P1-complemento** |
| 4 | Renome inline: input uncontrolled até commit (Enter) em vez de escrever no store por tecla | S | Baixo | 25 → ~2 commits por rename. **P3** |
| 5 | Quando o grid crescer: virtualização de linhas fora do viewport | M | M | Somente se card count → 100+. **P4** |

**Unificação (resposta ao Probe 2):** cold load e transições compartilham a causa-raiz — árvore larga com overlays fechados montados e conectados. Os fixes #1 e #2 são as duas táticas do mesmo programa (§6.4): #1 ataca o sintoma reportado (transições), #2 ataca o boot; #3 é complemento de ambos.

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

# 4. interações (3 reps × 12 interações)
node scripts/bench-interactions.mjs 3

# 5. storm de eventos de drag + CPU profile
node scripts/bench-pointer-storm.mjs 3

# 6. glass vs flat FPS — abre janela HEADED, alguns minutos
node scripts/bench-glass-fps.mjs 3 3
```

Saídas JSON: `apps/extension/scripts/results/{cold-load,decompose,rerender-names,transition-timeline,interactions,pointer-storm,glass-fps}.json` (regeneráveis, não commitados). Todos os scripts são read-only sobre o produto: instrumentação via `addInitScript` no page world, sem tocar código da extensão.

**Identidade de componentes (nomes legíveis)** — build throwaway: a partir de `perf/probe-rerender`, criar branch throwaway, adicionar `build: { minify: false }` em `vite()` no `wxt.config.ts`, `bun run build`, rodar `bench-rerender-names.mjs 3` e `bench-transition-timeline.mjs 3 names` (sufixo separa os JSONs), descartar a branch sem commitar. O build de produção (minificado) permanece o canônico para timings.
