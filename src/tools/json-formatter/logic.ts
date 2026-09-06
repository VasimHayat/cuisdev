/**
 * JSON Formatter — pure functions. Parsing, pretty-printing, minifying, key
 * sorting, statistics, and a conservative "repair" for the most common
 * mistakes (comments, trailing commas, single quotes, unquoted keys).
 */
import {
  offsetToLineColumn,
  parseErrorOffset,
  scanJsonError,
  type TextPosition,
} from '@/lib/json-errors';

export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type Indent = 2 | 4 | 'tab';

export interface FormatOptions {
  indent?: Indent;
  sortKeys?: boolean;
}

export class JsonParseError extends Error {
  override name = 'JsonParseError';
  constructor(
    message: string,
    /** Position of the error if the engine reported one. */
    public readonly position: TextPosition | undefined,
    /** Human hint about the likely cause, when we can guess it. */
    public readonly hint: string | undefined,
  ) {
    super(message);
  }
}

/** Parse JSON, throwing a JsonParseError with position and a hint. */
export function parseJson(text: string): JsonValue {
  const source = stripBom(text);
  if (source.trim() === '') throw new JsonParseError('Input is empty.', undefined, undefined);
  try {
    return JSON.parse(source) as JsonValue;
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    // Engines differ in what they report; our scanner supplies a position and a
    // clearer message whenever the engine does not.
    const scanned = scanJsonError(source);
    const offset = parseErrorOffset(raw, source) ?? scanned?.offset;
    const position = offset === undefined ? undefined : offsetToLineColumn(source, offset);
    const hint = guessHint(source, offset);
    const where = position ? ` (line ${position.line}, column ${position.column})` : '';
    const message = scanned?.message ?? cleanMessage(raw);
    throw new JsonParseError(`${message}${where}`, position, hint);
  }
}

export function formatJson(text: string, options: FormatOptions = {}): string {
  let value = parseJson(text);
  if (options.sortKeys) value = sortKeysDeep(value);
  return JSON.stringify(value, null, indentString(options.indent ?? 2));
}

export function minifyJson(text: string, options: Pick<FormatOptions, 'sortKeys'> = {}): string {
  let value = parseJson(text);
  if (options.sortKeys) value = sortKeysDeep(value);
  return JSON.stringify(value);
}

export function indentString(indent: Indent): string {
  return indent === 'tab' ? '\t' : ' '.repeat(indent);
}

export function sortKeysDeep(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, JsonValue> = {};
    for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
      sorted[key] = sortKeysDeep(value[key] as JsonValue);
    }
    return sorted;
  }
  return value;
}

export interface JsonStats {
  bytes: number;
  lines: number;
  keys: number;
  objects: number;
  arrays: number;
  strings: number;
  numbers: number;
  booleans: number;
  nulls: number;
  depth: number;
}

export function jsonStats(text: string, value: JsonValue): JsonStats {
  const stats: JsonStats = {
    bytes: new TextEncoder().encode(text).length,
    lines: text === '' ? 0 : text.split('\n').length,
    keys: 0,
    objects: 0,
    arrays: 0,
    strings: 0,
    numbers: 0,
    booleans: 0,
    nulls: 0,
    depth: 0,
  };
  const walk = (v: JsonValue, depth: number): void => {
    stats.depth = Math.max(stats.depth, depth);
    if (v === null) stats.nulls++;
    else if (Array.isArray(v)) {
      stats.arrays++;
      for (const item of v) walk(item, depth + 1);
    } else if (typeof v === 'object') {
      stats.objects++;
      for (const key of Object.keys(v)) {
        stats.keys++;
        walk(v[key] as JsonValue, depth + 1);
      }
    } else if (typeof v === 'string') stats.strings++;
    else if (typeof v === 'number') stats.numbers++;
    else stats.booleans++;
  };
  walk(value, 1);
  return stats;
}

export type JsonType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

export function typeOf(value: JsonValue): JsonType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value as JsonType;
}

