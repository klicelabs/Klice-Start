# Klice Start — Resumo Técnico

> Levantamento feito direto do código em `C:\Dev\klice-start`, em 2026-09-21.  
> Versão da extensão: **1.2.3** · 196 commits · ~27.5k LOC em `apps/extension` + ~9.3k LOC em `packages/ui`.  
> Onde a documentação divergir do código, o código manda — os conflitos estão marcados com ⚠️.

---


## 1. Stack & Build

- **Linguagem:** TypeScript, estrito. Não há JS puro em `src/` (só `.mjs` de config: `postcss.config.mjs`).
  - Extensão: `typescript ^5.9.3`. Raiz/`packages/ui`: `typescript ^6` (via catalog).
- **Framework:** **React 19** (extensão usa `react 19.2.4`; catalog aponta `19.2.7`). Não é vanilla JS.
  - `apps/web` é Next.js 16 (app separado, não a extensão).
- **Bundler:** **WXT `^0.20.27`** para a extensão (Vite 8 + Rolldown por baixo). `@wxt-dev/module-react` como módulo.
  - Monorepo orquestrado por **Turborepo** (`turbo.json`).
- **Manifest:** **V3** explícito (`manifestVersion: 3` no `wxt.config.ts`).
  - Firefox MV3 com `browser_specific_settings.gecko.id` fixo + `data_collection_permissions.required: ["none"]`.
- **Gerenciador de pacotes:** **Bun `1.3.13`** (`packageManager` no `package.json` + `bun.lock`). Bun workspaces (`apps/*`, `packages/*`) com `catalog:` para versões compartilhadas.
- **Outras peças de build:** Biome 2.5.2 (lint/format, `bun run check`), tsx (scripts), Vercel CLI (deploy do `apps/web`).

---

## 2. Estrutura de pastas atual

```
klice-start/
├── apps/
│   ├── extension/          # ← o produto (WXT + React 19)
│   ├── web/                # Next.js 16 — landing + scaffold de IA (não é a extensão)
│   └── fumadocs/           # Next.js — docs (scaffold)
├── packages/
│   ├── ui/                 # design system + primitivos shadcn (~9.3k LOC)
│   ├── db/                 # ⚠️ scaffold VAZIO (schema é só `export {}`)
│   ├── env/                # validação de env com zod (@t3-oss/env-core)
│   └── config/             # tsconfig/biome compartilhados
├── docs/
│   ├── product-foundation/ # 9 docs de produto (visão, estratégia, requisitos…)
│   └── technical-foundation/ # 7 docs de arquitetura (draft/target)
├── scripts/                # sync-vercel-env.ts
├── AGENTS.md / CLAUDE.md   # convenção de commits (Conventional Commits, EN)
└── turbo.json · biome.json · vercel.json · bun.lock
```


### Dentro de `apps/extension`

```
apps/extension/
├── entrypoints/
│   ├── background.ts       # service worker
│   ├── newtab/             # App.tsx + main.tsx + index.html
│   └── popup/              # App.tsx + main.tsx + index.html + style.css
├── src/
│   ├── components/newtab/  # ~20 componentes + folders/ search/ settings/ toolbar/
│   ├── components/shared/  # dialogs compartilhados
│   ├── hooks/              # use-clock, use-grid-dnd, use-marquee-selection…
│   ├── lib/                # 39 módulos (storage, idb, glass, dnd, url…)
│   ├── services/           # backup, bookmarks-html, svgl, wallpaper
│   ├── stores/             # 7 stores Zustand
│   ├── styles/tokens.css   # tokens + CSS global da extensão
│   ├── dev/                # seed de desenvolvimento (tree-shaken no build)
│   └── types.ts · types/chrome.d.ts
├── public/                 # _locales/en, icon/, wallpapers/
├── assets/wallpapers-master/  # 11 wallpapers fonte (jpg/avif)
├── scripts/                # verify-store.ts, testes, audit harness
└── wxt.config.ts
```

