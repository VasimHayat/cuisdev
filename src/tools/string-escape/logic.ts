/**
 * String escaping and unescaping for eight targets — pure functions, no DOM.
 *
 * Every escaper is linear in the input size (single regex pass or one scan).
 * Unescapers report the offset of the first problem in a `StringEscapeError`.
 */

export type EscapeTarget =
  'json' | 'javascript' | 'html-attribute' | 'xml' | 'csv' | 'shell' | 'regex' | 'sql';

export interface TargetInfo {
  id: EscapeTarget;
  label: string;
  /** False for one-way escapes (regex, SQL). */
  canUnescape: boolean;
  /** One line shown under the target selector. */
  hint: string;
}

export const TARGETS: readonly TargetInfo[] = [
  {
    id: 'json',
    label: 'JSON string',
    canUnescape: true,
    hint: 'Escapes " \\ and control characters the way JSON.stringify does. Output goes between the quotes of a JSON string.',
  },
  {
    id: 'javascript',
    label: 'JavaScript string',
    canUnescape: true,
    hint: 'Escapes \' " ` \\ line breaks, U+2028/2029 and control characters (\\xHH), so the text is safe inside any JS string literal.',
  },
  {
    id: 'html-attribute',
    label: 'HTML attribute',
    canUnescape: true,
    hint: 'Escapes & < > " and \' as entities so the text can sit inside a quoted attribute or text content.',
  },
  {
    id: 'xml',
    label: 'XML text / attribute',
    canUnescape: true,
    hint: 'Escapes the five XML predefined entities: &amp; &lt; &gt; &quot; &apos;.',
  },
  {
    id: 'csv',
    label: 'CSV field',
    canUnescape: true,
    hint: 'RFC 4180: wraps the value in double quotes when it contains a comma, quote, line break or outer spaces, doubling any inner quotes.',
  },
  {
    id: 'shell',
    label: 'Shell argument (POSIX)',
    canUnescape: true,
    hint: "Wraps the text in single quotes for sh/bash/zsh; each inner quote becomes '\\''. Unescape also understands double quotes and backslashes.",
  },
  {
    id: 'regex',
    label: 'Regular expression',
    canUnescape: false,
    hint: 'Backslash-escapes the metacharacters . * + ? ^ $ { } ( ) | [ ] \\ / so the text matches itself literally. Escape only.',
  },
  {
    id: 'sql',
    label: 'SQL string literal',
    canUnescape: false,
    hint: "Doubles single quotes ('' ) for a standard SQL literal. Escape only — prefer parameterised queries for user input.",
  },
];

export class StringEscapeError extends Error {
  override name = 'StringEscapeError';
  /** Character offset in the input where the problem was found, when known. */
  offset?: number;

  constructor(message: string, offset?: number) {
    super(message);
    if (offset !== undefined) this.offset = offset;
  }
}

export function canUnescape(target: EscapeTarget): boolean {
  return getTarget(target).canUnescape;
}

export function getTarget(target: EscapeTarget): TargetInfo {
  const info = TARGETS.find((t) => t.id === target);
  if (!info) {
    throw new StringEscapeError(
      `Unknown target "${String(target)}". Use one of: ${TARGETS.map((t) => t.id).join(', ')}.`,
    );
  }
  return info;
}

// --- public API -------------------------------------------------------------

export function escape(text: string, target: EscapeTarget): string {
  getTarget(target);
  if (text === '' && target !== 'shell') return '';
  switch (target) {
    case 'json':
      return escapeJson(text);
    case 'javascript':
      return escapeJs(text);
    case 'html-attribute':
      return replaceChars(text, HTML_ESCAPES);
    case 'xml':
      return replaceChars(text, XML_ESCAPES);
    case 'csv':
      return escapeCsv(text);
    case 'shell':
      return escapeShell(text);
    case 'regex':
      return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    case 'sql':
      return text.replace(/'/g, "''");
  }
}

export function unescape(text: string, target: EscapeTarget): string {
  const info = getTarget(target);
  if (!info.canUnescape) {
    throw new StringEscapeError(
      `${info.label} escaping is one-way: there is nothing to unescape. Switch to Escape, or pick a reversible target such as JSON or JavaScript.`,
    );
  }
  if (text === '') return '';
  switch (target) {
    case 'json':
      return unescapeJson(text);
    case 'javascript':
      return unescapeJs(text);
    case 'html-attribute':
      return unescapeEntities(text, HTML_NAMED);
    case 'xml':
      return unescapeEntities(text, XML_NAMED);
    case 'csv':
      return unescapeCsv(text);
    case 'shell':
      return unescapeShell(text);
    default:
      return text;
  }
}

// --- JSON -------------------------------------------------------------------

function escapeJson(text: string): string {
  return JSON.stringify(text).slice(1, -1);
}

const JSON_SIMPLE: Readonly<Record<string, string>> = {
  '"': '"',
  '\\': '\\',
  '/': '/',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
};

function unescapeJson(input: string): string {
  const s = stripQuotes(input, '"');
  if (!s.includes('\\')) return s;
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    const bs = s.indexOf('\\', i);
    if (bs === -1) {
      out.push(s.slice(i));
      break;
    }
    out.push(s.slice(i, bs));
    const next = s[bs + 1];
    if (next === undefined) {
      throw new StringEscapeError(
        `Trailing backslash at offset ${bs}: a backslash must be followed by one of " \\ / b f n r t or uXXXX.`,
        bs,
      );
    }
    if (next === 'u') {
      const hex = s.slice(bs + 2, bs + 6);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
        throw new StringEscapeError(
          `Invalid \\u escape at offset ${bs}: expected exactly 4 hex digits, found "\\u${hex}". Characters outside the BMP need two escapes (a surrogate pair), e.g. \\ud83d\\ude00.`,
          bs,
        );
      }
      out.push(String.fromCharCode(parseInt(hex, 16)));
      i = bs + 6;
      continue;
    }
    const simple = JSON_SIMPLE[next];
    if (simple === undefined) {
      throw new StringEscapeError(
        `Unknown escape "\\${next}" at offset ${bs}. JSON only allows \\" \\\\ \\/ \\b \\f \\n \\r \\t and \\uXXXX — a literal backslash must be written \\\\.`,
        bs,
      );
    }
    out.push(simple);
    i = bs + 2;
  }
  return out.join('');
}

