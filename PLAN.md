# Cuisdev 2.0 — Product & Engineering Plan

**Domain:** https://www.cuisdev.com **Repo:** `G:\HW_RESOURCES\Github\cusidev`
**Status:** Draft v1 for review — 2026-09-06
**Constraints agreed:** TypeScript + SCSS, no React, SEO-first, production grade.

---

## 0. Where we are today (audit of the live site)

| Area          | Finding                                                                     | Impact                                                                                                   |
| ------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Tools         | Only **1 real tool** (`/jsoneditor/`). Five cards are "Coming soon".        | Visitors bounce; Google sees thin content.                                                               |
| Trust signals | Claims "500K+ monthly users, 99.9% uptime, 4.9-star rating" with no source. | Fake social proof damages credibility and violates Google's review/structured-data policies. **Remove.** |
| Nav           | "Pricing", "Sign In", "Get Started" lead nowhere.                           | Dead UX; signals an unfinished product.                                                                  |
| Sitemap       | 1 URL. No per-tool landing pages, no hub pages, no blog.                    | Near-zero organic surface area.                                                                          |
| Title         | "Cuisdev - Professional Online Tools / JSON Editor, Image Editor & More"    | Generic; lists tools that do not exist.                                                                  |
| Brand         | Domain is **cuisdev**, repo folder is **cusidev**.                          | Pick one spelling everywhere (recommend `cuisdev`, it matches the domain).                               |

Everything that follows replaces the current site. The JSON editor is carried over and its old URL gets a 301 redirect.

---

## 1. Vision & positioning (the entrepreneur view)

### 1.1 One-liner

> **Cuisdev — fast, private, free developer utilities. Nothing you paste ever leaves your browser.**

### 1.2 The market gap

The "online dev tools" niche is huge (JSON formatter alone is 1M+ searches/month globally) and is dominated by
sites that are slow, ad-cluttered, and often ship your data to a server. Users tolerate them because there is no
obviously better option. The winning formula is already proven by **it-tools.tech**, **transform.tools**, and
**DevToys** (desktop): _many small, excellent, instant tools under one consistent, beautiful shell._

### 1.3 Differentiators (what we will actually be known for)

1. **Private by design** — 100% client-side processing, works offline (PWA), no sign-up, no cookie banner.
2. **Instant** — static HTML, under 50 KB of JS on first paint, every tool loads in under a second on 3G.
3. **Depth per tool** — not just a textarea: tree view, diff, share-by-URL, history, keyboard shortcuts, file drop.
4. **Chainable** — output of one tool becomes input of another (JSON to YAML to Base64) in one click.
5. **Open source** — public GitHub repo drives backlinks, trust, and contributors.

### 1.4 Who it's for

Primary: web/backend developers, QA, DevOps. Secondary: data analysts, technical writers, students.

### 1.5 Business model (staged, never at the cost of trust)

| Stage                  | Revenue                                                                               | Trigger              |
| ---------------------- | ------------------------------------------------------------------------------------- | -------------------- |
| 0. Launch (months 1–3) | None. Grow traffic and trust.                                                         | —                    |
| 1. Ethical ads         | Carbon Ads / EthicalAds (dev-only, single placement, no tracking).                    | 50K+ sessions/month  |
| 2. Pro ($3–5/mo)       | Cross-device snippet sync, saved workspaces, higher file limits, ad-free, API access. | 200K+ sessions/month |
| 3. B2B                 | Self-hosted / white-label build for companies with strict data-handling policies.     | Inbound demand       |

Hard rule: the free tools stay free and full-featured. Pro sells convenience, not core functionality.

---

## 2. Product scope

### 2.1 Tool architecture principle

Each tool is a **self-contained module** with its own SEO landing page, metadata, tests, and optional web worker.
Adding a tool = adding one folder. The registry generates: route, nav entry, search index, sitemap entry, OG image, related-tools links.

### 2.2 Launch catalogue (Phase 1 — about 24 tools, 6 categories)

