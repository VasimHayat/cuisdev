/**
 * Code Formatter & Minifier — pure functions, no DOM.
 *
 * Beautifying delegates to Prettier's browser build and minifying to terser
 * (JavaScript) or csso (CSS); both are `await import()`-ed the first time they
 * are needed so the tool page's first-load bundle stays small. HTML and JSON
 * minification are implemented here so they cost nothing extra.
 */
import type * as CssoModule from 'csso';
import type * as TerserModule from 'terser';

import { lineColumnToOffset, offsetToLineColumn, parseErrorOffset } from '@/lib/json-errors';

export type LanguageId = 'html' | 'css' | 'scss' | 'javascript' | 'typescript' | 'json';
export type Mode = 'beautify' | 'minify';
export type IndentOption = 2 | 4 | 'tab';
export type PrintWidth = 80 | 100 | 120;

export interface LanguageInfo {
  id: LanguageId;
  label: string;
  /** Prettier parser name. */
  parser: string;
  /** File extension used by the Download button. */
  extension: string;
  mime: string;
  /** How this language is minified, or `null` when it cannot be. */
  minifier: 'terser' | 'csso' | 'html' | 'json' | null;
  /** Whether the quote / semicolon / trailing-comma options apply. */
  script: boolean;
}

export const LANGUAGES: Record<LanguageId, LanguageInfo> = {
  html: {
    id: 'html',
    label: 'HTML',
    parser: 'html',
    extension: 'html',
    mime: 'text/html',
    minifier: 'html',
    script: false,
  },
  css: {
    id: 'css',
    label: 'CSS',
    parser: 'css',
    extension: 'css',
    mime: 'text/css',
    minifier: 'csso',
    script: false,
  },
  scss: {
    id: 'scss',
    label: 'SCSS',
    parser: 'scss',
    extension: 'scss',
    mime: 'text/x-scss',
    minifier: null,
    script: false,
  },
  javascript: {
    id: 'javascript',
    label: 'JavaScript',
    parser: 'babel',
    extension: 'js',
    mime: 'text/javascript',
    minifier: 'terser',
    script: true,
  },
  typescript: {
    id: 'typescript',
    label: 'TypeScript',
    parser: 'typescript',
    extension: 'ts',
    mime: 'text/plain',
    minifier: null,
    script: true,
  },
  json: {
    id: 'json',
    label: 'JSON',
    parser: 'json',
    extension: 'json',
    mime: 'application/json',
    minifier: 'json',
    script: false,
  },
};

export const LANGUAGE_IDS = Object.keys(LANGUAGES) as LanguageId[];

export function isLanguageId(value: string): value is LanguageId {
  return Object.hasOwn(LANGUAGES, value);
}

export function canMinify(language: LanguageId): boolean {
  return LANGUAGES[language].minifier !== null;
}

/** Why minification is unavailable, or `undefined` when it is available. */
export function minifyUnavailableMessage(language: LanguageId): string | undefined {
  if (language === 'typescript')
    return 'Minify is not available for TypeScript — compile it to JavaScript first, then minify.';
  if (language === 'scss')
    return 'Minify is not available for SCSS — compile it to CSS first, then minify.';
  return undefined;
}

/** Download file name for the current language and mode. */
export function fileNameFor(language: LanguageId, mode: Mode): string {
  const { extension } = LANGUAGES[language];
  return mode === 'minify' ? `code.min.${extension}` : `code.${extension}`;
}

export interface ErrorPosition {
  line: number;
  column: number;
  offset: number;
}

/** A syntax error reported by Prettier, terser, csso or our own parsers. */
export class CodeFormatError extends Error {
  override name = 'CodeFormatError';
  constructor(
    message: string,
    public readonly position?: ErrorPosition,
  ) {
    super(message);
  }
}

/** Strip a UTF-8 BOM and normalise CRLF / CR line endings to LF. */
export function normalizeSource(text: string): string {
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  return withoutBom.replace(/\r\n?/g, '\n');
}

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Percentage of bytes removed, rounded to one decimal. */
export function savingsPercent(inputBytes: number, outputBytes: number): number {
  if (inputBytes <= 0) return 0;
  const percent = ((inputBytes - outputBytes) / inputBytes) * 100;
  return Math.round(percent * 10) / 10 || 0;
}

export interface BeautifyOptions {
  indent?: IndentOption;
  printWidth?: PrintWidth;
  singleQuote?: boolean;
  semicolons?: boolean;
  trailingCommas?: boolean;
}

