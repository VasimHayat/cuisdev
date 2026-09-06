/**
 * SQL Formatter — pure functions, no DOM.
 *
 * Formatting delegates to the `sql-formatter` library, which is `await
 * import()`-ed the first time it is needed so the tool page's first-load
 * bundle stays small. Minifying is implemented here: it collapses whitespace
 * everywhere except inside string literals and comments.
 */
import type * as SqlFormatterModule from 'sql-formatter';

import { lineColumnToOffset } from '@/lib/json-errors';

export type DialectId =
  | 'sql'
  | 'mysql'
  | 'mariadb'
  | 'postgresql'
  | 'sqlite'
  | 'tsql'
  | 'bigquery'
  | 'snowflake'
  | 'spark'
  | 'plsql'
  | 'db2'
  | 'hive'
  | 'trino';

export type CaseOption = 'preserve' | 'upper' | 'lower';
export type IndentOption = 2 | 4 | 'tab';
export type LinesBetweenQueries = 1 | 2;
export type Mode = 'format' | 'minify';

export interface Dialect {
  id: DialectId;
  label: string;
}

/** Dialects offered by the tool, in the order they appear in the select. */
export const DIALECTS: readonly Dialect[] = [
  { id: 'sql', label: 'Standard SQL' },
  { id: 'mysql', label: 'MySQL' },
  { id: 'mariadb', label: 'MariaDB' },
  { id: 'postgresql', label: 'PostgreSQL' },
  { id: 'sqlite', label: 'SQLite' },
  { id: 'tsql', label: 'SQL Server (T-SQL)' },
  { id: 'bigquery', label: 'BigQuery' },
  { id: 'snowflake', label: 'Snowflake' },
  { id: 'spark', label: 'Spark SQL' },
  { id: 'plsql', label: 'Oracle PL/SQL' },
  { id: 'db2', label: 'Db2' },
  { id: 'hive', label: 'Hive' },
  { id: 'trino', label: 'Trino' },
];

const DIALECT_IDS = new Set<string>(DIALECTS.map((d) => d.id));

export function isDialectId(value: string): value is DialectId {
  return DIALECT_IDS.has(value);
}

export function dialectLabel(id: DialectId): string {
  return DIALECTS.find((d) => d.id === id)?.label ?? id;
}

export interface ErrorPosition {
  line: number;
  column: number;
  offset: number;
}

/** A parse error from the SQL formatter, with a position when one was reported. */
export class SqlFormatError extends Error {
  override name = 'SqlFormatError';
  constructor(
    message: string,
    public readonly position?: ErrorPosition,
  ) {
    super(message);
  }
}

/** Strip a UTF-8 BOM and normalise CRLF / CR line endings to LF. */
export function normalizeSql(text: string): string {
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

export function fileNameFor(mode: Mode): string {
  return mode === 'minify' ? 'query.min.sql' : 'query.sql';
}

export interface SqlFormatOptions {
  dialect?: DialectId;
  keywordCase?: CaseOption;
  dataTypeCase?: CaseOption;
  functionCase?: CaseOption;
  indent?: IndentOption;
  linesBetweenQueries?: LinesBetweenQueries;
}

export interface SqlFormatterConfig {
  language: DialectId;
  keywordCase: CaseOption;
  dataTypeCase: CaseOption;
  functionCase: CaseOption;
  tabWidth: number;
  useTabs: boolean;
  linesBetweenQueries: number;
}

/** Map the tool's options onto sql-formatter's. Exported so it can be unit-tested. */
export function formatterConfig(options: SqlFormatOptions = {}): SqlFormatterConfig {
  const indent = options.indent ?? 2;
  return {
    language: options.dialect ?? 'sql',
    keywordCase: options.keywordCase ?? 'upper',
    dataTypeCase: options.dataTypeCase ?? 'preserve',
    functionCase: options.functionCase ?? 'preserve',
    tabWidth: indent === 'tab' ? 2 : indent,
    useTabs: indent === 'tab',
    linesBetweenQueries: options.linesBetweenQueries ?? 1,
  };
}

// --- lazy library loading ----------------------------------------------------

let libraryPromise: Promise<typeof SqlFormatterModule> | undefined;

/** True once the sql-formatter chunk has been requested, so the UI can skip "Loading…". */
export function isReady(): boolean {
  return libraryPromise !== undefined;
}

/** Pretty-print SQL. Throws `SqlFormatError` with a position for parse errors. */
export async function formatSql(sql: string, options: SqlFormatOptions = {}): Promise<string> {
  const text = normalizeSql(sql);
  if (text.trim() === '') return '';
  libraryPromise ??= import('sql-formatter');
  const { format } = await libraryPromise;
  try {
    return format(text, formatterConfig(options));
  } catch (err) {
    throw toSqlError(err, text);
  }
}

// --- minify ------------------------------------------------------------------

interface Segment {
  /** Code segments get their whitespace collapsed; literals are copied verbatim. */
  code: boolean;
  text: string;
}

/**
 * Split SQL into code and verbatim segments: quoted strings and identifiers,
 * `--` / `#` line comments and `/* *\/` block comments are never touched.
 */
export function splitSql(sql: string): Segment[] {
  const src = normalizeSql(sql);
  const segments: Segment[] = [];
  let buffer = '';
  let i = 0;

  const flush = (): void => {
    if (buffer !== '') {
      segments.push({ code: true, text: buffer });
      buffer = '';
    }
  };

  while (i < src.length) {
    const ch = src[i] as string;

    if (ch === "'" || ch === '"' || ch === '`') {
      flush();
      const end = findQuoteEnd(src, i, ch);
      segments.push({ code: false, text: src.slice(i, end) });
      i = end;
      continue;
    }

    if ((ch === '-' && src[i + 1] === '-') || ch === '#') {
      flush();
      const newline = src.indexOf('\n', i);
      const end = newline === -1 ? src.length : newline;
      // A line comment must keep its terminating newline or it swallows the rest.
      segments.push({ code: false, text: `${src.slice(i, end)}\n` });
      i = end === src.length ? end : end + 1;
      continue;
    }

    if (ch === '/' && src[i + 1] === '*') {
      flush();
      const close = src.indexOf('*/', i + 2);
      const end = close === -1 ? src.length : close + 2;
      segments.push({ code: false, text: src.slice(i, end) });
      i = end;
      continue;
    }

    buffer += ch;
    i++;
  }

  flush();
  return segments;
}

/**
 * Collapse every run of whitespace to a single space and tighten the spacing
 * around `,`, `;`, `(` and `)`. String literals and comments are preserved.
 */
export function minifySql(sql: string): string {
  const text = normalizeSql(sql);
  if (text.trim() === '') return '';
  return splitSql(text)
    .map((segment) => (segment.code ? collapseCode(segment.text) : segment.text))
    .join('')
    .replace(/\n +/g, '\n')
    .trim();
}

function collapseCode(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,;)])/g, '$1')
    .replace(/([,(])\s+/g, '$1');
}

