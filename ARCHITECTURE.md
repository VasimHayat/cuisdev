# Architecture

## Principles

1. **Static first.** Every URL is a pre-rendered HTML file. Google, social crawlers and users with
   slow connections all get complete content with zero JavaScript.
2. **A tool is a folder.** `src/tools/<slug>/` contains everything about one tool. A registry
   discovers folders at build time; nothing central needs editing.
3. **Islands of vanilla TypeScript.** Each tool page ships only its own `client.ts` bundle (plus a
   ~3 KB shared shell script for theme + command palette). No framework runtime.
4. **Privacy is structural.** There is no backend. The CSP blocks connections to any origin but
   our own, so a tool cannot leak data even by mistake.

## Directory map

```
src/
├─ styles/            ITCSS SCSS design system → one global stylesheet
│  ├─ settings/       tokens (SCSS maps) and theme (emits CSS custom properties)
│  ├─ tools/          mixins (breakpoints, focus-ring, visually-hidden…)
│  ├─ generic/        reset
│  ├─ elements/       bare HTML element defaults
│  ├─ objects/        layout primitives: .container .stack .cluster .grid .switcher
│  ├─ components/     .btn .card .badge .field .header .footer .palette .prose .tool
│  └─ utilities/      .visually-hidden .skip-link .icon …
├─ layouts/
│  ├─ BaseLayout.astro    <head> (SEO, OG, JSON-LD, CSP-hashed theme script), header, footer, palette
│  └─ ToolLayout.astro    breadcrumbs, H1, <slot/> for the tool, long-form content, related tools
├─ components/        Header, Footer, ThemeToggle, CommandPalette, ToolCard, Icon, Breadcrumbs, FAQ…
├─ lib/
│  ├─ registry.ts     discovers + validates src/tools/*/meta.ts; category data; related-tools logic
│  ├─ seo.ts          JSON-LD builders (Organization, WebSite, SoftwareApplication, FAQPage, HowTo, BreadcrumbList)
│  ├─ site.ts         site constants (name, URL, nav)
│  ├─ theme-init.js   pre-paint theme script (inlined, CSP-hashed in astro.config.ts)
│  ├─ theme.ts        runtime theme toggle
│  └─ dom.ts          $, debounce, copy, download, file-drop, status helpers
├─ tools/
│  ├─ _types.ts       ToolMeta contract
│  └─ <slug>/         meta.ts · logic.ts · logic.test.ts · Tool.astro · client.ts · tool.scss
└─ pages/
   ├─ index.astro                 home
   ├─ tools/index.astro           all tools
   ├─ tools/[slug].astro          one route per tool (getStaticPaths from the registry)
   ├─ tools/category/[category]   hub pages
   ├─ og/[slug].png.ts            build-time Open Graph images (SVG → PNG via resvg)
   └─ about / privacy / terms / 404
```

## Request → page lifecycle

1. **Build.** `registry.ts` globs `src/tools/*/meta.ts`, validates each (slug = folder, description
   length, FAQ count…). `pages/tools/[slug].astro` maps every tool to a route and renders its
   `Tool.astro` inside `ToolLayout`. `@astrojs/sitemap` emits `sitemap-index.xml`. `og/[slug].png.ts`
   renders a card per tool. Astro computes CSP hashes for every inline script/style.
2. **Serve.** Any static host serves `dist/`; `_headers` (security + caching) and `_redirects`
   (legacy URLs) are provided in the Netlify/Cloudflare format for hosts that read them.
3. **Hydrate.** The browser runs `theme-init.js` inline before paint, then loads the tiny shared
   bundle (theme toggle, command palette) and the page's `client.ts`. Fuse.js for search is
   dynamically imported the first time the palette opens.

## Theming

Tokens live in `settings/_tokens.scss` as SCSS maps and are emitted by `settings/_theme.scss` as
CSS custom properties on `:root` (light) and `:root[data-theme='dark']`. A `prefers-color-scheme`
fallback covers no-JS. Components only ever reference `var(--color-*)`, never raw values.

## Design language

The look is "premium developer tool": a calm, near-black dark theme (and an equally deliberate
light one), large display type with tight tracking, hairline borders, and colour used sparingly.