| Category            | Tools                                                                                                                                                                        | Notes                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **JSON & Data**     | JSON Formatter/Validator (tree + code view), JSON to/from YAML, JSON to/from CSV, JSON to/from XML, JSON Schema validator, JSONPath tester                                   | Carry over existing editor; highest-traffic cluster                         |
| **Encode / Decode** | Base64 (text & file), URL encode/decode, HTML entities, JWT decoder, Unicode/string escape                                                                                   | Simple, high search volume                                                  |
| **Generators**      | UUID (v4/v7, bulk), Hash (MD5/SHA-1/256/512, HMAC), Password, Lorem ipsum, QR code                                                                                           | All in-browser via WebCrypto                                                |
| **Text**            | Diff checker (side-by-side/inline), Case converter, Regex tester (with explanation), Markdown preview, Word/char counter                                                     | CodeMirror 6 based                                                          |
| **Web & Code**      | Minify/Beautify HTML/CSS/JS, SQL formatter, Color converter (HEX/RGB/HSL/OKLCH + contrast checker), Cron expression parser, Timestamp/Epoch converter, Number base converter | Prettier standalone runs in a worker                                        |
| **Images**          | Image compressor, format converter (PNG/JPG/WebP/AVIF), resize/crop, image to Base64                                                                                         | Canvas + OffscreenCanvas in a worker; the "Image Editor" promise, delivered |

### 2.3 Phase 2 (months 2–4)

PDF merge/split/compress (pdf-lib), Favicon generator, SVG optimizer, CSS gradient/shadow generators, .htaccess/nginx config helpers, HTTP status reference, MIME-type lookup, Chmod calculator, Text-to-slug, Duplicate line remover, JSON to TypeScript/Go/Zod types, cURL to code converter.

### 2.4 Out of scope / recommendation

**Stock Analyzer** does not fit "developer tools" and dilutes topical authority for SEO. Recommend it lives on its own
subdomain or product (you already have `NSE-Stock-Analyzer-NSA`). Cross-link from the footer if desired.

---

## 3. Technology stack

### 3.1 Framework options (all TypeScript + SCSS, no React)

| Option                                | What it is                                                                                                                                                | Pros                                                                                                                              | Cons                                                                                  | Verdict                                   |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------- |
| **A. Astro 5 + vanilla TS islands**   | Static-site framework; zero JS by default, `<script>` tags are bundled TS, first-class SCSS, content collections, built-in sitemap/image/view transitions | Best SEO/perf out of the box; per-page code-splitting for free; huge ecosystem; can add Lit or Svelte islands later without React | Small new DSL (`.astro` files) to learn                                               | **Recommended**                           |
| B. Vite + vanilla TS multi-page       | Bare Vite MPA with an HTML templating plugin (e.g. `vite-plugin-handlebars`)                                                                              | Maximum control, minimal deps                                                                                                     | You hand-build routing, layouts, sitemap, OG, content collections — weeks of plumbing | Only if you want zero framework           |
| C. Eleventy (11ty) + Vite             | Mature static generator + Vite for TS/SCSS bundling                                                                                                       | Very flexible templating; fast builds                                                                                             | TS/SCSS integration is glue code; weaker component story                              | Good, but A does the same with less glue  |
| D. Lit web components (inside A or B) | Framework-agnostic components with Shadow DOM                                                                                                             | Encapsulated, reusable tool widgets; still "no React"                                                                             | Shadow DOM complicates global SCSS theming                                            | Optional add-on for complex widgets later |

**Decision proposed: Option A (Astro 5).** It is the industry default for content-heavy, SEO-critical sites and lets
every tool ship only the JS it needs.

### 3.2 Core libraries (no React anywhere)

| Need              | Choice                                                       | Why                                                                         |
| ----------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Code editor       | **CodeMirror 6**                                             | TS-native, modular, accessible, about 150 KB lazy-loaded only on tool pages |
| Formatting        | Prettier standalone (in worker), `sql-formatter`             | Battle-tested                                                               |
| Data conversion   | `yaml`, `papaparse`, `fast-xml-parser`, `ajv` (schema)       | Small, tree-shakeable                                                       |
| Diff              | `diff` (jsdiff)                                              | Standard                                                                    |
| Crypto/hash       | WebCrypto API + `hash-wasm` (MD5 is not in WebCrypto)        | Fast, in-browser                                                            |
| Images            | Canvas/OffscreenCanvas, `@jsquash/*` WASM codecs (AVIF/WebP) | True client-side compression                                                |
| PDF (Phase 2)     | `pdf-lib`, `pdfjs-dist`                                      | Pure JS                                                                     |
| URL state sharing | `lz-string` compress into the URL `#hash`                    | Share tool state without a server                                           |
| Local history     | IndexedDB via `idb`                                          | Recent inputs, never uploaded                                               |
| Search / Ctrl+K   | `fuse.js` over a generated tool index                        | Instant tool switching                                                      |
| PWA               | `@vite-pwa/astro` (Workbox)                                  | Offline, installable                                                        |
| OG images         | SVG template rendered with `@resvg/resvg-js` at build time   | Unique social card per tool, no React/satori needed                         |
| Analytics         | Cloudflare Web Analytics or Plausible                        | Cookie-less, so no consent banner                                           |

