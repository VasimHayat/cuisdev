/**
 * JSON ↔ CSV conversion — pure functions, no DOM. Built on `papaparse`.
 *
 * JSON → CSV expects an array of objects. Nested objects are flattened to
 * dot-notation columns (`address.city`); arrays are JSON-stringified so no
 * data is lost. CSV → JSON produces an array of objects (or of arrays when the
 * file has no header row).
 */
import Papa from 'papaparse';

export class ConvertError extends Error {
  override name = 'ConvertError';
  offset: number | undefined;
  line: number | undefined;
  column: number | undefined;

  constructor(
    message: string,
    position?: { offset?: number | undefined; line?: number; column?: number },
  ) {
    super(message);
    this.offset = position?.offset;
    this.line = position?.line;
    this.column = position?.column;
  }
}

export type Delimiter = ',' | ';' | '\t' | '|';
export const DELIMITERS: readonly Delimiter[] = [',', ';', '\t', '|'];

export interface JsonToCsvOptions {
  delimiter?: Delimiter;
  /** Emit the column names as the first row. Default true. */
  header?: boolean;
  /** Wrap every field in double quotes, not only the ones that need it. */
  quoteAll?: boolean;
}

export interface CsvToJsonOptions {
  /** Treat the first row as column names. Default true. */
  header?: boolean;
  /** `'auto'` sniffs the delimiter from the first rows. Default 'auto'. */
  delimiter?: Delimiter | 'auto';
  /** Convert numeric and boolean-looking strings to numbers/booleans. */
  dynamicTyping?: boolean;
  minify?: boolean;
  indent?: 2 | 4;
}

export interface CsvResult {
  csv: string;
  rows: number;
  columns: number;
}

export interface JsonResult {
  json: string;
  rows: number;
  columns: number;
  /** The delimiter actually used (auto-detected or explicit). */
  delimiter: Delimiter;
  /** Non-fatal parser notes (ragged rows, renamed duplicate headers…). */
  warnings: string[];
}

type Row = Record<string, unknown>;

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function offsetToLineColumn(text: string, offset: number): { line: number; column: number } {
  const clamped = Math.max(0, Math.min(offset, text.length));
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < clamped; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: clamped - lineStart + 1 };
}

function lineColumnToOffset(text: string, line: number, column: number): number {
  let offset = 0;
  let current = 1;
  while (current < line) {
    const nl = text.indexOf('\n', offset);
    if (nl === -1) return text.length;
    offset = nl + 1;
    current++;
  }
  return Math.min(offset + Math.max(0, column - 1), text.length);
}

/** JSON.parse with a helpful, positioned error. */
export function parseJson(input: string): unknown {
  const source = stripBom(input);
  if (source.trim() === '') {
    throw new ConvertError('Input is empty — paste a JSON array of objects to convert.');
  }
  try {
    return JSON.parse(source);
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const pos = /position (\d+)/.exec(raw);
    const lc = /line (\d+) column (\d+)/i.exec(raw);
    let offset: number | undefined;
    if (pos) offset = Number(pos[1]);
    else if (lc) offset = lineColumnToOffset(source, Number(lc[1]), Number(lc[2]));
    else if (/end of (JSON )?(input|data)/i.test(raw)) offset = source.length;
    const detail = raw
      .replace(/\s*in JSON at position \d+.*$/, '')
      .replace(/\s*\(line \d+ column \d+\)\s*$/, '')
      .replace(/^JSON\.parse:\s*/, '')
      .trim();
    if (offset === undefined) throw new ConvertError(`Invalid JSON: ${detail}.`);
    const { line, column } = offsetToLineColumn(source, offset);
    throw new ConvertError(
      `Invalid JSON at line ${line}, column ${column}: ${detail}. Check for trailing commas, single quotes or unquoted keys.`,
      { offset, line, column },
    );
  }
}

function isPlainObject(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Flatten nested objects into dot-notation keys. Arrays and empty objects are
 * JSON-stringified; null/undefined become empty cells.
 */
export function flattenRecord(record: Row, prefix = '', out: Row = {}): Row {
  for (const [key, value] of Object.entries(record)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value)) {
      if (Object.keys(value).length === 0) out[path] = '{}';
      else flattenRecord(value, path, out);
    } else if (Array.isArray(value)) {
      out[path] = JSON.stringify(value);
    } else if (value === null || value === undefined) {
      out[path] = '';
    } else {
      out[path] = value;
    }
  }
  return out;
}

function describeType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  if (typeof value === 'string') return 'a string';
  if (typeof value === 'number') return 'a number';
  if (typeof value === 'boolean') return 'a boolean';
  return `a ${typeof value}`;
}

/**
 * Validate that a parsed JSON value is an array of objects, with hints for
 * the common mistakes (wrapped in an envelope object, array of primitives…).
 */
