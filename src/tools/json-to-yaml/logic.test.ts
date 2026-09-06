import { describe, expect, it } from 'vitest';

import {
  ConvertError,
  describe as describeText,
  jsonErrorOffset,
  jsonToYaml,
  lineColumnToOffset,
  offsetToLineColumn,
  parseJson,
  parseYaml,
  stripBom,
  yamlToJson,
} from './logic';

describe('jsonToYaml', () => {
  it('converts nested objects and arrays with 2-space indent', () => {
    const yaml = jsonToYaml('{"name":"app","ports":[80,443],"db":{"host":"localhost"}}');
    expect(yaml).toBe('name: app\nports:\n  - 80\n  - 443\ndb:\n  host: localhost\n');
  });

  it('honours a 4-space indent', () => {
    expect(jsonToYaml('{"a":{"b":1}}', { indent: 4 })).toBe('a:\n    b: 1\n');
  });

  it('quotes strings that would otherwise change type', () => {
    const yaml = jsonToYaml('{"a":"123","b":"true","c":"null","d":"k: v","e":""}');
    expect(yaml).toBe('a: "123"\nb: "true"\nc: "null"\nd: "k: v"\ne: ""\n');
  });

  it('does not fold long strings', () => {
    const long = 'x'.repeat(200);
    expect(jsonToYaml(`{"a":"${long}"}`)).toBe(`a: ${long}\n`);
  });

  it('handles scalars, null and empty containers', () => {
    expect(jsonToYaml('5')).toBe('5\n');
    expect(jsonToYaml('null')).toBe('null\n');
    expect(jsonToYaml('{}')).toBe('{}\n');
    expect(jsonToYaml('[]')).toBe('[]\n');
  });

  it('keeps unicode intact and strips a BOM / CRLF', () => {
    expect(jsonToYaml('\ufeff{\r\n"emoji": "👋 日本"\r\n}')).toBe('emoji: 👋 日本\n');
  });

  it('writes multi-line strings as block scalars', () => {
    expect(jsonToYaml('{"s":"a\\nb"}')).toBe('s: |-\n  a\n  b\n');
  });
});

describe('yamlToJson', () => {
  it('converts YAML to pretty JSON', () => {
    expect(yamlToJson('name: app\nports:\n  - 80\n  - 443\n')).toBe(
      '{\n  "name": "app",\n  "ports": [\n    80,\n    443\n  ]\n}\n',
    );
  });

  it('supports 4-space indent and minified output', () => {
    expect(yamlToJson('a: 1', { indent: 4 })).toBe('{\n    "a": 1\n}\n');
    expect(yamlToJson('a: 1\nb: [1, 2]', { minify: true })).toBe('{"a":1,"b":[1,2]}\n');
  });

  it('turns multiple documents into an array', () => {
    expect(yamlToJson('a: 1\n---\nb: 2\n', { minify: true })).toBe('[{"a":1},{"b":2}]\n');
  });

  it('resolves anchors and aliases', () => {
    expect(yamlToJson('base: &b\n  x: 1\ncopy: *b\n', { minify: true })).toBe(
      '{"base":{"x":1},"copy":{"x":1}}\n',
    );
  });

  it('keeps YAML 1.2 semantics: "yes" and dates stay strings', () => {
    expect(yamlToJson('a: yes\nd: 2020-01-01\n', { minify: true })).toBe(
      '{"a":"yes","d":"2020-01-01"}\n',
    );
  });

  it('maps non-JSON numbers to null', () => {
    expect(yamlToJson('a: .inf\nb: .nan', { minify: true })).toBe('{"a":null,"b":null}\n');
  });

  it('round-trips through both directions', () => {
    const json = '{"a":1,"b":["x","y"],"c":{"d":null,"e":true},"f":"multi\\nline"}';
    expect(yamlToJson(jsonToYaml(json), { minify: true })).toBe(json + '\n');
  });
});

describe('parseJson errors', () => {
  it('rejects empty input', () => {
    expect(() => parseJson('')).toThrow(ConvertError);
    expect(() => parseJson('   \n')).toThrow(/empty/);
  });

  it('reports line and column with an offset', () => {
    let caught: ConvertError | undefined;
    try {
      parseJson('{\n  "a": 1,\n}');
    } catch (err) {
      caught = err as ConvertError;
    }
    expect(caught).toBeInstanceOf(ConvertError);
    expect(caught?.message).toMatch(/^Invalid JSON at line 3, column 1:/);
    expect(caught?.message).toMatch(/trailing commas/);
    expect(caught?.offset).toBe(12);
    expect(caught?.line).toBe(3);
    expect(caught?.column).toBe(1);
  });

  it('mentions the offending token', () => {
    expect(() => parseJson("{'a': 1}")).toThrow(/Invalid JSON at line 1, column 2/);
  });
});

describe('parseYaml errors', () => {
  it('rejects empty input', () => {
    expect(() => parseYaml('')).toThrow(/empty/);
    expect(() => parseYaml('\ufeff  ')).toThrow(ConvertError);
  });

  it('reports the position of an unclosed flow sequence', () => {
    let caught: ConvertError | undefined;
    try {
      parseYaml('a: [1, 2\nb: 3');
    } catch (err) {
      caught = err as ConvertError;
    }
    expect(caught?.message).toMatch(/^Invalid YAML at line 2, column 1: /);
    expect(caught?.message).not.toMatch(/\n/);
    expect(caught?.offset).toBe(9);
    expect(caught?.line).toBe(2);
  });

  it('rejects duplicate keys and tab indentation', () => {
    expect(() => parseYaml('a: 1\na: 2')).toThrow(/Map keys must be unique/);
    expect(() => parseYaml('a:\n\tb: 1')).toThrow(/Tabs are not allowed/);
  });

  it('treats a comment-only document as null', () => {
    expect(parseYaml('# nothing here')).toBeNull();
  });
});

describe('position helpers', () => {
  it('converts offsets to line/column and back', () => {
    const text = 'ab\ncd\nef';
    expect(offsetToLineColumn(text, 0)).toEqual({ line: 1, column: 1 });
    expect(offsetToLineColumn(text, 4)).toEqual({ line: 2, column: 2 });
    expect(offsetToLineColumn(text, 99)).toEqual({ line: 3, column: 3 });
    expect(lineColumnToOffset(text, 2, 2)).toBe(4);
    expect(lineColumnToOffset(text, 9, 1)).toBe(8);
  });

  it('extracts offsets from V8 and Firefox style messages', () => {
    expect(jsonErrorOffset('Unexpected token } in JSON at position 7', '')).toBe(7);
    expect(
      jsonErrorOffset('JSON.parse: bad thing at line 2 column 3 of the JSON data', 'ab\ncdef'),
    ).toBe(5);
    expect(jsonErrorOffset('Unexpected end of JSON input', '[1,')).toBe(3);
    expect(jsonErrorOffset('no position here', '')).toBeUndefined();
  });

  it('stripBom only removes a leading BOM', () => {
    expect(stripBom('\ufeffx')).toBe('x');
    expect(stripBom('x\ufeff')).toBe('x\ufeff');
  });
});

describe('describe', () => {
  it('counts lines and bytes', () => {
    expect(describeText('')).toBe('');
    expect(describeText('a')).toBe('1 line · 1 B');
    expect(describeText('a\nb\n')).toBe('2 lines · 4 B');
    expect(describeText('日'.repeat(400))).toBe('1 line · 1.17 KB');
  });
});