### 3.3 Styling system (SCSS)

- **Design tokens** in SCSS maps, emitted as CSS custom properties (`--color-bg`, `--space-4`, ...) so theming (light/dark/system) is runtime-switchable.
- **Architecture:** ITCSS layers (`settings > tools > generic > elements > objects > components > utilities`), BEM naming, one partial per component, Astro scoped styles for page-specific bits.
- **Typography:** system font stack + self-hosted `Inter` variable (`font-display: swap`), `JetBrains Mono` for code.
- **Layout primitives:** `.stack`, `.cluster`, `.sidebar`, `.switcher` (Every Layout style). No utility-class framework.
- **Motion:** `prefers-reduced-motion` respected; View Transitions for page changes.
- **Accessibility:** WCAG 2.2 AA contrast, focus-visible rings, skip links, full keyboard operation.

### 3.4 Hosting & infrastructure

| Choice                             | Reason                                                                                                                                              |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cloudflare Pages** (recommended) | Free, global edge, custom headers (`_headers`), redirects (`_redirects`), Web Analytics, unlimited bandwidth. Vercel/Netlify are fine alternatives. |
| GitHub Actions                     | Lint, test, build, Lighthouse CI, deploy. Preview URL per PR.                                                                                       |
| Cloudflare DNS                     | Apex + `www`; pick one canonical host and 301 the other.                                                                                            |

---

## 4. Repository structure

```
cusidev/
├─ .github/workflows/        ci.yml, deploy.yml, lighthouse.yml
├─ public/                   robots.txt, favicons, manifest.webmanifest, _headers, _redirects
├─ src/
│  ├─ styles/                ITCSS SCSS: settings/ tools/ generic/ elements/ objects/ components/ utilities/
│  ├─ layouts/               BaseLayout.astro, ToolLayout.astro, ArticleLayout.astro
│  ├─ components/            Header, Footer, ToolCard, CommandPalette, ThemeToggle, CopyButton, DropZone, SplitPane...
│  ├─ lib/                   registry.ts (tool index), seo.ts (JSON-LD builders), url-state.ts, storage.ts, worker-rpc.ts
│  ├─ tools/
│  │  └─ json-formatter/
│  │     ├─ meta.ts          slug, title, description, keywords, category, faq[], related[], jsonLd
│  │     ├─ Tool.astro       markup (server-rendered shell, no JS)
│  │     ├─ client.ts        hydration: wires CodeMirror, events, worker
│  │     ├─ logic.ts         pure functions, unit-tested, zero DOM
│  │     ├─ worker.ts        (optional) heavy work off the main thread
│  │     └─ tool.scss
│  ├─ content/               blog/ and guides/ (MDX) as content collections
│  ├─ pages/
│  │  ├─ index.astro
│  │  ├─ tools/[slug].astro           one URL per tool
│  │  ├─ tools/category/[cat].astro   hub pages
│  │  ├─ blog/...
│  │  ├─ about.astro, privacy.astro, terms.astro, changelog.astro
│  │  └─ og/[slug].png.ts             build-time OG images
│  └─ scripts/               generate-search-index.ts, validate-meta.ts, new-tool.ts (scaffolder)
├─ tests/                    unit (Vitest), e2e (Playwright), a11y (axe)
├─ astro.config.ts, tsconfig.json, .stylelintrc, eslint.config.js, lighthouserc.json
└─ package.json
```

---

## 5. SEO strategy (the growth engine)

### 5.1 Technical SEO (must-haves, all automated)