export function toRows(value: unknown): Row[] {
  if (isPlainObject(value)) {
    const nested = Object.entries(value).find(
      ([, v]) => Array.isArray(v) && v.length > 0 && v.every(isPlainObject),
    );
    const hint = nested
      ? ` Your object has an array of objects under "${nested[0]}" — paste that array instead.`
      : ' Wrap a single record in [ ] to convert it as one row.';
    throw new ConvertError(
      `JSON must be an array of objects (one object per row), but the top-level value is an object.${hint}`,
    );
  }
  if (!Array.isArray(value)) {
    throw new ConvertError(
      `JSON must be an array of objects (one object per row), but the top-level value is ${describeType(value)}.`,
    );
  }
  const bad = value.findIndex((item) => !isPlainObject(item));
  if (bad !== -1) {
    throw new ConvertError(
      `JSON must be an array of objects, but item ${bad} is ${describeType(value[bad])}. Every row needs to be an object like {"name": "…"}.`,
    );
  }
  return value as Row[];
}

export function jsonToCsv(input: string, options: JsonToCsvOptions = {}): CsvResult {
  const rows = toRows(parseJson(input));
  if (rows.length === 0) return { csv: '', rows: 0, columns: 0 };

  const flat = rows.map((row) => flattenRecord(row));
  // Column order: first appearance across all rows.
  const fields: string[] = [];
  const seen = new Set<string>();
  for (const row of flat) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        fields.push(key);
      }
    }
  }
  const data = flat.map((row) => fields.map((f) => (f in row ? row[f] : '')));
  const csv = Papa.unparse(
    { fields, data },
    {
      delimiter: options.delimiter ?? ',',
      header: options.header ?? true,
      quotes: options.quoteAll ?? false,
      newline: '\n',
    },
  );
  return { csv: csv + '\n', rows: rows.length, columns: fields.length };
}

export function csvToJson(input: string, options: CsvToJsonOptions = {}): JsonResult {
  const source = stripBom(input);
  if (source.trim() === '') {
    throw new ConvertError('Input is empty — paste some CSV to convert.');
  }
  const header = options.header ?? true;
  const delimiter = options.delimiter ?? 'auto';

  const result = Papa.parse<unknown>(source, {
    header,
    delimiter: delimiter === 'auto' ? '' : delimiter,
    dynamicTyping: options.dynamicTyping ?? false,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });

  const warnings: string[] = [];
  for (const error of result.errors) {
    if (error.type === 'Quotes') {
      const offset = error.index;
      let position: { line: number; column: number } | undefined;
      if (offset !== undefined) position = offsetToLineColumn(source, offset);
      else if (typeof error.row === 'number')
        position = { line: error.row + (header ? 2 : 1), column: 1 };
      const where = position ? ` at line ${position.line}, column ${position.column}` : '';
      throw new ConvertError(
        `Invalid CSV${where}: ${error.message}. A quoted field must end with a closing " and quotes inside a field must be doubled ("").`,
        position ? { offset, ...position } : undefined,
      );
    }
    if (error.type === 'Delimiter') {
      warnings.push(
        'Could not detect the delimiter; assumed a comma. Pick one explicitly if the columns look wrong.',
      );
    } else if (error.type === 'FieldMismatch') {
      const row = typeof error.row === 'number' ? error.row + (header ? 2 : 1) : undefined;
      warnings.push(row === undefined ? `${error.message}.` : `Line ${row}: ${error.message}.`);
    }
  }
  if (result.meta.renamedHeaders) {
    const renamed = Object.entries(result.meta.renamedHeaders)
      .map(([to, from]) => `"${from}" → "${to}"`)
      .join(', ');
    warnings.push(`Duplicate column names were renamed: ${renamed}.`);
  }

  const data = result.data;
  const columns = header
    ? (result.meta.fields?.length ?? 0)
    : Math.max(0, ...data.map((row) => (Array.isArray(row) ? row.length : 0)));
  const json = options.minify
    ? JSON.stringify(data)
    : JSON.stringify(data, null, options.indent ?? 2);
  const used = result.meta.delimiter;
  const detected: Delimiter = DELIMITERS.includes(used as Delimiter) ? (used as Delimiter) : ',';
  return {
    json: json + '\n',
    rows: data.length,
    columns,
    delimiter: detected,
    warnings: [...new Set(warnings)],
  };
}

/** Human label for a delimiter, for stats and messages. */
export function delimiterName(delimiter: Delimiter | 'auto'): string {
  switch (delimiter) {
    case ',':
      return 'comma';
    case ';':
      return 'semicolon';
    case '\t':
      return 'tab';
    case '|':
      return 'pipe';
    default:
      return 'auto';
  }
}

/** Short stats line for a pane: line count and UTF-8 byte size. */
export function describe(text: string): string {
  if (text.length === 0) return '';
  let lines = 1;
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) lines++;
  if (text.endsWith('\n')) lines--;
  const bytes = new TextEncoder().encode(text).length;
  const size = bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(bytes < 10240 ? 2 : 1)} KB`;
  return `${lines.toLocaleString()} ${lines === 1 ? 'line' : 'lines'} · ${size}`;
}
