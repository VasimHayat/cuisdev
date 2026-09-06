import { describe, expect, it } from 'vitest';

import {
  checkExpression,
  describeCount,
  formatMatches,
  jsonErrorOffset,
  JsonParseError,
  JsonPathError,
  parseJson,
  queryJsonPath,
  RESULT_TYPE_LABEL,
  RESULT_TYPES,
  runQuery,
} from './logic';

const STORE = {
  store: {
    book: [
      { category: 'reference', author: 'Nigel Rees', title: 'Sayings of the Century', price: 8.95 },
      { category: 'fiction', author: 'Evelyn Waugh', title: 'Sword of Honour', price: 12.99 },
      {
        category: 'fiction',
        author: 'Herman Melville',
        title: 'Moby Dick',
        isbn: '0-553-21311-3',
        price: 8.99,
      },
      {
        category: 'fiction',
        author: 'J. R. R. Tolkien',
        title: 'The Lord of the Rings',
        isbn: '0-395-19395-8',
        price: 22.99,
      },
    ],
    bicycle: { color: 'red', price: 19.95 },
  },
};

describe('parseJson', () => {
  it('parses documents of every JSON type', () => {
    expect(parseJson('{"a":[1,2]}')).toEqual({ a: [1, 2] });
    expect(parseJson('[true,null]')).toEqual([true, null]);
    expect(parseJson('"text"')).toBe('text');
    expect(parseJson('12')).toBe(12);
  });

  it('strips a BOM and accepts CRLF line endings', () => {
    expect(parseJson('﻿{\r\n"a":\r\n1}')).toEqual({ a: 1 });
  });

  it('rejects empty input', () => {
    expect(() => parseJson('')).toThrow(JsonParseError);
    expect(() => parseJson(' \n\t')).toThrow(/JSON input is empty/);
  });

  it('reports where the JSON breaks and exposes the offset', () => {
    let caught: JsonParseError | undefined;
    try {
      parseJson("{'a': 1}");
    } catch (err) {
      caught = err as JsonParseError;
    }
    expect(caught).toBeInstanceOf(JsonParseError);
    expect(caught?.offset).toBe(1);
    expect(caught?.message).toMatch(/not valid JSON at line 1, column 2/);
    expect(caught?.message).toMatch(/single quotes/);
  });
});

describe('jsonErrorOffset', () => {
  it('understands position, line/column and end-of-input messages', () => {
    expect(jsonErrorOffset('Unexpected token at position 4', '')).toBe(4);
    expect(jsonErrorOffset('at line 3 column 2', 'a\nb\ncd')).toBe(5);
    expect(jsonErrorOffset('at line 5 column 1', 'a\nb')).toBe(2);
    expect(jsonErrorOffset('Unexpected end of JSON input', '[1,')).toBe(3);
    expect(jsonErrorOffset('mystery', 'x')).toBeUndefined();
  });
});