**Onde fica cada coisa:**

| Peça               | Local                       | Observação                                                                   |
| ------------------ | --------------------------- | ---------------------------------------------------------------------------- |
| **Background**     | `entrypoints/background.ts` | Service worker. Menus de contexto, captura de screenshot, atalho de teclado. |
| **Popup**          | `entrypoints/popup/`        | Só o fluxo "salvar com pasta nova" (aberto como janela 360×500).             |
| **Newtab**         | `entrypoints/newtab/`       | `chrome_url_overrides.newtab` — é aqui que vive 95% do produto.              |
| **Content script** | **não existe**              | Zero `content_scripts` no manifest. Nenhuma injeção em páginas de terceiros. |
| **Options page**   | **não existe**              | Settings são uma tela interna do próprio newtab.                             |

---

## 3. O que já está construído


### Startpage — praticamente completa

- **Layout:** grid de "dials" com 3 tamanhos (`small/medium/large`), `maxColumns` configurável, 3 aspectos de card (`square/horizontal/vertical`) e 2 modos (`card` = capa do site / `icon` = launcher de ícones).
- **Bookmarks/cards:** CRUD completo, título editável, favicon, thumbnail real do site.
- **Pastas visuais aninhadas:** hierarquia ilimitada, com card de preview da pasta e navegação por tabs/breadcrumb no toolbar.
- **Manipulação direta:** drag & drop (incl. entre pastas e reordenação mista pasta↔card via `itemOrder`), seleção múltipla por marquee, seleção com Ctrl/Meta, tray de seleção, "combinar em pasta".
- **Captura de screenshot:** `captureVisibleTab` em background, com fila, debounce de 1.2s, cooldown de falha, geração de navegação para não anexar frame velho. Requer permissão opcional.
- **Quick Links:** faixa de destinos ordenados acima da biblioteca.
- **Widgets:** relógio (24h/segundos opcionais) e saudação personalizável, ambos desligáveis.
- **Busca unificada:** índice local de pastas/cards + motores externos (Google, Bing, DuckDuckGo) + sugestões. **Não é busca semântica.**
- **Import/Export:** import de favoritos (HTML Netscape + `chrome.bookmarks.getTree`) e backup/restore próprio (`services/backup.ts`, `lib/backup-format.ts`). Tem diálogo de conflito com modos "manter atuais" vs "substituir".
- **Wallpapers:** 11 wallpapers empacotados (avif, com thumbs) + frequência de troca + proxy Pexels opcional via `apps/web/api/pexels`.
- **Undo / Redo:** histórico de comandos session-scoped (limite 30) com stacks de undo/redo e diálogo próprio (`history-dialog` / `history-manager`). Cobre `move`, `reorder`, `combine`, `create`, `rename`, `update` e `delete`. Cada entrada é um **delta inverso compacto** (não um snapshot do app) e a descrição é compartilhada entre toast, confirmação e UI — sem strings ad hoc. O gesto de drag é capturado no `dragstart` (`lib/history-capture.ts`), então um gesto gera no máximo uma entrada.
- **Extras:** rest mode, go-to-top, menu de contexto de página.

### IA — **não existe na extensão**

- **Zero** ocorrências de `openai` / `anthropic` / `gemini` / `llm` em `apps/extension`.
- O que **existe** é um **scaffold do Better-T-Stack** em `apps/web`:
  - `src/app/api/ai/route.ts` → `streamText` com `google("gemini-2.5-flash")` via **Vercel AI SDK v7** (`ai ^7.0.13`, `@ai-sdk/google ^4.0.7`).
  - `src/app/ai/page.tsx` → página de chat demo com `useChat` + `streamdown`.
  - Chave `GOOGLE_GENERATIVE_AI_API_KEY` presente em `apps/web/.env`.
  - **Não é feature de produto, não conversa com a extensão.** É o exemplo `--examples ai` do gerador.