// --- JavaScript -------------------------------------------------------------

const JS_ESCAPES: Readonly<Record<string, string>> = {
  '\\': '\\\\',
  '"': '\\"',
  "'": "\\'",
  '`': '\\`',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
  '\b': '\\b',
  '\f': '\\f',
  '\v': '\\v',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
};

// Quotes, backslash, line terminators, control characters and lone surrogates
// (with the `u` flag a surrogate range only matches unpaired halves).
// eslint-disable-next-line no-control-regex -- control characters are exactly what we escape
const JS_ESCAPE_RE = /[\\"'`\u2028\u2029]|[\0-\x1f\x7f]|[\ud800-\udfff]/gu;

function escapeJs(text: string): string {
  return text.replace(JS_ESCAPE_RE, (c) => {
    const known = JS_ESCAPES[c];
    if (known) return known;
    const code = c.charCodeAt(0);
    return code < 0x100
      ? `\\x${code.toString(16).padStart(2, '0')}`
      : `\\u${code.toString(16).padStart(4, '0')}`;
  });
}

const JS_SIMPLE: Readonly<Record<string, string>> = {
  n: '\n',
  r: '\r',
  t: '\t',
  b: '\b',
  f: '\f',
  v: '\v',
};

function unescapeJs(input: string): string {
  const s = stripQuotes(input, '"', "'", '`');
  if (!s.includes('\\')) return s;
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    const bs = s.indexOf('\\', i);
    if (bs === -1) {
      out.push(s.slice(i));
      break;
    }
    out.push(s.slice(i, bs));
    const next = s[bs + 1];
    if (next === undefined) {
      throw new StringEscapeError(
        `Trailing backslash at offset ${bs}: the string ends in the middle of an escape sequence.`,
        bs,
      );
    }
    i = bs + 2;
    const simple = JS_SIMPLE[next];
    if (simple !== undefined) {
      out.push(simple);
    } else if (next === 'x') {
      const hex = s.slice(i, i + 2);
      if (!/^[0-9a-fA-F]{2}$/.test(hex)) {
        throw new StringEscapeError(
          `Invalid \\x escape at offset ${bs}: expected 2 hex digits, found "\\x${hex}".`,
          bs,
        );
      }
      out.push(String.fromCharCode(parseInt(hex, 16)));
      i += 2;
    } else if (next === 'u') {
      if (s[i] === '{') {
        const close = s.indexOf('}', i);
        const hex = close === -1 ? '' : s.slice(i + 1, close);
        const code = /^[0-9a-fA-F]{1,6}$/.test(hex) ? parseInt(hex, 16) : Number.NaN;
        if (Number.isNaN(code) || code > 0x10ffff) {
          throw new StringEscapeError(
            `Invalid \\u{…} escape at offset ${bs}: expected 1–6 hex digits up to 10FFFF inside the braces.`,
            bs,
          );
        }
        out.push(String.fromCodePoint(code));
        i = close + 1;
      } else {
        const hex = s.slice(i, i + 4);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
          throw new StringEscapeError(
            `Invalid \\u escape at offset ${bs}: expected 4 hex digits, found "\\u${hex}". Use \\u{1F600} for code points above FFFF.`,
            bs,
          );
        }
        out.push(String.fromCharCode(parseInt(hex, 16)));
        i += 4;
      }
    } else if (next >= '0' && next <= '7') {
      // Legacy octal escape (\0, \12, \177) — up to three digits, max 0o377.
      let digits = next;
      while (digits.length < 3 && s[i] !== undefined && /[0-7]/.test(s[i] as string)) {
        if (parseInt(digits + s[i], 8) > 0o377) break;
        digits += s[i];
        i++;
      }
      out.push(String.fromCharCode(parseInt(digits, 8)));
    } else if (next === '\n') {
      // Line continuation: backslash-newline disappears.
    } else if (next === '\r') {
      if (s[i] === '\n') i++;
    } else {
      // Identity escape: \' \" \` \\ \/ and any other character stand for themselves.
      out.push(next);
    }
  }
  return out.join('');
}

