# Cuisdev

**Fast, private, free developer utilities. Nothing you paste ever leaves your browser.**

https://www.cuisdev.com

Cuisdev is a collection of small, excellent developer tools (JSON, encoding, generators, text,
web & code, images) built as a static site. Every tool runs 100% client-side: no accounts, no
uploads, no tracking cookies.

## Stack

| Layer     | Choice                                                            |
| --------- | ----------------------------------------------------------------- |
| Framework | [Astro](https://astro.build) (static output, zero JS by default)  |
| Language  | TypeScript (strict) — **no React**                                |
| Styles    | SCSS, ITCSS layers, BEM naming, CSS custom properties for theming |
| Tests     | Vitest (unit), Playwright + axe (e2e / a11y), Lighthouse CI       |
| Hosting   | Any static host (undecided)                                       |
| Offline   | Hand-rolled service worker (`src/pages/sw.js.ts`)                 |

See [ARCHITECTURE.md](ARCHITECTURE.md) for how it fits together and [PLAN.md](PLAN.md) for the
product roadmap.

## Getting started

```bash
npm install
npm run dev          # http://localhost:4321
```

| Command                 | What it does                                           |
| ----------------------- | ------------------------------------------------------ |
| `npm run dev`           | Dev server with HMR                                    |
| `npm run build`         | Production build to `dist/`                            |
| `npm run preview`       | Serve the production build locally                     |
| `npm run check`         | Astro + TypeScript type-check                          |
| `npm run lint`          | ESLint + Stylelint                                     |
| `npm run format`        | Prettier                                               |
| `npm test`              | Unit tests (Vitest)                                    |
| `npm run test:e2e`      | Playwright e2e + accessibility tests (needs a build)   |
| `npm run lhci`          | Lighthouse CI against `dist/` with performance budgets |
| `npm run validate`      | Everything CI runs, in order                           |
| `npm run new-tool -- …` | Scaffold a new tool (see below)                        |
| `npm run icons`         | Regenerate PNG icons from `public/favicon.svg`         |

First time running e2e tests: `npx playwright install chromium`. The suite builds to `dist/` and
serves it on port 4329 (override with `PW_PORT`). If the download is blocked on your
network, run against your installed browser instead: `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`
(or `msedge`).

## Adding a tool

```bash
npm run new-tool -- url-encoder --name "URL Encoder / Decoder" --category encoding --icon code
```

This creates `src/tools/url-encoder/` with `meta.ts`, `logic.ts` (+ test), `Tool.astro`,
`client.ts` and `tool.scss`. The registry picks it up automatically: route, sitemap entry,
search index, category page, OG image and footer links are all generated. Full guide in
[CONTRIBUTING.md](CONTRIBUTING.md).

## Deployment

The build is a plain static site in `dist/` and runs on any static host. Hosting has not been
chosen yet. `public/_headers` and `public/_redirects` carry the security headers, caching rules
and legacy redirects in the format understood by Netlify- and Cloudflare-style hosts; port them
to your host's equivalent (e.g. `vercel.json`, nginx config) if you pick something else.

## License

[MIT](LICENSE). The Cuisdev name and logo are not covered by the licence.
"# cuisdev"