export interface PrettierConfig {
  parser: string;
  tabWidth: number;
  useTabs: boolean;
  printWidth: number;
  singleQuote: boolean;
  semi: boolean;
  trailingComma: 'all' | 'none';
  endOfLine: 'lf';
}

/** Map the tool's options onto Prettier's. Exported so it can be unit-tested. */
export function prettierConfig(
  language: LanguageId,
  options: BeautifyOptions = {},
): PrettierConfig {
  const indent = options.indent ?? 2;
  return {
    parser: LANGUAGES[language].parser,
    tabWidth: indent === 'tab' ? 2 : indent,
    useTabs: indent === 'tab',
    printWidth: options.printWidth ?? 80,
    singleQuote: options.singleQuote ?? false,
    semi: options.semicolons ?? true,
    trailingComma: (options.trailingCommas ?? true) ? 'all' : 'none',
    endOfLine: 'lf',
  };
}

// --- lazy library loading ----------------------------------------------------

type PrettierPlugin = unknown;

interface PrettierModule {
  format(source: string, options: Record<string, unknown>): Promise<string>;
}

const pluginCache = new Map<LanguageId, Promise<PrettierPlugin[]>>();
let prettierPromise: Promise<PrettierModule> | undefined;
let terserPromise: Promise<typeof TerserModule> | undefined;
let cssoPromise: Promise<typeof CssoModule> | undefined;

/**
 * True when everything needed for `language` + `mode` has already been
 * downloaded, so the UI knows whether to announce "Loading formatter…".
 */
export function isReady(language: LanguageId, mode: Mode): boolean {
  if (mode === 'beautify') return prettierPromise !== undefined && pluginCache.has(language);
  switch (LANGUAGES[language].minifier) {
    case 'terser':
      return terserPromise !== undefined;
    case 'csso':
      return cssoPromise !== undefined;
    default:
      return true;
  }
}

async function loadPrettier(): Promise<PrettierModule> {
  prettierPromise ??= import('prettier/standalone') as unknown as Promise<PrettierModule>;
  return prettierPromise;
}

async function loadPlugins(language: LanguageId): Promise<PrettierPlugin[]> {
  const cached = pluginCache.get(language);
  if (cached) return cached;
  const loading = (async (): Promise<PrettierPlugin[]> => {
    switch (language) {
      case 'html':
        return [await import('prettier/plugins/html')];
      case 'css':
      case 'scss':
        return [await import('prettier/plugins/postcss')];
      case 'typescript':
        return [
          await import('prettier/plugins/typescript'),
          await import('prettier/plugins/estree'),
        ];
      default:
        return [await import('prettier/plugins/babel'), await import('prettier/plugins/estree')];
    }
  })();
  pluginCache.set(language, loading);
  return loading;
}

// --- beautify ----------------------------------------------------------------

/** Pretty-print `source` with Prettier. Throws `CodeFormatError` on syntax errors. */
export async function beautify(
  source: string,
  language: LanguageId,
  options: BeautifyOptions = {},
): Promise<string> {
  const text = normalizeSource(source);
  if (text.trim() === '') return '';
  const [prettier, plugins] = await Promise.all([loadPrettier(), loadPlugins(language)]);
  try {
    return await prettier.format(text, { ...prettierConfig(language, options), plugins });
  } catch (err) {
    throw toFormatError(err, text, language);
  }
}

// --- minify ------------------------------------------------------------------

/** Minify `source`. Throws `CodeFormatError` for syntax errors and unsupported languages. */
export async function minify(source: string, language: LanguageId): Promise<string> {
  const text = normalizeSource(source);
  if (text.trim() === '') return '';
  switch (LANGUAGES[language].minifier) {
    case 'html':
      return minifyHtml(text);
    case 'json':
      return minifyJsonText(text);
    case 'csso': {
      cssoPromise ??= import('csso');
      const csso = await cssoPromise;
      try {
        return csso.minify(text, { restructure: true }).css;
      } catch (err) {
        throw toFormatError(err, text, language);
      }
    }
    case 'terser': {
      terserPromise ??= import('terser');
      const terser = await terserPromise;
      try {
        const result = await terser.minify(text, { format: { comments: false }, sourceMap: false });
        return result.code ?? '';
      } catch (err) {
        throw toFormatError(err, text, language);
      }
    }
    default:
      throw new CodeFormatError(
        minifyUnavailableMessage(language) ??
          `Minify is not available for ${LANGUAGES[language].label}.`,
      );
  }
}

