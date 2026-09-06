import { describe, expect, it } from 'vitest';

import {
  formatJson,
  isValidJson,
  JsonParseError,
  jsonStats,
  minifyJson,
  parseJson,
  repairJson,
  sortKeysDeep,
  summarize,
  typeOf,
} from './logic';

const sample = '{"b":1,"a":{"d":[1,2,{"z":null,"y":true}],"c":"x"}}';

describe('parseJson', () => {
  it('parses valid JSON', () => {
    expect(parseJson('{"a": [1, 2]}')).toEqual({ a: [1, 2] });
  });

  it('strips a UTF-8 BOM', () => {
    expect(parseJson('﻿{"a":1}')).toEqual({ a: 1 });
  });

  it('rejects empty input with a clear message', () => {
    expect(() => parseJson('   ')).toThrow(JsonParseError);
    expect(() => parseJson('')).toThrow(/empty/);
  });

  it('reports line and column for syntax errors', () => {
    const src = '{\n  "a": 1,\n  "b": }';
    let error: JsonParseError | undefined;
    try {
      parseJson(src);
    } catch (e) {
      error = e as JsonParseError;
    }
    expect(error).toBeInstanceOf(JsonParseError);
    expect(error?.position?.line).toBe(3);
    expect(error?.message).toMatch(/line 3, column \d+/);
  });

  it('hints about trailing commas', () => {
    try {
      parseJson('{"a": 1,}');
    } catch (e) {
      expect((e as JsonParseError).hint).toMatch(/Trailing commas/);
    }
  });

  it('hints about comments', () => {
    try {
      parseJson('{"a": 1 // one\n}');
    } catch (e) {
      expect((e as JsonParseError).hint).toMatch(/comments/);
    }
  });

  it('hints about single quotes', () => {
    try {
      parseJson("{'a': 1}");
    } catch (e) {
      expect((e as JsonParseError).hint).toMatch(/double quotes|quoted/);
    }
  });

  it('hints about missing closing brackets', () => {
    try {
      parseJson('{"a": [1, 2');
    } catch (e) {
      expect((e as JsonParseError).hint).toMatch(/missing/);
    }
  });
});

describe('formatJson / minifyJson', () => {
  it('pretty prints with 2 spaces by default', () => {
    expect(formatJson('{"a":1}')).toBe('{\n  "a": 1\n}');
  });

  it('supports 4 spaces and tabs', () => {
    expect(formatJson('{"a":1}', { indent: 4 })).toBe('{\n    "a": 1\n}');
    expect(formatJson('{"a":1}', { indent: 'tab' })).toBe('{\n\t"a": 1\n}');
  });

  it('sorts keys recursively when asked', () => {
    expect(minifyJson(sample, { sortKeys: true })).toBe(
      '{"a":{"c":"x","d":[1,2,{"y":true,"z":null}]},"b":1}',
    );
  });

  it('minifies', () => {
    expect(minifyJson('{ "a" : [ 1 , 2 ] }')).toBe('{"a":[1,2]}');
  });

  it('preserves unicode and escapes', () => {
    expect(minifyJson('{"e":"héllo \\n 👋"}')).toBe('{"e":"héllo \\n 👋"}');
  });

  it('throws JsonParseError on invalid input', () => {
    expect(() => formatJson('{')).toThrow(JsonParseError);
  });
});

describe('sortKeysDeep', () => {
  it('sorts nested objects inside arrays and leaves scalars alone', () => {
    expect(sortKeysDeep([{ b: 1, a: 2 }, 3, 'x'])).toEqual([{ a: 2, b: 1 }, 3, 'x']);
    expect(sortKeysDeep(null)).toBeNull();
  });
});

describe('jsonStats', () => {
  it('counts nodes and depth', () => {
    const stats = jsonStats(sample, parseJson(sample));
    expect(stats).toMatchObject({
      keys: 6,
      objects: 3,
      arrays: 1,
      strings: 1,
      numbers: 3,
      booleans: 1,
      nulls: 1,
      depth: 5,
      lines: 1,
    });
    expect(stats.bytes).toBe(sample.length);
  });
});

describe('typeOf / summarize', () => {
  it('classifies values', () => {
    expect(typeOf(null)).toBe('null');
    expect(typeOf([])).toBe('array');
    expect(typeOf({})).toBe('object');
    expect(typeOf('s')).toBe('string');
    expect(typeOf(1)).toBe('number');
    expect(typeOf(true)).toBe('boolean');
  });

  it('summarises containers and stringifies scalars', () => {
    expect(summarize([1, 2])).toBe('[2 items]');
    expect(summarize([1])).toBe('[1 item]');
    expect(summarize({ a: 1 })).toBe('{1 key}');
    expect(summarize({})).toBe('{0 keys}');
    expect(summarize('x')).toBe('"x"');
    expect(summarize(null)).toBe('null');
  });
});

describe('repairJson', () => {
  it('removes line and block comments', () => {
    expect(repairJson('{\n// c\n"a": 1 /* x */\n}')).toBe('{\n\n"a": 1 \n}');
    expect(isValidJson(repairJson('{\n// c\n"a": 1 /* x */\n}'))).toBe(true);
  });

  it('removes trailing commas in objects and arrays', () => {
    expect(repairJson('{"a": [1, 2,], }')).toBe('{"a": [1, 2] }');
  });

  it('converts single-quoted strings, preserving embedded quotes', () => {
    expect(repairJson("{'a': 'it\\'s \"ok\"'}")).toBe('{"a": "it\'s \\"ok\\""}');
  });

  it('quotes unquoted keys but not values or array items', () => {
    expect(repairJson('{a: 1, b_2: [c, "d"], $x: {y: true}}')).toBe(
      '{"a": 1, "b_2": [c, "d"], "$x": {"y": true}}',
    );
  });

  it('replaces NaN/Infinity/undefined and Python literals', () => {
    expect(repairJson('[NaN, Infinity, undefined, True, False, None]')).toBe(
      '[null, null, null, true, false, null]',
    );
  });

  it('does not touch content inside double-quoted strings', () => {
    const src = '{"url": "http://x/y, // not a comment", "k": "a\' b"}';
    expect(repairJson(src)).toBe(src);
  });

  it('normalises smart quotes and BOM', () => {
    expect(repairJson('﻿{“a”: ‘b’}')).toBe('{"a": "b"}');
  });

  it('produces valid JSON for a typical messy config', () => {
    const messy = `{
      // server settings
      host: 'localhost',
      port: 8080,
      tags: ['a', 'b',],
      debug: True,
    }`;
    const fixed = repairJson(messy);
    expect(isValidJson(fixed)).toBe(true);
    expect(parseJson(fixed)).toEqual({
      host: 'localhost',
      port: 8080,
      tags: ['a', 'b'],
      debug: true,
    });
  });
});

describe('isValidJson', () => {
  it('returns booleans', () => {
    expect(isValidJson('[]')).toBe(true);
    expect(isValidJson('[')).toBe(false);
  });
});