/** Index just past the closing quote, honouring doubled quotes and backslash escapes. */
function findQuoteEnd(src: string, start: number, quote: string): number {
  let i = start + 1;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\' && quote !== '`') {
      i += 2;
      continue;
    }
    if (ch === quote) {
      if (src[i + 1] === quote) {
        i += 2;
        continue;
      }
      return i + 1;
    }
    i++;
  }
  return src.length;
}

// --- error normalisation -----------------------------------------------------

const HINT =
  'Check for an unclosed quote or bracket, a missing comma, or try a different SQL dialect.';

/**
 * Turn a sql-formatter exception into a short, friendly `SqlFormatError`. The
 * library's messages embed a token dump and a long list of expected tokens; we
 * keep the useful part and re-attach the reported line and column.
 */
export function toSqlError(err: unknown, source: string): SqlFormatError {
  if (err instanceof SqlFormatError) return err;
  const raw = err instanceof Error ? err.message : String(err);

  if (/Unsupported SQL dialect/i.test(raw)) {
    return new SqlFormatError('That SQL dialect is not supported. Pick another one.');
  }

  const at = /line (\d+) column (\d+)/i.exec(raw);
  const line = at ? Number(at[1]) : undefined;
  const column = at ? Number(at[2]) : undefined;

  let headline: string;
  if (/Unexpected EOF/i.test(raw)) {
    headline = 'the statement ends before it is finished';
  } else {
    const token = /Unexpected "(.*?)"/s.exec(raw)?.[1];
    headline = token ? `unexpected ${truncate(token.trim(), 30)}` : 'the query could not be parsed';
  }

  const where =
    line !== undefined && column !== undefined ? ` at line ${line}, column ${column}` : '';
  const message = `SQL parse error: ${headline}${where}. ${HINT}`;

  if (line !== undefined && column !== undefined) {
    return new SqlFormatError(message, {
      line,
      column,
      offset: lineColumnToOffset(source, line, Math.max(1, column)),
    });
  }
  return new SqlFormatError(message);
}

function truncate(text: string, max: number): string {
  return text.length <= max ? `"${text}"` : `"${text.slice(0, max)}…"`;
}

// --- sample ------------------------------------------------------------------

export const SAMPLE = `with recent_orders as (select o.customer_id, count(*) as order_count, sum(o.total_amount) as lifetime_value from orders o where o.placed_at >= date '2026-01-01' and o.status <> 'cancelled' group by o.customer_id) select c.id, c.full_name, c.email, r.order_count, r.lifetime_value, coalesce(a.city, 'unknown') as city from customers c inner join recent_orders r on r.customer_id = c.id left join addresses a on a.customer_id = c.id and a.is_primary = true where r.lifetime_value > (select avg(lifetime_value) from recent_orders) and c.email is not null order by r.lifetime_value desc, c.full_name asc limit 50;`;
