import { describe, expect, it } from 'vitest';

import {
  compileSchema,
  detectDraft,
  DRAFT_LABEL,
  errorsToJson,
  findPathOffset,
  inferSchema,
  inferSchemaText,
  jsonErrorOffset,
  JsonParseError,
  normalizeErrors,
  parseJson,
  pointerSegments,
  SchemaError,
  validateData,
  validateJson,
} from './logic';

const USER_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    id: { type: 'integer', minimum: 1 },
    name: { type: 'string', minLength: 1 },
    email: { type: 'string', format: 'email' },
    age: { type: 'integer', minimum: 13, maximum: 120 },
    roles: { type: 'array', items: { type: 'string', enum: ['admin', 'editor', 'viewer'] } },
  },
  required: ['id', 'name', 'email'],
  additionalProperties: false,
};

describe('parseJson', () => {
  it('parses objects, arrays and primitives', () => {
    expect(parseJson('{"a":1}', 'data')).toEqual({ a: 1 });
    expect(parseJson('[1,2]', 'data')).toEqual([1, 2]);
    expect(parseJson('"x"', 'data')).toBe('x');
    expect(parseJson('42', 'schema')).toBe(42);
  });

  it('strips a UTF-8 BOM and accepts Windows line endings', () => {
    expect(parseJson('﻿{\r\n  "a": 1\r\n}', 'data')).toEqual({ a: 1 });
  });

  it('rejects empty input with a source-specific message', () => {
    expect(() => parseJson('', 'schema')).toThrow(JsonParseError);
    expect(() => parseJson('   \n', 'schema')).toThrow(/Schema is empty — paste a JSON Schema/);
    expect(() => parseJson('', 'data')).toThrow(/JSON data is empty/);
  });

  it('reports the location and keeps the source and offset on the error', () => {
    let caught: unknown;
    try {
      parseJson('{\n  "a": 1,\n}', 'data');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(JsonParseError);
    const e = caught as JsonParseError;
    expect(e.source).toBe('data');
    expect(e.offset).toBe(12);
    expect(e.message).toMatch(/JSON data is not valid JSON at line 3, column 1/);
    expect(e.message).toMatch(/trailing commas/);
  });

  it('handles unterminated input by pointing at the end', () => {
    let caught: JsonParseError | undefined;
    try {
      parseJson('{"a": ', 'schema');
    } catch (err) {
      caught = err as JsonParseError;
    }
    expect(caught?.source).toBe('schema');
    expect(caught?.offset).toBe(6);
  });
});

describe('jsonErrorOffset', () => {
  it('reads Chromium-style positions', () => {
    expect(jsonErrorOffset('Unexpected token } in JSON at position 7', 'x')).toBe(7);
  });

  it('converts Firefox-style line/column pairs', () => {
    expect(jsonErrorOffset('JSON.parse: bad at line 2 column 3 of the JSON data', 'ab\ncdef')).toBe(
      5,
    );
    expect(jsonErrorOffset('at line 9 column 1', 'ab\ncd')).toBe(3);
  });

  it('maps "end of input" to the source length and gives up otherwise', () => {
    expect(jsonErrorOffset('Unexpected end of JSON input', '{"a":')).toBe(5);
    expect(jsonErrorOffset('something else', 'abc')).toBeUndefined();
  });
});

describe('detectDraft', () => {
  it('recognises 2020-12, 2019-09 and falls back to draft-07', () => {
    expect(detectDraft({ $schema: 'https://json-schema.org/draft/2020-12/schema' })).toBe(
      '2020-12',
    );
    expect(detectDraft({ $schema: 'https://json-schema.org/draft/2019-09/schema' })).toBe(
      '2019-09',
    );
    expect(detectDraft({ $schema: 'http://json-schema.org/draft-07/schema#' })).toBe('draft-07');
    expect(detectDraft({ type: 'string' })).toBe('draft-07');
    expect(detectDraft(true)).toBe('draft-07');
    expect(detectDraft(null)).toBe('draft-07');
    expect(detectDraft({ $schema: 42 })).toBe('draft-07');
  });

  it('has a label for every draft', () => {
    expect(DRAFT_LABEL['2020-12']).toBe('Draft 2020-12');
    expect(DRAFT_LABEL['2019-09']).toBe('Draft 2019-09');
    expect(DRAFT_LABEL['draft-07']).toBe('Draft-07');
  });
});

describe('compileSchema', () => {
  it('compiles each draft with formats enabled', () => {
    const v2020 = compileSchema(USER_SCHEMA);
    expect(v2020.draft).toBe('2020-12');
    const v2019 = compileSchema({
      $schema: 'https://json-schema.org/draft/2019-09/schema',
      type: 'string',
      format: 'date',
    });
    expect(v2019.draft).toBe('2019-09');
    expect(v2019.validate('2024-02-30')).toBe(false);
    expect(v2019.validate('2024-02-29')).toBe(true);
    const v07 = compileSchema({ type: 'string', format: 'uri' });
    expect(v07.draft).toBe('draft-07');
    expect(v07.validate('not a uri')).toBe(false);
  });

  it('accepts boolean schemas', () => {
    expect(compileSchema(true).validate(123)).toBe(true);
    expect(compileSchema(false).validate(123)).toBe(false);
  });

  it('rejects non-object schemas with a clear message', () => {
    expect(() => compileSchema(null)).toThrow(SchemaError);
    expect(() => compileSchema([1])).toThrow(/schema is an array/);
    expect(() => compileSchema('x')).toThrow(/schema is a string/);
    expect(() => compileSchema(7)).toThrow(/schema is a number/);
  });

  it('explains invalid keyword values', () => {
    expect(() => compileSchema({ type: 'banana' })).toThrow(SchemaError);
    expect(() => compileSchema({ type: 'banana' })).toThrow(
      /Schema is invalid — \/type must be equal to one of the allowed values/,
    );
  });

  it('explains unsupported drafts', () => {
    expect(() =>
      compileSchema({ $schema: 'http://json-schema.org/draft-04/schema#', type: 'string' }),
    ).toThrow(/Unsupported \$schema "http:\/\/json-schema.org\/draft-04\/schema#"/);
  });

  it('explains unresolvable $ref', () => {
    expect(() => compileSchema({ $ref: '#/$defs/missing' })).toThrow(
      /Cannot resolve \$ref #\/\$defs\/missing/,
    );
  });

  it('explains broken regex patterns', () => {
    expect(() => compileSchema({ type: 'string', pattern: '[' })).toThrow(
      /"pattern" or "patternProperties" regex is invalid/,
    );
  });

  it('allows recompiling a schema that declares the same $id', () => {
    const schema = { $id: 'https://example.com/thing.json', type: 'string' };
    expect(compileSchema(schema).validate('a')).toBe(true);
    expect(compileSchema(schema).validate(1)).toBe(false);
  });

  it('ignores unknown keywords (strict mode off)', () => {
    expect(() => compileSchema({ type: 'string', 'x-custom': true })).not.toThrow();
  });
});

describe('validateData / validateJson', () => {
  it('reports a valid document', () => {
    const result = validateData(USER_SCHEMA, {
      id: 1,
      name: 'Ada',
      email: 'ada@example.com',
      age: 36,
      roles: ['admin'],
    });
    expect(result).toEqual({ valid: true, draft: '2020-12', errors: [] });
  });

  it('collects every error (allErrors) with paths, keywords and messages', () => {
    const result = validateData(USER_SCHEMA, {
      id: 0,
      name: '',
      email: 'ada.lovelace',
      age: 9,
      roles: ['root'],
      extra: 1,
    });
    expect(result.valid).toBe(false);
    const byKeyword = Object.fromEntries(result.errors.map((e) => [e.keyword, e]));
    expect(result.errors.filter((e) => e.keyword === 'minimum').map((e) => e.path)).toEqual([
      '/id',
      '/age',
    ]);
    expect(byKeyword.minLength?.path).toBe('/name');
    expect(byKeyword.format?.path).toBe('/email');
    expect(byKeyword.format?.message).toBe('must match format "email"');
    expect(byKeyword.enum?.path).toBe('/roles/0');
    expect(byKeyword.enum?.message).toMatch(/"admin", "editor", "viewer"/);
    expect(byKeyword.additionalProperties?.path).toBe('(root)');
    expect(byKeyword.additionalProperties?.message).toMatch(/"extra" is not allowed/);
    expect(result.errors).toHaveLength(6);
  });

  it('uses "(root)" for missing required properties at the top level', () => {
    const result = validateData(USER_SCHEMA, { id: 1 });
    const required = result.errors.filter((e) => e.keyword === 'required');
    expect(required.map((e) => e.path)).toEqual(['(root)', '(root)']);
    expect(required[0]?.params).toEqual({ missingProperty: 'name' });
    expect(required[0]?.schemaPath).toBe('#/required');
  });

  it('describes const violations', () => {
    const result = validateData({ const: 'fixed' }, 'other');
    expect(result.errors[0]?.message).toBe('must be equal to constant: "fixed"');
  });

  it('runs the whole pipeline from text', () => {
    const ok = validateJson(JSON.stringify(USER_SCHEMA), '{"id":1,"name":"A","email":"a@b.co"}');
    expect(ok.valid).toBe(true);
    const bad = validateJson('{"type":"number"}', '"nope"');
    expect(bad.valid).toBe(false);
    expect(bad.draft).toBe('draft-07');
    expect(bad.errors[0]?.message).toBe('must be number');
  });

  it('propagates parse errors with the right source', () => {
    expect(() => validateJson('{', '{}')).toThrow(JsonParseError);
    try {
      validateJson('{}', '{');
    } catch (err) {
      expect((err as JsonParseError).source).toBe('data');
    }
    try {
      validateJson('{', '{}');
    } catch (err) {
      expect((err as JsonParseError).source).toBe('schema');
    }
  });

  it('handles a large document quickly', () => {
    const items = Array.from({ length: 20_000 }, (_, i) => ({ id: i, tag: `t${i}` }));
    const schema = {
      type: 'array',
      items: { type: 'object', required: ['id', 'tag'], properties: { id: { type: 'integer' } } },
    };
    const text = JSON.stringify(items);
    expect(text.length).toBeGreaterThan(500_000);
    const start = performance.now();
    expect(validateJson(JSON.stringify(schema), text).valid).toBe(true);
    expect(performance.now() - start).toBeLessThan(2000);
  });
});

describe('normalizeErrors / errorsToJson', () => {
  it('returns [] for null or undefined', () => {
    expect(normalizeErrors(null)).toEqual([]);
    expect(normalizeErrors(undefined)).toEqual([]);
  });

  it('falls back to a generic message when Ajv omits one', () => {
    const [issue] = normalizeErrors([
      { keyword: 'custom', instancePath: '/x', schemaPath: '#/x', params: {} },
    ]);
    expect(issue?.message).toBe('is invalid');
    expect(issue?.path).toBe('/x');
  });

  it('serialises errors back to Ajv-style JSON', () => {
    const json = errorsToJson([
      { path: '(root)', message: 'm', keyword: 'required', schemaPath: '#/required', params: {} },
      { path: '/a', message: 'n', keyword: 'type', schemaPath: '#/a/type', params: { type: 'x' } },
    ]);
    const parsed = JSON.parse(json) as { instancePath: string; params: unknown }[];
    expect(parsed[0]?.instancePath).toBe('');
    expect(parsed[1]?.instancePath).toBe('/a');
    expect(parsed[1]?.params).toEqual({ type: 'x' });
    expect(json).toContain('\n  ');
  });
});

describe('pointerSegments / findPathOffset', () => {
  it('splits and unescapes JSON Pointers', () => {
    expect(pointerSegments('')).toEqual([]);
    expect(pointerSegments('(root)')).toEqual([]);
    expect(pointerSegments('/a/0/b~1c/d~0e')).toEqual(['a', '0', 'b/c', 'd~e']);
  });

  it('finds nested keys in order, skipping array indices', () => {
    const text = '{"zip": 1, "address": {"city": "x", "zip": 2}, "items": [{"zip": 3}]}';
    expect(findPathOffset(text, '/zip')).toBe(1);
    expect(findPathOffset(text, '/address/zip')).toBe(text.indexOf('"zip": 2'));
    expect(findPathOffset(text, '/items/0/zip')).toBe(text.indexOf('"zip": 3'));
  });

  it('returns the deepest key found, or undefined', () => {
    const text = '{"a": {"b": 1}}';
    expect(findPathOffset(text, '/a/missing')).toBe(1);
    expect(findPathOffset(text, '/nope')).toBeUndefined();
    expect(findPathOffset(text, '(root)')).toBeUndefined();
    expect(findPathOffset(text, '/0')).toBeUndefined();
  });

  it('escapes keys that contain quotes', () => {
    const text = '{"he said \\"hi\\"": 1}';
    expect(findPathOffset(text, '/he said "hi"')).toBe(1);
  });
});

describe('inferSchema', () => {
  it('types primitives, distinguishing integers from numbers', () => {
    expect(inferSchema(null)).toMatchObject({ type: 'null' });
    expect(inferSchema(true)).toMatchObject({ type: 'boolean' });
    expect(inferSchema(3)).toMatchObject({ type: 'integer' });
    expect(inferSchema(3.5)).toMatchObject({ type: 'number' });
    expect(inferSchema('s')).toMatchObject({ type: 'string' });
  });

  it('declares the 2020-12 dialect at the root only', () => {
    const schema = inferSchema({ a: { b: 1 } });
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    const props = schema.properties as Record<string, Record<string, unknown>>;
    expect(props.a?.$schema).toBeUndefined();
  });

  it('makes every object key required and recurses', () => {
    const schema = inferSchema({ id: 1, tags: ['a'], meta: { ok: false, n: null } });
    expect(schema).toEqual({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        id: { type: 'integer' },
        tags: { type: 'array', items: { type: 'string' } },
        meta: {
          type: 'object',
          properties: { ok: { type: 'boolean' }, n: { type: 'null' } },
          required: ['ok', 'n'],
        },
      },
      required: ['id', 'tags', 'meta'],
    });
  });

  it('types arrays from their first element and leaves empty ones open', () => {
    expect(inferSchema([{ x: 1 }, { x: 'later' }])).toMatchObject({
      type: 'array',
      items: { type: 'object', properties: { x: { type: 'integer' } }, required: ['x'] },
    });
    expect(inferSchema([])).toEqual({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'array',
    });
    expect(inferSchema({})).toEqual({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
    });
  });

  it('produces a schema the data itself satisfies', () => {
    const data = { id: 7, name: 'Ada', tags: ['x', 'y'], nested: { deep: [1.5] } };
    const result = validateData(inferSchema(data), data);
    expect(result.valid).toBe(true);
    expect(result.draft).toBe('2020-12');
  });

  it('inferSchemaText pretty-prints and rejects invalid JSON', () => {
    const text = inferSchemaText('{"a": 1}');
    expect(text).toContain('\n  "type": "object"');
    expect(JSON.parse(text)).toMatchObject({ required: ['a'] });
    expect(() => inferSchemaText('nope')).toThrow(JsonParseError);
  });
});
