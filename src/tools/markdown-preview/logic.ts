/**
 * Markdown Preview & Editor — pure functions, no DOM.
 *
 * `marked` turns Markdown into HTML here; the sanitising itself needs a DOM, so
 * the client hands the HTML to DOMPurify using the policy and the link-hardening
 * hook defined below. Both are exported so they can be reasoned about (and
 * tested) without a browser.
 */

export interface RenderOptions {
  /** GitHub Flavored Markdown: tables, task lists, strikethrough, autolinks. */
  gfm?: boolean;
  /** Treat a single newline as a <br>. */
  breaks?: boolean;
}

/** U+FEFF, the byte-order mark editors leave at the start of a file. */
const BOM = '﻿';

/** Strip a UTF-8 BOM and normalise Windows / classic-Mac line endings. */
export function normalizeMarkdown(markdown: string): string {
  const withoutBom = markdown.startsWith(BOM) ? markdown.slice(BOM.length) : markdown;
  return withoutBom.replace(/\r\n?/g, '\n');
}

/**
 * Render Markdown to (still untrusted) HTML. `marked` is imported on demand:
 * it is far too big to sit in the page's first-load budget.
 */
export async function renderMarkdown(
  markdown: string,
  options: RenderOptions = {},
): Promise<string> {
  const source = normalizeMarkdown(markdown);
  if (source.trim() === '') return '';
  const { marked } = await import('marked');
  return await marked.parse(source, {
    gfm: options.gfm ?? true,
    breaks: options.breaks ?? false,
    async: false,
  });
}

/**
 * DOMPurify policy. `USE_PROFILES: { html: true }` drops SVG and MathML
 * entirely; the explicit forbid lists take out the style- and layout-injection
 * vectors the HTML profile would otherwise keep.
 */
export interface SanitizeConfig {
  USE_PROFILES: { html: true };
  FORBID_TAGS: string[];
  FORBID_ATTR: string[];
  ALLOW_DATA_ATTR: false;
}

export const SANITIZE_CONFIG: SanitizeConfig = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'base', 'link', 'meta'],
  FORBID_ATTR: ['style', 'srcset', 'formaction', 'ping', 'target'],
  ALLOW_DATA_ATTR: false,
};

/** Schemes a link may use. Everything else is stripped. */
export const SAFE_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:', 'ftp:'];

/** Whitespace and control characters an attacker can hide inside a URL. */
function stripInvisible(value: string): string {
  let out = '';
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code <= 0x20 || code === 0xa0 || code === 0x2028 || code === 0x2029) continue;
    out += char;
  }
  return out;
}

/**
 * True for URLs that must never survive sanitising — `javascript:`, `data:`
 * payloads, `vbscript:` and friends. Invisible characters are removed first,
 * because "java\nscript:alert(1)" is still executable in some parsers.
 */
export function isUnsafeHref(value: string): boolean {
  const cleaned = stripInvisible(value).toLowerCase();
  const scheme = /^([a-z0-9+.-]+):/.exec(cleaned);
  if (!scheme) return false; // relative URL or same-page fragment
  return !SAFE_SCHEMES.includes(`${scheme[1]}:`);
}

/** The slice of `Element` the DOMPurify hook actually touches. */
export interface HookElement {
  tagName: string;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

/**
 * DOMPurify `afterSanitizeAttributes` hook: strip any href scheme that slipped
 * through and make every remaining link open safely in a new tab.
 */
export function hardenLinks(node: HookElement): void {
  if (node.tagName.toUpperCase() !== 'A') return;
  const href = node.getAttribute('href');
  if (href === null) return;
  if (isUnsafeHref(href)) {
    node.removeAttribute('href');
    node.setAttribute('data-blocked-url', 'true');
    return;
  }
  if (href.startsWith('#')) return; // same-page anchor: leave it alone
  node.setAttribute('target', '_blank');
  node.setAttribute('rel', 'noopener noreferrer');
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** First ATX or setext heading, used to title the downloaded document. */
export function extractTitle(markdown: string, fallback = 'Document'): string {
  const lines = normalizeMarkdown(markdown).split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const atx = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if (atx?.[1]) return atx[1].trim();
    const next = lines[i + 1] ?? '';
    if (line.trim() !== '' && /^\s{0,3}(=+|-{2,})\s*$/.test(next)) return line.trim();
  }
  return fallback;
}

/**
 * Wrap sanitised HTML in a minimal, self-contained document for download.
 * The inline stylesheet is fine here: the file is saved to disk, so the site's
 * CSP does not apply to it.
 */
export function standaloneHtml(bodyHtml: string, title = 'Document'): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light dark; }
      body {
        max-width: 46rem;
        margin: 2rem auto;
        padding: 0 1rem;
        font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      }
      h1, h2, h3 { line-height: 1.25; }
      code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
      pre { padding: 1rem; overflow-x: auto; background: rgba(127, 127, 127, 0.12); border-radius: 6px; }
      code { font-size: 0.9em; }
      blockquote { margin: 0; padding-left: 1rem; border-left: 3px solid rgba(127, 127, 127, 0.5); }
      table { border-collapse: collapse; }
      th, td { padding: 0.4rem 0.75rem; border: 1px solid rgba(127, 127, 127, 0.4); }
      img { max-width: 100%; }
    </style>
  </head>
  <body>
${bodyHtml}
  </body>
</html>
`;
}

export interface MarkdownStats {
  words: number;
  characters: number;
  lines: number;
  readingMinutes: number;
}

/** Words are runs of non-whitespace, which is what every word counter does. */
export function countWords(text: string): number {
  const trimmed = normalizeMarkdown(text).trim();
  if (trimmed === '') return 0;
  return trimmed.split(/\s+/).length;
}

export function markdownStats(text: string): MarkdownStats {
  const normalized = normalizeMarkdown(text);
  const words = countWords(normalized);
  return {
    words,
    characters: normalized.length,
    lines: normalized === '' ? 0 : normalized.split('\n').length,
    readingMinutes: words === 0 ? 0 : Math.max(1, Math.round(words / 200)),
  };
}

export function describeStats(stats: MarkdownStats): string {
  if (stats.words === 0) return '';
  const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
  return `${plural(stats.words, 'word')} · ${plural(stats.characters, 'character')} · ${plural(stats.lines, 'line')} · ${stats.readingMinutes} min read`;
}

/** A filename-safe slug taken from the document title. */
export function toFileName(title: string, extension: string): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'document';
  return `${slug}.${extension}`;
}
