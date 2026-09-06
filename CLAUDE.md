# Cuisdev — guidance for AI assistants

Read `ARCHITECTURE.md` and `CONTRIBUTING.md` first. `PLAN.md` is the product roadmap.

## Hard constraints

- **No React** (or any UI framework runtime). Astro components + vanilla TypeScript islands only.
- **No Tailwind / utility-class frameworks.** SCSS with ITCSS layers and BEM class names.
- **Nothing leaves the browser.** Tools never call a network endpoint with user data.
- **No inline `style=""`** — the CSP forbids it. Toggle classes or `data-*` attributes.
- **Truthful copy only.** Never add usage numbers, ratings or testimonials that are not real.

## Commands

```bash
npm run dev            # dev server (Astro recommends `astro dev --background` for agents)
npm run validate       # format:check + lint + check + test + build — run before claiming done
npm run test:e2e       # Playwright (needs `npm run build` first; preview server auto-starts)
npm run new-tool -- <slug> --name "Name" --category <id> [--icon <icon>]
```

## Adding or changing a tool

- One folder per tool: `src/tools/<slug>/` (`meta.ts`, `logic.ts`, `logic.test.ts`, `Tool.astro`,
  `client.ts`, `tool.scss`). Use `src/tools/base64/` as the reference implementation.
- `meta.ts` is validated at build time (slug = folder name, description 110–160 chars, ≥3 FAQs, …).
- Pure logic goes in `logic.ts` and must be unit-tested. DOM wiring goes in `client.ts`.
- Reuse shared classes (`.tool`, `.tool__panes`, `.btn`, `.field__textarea`…) before writing SCSS.
- Icons come from `src/components/icons.ts`; add new paths there rather than inlining SVG.

## Astro 7 notes

- Rust compiler is strict: close every non-void tag, no invalid nesting.
- `compressHTML: true` is set explicitly (v7 default `'jsx'` strips inline whitespace).
- Content collections (future blog) use `src/content.config.ts` with `glob()` loaders.
- Endpoints with extensions (`/og/x.png`, `/sitemap-index.xml`) never have trailing slashes.
