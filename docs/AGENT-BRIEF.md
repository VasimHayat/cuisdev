# Phase 1 tool-building brief

You are implementing one or more tools for Cuisdev, a privacy-first developer-tools site.
Read, in this order: `CLAUDE.md`, `CONTRIBUTING.md`, `ARCHITECTURE.md`, then the reference
implementation in `src/tools/base64/` (all six files) and `tests/e2e/tools/base64.spec.ts`.

## Environment

- You are in a **git worktree** on your own branch. Run `npm ci` first (node_modules are not shared).
- **Do not add npm dependencies.** Everything you need is installed: `codemirror` + `@codemirror/*`,
  `yaml`, `papaparse`, `fast-xml-parser`, `ajv`, `ajv-formats`, `jsonpath-plus`, `hash-wasm`, `qrcode`.
  If something is truly missing, implement it by hand or say so in your final report.
- Do not edit shared files (`src/lib/*`, `src/components/*`, `src/styles/*`, `src/layouts/*`,
  `package.json`, `tests/e2e/a11y.spec.ts`, `tests/e2e/shell.spec.ts`). If a shared change is
  unavoidable, keep it minimal and call it out explicitly in your report. New icons: you may append
  to `src/components/icons.ts` only if none of the existing icons fit.
- Windows machine. Use `PLAYWRIGHT_CHANNEL=chrome` and your assigned `PW_PORT` for browser tests:
  `PLAYWRIGHT_CHANNEL=chrome PW_PORT=<port> npx playwright test tests/e2e/tools/<slug>.spec.ts`
  (build first: `npx astro build`). Never run `astro preview`.
- Commit your work on your branch when done (Conventional Commits, one commit per tool is ideal).

## Per tool

1. Scaffold: `npm run new-tool -- <slug> --name "<Name>" --category <cat> --icon <icon>`.
2. `logic.ts`: pure functions, no DOM. Throw `Error` subclasses with **helpful, specific messages**
   (what is wrong, where, how to fix). Handle edge cases: empty input, huge input, unicode, BOM,
   Windows line endings.
3. `logic.test.ts`: cover every exported function, every error branch, round-trips, edge cases.
   Aim for 15+ focused tests per tool.
4. `meta.ts`: this is the SEO. Real, useful content — not filler:
   - `seoTitle` ≤ 50 chars, primary keyword first, e.g. `"JSON to YAML Converter Online — Free"`.
   - `description` 110–160 chars with primary keyword + privacy hook.
   - `tagline` ≤ 100 chars.
   - `intro`: 3 paragraphs (what it is / why this one is good / privacy).
   - `howTo`: 3–5 imperative steps matching the actual UI labels.
   - `example`: realistic input/output.
   - `faq`: 5–6 questions people actually Google, each answered accurately in 2–4 sentences.
   - `keywords`: 8–12 phrases. `related`: slugs of other Phase 1 tools (they may not exist in your
     worktree — the registry validates `related` at build time, so **only reference tools you are
     building yourself or `base64`**; I will wire cross-links at integration).
5. `Tool.astro` + `client.ts`: use the shared chrome (`.tool`, `.tool__options`, `.tool__panes`,
   `.tool__pane`, `.tool__pane-header`, `.tool__actions`, `.tool__status`, `.btn`, `.field__*`,
   `.segmented`, `.choice`). Every tool has: live output as you type (debounced), Copy, Clear,
   Sample (loads a realistic example), Download where it makes sense, an error status via
   `setStatus(el, msg, 'error')`. Code-like inputs (JSON/YAML/XML) use `mountEditor` from
   `@/lib/editor` and show parse errors inline via `setDiagnostics` + `parseErrorOffset`.
6. `tool.scss`: only what the shared chrome doesn't cover, scoped under `.tool-<slug>`.
7. `tests/e2e/tools/<slug>.spec.ts`: happy path through the real UI, at least one error state,
   Clear, Copy (assert button flashes "Copied!"), and any option that changes output. Use the
   helpers in `tests/e2e/helpers.ts`. Specs run on desktop and Pixel 7 automatically.
8. **Mobile**: check your tool at 390px wide — no horizontal scroll, controls wrap, editors usable.
9. Verify: `npx vitest run src/tools/<slug>`, `npx astro check`, `npx eslint src/tools/<slug> tests`,
   `npx stylelint "src/tools/<slug>/*.scss"`, `npx prettier --check src/tools/<slug> tests`,
   `npx astro build`, then the Playwright spec (both projects). Fix everything before committing.

## Quality bar

- No inline `style=""` (CSP). No `innerHTML` with user data (escape or use textContent).
- Accessible: every control labelled, errors announced via the `role="status"` element,
  keyboard operable. axe runs on every page in CI.
- Handle large inputs (1 MB JSON) without freezing: keep work synchronous but efficient; no
  quadratic string building.
- Copy must be truthful. Never claim features the tool does not have.

## Final report (keep it short)

Branch name, worktree path, list of tools with slug, unit test count, e2e test count, anything
you could not finish, and any shared-file edits.