- A IA está **planejada** como recurso Pro (ver §7), com princípios canônicos em `docs/product-foundation/04-experience-principles.md` (9 princípios; o teste de design é *"remova a IA: o Klice Start ainda parece o Klice Start?"*).


### Bookmarks — como são armazenados

Três camadas distintas, com papéis bem separados:

| Camada          | O quê                                  | Onde                                                                                                                                              |
| --------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estado leve** | pastas, cards, `itemOrder`, `settings` | `chrome.storage.local`, chave **`perch-setup`**, via Zustand `persist` com adapter próprio (`chromeStorageAdapter`, fallback para `localStorage`) |
| **Imagens**     | thumbnails e wallpapers customizados   | **IndexedDB** `perch-db` (v1), stores `thumbnails` / `backgrounds` (`src/lib/idb.ts`)                                                             |
| **Importação**  | favoritos do navegador                 | `chrome.bookmarks.getTree()` — **somente leitura/import**. A extensão **não** gerencia os bookmarks nativos.                                      |

- ⚠️ A chave continua sendo `perch-setup` (nome antigo do produto, mantido de propósito para não quebrar instalações existentes).
- Toda leitura passa por `normalizeState()` (`lib/storage.ts`), que reconstrói cards com campo fixo e descarta registros inválidos/duplicados.
- Há um "seam" arquitetural documentado (`docs/technical-foundation/03-storage-seam-sync-contract.md`) para trocar o backend local por sync sem mexer na aplicação — **hoje o adapter é local-only**.

### Permissões já declaradas

```jsonc
"permissions": ["storage", "activeTab", "tabs", "contextMenus", "bookmarks"],
"host_permissions": ["http://*/*", "https://*/*"],
"optional_host_permissions": ["<all_urls>"]
```

- `tabs` + `activeTab` → captura de screenshot e leitura de título/favicon/URL.
- `contextMenus` → menu "Save page to Klice Start" com submenu por pasta.
- `bookmarks` → import.
- `optional_host_permissions: <all_urls>` → só pedido em runtime, para captura automática de thumbnail.
- **Não há** `scripting`, `webRequest`, `cookies`, `history` nem `downloads`.
- Comando: `Alt+Shift+D` (`Command+Shift+D` no macOS) → salvar página atual.

---


## 4. UI / Estilo

- **Lib de UI:** **Tailwind CSS v4** (`@tailwindcss/postcss`) + **shadcn/ui** dentro de `packages/ui`.
  - `components.json`: style `base-lyra`, baseColor `neutral`, `cssVariables: true`, iconLibrary `lucide`, registry extra `@beui`.
  - Primitivos: `@base-ui/react ^1.6.0` (não Radix, exceto o slider) + `motion ^13.2.0` + `sonner` (toasts).
