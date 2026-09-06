/**
 * JSONPath Tester — pure functions, no DOM.
 *
 * Thin, well-behaved layer over `jsonpath-plus`: parses the document with a
 * helpful error, sanity-checks the expression, evaluates it in the requested
 * result type and formats the matches for display.
 */
import { JSONPath } from 'jsonpath-plus';

/** The JSON document could not be parsed. */
export class JsonParseError extends Error {
  override name = 'JsonParseError';
  constructor(
    message: string,
    /** Character offset of the problem when the engine reported one. */
    readonly offset?: number,
  ) {
    super(message);
  }
}

/** The JSONPath expression is empty, unbalanced or rejected by the evaluator. */
export class JsonPathError extends Error {
  override name = 'JsonPathError';
}

export type ResultType = 'value' | 'path' | 'pointer';

export const RESULT_TYPES: readonly ResultType[] = ['value', 'path', 'pointer'];

export const RESULT_TYPE_LABEL: Record<ResultType, string> = {
  value: 'Values',
  path: 'Paths',
  pointer: 'Pointers',
};

export interface QueryResult {
  resultType: ResultType;
  /** Raw matches (values, normalised paths or JSON Pointers). */
  matches: unknown[];
  count: number;
  /** Pretty-printed JSON array of the matches, ready for the output editor. */
  output: string;
}

/**
 * Convert a JSON.parse error message into a character offset. Chromium/Node
 * report "at position N"; Firefox and Safari report "line L column C".
 */
export function jsonErrorOffset(message: string, source: string): number | undefined {
  const pos = /position (\d+)/.exec(message);
  if (pos) return Number(pos[1]);
  const lc = /line (\d+) column (\d+)/i.exec(message);
  if (lc) {
    const line = Number(lc[1]);
    const col = Number(lc[2]);
    let offset = 0;
    let seen = 1;
    while (seen < line) {
      const nl = source.indexOf('\n', offset);
      if (nl === -1) break;
      offset = nl + 1;
      seen++;
    }
    return offset + col - 1;
  }
  if (/end of JSON input|unexpected end/i.test(message)) return source.length;
  return undefined;
}

/**
 * Parse the JSON document. Tolerates a UTF-8 byte-order mark and Windows line
 * endings; rejects empty input with a clear message.
 */
export function parseJson(text: string): unknown {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  if (clean.trim() === '') {
    throw new JsonParseError('JSON input is empty — paste the document you want to query.');
  }
  try {
    return JSON.parse(clean);
  } catch (err) {
    const native = err instanceof Error ? err.message : String(err);
    const offset = jsonErrorOffset(native, clean);
    const where = offset === undefined ? '' : ` ${describeOffset(clean, offset)}`;
    throw new JsonParseError(
      `JSON input is not valid JSON${where}: ${native.replace(/^JSON\.parse: /, '')}. Check for trailing commas, single quotes or unquoted keys.`,
      offset,
    );
  }
}

function describeOffset(text: string, offset: number): string {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      lineStart = i + 1;
    }
  }
  return `at line ${line}, column ${offset - lineStart + 1}`;
}

/**
 * Cheap structural check before handing the expression to the evaluator,
 * which is lenient about unbalanced brackets and silently returns the root.
 * Throws `JsonPathError` for empty input or unbalanced `[]` / `()`.
 */
export function checkExpression(path: string): string {
  const trimmed = path.trim();
  if (trimmed === '') {
    throw new JsonPathError(
      'Enter a JSONPath expression — start with $ for the root, e.g. $.store.book[*].title',
    );
  }
  let square = 0;
  let round = 0;
  let quote: string | null = null;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '[') square++;
    else if (ch === ']') square--;
    else if (ch === '(') round++;
    else if (ch === ')') round--;
    if (square < 0 || round < 0) {
      throw new JsonPathError(
        `Unexpected closing "${ch}" at character ${i + 1} — there is no matching opening bracket.`,
      );
    }
  }
  if (quote) throw new JsonPathError(`Unterminated ${quote} string in the expression.`);
  if (square > 0) {
    throw new JsonPathError(
      `Missing ${square} closing "]" — every [ must be closed, e.g. $.items[0] or $.items[?(@.id > 1)].`,
    );
  }
  if (round > 0) {
    throw new JsonPathError(
      `Missing ${round} closing ")" — filter expressions look like [?(@.price < 10)].`,
    );
  }
  return trimmed;
}

/**
 * Evaluate a JSONPath expression against parsed JSON. Always returns an array
 * (`wrap: true`). Throws `JsonPathError` with the evaluator's reason when the
 * expression cannot be evaluated.
 */
export function queryJsonPath(
  json: unknown,
  path: string,
  resultType: ResultType = 'value',
): unknown[] {
  const expression = checkExpression(path);
  try {
    const result: unknown = JSONPath({
      path: expression,
      json: json as object,
      resultType,
      wrap: true,
    });
    return Array.isArray(result) ? result : [];
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new JsonPathError(`Invalid JSONPath expression: ${cleanReason(reason)}`);
  }
}

function cleanReason(reason: string): string {
  const cleaned = reason.replace(/^jsonPath:\s*/i, '').trim();
  if (/Unexpected "\?"/.test(cleaned)) {
    return `${cleaned} — filters need the form [?(@.key op value)], e.g. [?(@.price < 10)].`;
  }
  return cleaned.endsWith('.') ? cleaned : `${cleaned}.`;
}

/** Pretty-print matches as a JSON array. */
export function formatMatches(matches: readonly unknown[]): string {
  return JSON.stringify(matches, null, 2);
}

/** Text in, text out: parse, check, evaluate and format in one call. */
export function runQuery(jsonText: string, path: string, resultType: ResultType): QueryResult {
  const json = parseJson(jsonText);
  const matches = queryJsonPath(json, path, resultType);
  return { resultType, matches, count: matches.length, output: formatMatches(matches) };
}

/** "1 match" / "12 matches" for the stats line. */
export function describeCount(count: number): string {
  return count === 1 ? '1 match' : `${count.toLocaleString()} matches`;
}