- **Two accents.** `--color-accent` (cyan) carries every interactive meaning — links, focus,
  active states. `--color-accent-alt` (violet) exists only to make `--gradient-accent`, which is
  used on the primary button, the eyebrow rule and card hover states. Nothing is only distinguished
  by the gradient, so it never carries meaning on its own.
- **Atmosphere, not images.** The home hero paints two radial washes and a masked grid with pure
  CSS on an absolutely positioned `.hero__decor` layer. It costs no requests and cannot move
  content, so CLS stays at 0.
- **Hairlines.** Cards, the tool surface, the header and the footer share one
  `--gradient-hairline` edge highlight, which is what makes surfaces read as lit rather than flat.
- **Contrast is checked, not assumed.** Every text token is verified against every surface it can
  sit on before it is committed; the axe suite then re-checks every page in both themes. Decorative
  tokens (`--color-glow-*`, `--color-grid-line`, `--color-hairline`) are never used behind text.
- **Type scale** runs to `--text-6xl`; headings use `--tracking-tight` and the hero
  `--tracking-tighter`.

## Content Security Policy

Enabled via Astro's `security.csp`. Astro hashes every inline `<script>` and `<style>` it emits;
`'self'` allows bundled assets. The one hand-inlined script (theme init) is hashed in
`astro.config.ts` from the exact file bytes. Consequences for tool authors:

- No inline `style=""` attributes — toggle classes or `data-*` attributes instead.
- No `eval`, no `new Function`, no remote scripts. One documented exception: the JSON Schema
  Validator page declares `scriptSources: ["'unsafe-eval'"]` in its `meta.ts` because Ajv compiles
  schemas with `new Function`; `pages/tools/[slug].astro` adds it to that page's CSP only. Eval-free
  validators were evaluated and rejected for spec-compliance bugs.
- Workers must be same-origin (`worker-src 'self' blob:`).

## Performance budgets (enforced in CI by Lighthouse CI)

| Page type  | JS (uncompressed) | CSS   | Scores                              |
| ---------- | ----------------- | ----- | ----------------------------------- |
| Home/About | ≤ 60 KB           | 60 KB | Perf ≥ 98, A11y/BP/SEO = 100        |
| Tool page  | ≤ 600 KB          | 60 KB | Perf ≥ 98, A11y/BP/SEO = 100, CLS 0 |

Budgets are measured against the uncompressed build output (the CI static server does not
compress); production hosts serve the same files Brotli-compressed at roughly a third of the size. A
CodeMirror tool page is ~370 KB uncompressed / ~120 KB compressed, and the editor chunk is shared
and cached across every tool that uses it. On Windows, `node scripts/lighthouse-local.ts` runs the
same checks when `lhci` cannot clean up its temporary Chrome profile.

## Offline support

`src/pages/sw.js.ts` generates a service worker at build time (its cache name carries the build
timestamp, so a deploy invalidates the old cache). Navigations are network-first with a cached
fallback and finally `/offline/`; hashed assets under `/_astro/`, `/icons/` and `/og/` are
cache-first; everything else same-origin is stale-while-revalidate. Because the worker only takes
control _after_ the first page has loaded, `ServiceWorker.astro` posts that page and the assets it
loaded to the worker, so a single visit is enough to make a tool work offline.

## Testing pyramid

- **Vitest** — `logic.ts` of every tool and `lib/*`. Coverage thresholds in `vitest.config.ts`.
- **Playwright** — `tests/e2e/shell.spec.ts` (navigation, palette, theme), `tests/e2e/tools/*.spec.ts`
  (one spec per tool), `tests/e2e/a11y.spec.ts` (every sitemap URL: axe WCAG 2.2 AA light and dark,
  no horizontal scroll at 390px, one `h1`, a meta description) and `tests/e2e/offline.spec.ts`.
  The last runs in its own serial project after the others, because Chromium's offline emulation
  interferes with anything running beside it.
- **Lighthouse CI** — budgets above, on the built `dist/`.

## Roadmap hooks already in place

- `ToolMeta.related` for hand-curated cross-links; category fallback is automatic.
- `site.github` — set it and GitHub links appear in header/footer/schema.
- Blog: add `src/content.config.ts` with a `glob()` loader and an `ArticleLayout`; `prose` styles
  are ready.
- PWA: `manifest.webmanifest` and icons exist; add `@vite-pwa/astro` for offline support.