- **Design system:** sim, e é sofisticado.
  - `packages/ui/src/styles/globals.css` → tokens shadcn + variante `dark`.
  - `apps/extension/src/styles/tokens.css` → tokens próprios do produto.
  - **Accent colors:** 5 curadas — `blue` (#007aff), `yellow`, `green`, `purple`, `pink` — cada uma com par light/dark (`lib/accent.ts`).
  - **Material modes:** `glass` vs `flat` (`AppearanceMode: "liquid" | "classic"`), com slider contínuo de intensidade do Liquid Glass (0 Ultra Clear → 100 Fully Tinted, default calibrado 60).
  - **Squircle:** sistema próprio via `corner-shape` + `--squircle-r`, com fallback `@supports`.
  - **Motion tokens:** `--ease-out`, `--ease-spring`, `--ease-in-out`, `--ease-drawer`, `--motion-toolbar-duration`.
  - **Tipografia sobre wallpaper:** papel de contraste próprio (`--foreground-on-wallpaper*`), separado do palette de superfície.
  - Convenção documentada: **cursor de seta** para UI clicável normal (sem `cursor: pointer`), exceto exceção conhecida nos labels do diálogo de import.
- **Dark mode:** sim — `ColorScheme = "auto" | "light" | "dark"`, com `auto` seguindo `prefers-color-scheme` (`appearance-provider.tsx`). Também trata `prefers-contrast: more` e `prefers-reduced-motion`.
- **i18n:** ⚠️ **nominal apenas.** Existe `default_locale: "en"` e `public/_locales/en/messages.json` com **2 chaves** (`appName`, `appDesc`), mas **nenhuma chamada** a `browser.i18n` / `getMessage` no código. Toda a UI é **hardcoded em inglês**. (O histórico tem um commit `i18n: replace all PT-BR strings with English` — foi migração de strings, não adoção de framework.)

---


## 5. Estado atual do mascote

**Não existe absolutamente nada.**

- Zero assets: `public/icon/` tem só os PNGs do logo; `assets/` tem só wallpapers fotográficos (jpg/avif). Nenhum SVG, sprite, Lottie ou ilustração no repo.
- Zero referências no código (`mascot`, `mascote`, `character`, `avatar`, `sprite`, `companion` → nenhum hit).
- Zero menções na documentação de produto.

**⚠️ Alerta importante antes de investir nisso.** A brand strategy do projeto (escrita e aprovada, hoje em `docs/product-foundation/deferred/`) posiciona o produto **explicitamente contra** um mascote:

> *"Klice Start should never sound inflated, frantic, clever at the user's expense, or **artificially playful**."*  
> *"Warmth: Warm **without being cute**. Avoid: **Infantilizing the user**."*  
> *"## Illustration Philosophy — Illustration is rare in Klice Start. […] The default is **no illustration**; illustration must earn its place."*  
> *"Klice Start is **not a playful brand**; it is a calm, precise one."*

E `docs/product-foundation/README.md` diz que os docs em `deferred/` **não são binding hoje** — eles governam "uma superfície pública e um time que ainda não existem", e devem ser ativados quando houver landing page / store listing. Ou seja: **o mascote é uma decisão de posicionamento de marca, não uma decisão de UI.** Vale resolver isso antes de desenhar qualquer coisa.

**Onde ele faria sentido tecnicamente** (se a decisão de marca for "sim"):

- **Só na startpage (newtab).** É a única superfície de verdade — não há content script, e o popup é um formulário estreito de 360×500.
- **Nunca no popup** nem em estados de erro do service worker: são superfícies transacionais, e o brand doc manda o tom ser "terse" ali.
- Encostar no **empty state** (`empty-landing.tsx`) é o encaixe mais defensável — é exatamente o caso "warmth without childishness" previsto no doc.
- Lembrar de `prefers-reduced-motion` e do bar de qualidade de UI em `08-product-requirements.md` (motion consistency, performance, reduced motion) antes de dar vida ao personagem.

---


## 6. Restrições / preferências

- **Libs a evitar:** não há banimento explícito documentado. Restrições reais vêm dos anti-requisitos do produto: **nada de feed de notícias, ads/tiles patrocinados, conta obrigatória para o valor core, dark patterns, lock-in por navegador e "features que atrasam o new tab"**.
- **Limite de bundle size:** não há número definido. Há a regra qualitativa: *"Performance is sacred on a high-frequency surface"* e *"no step makes the user wait without feedback"*.
  - Tamanho atual do build `chrome-mv3`: **3.5 MB**, sendo **2.4 MB de wallpapers** e **932 KB de JS** (`newtab` 655 KB, `globals` 280 KB, `popup` 10 KB). O JS é o que merece atenção.
- **Publicação:** **distribuição pública, não uso pessoal.**
  - Já existem artefatos de submissão em `.output/`: `klice-start-1.2.3-firefox.zip` + `klice-start-1.2.3-sources.zip`.
  - O `README.md` tem uma seção dedicada a **"Browser Extension (Firefox / AMO submission)"** com o passo reprodutível do source archive (exigência da Mozilla para código minificado).
  - O `wxt.config.ts` configura `zip.sourcesRoot` cobrindo o workspace inteiro e excluindo `apps/web`, `apps/fumadocs`, `docs`.
  - A product strategy cita Chrome Web Store e Edge Add-ons como canais. A versão do manifest já está em `1.2.3`.
  - ⚠️ Pequena divergência: o README diz que o zip sai como `extension-<version>-firefox.zip`, mas o artefato real é `klice-start-<version>-firefox.zip`.

---

## 7. O que falta

### Bloqueios de documentação / higiene (baratos, alto retorno)

- **README raiz é boilerplate do Better-T-Stack.** Fala de Next.js, Drizzle e PostgreSQL — nada sobre a extensão. Só a última seção é real.
- **⚠️ `docs/technical-foundation/01-system-architecture.md` contradiz o código.** Descreve a extensão como *"vanilla-JS Manifest V3 extension"* com `app.js` e *"no build step (see CLAUDE.md)"*. A realidade é React 19 + TS + WXT + Vite. O `CLAUDE.md` citado **só contém a convenção de commits** — a citação está quebrada.
- **`packages/db` é um scaffold vazio** (`export {}`), mas a raiz expõe scripts `db:push` / `db:migrate` / `db:studio` e o README manda configurar PostgreSQL. Nada disso é usado pela extensão.
- **`apps/web` e `apps/fumadocs` são scaffolding.** O `apps/web` é o exemplo de IA do gerador; não há landing page real do produto.
- **i18n não implementado** apesar de `default_locale` e `_locales/` existirem (ver §4).

### Requisitos "Important" ainda não construídos (de `08-product-requirements.md`)

| #      | Requisito             | Estado                                                                                                                        |
| ------ | --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **I1** | **Cross-Device Sync** | Não feito. É o maior gatilho de conversão paga segundo a estratégia. Existe o "seam" documentado, mas o adapter é local-only. |
| **I2** | **Cloud Backup**      | Não feito. Existe backup/restore **local** (arquivo), não na nuvem.                                                           |
| **I3** | **Bento Widgets**     | Não feito. Hoje só relógio + saudação.                                                                                        |
| **I4** | **AI Organization**   | Não feito. Ver §3 — só há scaffold de chat em `apps/web`.                                                                     |
| **I5** | **Semantic Search**   | Não feito. A busca atual é por substring sobre um índice local.                                                               |

### Outros itens planejados (não comprometidos)

- **Future:** PWA/companion mobile, setups compartilhados + galeria da comunidade, widgets de terceiros/marketplace, contextos de projeto/sessão, resumo de página por IA no momento de salvar, templates de setup avançados.
- **Nice to have:** atalhos de teclado avançados, command palette, modos extras de relógio/data, sons/haptics opcionais, múltiplos search providers.

### Lacunas que o próprio levantamento revelou

- **Mascote** — nada existe, e a brand strategy empurra contra (§5). Decisão de marca pendente.
- **Content script** — inexistente por design. Se algum dia precisar ler/agir em páginas de terceiros, isso é uma mudança de arquitetura + permissões + revisão de store.
- **Nenhum limite de bundle definido** — vale fixar um budget antes que o chunk `newtab` (655 KB) cresça mais, já que "performance is sacred" é anti-requisito.
- **Firefox verificado só estaticamente** — não há Firefox nesta máquina; o comportamento Gecko é validado por inspeção do bundle, não em browser real.

---

## Notas de método

- Contagens de LOC, tamanhos de bundle e presença/ausência de features foram verificadas diretamente no código-fonte e nos artefatos de build, não inferidas da documentação.
- Os dois itens de **débito pré-existente** já diagnosticados no projeto continuam abertos e **não** são regressões: (a) `verify-store.ts` reporta `FAIL round-trip preserves cards` por um bug de comparação (`JSON.stringify` é sensível à ordem das chaves) — todos os valores são idênticos; (b) há exatamente um `cursor:pointer` no CSS buildado, vindo de dois `<label>` no diálogo de import de bookmarks, que é um caso ambíguo frente à convenção de cursor de seta.