/** Minify JSON by re-serialising it. Reports the position of any syntax error. */
export function minifyJsonText(source: string): string {
  const text = normalizeSource(source);
  if (text.trim() === '') return '';
  try {
    return JSON.stringify(JSON.parse(text));
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const offset = parseErrorOffset(raw, text);
    if (offset === undefined) throw new CodeFormatError(`JSON syntax error: ${cleanJson(raw)}`);
    const { line, column } = offsetToLineColumn(text, offset);
    throw new CodeFormatError(
      `JSON syntax error: ${cleanJson(raw)} (line ${line}, column ${column})`,
      { line, column, offset },
    );
  }
}

function cleanJson(raw: string): string {
  return raw
    .replace(/^JSON\.parse: /, '')
    .replace(/ in JSON at position \d+.*$/, '')
    .replace(/ at position \d+.*$/, '')
    .replace(/\s*\(line \d+ column \d+\)\s*$/, '')
    .replace(/,? .*is not valid JSON$/, '')
    .trim();
}

/** Tags whose text content must survive minification byte for byte. */
const RAW_TEXT_TAGS = new Set(['pre', 'textarea', 'script', 'style']);

/**
 * Minify HTML by hand: drop whitespace-only gaps between tags, collapse runs of
 * whitespace inside text to a single space, remove comments (conditional
 * comments are kept), and copy the contents of `<pre>`, `<textarea>`,
 * `<script>` and `<style>` verbatim.
 */
export function minifyHtml(source: string): string {
  const src = normalizeSource(source);
  const n = src.length;
  let out = '';
  let i = 0;

  while (i < n) {
    if (src[i] !== '<') {
      const next = src.indexOf('<', i);
      const stop = next === -1 ? n : next;
      out += collapseText(src.slice(i, stop));
      i = stop;
      continue;
    }

    // Comment: keep only conditional comments.
    if (src.startsWith('<!--', i)) {
      const close = src.indexOf('-->', i + 4);
      const stop = close === -1 ? n : close + 3;
      const body = src.slice(i + 4, close === -1 ? n : close);
      if (isConditionalComment(body)) out += src.slice(i, stop);
      i = stop;
      continue;
    }

    // Doctype, CDATA or processing instruction.
    if (src.startsWith('<!', i) || src.startsWith('<?', i)) {
      const close = src.indexOf('>', i);
      const stop = close === -1 ? n : close + 1;
      out += collapseTag(src.slice(i, stop));
      i = stop;
      continue;
    }

    const match = /^<(\/?)([a-zA-Z][\w:.-]*)/.exec(src.slice(i));
    if (!match) {
      out += '<';
      i += 1;
      continue;
    }

    const tagEnd = findTagEnd(src, i);
    const tag = src.slice(i, tagEnd);
    out += collapseTag(tag);
    i = tagEnd;

    const name = (match[2] as string).toLowerCase();
    if (match[1] === '' && RAW_TEXT_TAGS.has(name) && !tag.endsWith('/>')) {
      const rest = src.slice(i);
      const close = new RegExp(`</${name}\\s*>`, 'i').exec(rest);
      if (close) {
        out += rest.slice(0, close.index) + collapseTag(close[0]);
        i += close.index + close[0].length;
      } else {
        out += rest;
        i = n;
      }
    }
  }

  return out.trim();
}

function collapseText(text: string): string {
  if (text.trim() === '') return '';
  return text.replace(/\s+/g, ' ');
}

