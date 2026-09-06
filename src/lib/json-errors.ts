/**
 * Turn engine-specific JSON.parse error messages into document positions, and
 * locate syntax errors ourselves when the engine does not say where they are.
 * Pure module (no DOM, no CodeMirror) so tool logic can depend on it in tests.
 */

export interface TextPosition {
  /** 0-based character offset. */
  offset: number;
  /** 1-based line. */
  line: number;
  /** 1-based column. */
  column: number;
}

/**
 * Extract the offset from a JSON.parse error. V8 reports "at position N" or
 * "(line L column C)"; SpiderMonkey reports "at line L column C of the JSON data".
 */
export function parseErrorOffset(message: string, source: string): number | undefined {
  const pos = /position (\d+)/.exec(message);
  if (pos) return Math.min(Number(pos[1]), source.length);
  const lc = /line (\d+) column (\d+)/i.exec(message);
  if (lc) return lineColumnToOffset(source, Number(lc[1]), Number(lc[2]));
  return undefined;
}

export function lineColumnToOffset(source: string, line: number, column: number): number {
  let offset = 0;
  let current = 1;
  while (current < line) {
    const nl = source.indexOf('\n', offset);
    if (nl === -1) break;
    offset = nl + 1;
    current++;
  }
  return Math.min(offset + Math.max(0, column - 1), source.length);
}

export function offsetToLineColumn(source: string, offset: number): TextPosition {
  const clamped = Math.min(Math.max(0, offset), source.length);
  let line = 1;
  let lastNewline = -1;
  for (let i = 0; i < clamped; i++) {
    if (source.charCodeAt(i) === 10) {
      line++;
      lastNewline = i;
    }
  }
  return { offset: clamped, line, column: clamped - lastNewline };
}

export interface ScanError {
  offset: number;
  message: string;
}

class ScanFailure extends Error {
  constructor(
    public readonly offset: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Locate the first syntax error in a JSON document with a tiny validating
 * scanner. Used when the engine's error message carries no position (V8 since
 * Node 20 omits it for "unexpected token" errors). Returns undefined for valid
 * JSON.
 */
export function scanJsonError(src: string): ScanError | undefined {
  const n = src.length;
  let i = 0;

  const ws = (): void => {
    while (i < n) {
      const c = src.charCodeAt(i);
      if (c === 32 || c === 10 || c === 13 || c === 9) i++;
      else break;
    }
  };
  const fail = (message: string, at = i): never => {
    throw new ScanFailure(Math.min(at, n), message);
  };
  const describe = (): string => (i >= n ? 'end of input' : `"${src[i]}"`);

  const string = (): void => {
    i++; // opening quote
    while (i < n) {
      const c = src[i] as string;
      if (c === '"') {
        i++;
        return;
      }
      if (c === '\\') {
        const e = src[i + 1];
        if (e === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(src.slice(i + 2, i + 6))) fail('Invalid unicode escape', i);
          i += 6;
          continue;
        }
        if (e === undefined || !'"\\/bfnrt'.includes(e)) fail(`Invalid escape "\\${e ?? ''}"`, i);
        i += 2;
        continue;
      }
      if (c < ' ') fail('Unescaped control character in string (use \\n, \\t, …)', i);
      i++;
    }
    fail('Unterminated string', n);
  };

  const number = (): void => {
    const m = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(src.slice(i, i + 64));
    if (!m || m[0] === '' || m[0] === '-') fail('Invalid number');
    i += (m as RegExpExecArray)[0].length;
    if (src[i] === '.' || /[0-9]/.test(src[i] ?? '')) {
      fail('Invalid number (leading zeros or a trailing dot are not allowed)');
    }
  };

  const object = (): void => {
    i++; // {
    ws();
    if (src[i] === '}') {
      i++;
      return;
    }
    for (;;) {
      ws();
      if (src[i] !== '"') {
        if (src[i] === '}') fail('Trailing comma before "}"');
        fail(`Expected a quoted property name, found ${describe()}`);
      }
      string();
      ws();
      if (src[i] !== ':') fail(`Expected ":" after property name, found ${describe()}`);
      i++;
      value();
      ws();
      if (src[i] === ',') {
        i++;
        continue;
      }
      if (src[i] === '}') {
        i++;
        return;
      }
      fail(`Expected "," or "}" after property value, found ${describe()}`);
    }
  };

  const array = (): void => {
    i++; // [
    ws();
    if (src[i] === ']') {
      i++;
      return;
    }
    for (;;) {
      ws();
      if (src[i] === ']') fail('Trailing comma before "]"');
      value();
      ws();
      if (src[i] === ',') {
        i++;
        continue;
      }
      if (src[i] === ']') {
        i++;
        return;
      }
      fail(`Expected "," or "]" after array element, found ${describe()}`);
    }
  };

  const value = (): void => {
    ws();
    if (i >= n) fail('Unexpected end of input');
    const c = src[i] as string;
    if (c === '{') return object();
    if (c === '[') return array();
    if (c === '"') return string();
    if (c === '-' || (c >= '0' && c <= '9')) return number();
    for (const lit of ['true', 'false', 'null']) {
      if (src.startsWith(lit, i)) {
        i += lit.length;
        return;
      }
    }
    if (c === "'") fail('Single quotes are not valid in JSON — use double quotes');
    fail(`Unexpected token ${describe()}`);
  };

  try {
    value();
    ws();
    if (i < n) fail(`Unexpected token ${describe()} after the JSON value`);
    return undefined;
  } catch (e) {
    if (e instanceof ScanFailure) return { offset: e.offset, message: e.message };
    throw e;
  }
}