// --- HTML / XML entities ----------------------------------------------------

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const XML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

const HTML_NAMED: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

const XML_NAMED: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

const ENTITY_RE = /&(?:([a-zA-Z]+)|#([0-9]+)|#[xX]([0-9a-fA-F]+));/g;

function replaceChars(text: string, table: Readonly<Record<string, string>>): string {
  return text.replace(/[&<>"']/g, (c) => table[c] as string);
}

/** Decode the given named entities plus any numeric reference. Unknown names are left as-is. */
function unescapeEntities(text: string, named: Readonly<Record<string, string>>): string {
  if (!text.includes('&')) return text;
  return text.replace(ENTITY_RE, (match, name?: string, dec?: string, hex?: string) => {
    if (name !== undefined) return named[name] ?? match;
    const code = dec !== undefined ? parseInt(dec, 10) : parseInt(hex as string, 16);
    if (code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return '�';
    return String.fromCodePoint(code);
  });
}

// --- CSV --------------------------------------------------------------------

function escapeCsv(text: string): string {
  const needsQuotes = /[",\r\n]/.test(text) || /^\s|\s$/.test(text);
  return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text;
}

function unescapeCsv(text: string): string {
  if (!text.startsWith('"')) {
    const quote = text.indexOf('"');
    if (quote !== -1) {
      throw new StringEscapeError(
        `Unexpected double quote at offset ${quote}: a CSV field that contains quotes must be wrapped in quotes with the inner ones doubled, e.g. "say ""hi""".`,
        quote,
      );
    }
    return text;
  }
  if (text.length < 2 || !text.endsWith('"')) {
    throw new StringEscapeError(
      'Unterminated quoted field: it starts with a double quote but does not end with one.',
      text.length,
    );
  }
  const inner = text.slice(1, -1);
  const out: string[] = [];
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i] as string;
    if (ch === '"') {
      if (inner[i + 1] === '"') {
        out.push('"');
        i++;
      } else {
        throw new StringEscapeError(
          `Stray double quote at offset ${i + 1}: inside a quoted CSV field every quote must be doubled ("").`,
          i + 1,
        );
      }
    } else {
      out.push(ch);
    }
  }
  return out.join('');
}

// --- Shell ------------------------------------------------------------------

function escapeShell(text: string): string {
  return `'${text.replace(/'/g, "'\\''")}'`;
}

/** Interpret one POSIX shell word: single quotes, double quotes, backslashes and concatenation. */
function unescapeShell(s: string): string {
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i] as string;
    if (ch === "'") {
      const close = s.indexOf("'", i + 1);
      if (close === -1) {
        throw new StringEscapeError(
          `Unterminated single quote at offset ${i}. Inside single quotes nothing is special, so a literal quote must be written as '\\'' outside them.`,
          i,
        );
      }
      out.push(s.slice(i + 1, close));
      i = close + 1;
    } else if (ch === '"') {
      let j = i + 1;
      let closed = false;
      while (j < s.length) {
        const c = s[j] as string;
        if (c === '"') {
          closed = true;
          break;
        }
        if (c === '\\' && j + 1 < s.length) {
          const n = s[j + 1] as string;
          if (n === '\n') {
            j += 2;
            continue;
          }
          if ('$`"\\'.includes(n)) {
            out.push(n);
            j += 2;
            continue;
          }
        }
        out.push(c);
        j++;
      }
      if (!closed) {
        throw new StringEscapeError(`Unterminated double quote at offset ${i}.`, i);
      }
      i = j + 1;
    } else if (ch === '\\') {
      const n = s[i + 1];
      if (n === undefined) {
        throw new StringEscapeError(
          `Trailing backslash at offset ${i}: a backslash must be followed by the character it escapes.`,
          i,
        );
      }
      if (n !== '\n') out.push(n);
      i += 2;
    } else {
      out.push(ch);
      i++;
    }
  }
  return out.join('');
}

// --- helpers ----------------------------------------------------------------

/** Remove one pair of matching surrounding quotes, if present (so a pasted literal works). */
function stripQuotes(text: string, ...quotes: string[]): string {
  const trimmed = text.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0] as string;
    if (quotes.includes(first) && trimmed.endsWith(first) && !trimmed.endsWith(`\\${first}`)) {
      return trimmed.slice(1, -1);
    }
  }
  return text;
}
