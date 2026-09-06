/**
 * JSON ↔ YAML conversion — pure functions, no DOM.
 *
 * Uses the `yaml` package (YAML 1.2 core schema). Errors carry a document
 * offset plus line/column so the UI can highlight the exact spot.
 */
import YAML from 'yaml';

export class ConvertError extends Error {
  override name = 'ConvertError';
  /** Zero-based character offset into the (BOM-stripped) input, when known. */
  offset: number | undefined;
  /** One-based line/column, when known. */
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

export type Indent = 2 | 4;

export interface JsonToYamlOptions {
  indent?: Indent;
}

export interface YamlToJsonOptions {
  indent?: Indent;
  /** Emit a single line with no whitespace. */
  minify?: boolean;
}

/** Remove a UTF-8 byte-order mark, which JSON.parse rejects. */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Convert a zero-based offset to one-based line/column. */
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

/** Convert one-based line/column to a zero-based offset. */
export function lineColumnToOffset(text: string, line: number, column: number): number {
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

/**
 * Pull a position out of a JSON.parse error. V8 says "at position N" (and, in
 * newer versions, "(line L column C)"); Firefox says "line L column C".
 */
export function jsonErrorOffset(message: string, source: string): number | undefined {
  const pos = /position (\d+)/.exec(message);
  if (pos) return Number(pos[1]);
  const lc = /line (\d+) column (\d+)/i.exec(message);
  if (lc) return lineColumnToOffset(source, Number(lc[1]), Number(lc[2]));
  // "Unexpected end of JSON input" has no position: the problem is at the end.
  if (/end of (JSON )?(input|data)/i.test(message)) return source.length;
  return undefined;
}

/** JSON.parse with a helpful, positioned error. */
export function parseJson(input: string): unknown {
  const source = stripBom(input);
  if (source.trim() === '') {
    throw new ConvertError('Input is empty — paste some JSON to convert.');
  }
  try {
    return JSON.parse(source);
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const offset = jsonErrorOffset(raw, source);
    // Drop V8's "in JSON at position N" / "(line…)" tail; we add our own position.
    const detail = raw
      .replace(/\s*in JSON at position \d+.*$/, '')
      .replace(/\s*\(line \d+ column \d+\)\s*$/, '')
      .replace(/^JSON\.parse:\s*/, '')
      .trim();
    if (offset === undefined) {
      throw new ConvertError(
        `Invalid JSON: ${detail}. Check for trailing commas or unquoted keys.`,
      );
    }
    const { line, column } = offsetToLineColumn(source, offset);
    throw new ConvertError(
      `Invalid JSON at line ${line}, column ${column}: ${detail}. Check for trailing commas, single quotes or unquoted keys.`,
      { offset, line, column },
    );
  }
}

/**
 * Parse YAML. Multiple documents (separated by `---`) are returned as an array.
 * Throws ConvertError with a position for syntax errors.
 */
export function parseYaml(input: string): unknown {
  const source = stripBom(input);
  if (source.trim() === '') {
    throw new ConvertError('Input is empty — paste some YAML to convert.');
  }
  const docs = YAML.parseAllDocuments(source, { prettyErrors: true });
  if (docs.length === 0) return null; // comments only
  for (const doc of docs) {
    const problem = doc.errors[0];
    if (problem) {
      const [start] = problem.pos;
      const lp = problem.linePos?.[0];
      const position = lp ? { line: lp.line, column: lp.col } : offsetToLineColumn(source, start);
      // The pretty message is "<text> at line L, column C:\n\n<code frame>" — keep the text.
      const detail = (problem.message.split('\n')[0] ?? problem.message)
        .replace(/\s+at line \d+, column \d+:?$/, '')
        .replace(/\.$/, '')
        .trim();
      throw new ConvertError(
        `Invalid YAML at line ${position.line}, column ${position.column}: ${detail}.`,
        { offset: start, ...position },
      );
    }
  }
  const values = docs.map((doc) => doc.toJS({ json: true }) as unknown);
  return values.length === 1 ? values[0] : values;
}

export function jsonToYaml(input: string, options: JsonToYamlOptions = {}): string {
  const value = parseJson(input);
  // lineWidth 0 disables folding of long strings so values stay greppable.
  return YAML.stringify(value, { indent: options.indent ?? 2, lineWidth: 0 });
}

export function yamlToJson(input: string, options: YamlToJsonOptions = {}): string {
  const value = parseYaml(input);
  const text = options.minify
    ? JSON.stringify(value)
    : JSON.stringify(value, null, options.indent ?? 2);
  return text + '\n';
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
