<div align="center">
  <img src="apps/extension/public/icon/icon128.png" alt="Klice Start icon" width="96" />
</div>

# Klice Start

Klice Start replaces the browser's new tab with a personal dashboard for saved pages. It combines visual cards, nested folders, search, and lightweight customization in a local-only browser extension.

## What it does

- **Save pages as visual cards** from the extension popup, the page context menu, or the keyboard shortcut (`Alt+Shift+D`; `Command+Shift+D` on macOS).
- **Organize with nested folders** and reorder cards and folders with drag and drop. Changes can be undone and redone.
- **Find saved pages** by title or URL without opening them first.
- **Show page previews** captured from the browser. Missing previews can be captured automatically when you visit a saved page, after granting optional `<all_urls>` site access in Settings. You can also refresh previews manually.
- **Import browser bookmarks** from HTML files exported by Chromium, Firefox, or Vivaldi.
- **Personalize the dashboard** with bundled or custom wallpapers, background styles, and controls for the clock, greeting, search, and cards.

## Privacy and permissions

Klice Start is a single-device extension. It does not require an account, backend, or sync service. Dashboard setup is stored in browser local storage; image data such as captured previews is stored in IndexedDB.

Automatic preview capture requires optional `<all_urls>` site access. The extension asks for that access through its Settings consent flow; you can use the dashboard without enabling it. The build does not require environment variables or a database.

## Architecture

The browser extension is the product. It is an MV3 extension built with WXT, Vite, React, TypeScript, and Zustand.

- `apps/extension/entrypoints/newtab/` - new-tab dashboard.
- `apps/extension/entrypoints/popup/` - save the current page.
- `apps/extension/entrypoints/background.ts` - browser menus and screenshot capture.
- `apps/extension/src/` - UI components, state, storage, and browser integrations.
- `apps/extension/scripts/` - product tests, browser E2E harnesses, and separate diagnostic benchmarks.
- `packages/ui/` - shared interface primitives.

The repository also contains web and database workspaces for other development. `apps/web/` and `packages/db/` are not required to build or run the extension; the database workspace is an unused Drizzle/PostgreSQL scaffold. See [product notes](docs/PRODUCT.md) and [architecture notes](docs/ARCHITECTURE.md) for more detail.

## Develop the extension

Requirements: [Bun](https://bun.sh) 1.3.13 and Chrome/Chromium or Firefox.

Install dependencies from the repository root, then start the extension workspace:

    bun install --frozen-lockfile
    cd apps/extension
    bun run dev

WXT serves the development build on port `5555` and writes it under `.output/chrome-mv3-dev/`. For Firefox, run `bun run dev:firefox`; its development build is under `.output/firefox-mv3-dev/`.

To create a production build, run these commands from `apps/extension/`:

    bun run build
    bun run build:firefox

The unpacked builds are written to `.output/chrome-mv3/` and `.output/firefox-mv3/`. Load the matching directory as an unpacked/temporary extension in your browser (`chrome://extensions` in Chrome or `about:debugging` in Firefox).

To create browser store archives, run `bun run zip` for Chromium or `bun run zip:firefox` for Firefox. The Firefox command also creates a sources archive under `.output/`.

## Tests and checks

Run the extension checks from `apps/extension/`:

    bun run compile
    bun test scripts/

The browser E2E harnesses run against a production build and use Playwright with Chromium:

    bun run build
    bun scripts/verify-auto-capture-e2e.mjs
    node scripts/verify-thumbnail-refresh-e2e.mjs

The auto-capture harness uses Bun; the thumbnail-refresh harness uses Node. These E2E scripts are manual browser checks, separate from the Bun unit tests. The `bench-*.mjs` scripts are diagnostic tools rather than tests; see [their notes](apps/extension/scripts/README.md).

From the repository root, `bun run check` runs Biome checks and applies its formatting fixes.

<details>
<summary>Other monorepo scripts</summary>

These root-level commands support the other workspaces; they are not needed for extension development.

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start development tasks across workspaces with Turborepo. |
| `bun run build` | Build workspaces with a build task. |
| `bun run dev:web` | Start the `apps/web/` development server. |
| `bun run check-types` | Run workspace type-check tasks. |
| `bun run db:push` | Push the Drizzle schema. |
| `bun run db:generate` | Generate Drizzle migrations. |
| `bun run db:migrate` | Apply Drizzle migrations. |
| `bun run db:studio` | Open Drizzle Studio. |
| `bun run deploy:setup` | Link the web workspace to a Vercel project. |
| `bun run dev:vercel` | Run Vercel's local development environment. |
| `bun run env:preview` | Sync local environment variables to Vercel Preview. |
| `bun run env:production` | Sync local environment variables to Vercel Production. |
| `bun run deploy:check` | Preview a Vercel deployment without uploading. |
| `bun run deploy` | Create a Vercel Preview deployment. |
| `bun run deploy:prod` | Deploy to Vercel Production. |

Vercel commands target the web workspace and require a linked Vercel project. Local `.env` files are not uploaded automatically; sync the relevant environment before deploying.

</details>