describe('checkExpression', () => {
  it('returns the trimmed expression when balanced', () => {
    expect(checkExpression('  $.store.book[*].author ')).toBe('$.store.book[*].author');
    expect(checkExpression("$['store']['book'][?(@.price < 10)]")).toBe(
      "$['store']['book'][?(@.price < 10)]",
    );
  });

  it('rejects an empty expression with a hint', () => {
    expect(() => checkExpression('')).toThrow(JsonPathError);
    expect(() => checkExpression('   ')).toThrow(/start with \$ for the root/);
  });

  it('rejects unbalanced brackets and parentheses', () => {
    expect(() => checkExpression('$.store.book[')).toThrow(/Missing 1 closing "\]"/);
    expect(() => checkExpression('$.a[[0]')).toThrow(/Missing 1 closing "\]"/);
    expect(() => checkExpression('$.store.book[?(@.price < 10]')).toThrow(/Missing 1 closing "\)"/);
    expect(() => checkExpression('$.a]')).toThrow(/Unexpected closing "\]" at character 4/);
    expect(() => checkExpression('$.a)')).toThrow(/Unexpected closing "\)"/);
  });

  it('ignores brackets inside quoted strings and rejects unterminated strings', () => {
    expect(checkExpression("$['a[b']")).toBe("$['a[b']");
    expect(checkExpression('$["x)"]')).toBe('$["x)"]');
    expect(checkExpression("$['it\\'s']")).toBe("$['it\\'s']");
    expect(() => checkExpression("$['open")).toThrow(/Unterminated ' string/);
  });
});

describe('queryJsonPath', () => {
  it('returns values by default', () => {
    expect(queryJsonPath(STORE, '$.store.book[?(@.price < 10)].title')).toEqual([
      'Sayings of the Century',
      'Moby Dick',
    ]);
  });

  it('supports the path and pointer result types', () => {
    expect(queryJsonPath(STORE, '$.store.book[?(@.price < 10)].title', 'path')).toEqual([
      "$['store']['book'][0]['title']",
      "$['store']['book'][2]['title']",
    ]);
    expect(queryJsonPath(STORE, '$.store.book[?(@.price < 10)].title', 'pointer')).toEqual([
      '/store/book/0/title',
      '/store/book/2/title',
    ]);
  });

  it('handles wildcards, recursion, slices and unions', () => {
    expect(queryJsonPath(STORE, '$.store.book[*].author')).toHaveLength(4);
    expect(queryJsonPath(STORE, '$..price')).toEqual([8.95, 12.99, 8.99, 22.99, 19.95]);
    expect(queryJsonPath(STORE, '$..book[-1:].title')).toEqual(['The Lord of the Rings']);
    expect(queryJsonPath(STORE, '$..book[0,1].title')).toEqual([
      'Sayings of the Century',
      'Sword of Honour',
    ]);
    expect(queryJsonPath(STORE, '$..book[?(@.isbn)].isbn')).toEqual([
      '0-553-21311-3',
      '0-395-19395-8',
    ]);
  });

  it('always returns an array, even for a single or no match', () => {
    expect(queryJsonPath(STORE, '$.store.bicycle.color')).toEqual(['red']);
    expect(queryJsonPath(STORE, '$.store.nothing')).toEqual([]);
    expect(queryJsonPath(STORE, '$')).toEqual([STORE]);
  });

  it('works on primitive and array roots', () => {
    expect(queryJsonPath([1, 2, 3], '$[1:]')).toEqual([2, 3]);
    expect(queryJsonPath('hello', '$')).toEqual(['hello']);
  });

  it('wraps evaluator failures in JsonPathError', () => {
    expect(() => queryJsonPath(STORE, '$.store.book[?(foo(@))]')).toThrow(JsonPathError);
    expect(() => queryJsonPath(STORE, '$.store.book[?(foo(@))]')).toThrow(
      /Invalid JSONPath expression: .*foo/,
    );
    expect(() => queryJsonPath(STORE, '$.store.book[?(@.price <)]')).toThrow(JsonPathError);
  });

  it('runs the structural checks first', () => {
    expect(() => queryJsonPath(STORE, '')).toThrow(/Enter a JSONPath expression/);
    expect(() => queryJsonPath(STORE, '$.store[')).toThrow(/Missing 1 closing/);
  });
});

describe('formatMatches / runQuery / describeCount', () => {
  it('pretty-prints matches as a JSON array', () => {
    expect(formatMatches(['a', 1])).toBe('[\n  "a",\n  1\n]');
    expect(formatMatches([])).toBe('[]');
  });

  it('runs the whole pipeline and counts matches', () => {
    const result = runQuery(JSON.stringify(STORE), '$..author', 'value');
    expect(result.count).toBe(4);
    expect(result.resultType).toBe('value');
    expect(result.matches[0]).toBe('Nigel Rees');
    expect(JSON.parse(result.output)).toEqual(result.matches);
  });

  it('propagates JSON and expression errors', () => {
    expect(() => runQuery('{', '$', 'value')).toThrow(JsonParseError);
    expect(() => runQuery('{}', '$[', 'value')).toThrow(JsonPathError);
  });

  it('copes with a large document', () => {
    const big = { items: Array.from({ length: 30_000 }, (_, i) => ({ id: i, even: i % 2 === 0 })) };
    const text = JSON.stringify(big);
    expect(text.length).toBeGreaterThan(700_000);
    const start = performance.now();
    const result = runQuery(text, '$.items[?(@.even)].id', 'value');
    expect(result.count).toBe(15_000);
    expect(performance.now() - start).toBeLessThan(3000);
  });

  it('pluralises the match count', () => {
    expect(describeCount(0)).toBe('0 matches');
    expect(describeCount(1)).toBe('1 match');
    expect(describeCount(1234)).toBe('1,234 matches');
  });

  it('exposes labelled result types for the UI', () => {
    expect(RESULT_TYPES).toEqual(['value', 'path', 'pointer']);
    expect(RESULT_TYPE_LABEL).toEqual({ value: 'Values', path: 'Paths', pointer: 'Pointers' });
  });
});
