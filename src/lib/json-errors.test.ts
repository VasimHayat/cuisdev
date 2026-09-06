import { describe, expect, it } from 'vitest';

import {
  lineColumnToOffset,
  offsetToLineColumn,
  parseErrorOffset,
  scanJsonError,
} from './json-errors';

describe('parseErrorOffset', () => {
  it('reads V8 "at position N"', () => {
    expect(parseErrorOffset('Unexpected token } in JSON at position 12', '{"a": 1,     }')).toBe(
      12,
    );
  });

  it('clamps positions beyond the source length', () => {
    expect(parseErrorOffset('Unexpected end of JSON input at position 99', '{"a"')).toBe(4);
  });

  it('reads "(line L column C)" and converts to an offset', () => {
    const src = '{\n  "a": 1,\n  "b": }';
    expect(parseErrorOffset('Unexpected token "}" (line 3 column 8)', src)).toBe(
      src.indexOf('}', src.indexOf('"b"')),
    );
  });

  it('reads SpiderMonkey "at line L column C"', () => {
    const src = '[\n1,\n]';
    expect(parseErrorOffset('unexpected character at line 3 column 1 of the JSON data', src)).toBe(
      5,
    );
  });

  it('returns undefined when no position is present', () => {
    expect(parseErrorOffset('Unexpected end of JSON input', '')).toBeUndefined();
  });
});

describe('line/column conversions', () => {
  const src = 'ab\ncd\n\nefg';

  it('round-trips offsets and positions', () => {
    for (const offset of [0, 1, 2, 3, 5, 6, 7, 9, 10]) {
      const { line, column } = offsetToLineColumn(src, offset);
      expect(lineColumnToOffset(src, line, column)).toBe(offset);
    }
  });

  it('reports 1-based lines and columns', () => {
    expect(offsetToLineColumn(src, 0)).toEqual({ offset: 0, line: 1, column: 1 });
    expect(offsetToLineColumn(src, 4)).toEqual({ offset: 4, line: 2, column: 2 });
    expect(offsetToLineColumn(src, 7)).toEqual({ offset: 7, line: 4, column: 1 });
  });

  it('clamps out-of-range input', () => {
    expect(offsetToLineColumn(src, 999).offset).toBe(src.length);
    expect(lineColumnToOffset(src, 99, 99)).toBe(src.length);
  });
});

describe('scanJsonError', () => {
  const cases: [string, string, number][] = [
    ['{"a": 1,}', 'Trailing comma', 8],
    ['[1, 2,]', 'Trailing comma', 6],
    ['{"a" 1}', 'Expected ":"', 5],
    ['{a: 1}', 'quoted property name', 1],
    ["{'a': 1}", 'quoted property name', 1],
    ['[1 2]', 'Expected "," or "]"', 3],
    ['{"a": tru}', 'Unexpected token', 6],
    ['{"a": "x', 'Unterminated string', 8],
    ['{"a": "\\q"}', 'Invalid escape', 7],
    ['{"a": 01}', 'Invalid number', 7],
    ['{"a": 1} x', 'after the JSON value', 9],
    ['', 'Unexpected end of input', 0],
    ['{"a": ', 'Unexpected end of input', 6],
    ["['x']", 'Single quotes', 1],
  ];

  for (const [src, message, offset] of cases) {
    it(`locates the error in ${JSON.stringify(src)}`, () => {
      const result = scanJsonError(src);
      expect(result?.message).toMatch(message);
      expect(result?.offset).toBe(offset);
    });
  }

  it('returns undefined for valid JSON', () => {
    expect(scanJsonError('{"a": [1, 2.5e3, "x\\n\\u00e9", true, null, {}]}')).toBeUndefined();
    expect(scanJsonError('  "just a string"  ')).toBeUndefined();
    expect(scanJsonError('-0.5')).toBeUndefined();
    expect(scanJsonError('[]')).toBeUndefined();
  });
});