/** Short summary for a tree node, e.g. "{3 keys}" or "[12 items]". */
export function summarize(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.length} ${value.length === 1 ? 'item' : 'items'}]`;
  if (value !== null && typeof value === 'object') {
    const n = Object.keys(value).length;
    return `{${n} ${n === 1 ? 'key' : 'keys'}}`;
  }
  return JSON.stringify(value);
}

/**
 * Repair common non-JSON syntax so it parses: BOM, // and /* comments,
 * trailing commas, single-quoted strings, unquoted object keys, NaN/Infinity/
 * undefined literals, and smart quotes. Strings are respected — nothing inside
 * a valid double-quoted string is touched.
 */
export function repairJson(text: string): string {
  const src = stripBom(text).replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  let out = '';
  let i = 0;
  const n = src.length;

  while (i < n) {
    const ch = src[i] as string;

    // Double-quoted string: copy verbatim (handles escapes)
    if (ch === '"') {
      const end = findStringEnd(src, i, '"');
      out += src.slice(i, end);
      i = end;
      continue;
    }

    // Single-quoted string → double-quoted
    if (ch === "'") {
      const end = findStringEnd(src, i, "'");
      const inner = src.slice(i + 1, end - 1);
      out += JSON.stringify(inner.replace(/\\'/g, "'").replace(/\\"/g, '"'));
      i = end;
      continue;
    }

    // Comments
    if (ch === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i);
      i = nl === -1 ? n : nl;
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      const close = src.indexOf('*/', i + 2);
      i = close === -1 ? n : close + 2;
      continue;
    }

    // Trailing comma before } or ]
    if (ch === ',') {
      let j = i + 1;
      while (j < n && /\s/.test(src[j] as string)) j++;
      if (src[j] === '}' || src[j] === ']') {
        i++;
        continue;
      }
    }

    // Unquoted key: identifier followed by ':'
    if (/[A-Za-z_$]/.test(ch) && isKeyPosition(out)) {
      let j = i;
      while (j < n && /[\w$]/.test(src[j] as string)) j++;
      let k = j;
      while (k < n && /\s/.test(src[k] as string)) k++;
      if (src[k] === ':') {
        out += JSON.stringify(src.slice(i, j));
        i = j;
        continue;
      }
    }

    // Non-JSON literals in value position
    if (/[A-Za-z]/.test(ch)) {
      const word = /^[A-Za-z]+/.exec(src.slice(i))?.[0] ?? '';
      if (word === 'NaN' || word === 'Infinity' || word === 'undefined') {
        out += 'null';
        i += word.length;
        continue;
      }
      if (word === 'True' || word === 'False') {
        out += word.toLowerCase();
        i += word.length;
        continue;
      }
      if (word === 'None') {
        out += 'null';
        i += word.length;
        continue;
      }
    }

    out += ch;
    i++;
  }
  return out.trim();
}

/** True if `text` is valid JSON. */
export function isValidJson(text: string): boolean {
  try {
    parseJson(text);
    return true;
  } catch {
    return false;
  }
}

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

// ---------------------------------------------------------------------------

function findStringEnd(src: string, start: number, quote: string): number {
  let i = start + 1;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (c === quote) return i + 1;
    i++;
  }
  return src.length;
}

/** After an object opener or a comma inside an object, the next token is a key. */
function isKeyPosition(out: string): boolean {
  const trimmed = out.trimEnd();
  const last = trimmed[trimmed.length - 1];
  if (last === '{') return true;
  if (last !== ',') return false;
  // Walk back to find whether we are inside an object (not an array)
  let depth = 0;
  for (let i = trimmed.length - 2; i >= 0; i--) {
    const c = trimmed[i];
    if (c === '"') {
      // skip string backwards
      let j = i - 1;
      while (j >= 0 && !(trimmed[j] === '"' && trimmed[j - 1] !== '\\')) j--;
      i = j;
      continue;
    }
    if (c === '}' || c === ']') depth++;
    else if (c === '{' || c === '[') {
      if (depth === 0) return c === '{';
      depth--;
    }
  }
  return false;
}

function cleanMessage(raw: string): string {
  return raw
    .replace(/^JSON\.parse: /, '')
    .replace(/ in JSON at position \d+.*$/, '')
    .replace(/ at position \d+.*$/, '')
    .replace(/\s*\(line \d+ column \d+\)\s*$/, '')
    .replace(/ at line \d+ column \d+ of the JSON data$/, '')
    .replace(/^Unexpected token '(.+?)', .*is not valid JSON$/, 'Unexpected token "$1"')
    .replace(/^Unexpected token (\S+), .*is not valid JSON$/, 'Unexpected token $1')
    .replace(/^Expected (.+) after (.+) in JSON$/, 'Expected $1 after $2')
    .trim();
}

function guessHint(source: string, offset: number | undefined): string | undefined {
  const around =
    offset === undefined ? source : source.slice(Math.max(0, offset - 40), offset + 40);
  if (/\/\/|\/\*/.test(source))
    return 'JSON does not allow comments. Use "Fix common mistakes" to strip them.';
  if (/,\s*[}\]]/.test(around)) return 'Trailing commas are not allowed before } or ].';
  if (/'/.test(around) && !/"/.test(around))
    return 'Strings must use double quotes, not single quotes.';
  if (/[{,]\s*[A-Za-z_$][\w$]*\s*:/.test(around)) return 'Object keys must be quoted strings.';
  if (/\b(NaN|Infinity|undefined)\b/.test(around))
    return 'NaN, Infinity and undefined are not valid JSON values — use null.';
  if (/[“”‘’]/.test(around))
    return 'Smart (curly) quotes detected — JSON needs straight double quotes.';
  if (source.trim().endsWith(','))
    return 'The input ends with a comma — remove it or add the next value.';
  const opens = (source.match(/[{[]/g) ?? []).length;
  const closes = (source.match(/[}\]]/g) ?? []).length;
  if (opens > closes) return 'Looks like a closing } or ] is missing.';
  if (closes > opens) return 'There is an extra closing } or ].';
  return undefined;
}