/** Collapse whitespace between attributes without touching quoted values. */
function collapseTag(tag: string): string {
  let out = '';
  let i = 0;
  while (i < tag.length) {
    const ch = tag[i] as string;
    if (ch === '"' || ch === "'") {
      const close = tag.indexOf(ch, i + 1);
      const stop = close === -1 ? tag.length : close + 1;
      out += tag.slice(i, stop);
      i = stop;
      continue;
    }
    if (/\s/.test(ch)) {
      let j = i;
      while (j < tag.length && /\s/.test(tag[j] as string)) j++;
      // Keep one space before `/>`: dropping it can swallow an unquoted value.
      if (!tag.slice(j).startsWith('>')) out += ' ';
      i = j;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

function isConditionalComment(body: string): boolean {
  const trimmed = body.trim();
  return /^\[if\b/i.test(trimmed) || /\[endif\]/i.test(trimmed);
}

/** Index just past the `>` that ends the tag starting at `start`. */
function findTagEnd(src: string, start: number): number {
  let i = start + 1;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"' || ch === "'") {
      const close = src.indexOf(ch, i + 1);
      i = close === -1 ? src.length : close + 1;
      continue;
    }
    if (ch === '>') return i + 1;
    i++;
  }
  return src.length;
}

// --- error normalisation -----------------------------------------------------

interface LocatedError {
  message?: string;
  loc?: { start?: { line?: number; column?: number } };
  line?: number;
  col?: number;
}

/**
 * Turn a Prettier / terser / csso error into a `CodeFormatError` with a single
 * readable line and a document position. Prettier appends a code frame to its
 * message; we keep only the first line and re-attach line/column ourselves.
 */
export function toFormatError(err: unknown, source: string, language: LanguageId): CodeFormatError {
  if (err instanceof CodeFormatError) return err;
  const e = (err ?? {}) as LocatedError;
  const raw = typeof e.message === 'string' ? e.message : typeof err === 'string' ? err : '';
  const first = raw.split('\n')[0] ?? '';
  const headline =
    first
      .replace(/^CssSyntaxError:\s*/, '')
      .replace(/\s*\(\d+:\d+\)\s*$/, '')
      .trim() || 'the input could not be parsed';

  const line = e.loc?.start?.line ?? e.line;
  const column = e.loc?.start?.column ?? e.col;
  const label = LANGUAGES[language].label;

  if (typeof line === 'number' && typeof column === 'number') {
    const offset = lineColumnToOffset(source, line, Math.max(1, column));
    return new CodeFormatError(
      `${label} syntax error: ${headline} (line ${line}, column ${column})`,
      { line, column, offset },
    );
  }
  return new CodeFormatError(`${label} syntax error: ${headline}`);
}

// --- samples -----------------------------------------------------------------

export const SAMPLES: Record<LanguageId, string> = {
  html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Invoice 4821</title>
<!-- page chrome -->
<style>body{margin:0;font-family:system-ui}</style></head>
<body>
<main class="invoice"    id="main">
      <h1>Invoice   4821</h1>
  <p>Due <time datetime="2026-10-01">1 October 2026</time>.</p>
  <pre>  keep   this   spacing  </pre>
  <table><tr><td>Consulting</td><td>1,200.00</td></tr></table>
</main>
</body></html>`,
  css: `.card{display:flex;flex-direction:column;gap:1rem;padding:1.5rem;
border:1px solid rgb(226, 232, 240);border-radius:12px;background:#ffffff}
/* hover state */
.card:hover{border-color:#94a3b8;box-shadow:0 1px 2px rgba(0,0,0,0.06)}
.card__title{margin:0;font-size:1.125rem;font-weight:600;color:#0f172a}
@media (max-width:640px){.card{padding:1rem}}`,
  scss: `$radius: 12px;
$border: #e2e8f0;
.card{display:flex;flex-direction:column;gap:1rem;padding:1.5rem;
border:1px solid $border;border-radius:$radius;
&__title{margin:0;font-size:1.125rem;font-weight:600}
&:hover{border-color:#94a3b8}
@media (max-width:640px){padding:1rem}}`,
  javascript: `const ENDPOINT="/api/orders";
async function loadOrders(customerId,{status="open",limit=25}={}){
const params=new URLSearchParams({customerId,status,limit:String(limit)});
const response=await fetch(ENDPOINT+"?"+params,{headers:{Accept:"application/json"}});
if(!response.ok){throw new Error("Request failed: "+response.status)}
const {data}=await response.json();
return data.map(order=>({...order,total:Number(order.total)}))}
export {loadOrders};`,
  typescript: `interface Order{id:string;total:number;status:"open"|"paid"|"void"}
type Options={status?:Order["status"];limit?:number};
export async function loadOrders(customerId:string,{status="open",limit=25}:Options={}):Promise<Order[]>{
const params=new URLSearchParams({customerId,status,limit:String(limit)});
const response=await fetch("/api/orders?"+params);
if(!response.ok)throw new Error("Request failed: "+response.status);
const {data}=await response.json() as {data:Order[]};
return data}`,
  json: `{"id":4821,"customer":{"name":"Ada Lovelace","email":"ada@example.com"},
"lines":[{"sku":"CONS-01","description":"Consulting","qty":8,"unit":150},
{"sku":"SUP-14","description":"Support retainer","qty":1,"unit":420}],
"currency":"GBP","paid":false,"issued":"2026-09-01T10:15:00Z"}`,
};
