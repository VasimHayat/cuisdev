# Contributing

Thanks for helping build Cuisdev. This guide gets you from clone to merged tool.

## Ground rules

1. **Client-side only.** A tool must never send user input anywhere. If it needs a network request
   to work, it does not belong here.
2. **No React, no utility-class CSS frameworks.** Astro components, TypeScript, SCSS.
3. **Every tool ships complete:** logic + unit tests, UI, SEO content (`meta.ts`) and passes the
   Lighthouse / a11y gates. Half-finished tools are not merged.
4. **Truthful copy.** No invented statistics, no "trusted by millions".

## Setup

```bash
npm install
npx playwright install chromium   # once, for e2e tests
npm run dev
```

## Adding a tool (about 10 minutes of plumbing, then the real work)

```bash
npm run new-tool -- <slug> --name "Display Name" --category <json|encoding|generators|text|web|images> [--icon <name>]
```

You now have `src/tools/<slug>/`:

| File            | Purpose                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `meta.ts`       | Everything the site knows about the tool: name, SEO title/description, keywords, intro, how-to steps, example, FAQ, related tools. Validated at build. |
| `logic.ts`      | Pure functions. No DOM, no globals. This is what gets unit-tested.                                                                                     |
| `logic.test.ts` | Vitest tests. Aim for every branch, including error messages.                                                                                          |
| `Tool.astro`    | Server-rendered markup for the tool surface. Uses shared `.tool*` classes.                                                                             |
| `client.ts`     | Hydration: wires DOM events to `logic.ts`. Imported by `Tool.astro`'s `<script>`.                                                                      |
| `tool.scss`     | Tool-specific styles scoped under `.tool-<slug>`.                                                                                                      |

### Writing `meta.ts` well (this is the SEO)

- `seoTitle` ≤ 50 chars, leads with the primary keyword: `"JSON Formatter & Validator Online — Free"`.
- `description` 110–160 chars, includes the primary keyword and the privacy hook.
- `intro` 2–3 paragraphs that would genuinely help someone who landed from Google.
- `howTo` 3–5 imperative steps (rendered as `HowTo` schema).
- `faq` 4–6 real questions people search for (rendered as `FAQPage` schema). Inline
  `<code>`, `<strong>` and `<a>` are allowed in answers.
- `keywords` 6–12 phrases; they feed the command-palette search and `SoftwareApplication` schema.

### UI conventions

- Use the shared chrome: `.tool`, `.tool__options`, `.tool__panes`, `.tool__pane`, `.tool__actions`,
  `.tool__status`. Look at `src/tools/base64/` as the reference implementation.
- Buttons use `data-action="…"` and are handled by one delegated click listener.
- Errors go to the `[data-status]` element via `setStatus(el, message, 'error')` so screen readers
  hear them (`role="status"`).
- Every input has a `<label>`. Every icon-only button has an `aria-label`.
- Heavy work (> ~16 ms) goes into a Web Worker (`worker.ts`) — see `src/lib/` helpers.
- Never set inline `style=""` attributes; the CSP forbids them. Toggle classes or `data-*`.

### Test requirements (every tool, every phase)

| Layer   | Where                            | Must cover                                                                 |
| ------- | -------------------------------- | -------------------------------------------------------------------------- |
| Unit    | `src/tools/<slug>/logic.test.ts` | Every exported function, every error branch, round-trips, edge cases       |
| Browser | `tests/e2e/tools/<slug>.spec.ts` | Happy path through the real UI, one error state, copy/clear actions        |
| A11y    | `tests/e2e/a11y.spec.ts`         | Add the tool URL to the `pages` list (axe, light + dark, desktop + mobile) |

A phase is complete only when all three pass for every tool in it.

### Definition of done

- [ ] `npm run validate` passes (format, lint, type-check, unit tests, build)
- [ ] `npm run test:e2e` passes, including the axe accessibility suite
- [ ] Manually checked in light and dark theme, desktop and mobile widths
- [ ] Keyboard-only walkthrough works
- [ ] `meta.ts` content reviewed for accuracy and grammar

## Commit style

Conventional Commits: `feat(tools): add url encoder`, `fix(base64): handle data URLs`,
`docs: …`, `chore: …`. Husky runs lint-staged on commit.

## Reporting bugs

Open an issue with the tool name, the input that misbehaved (if not sensitive), the expected
result and your browser.