- **Static HTML per tool** with real content, not an SPA shell. Google indexes it instantly.
- **URL scheme:** `/tools/json-formatter/`, hubs at `/tools/json/`, guides at `/blog/<slug>/`. Lower-case, hyphenated, trailing slash, one canonical.
- **301 redirects** from `/jsoneditor/` to `/tools/json-formatter/` (and any other legacy paths) via `_redirects`.
- **Structured data (JSON-LD):** `WebSite` + `SearchAction`, `Organization`, per tool `SoftwareApplication` (`applicationCategory: DeveloperApplication`, price 0), `FAQPage`, `BreadcrumbList`, `HowTo` where a how-to section exists.
- **Meta formulas:** Title `"{Tool} Online — Free, Private, Instant | Cuisdev"` (60 chars max). Description hand-written per tool, 140–155 chars, containing the primary keyword and the privacy hook.
- **Open Graph / Twitter cards** with a generated 1200x630 image per tool.
- **Sitemap** auto-generated with `lastmod`, `robots.txt`, RSS feed for the blog.
- **Core Web Vitals targets:** LCP under 1.2 s, CLS 0, INP under 100 ms. Lighthouse 100/100/100/100 enforced in CI with budgets (60 KB JS max on home, 250 KB max on a tool page including CodeMirror).
- **Semantic HTML:** one `<h1>`, landmark regions, descriptive link text, `<noscript>` explanation.
- **Image discipline:** Astro `<Image>` outputs AVIF/WebP, explicit dimensions, lazy below the fold.
- **Internal linking:** related tools (same category + "people also use"), breadcrumbs, footer hubs, contextual links from guides.
- **i18n-ready** (`hreflang` scaffolding). Actual translations are Phase 3.

### 5.2 Content SEO (what ranks)

Each tool page contains, below the fold, **400–800 words of genuinely useful content**:

1. What the tool does (1 paragraph, keyword-natural)
2. How to use it (3–5 steps, feeds the `HowTo` schema)
3. Worked example with sample input/output
4. FAQ (4–6 questions taken from real search queries, feeds the `FAQPage` schema)
5. Related tools + relevant guide links
6. "Your data stays in your browser" trust block

**Keyword clusters (initial targets)**

| Cluster    | Head terms                                                   | Long-tail examples for guides                         |
| ---------- | ------------------------------------------------------------ | ----------------------------------------------------- |
| JSON       | json formatter, json validator, json viewer, json beautifier | "how to fix Unexpected token in JSON", "json vs yaml" |
| Encoding   | base64 decode, url encode, jwt decoder                       | "is base64 encryption?", "how to decode a JWT safely" |
| Generators | uuid generator, sha256 hash online, password generator       | "uuid v4 vs v7"                                       |
| Text       | diff checker, regex tester, case converter                   | "regex for email validation explained"                |
| Code       | css minifier, sql formatter, cron expression                 | "cron every 5 minutes", "cron syntax cheatsheet"      |
| Timestamps | epoch converter, unix timestamp                              | "epoch to date in JavaScript"                         |

**Blog cadence:** 2 guides per week for the first 3 months. Every guide links to at least 2 tools.

### 5.3 Off-page & distribution

Open-source the repo (backlinks, GitHub stars), launch on Product Hunt + Hacker News ("Show HN") + r/webdev,
republish guides on dev.to/Hashnode with canonical back to cuisdev, submit to tool directories, ship a Chrome
extension and VS Code extension later as acquisition channels.

---

## 6. Production quality bar

| Area          | Standard                                                                                                                                                                               |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code quality  | Strict TS (`strict`, `noUncheckedIndexedAccess`), ESLint (typescript-eslint + astro), Stylelint (scss standard), Prettier, Husky + lint-staged, Conventional Commits                   |
| Testing       | Vitest unit tests for every `logic.ts` (90%+ coverage), Playwright e2e smoke per tool, `@axe-core/playwright` a11y gate, Lighthouse CI budgets                                         |
| Security      | Strict CSP (no inline scripts except hashed), `X-Frame-Options`, `Referrer-Policy`, SRI on any CDN asset (goal: none), Dependabot/Renovate, `npm audit` in CI, no third-party trackers |
| Privacy/legal | Privacy policy (truthful: "we cannot see your data"), Terms, cookie-less analytics so no consent banner, GDPR/CCPA compliant by construction                                           |
| Reliability   | Static hosting (no servers to fail), PWA offline fallback, error boundary UI per tool, optional Sentry with PII scrubbing                                                              |
| Accessibility | WCAG 2.2 AA, keyboard-complete, screen-reader tested (NVDA), reduced-motion                                                                                                            |
| Observability | Web Vitals RUM to analytics, uptime monitor (free tier), Google Search Console + Bing Webmaster                                                                                        |
| Docs          | `README`, `CONTRIBUTING` ("add a tool in 10 minutes"), `ARCHITECTURE.md`, tool scaffolder script                                                                                       |

---

## 7. UX & design direction

- **Shell:** slim top bar (logo, Ctrl+K search, theme toggle, GitHub), left category sidebar on desktop, bottom sheet on mobile.
- **Home:** hero with the one-liner + search, category grid, "most used" row, "recently used" (local only), trust strip with _real_ claims only (private, offline, open source).
- **Tool page layout:** input pane / options bar / output pane, sticky action bar (Copy, Download, Share, Clear, Swap), file drop anywhere, keyboard shortcuts panel (`?`).
- **Personality:** clean, technical, confident. Dark mode first-class. One accent colour, generous whitespace, monospace wherever data lives.
- **Empty states** teach the tool with a "Load sample" button. **Error states** point to the exact line and column.

---

## 8. Roadmap & milestones

| Phase             | Duration   | Deliverables                                                                                                                                          | Exit criteria                                                            |
| ----------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **0. Foundation** | Week 1     | Astro scaffold, SCSS design system, layouts, header/footer/theme, tool registry + scaffolder script, CI/CD to Cloudflare Pages preview, Lighthouse CI | Empty shell scores 100/100/100/100; adding a tool takes under 10 minutes |
| **1. Core tools** | Weeks 2–3  | JSON cluster (6) + Encode/Decode (5) + Generators (5) with content, tests, OG images; `/jsoneditor/` redirect                                         | 16 tools live on preview, all tests green                                |
| **2. Launch**     | Week 4     | Text (5) + Web/Code (6) + Images (4), Ctrl+K palette, share-by-URL, history, PWA, blog with 4 seed guides, legal pages, Search Console                | **Public launch** at cuisdev.com; Product Hunt / Hacker News posts       |
| **3. Growth**     | Months 2–4 | Phase 2 tools (about 15), 2 guides per week, tool chaining, browser extension                                                                         | 50K sessions/month; top 10 for 5 head terms                              |
| **4. Monetise**   | Month 4+   | Ethical ads, then Pro (sync, workspaces, API)                                                                                                         | Revenue covers infra + content                                           |

---

## 9. KPIs

| Metric                       | 3 months             | 6 months   |
| ---------------------------- | -------------------- | ---------- |
| Organic sessions / month     | 30K                  | 150K       |
| Indexed tool pages           | 40                   | 60+        |
| Lighthouse (all pages)       | 100 across the board | maintained |
| Top-10 rankings (head terms) | 5                    | 20         |
| GitHub stars                 | 300                  | 1,500      |
| Return-visitor rate          | 25%                  | 35%        |

---

## 10. Risks & mitigations

| Risk                                      | Mitigation                                                                             |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| Very competitive SERPs for head terms     | Win on speed + depth + long-tail guides first; head terms follow authority             |
| Scope creep (too many tools, all shallow) | Definition of done per tool includes content + tests + FAQ; ship clusters, not singles |
| Bundle bloat from editor/codecs           | Per-tool code-splitting, workers, Lighthouse budgets fail the build                    |
| Fake-claims hangover from the old site    | Remove all unverifiable numbers at launch; publish a real stats page later             |
| Brand confusion (cuisdev vs cusidev)      | Standardise on `cuisdev` in code, copy, and social handles                             |

---

## 11. Decisions needed from you before build starts

1. **Framework:** approve **Astro 5** (Option A)? Alternative: Vite MPA if you want zero framework.
2. **Hosting:** Cloudflare Pages (recommended) vs Vercel vs Netlify. Is DNS already at Cloudflare?
3. **Canonical host:** `www.cuisdev.com` or `cuisdev.com`?
4. **Open source:** public GitHub repo from day one? Strongly recommended for SEO and trust.
5. **Stock Analyzer:** exclude from this site (recommended) or keep as a link-out?
6. **Ads:** ever, or Pro-only monetisation?
7. **Brand assets:** do you have a logo/colours, or should Phase 0 include a light brand pass?
8. **Analytics:** Cloudflare Web Analytics (simplest) or self-hosted Plausible/Umami?

Once these are confirmed, Phase 0 starts with scaffolding the repo.
