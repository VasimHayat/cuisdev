/**
 * JSON Schema Validator — pure functions, no DOM.
 *
 * Wraps Ajv (draft-07, 2019-09 and 2020-12) with `ajv-formats`, normalises its
 * error objects into a UI-friendly shape, infers a starter schema from sample
 * data and locates error paths inside the raw JSON text.
 */
import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import Ajv2019 from 'ajv/dist/2019';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

/** The JSON text (schema or data) could not be parsed. */
export class JsonParseError extends Error {
  override name = 'JsonParseError';
  constructor(
    message: string,
    /** Which editor holds the broken text. */
    readonly source: 'schema' | 'data',
    /** Character offset of the problem when the engine reported one. */
    readonly offset?: number,
  ) {
    super(message);
  }
}

/** The schema parsed as JSON but Ajv refused to compile it. */
export class SchemaError extends Error {
  override name = 'SchemaError';
}

export type Draft = '2020-12' | '2019-09' | 'draft-07';

export interface ValidationIssue {
  /** JSON Pointer to the offending value, or "(root)". */
  path: string;
  message: string;
  keyword: string;
  schemaPath: string;
  params: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  draft: Draft;
  errors: ValidationIssue[];
}

export const DRAFT_LABEL: Record<Draft, string> = {
  '2020-12': 'Draft 2020-12',
  '2019-09': 'Draft 2019-09',
  'draft-07': 'Draft-07',
};

const SOURCE_LABEL = { schema: 'Schema', data: 'JSON data' } as const;

/**
 * Convert a JSON.parse error message into a character offset. Chromium/Node
 * report "at position N" (sometimes with "(line L column C)"); Firefox and
 * Safari report "line L column C".
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
 * Parse JSON text with a helpful error. Tolerates a UTF-8 byte-order mark and
 * Windows line endings; rejects empty input with a clear message.
 */
export function parseJson(text: string, source: 'schema' | 'data'): unknown {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  if (clean.trim() === '') {
    throw new JsonParseError(
      `${SOURCE_LABEL[source]} is empty — paste ${source === 'schema' ? 'a JSON Schema' : 'the JSON document you want to check'}.`,
      source,
    );
  }
  try {
    return JSON.parse(clean);
  } catch (err) {
    const native = err instanceof Error ? err.message : String(err);
    const offset = jsonErrorOffset(native, clean);
    const where = offset === undefined ? '' : ` ${describeOffset(clean, offset)}`;
    throw new JsonParseError(
      `${SOURCE_LABEL[source]} is not valid JSON${where}: ${native.replace(/^JSON\.parse: /, '')}. Check for trailing commas, single quotes or unquoted keys.`,
      source,
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

/** Pick the Ajv flavour from the schema's `$schema` URI. Defaults to draft-07. */
export function detectDraft(schema: unknown): Draft {
  if (schema !== null && typeof schema === 'object' && !Array.isArray(schema)) {
    const uri = (schema as Record<string, unknown>).$schema;
    if (typeof uri === 'string') {
      if (uri.includes('2020-12')) return '2020-12';
      if (uri.includes('2019-09')) return '2019-09';
    }
  }
  return 'draft-07';
}

const instances = new Map<Draft, Ajv>();

function ajvFor(draft: Draft): Ajv {
  let ajv = instances.get(draft);
  if (!ajv) {
    const options = { allErrors: true, strict: false, validateFormats: true };
    ajv =
      draft === '2020-12'
        ? new Ajv2020(options)
        : draft === '2019-09'
          ? new Ajv2019(options)
          : new Ajv(options);
    addFormats(ajv);
    instances.set(draft, ajv);
  } else {
    // Drop previously compiled user schemas so a repeated `$id` does not collide.
    ajv.removeSchema();
  }
  return ajv;
}

/**
 * Compile a parsed schema. Throws `SchemaError` with a readable explanation
 * when the schema itself is invalid (bad keyword value, unresolvable `$ref`,
 * broken regex, unsupported draft…).
 */
export function compileSchema(schema: unknown): { validate: ValidateFunction; draft: Draft } {
  if (schema === null || Array.isArray(schema) || !['object', 'boolean'].includes(typeof schema)) {
    throw new SchemaError(
      `A JSON Schema must be an object (or the booleans true/false), but the schema is ${describeType(schema)}.`,
    );
  }
  const draft = detectDraft(schema);
  const ajv = ajvFor(draft);
  try {
    return { validate: ajv.compile(schema as object | boolean), draft };
  } catch (err) {
    throw new SchemaError(explainCompileError(err, schema));
  }
}

function explainCompileError(err: unknown, schema: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const uri =
    schema !== null && typeof schema === 'object'
      ? (schema as Record<string, unknown>).$schema
      : undefined;
  if (/no schema with key or ref/.test(raw) && typeof uri === 'string') {
    return `Unsupported $schema "${uri}". Supported drafts are 2020-12, 2019-09 and draft-07 — change or remove the $schema keyword.`;
  }
  if (/can't resolve reference/.test(raw)) {
    return `Cannot resolve ${raw.replace(/^can't resolve reference /, '$ref ')}. Only references inside this schema (#/$defs/… or #/definitions/…) can be resolved.`;
  }
  if (/^Invalid regular expression/.test(raw) || err instanceof SyntaxError) {
    return `A "pattern" or "patternProperties" regex is invalid: ${raw.replace(/^Invalid regular expression: /, '')}.`;
  }
  if (/^schema is invalid: /.test(raw)) {
    const details = raw.replace(/^schema is invalid: /, '').replace(/(^|, )data\//g, '$1/');
    return `Schema is invalid — ${details}.`;
  }
  return `Schema could not be compiled: ${raw}`;
}

function describeType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  return typeof value === 'object' ? 'an object' : `a ${typeof value}`;
}

/** Turn Ajv's error objects into the flat shape the UI renders. */
export function normalizeErrors(
  errors: readonly ErrorObject[] | null | undefined,
): ValidationIssue[] {
  if (!errors) return [];
  return errors.map((e) => ({
    path: e.instancePath === '' ? '(root)' : e.instancePath,
    message: describeError(e),
    keyword: e.keyword,
    schemaPath: e.schemaPath,
    params: e.params as Record<string, unknown>,
  }));
}

function describeError(e: ErrorObject): string {
  const base = e.message ?? 'is invalid';
  const params = e.params as Record<string, unknown>;
  switch (e.keyword) {
    case 'additionalProperties':
      return `${base} ("${String(params.additionalProperty)}" is not allowed)`;
    case 'enum': {
      const allowed = Array.isArray(params.allowedValues) ? params.allowedValues : [];
      return `${base}: ${allowed.map((v) => JSON.stringify(v)).join(', ')}`;
    }
    case 'const':
      return `${base}: ${JSON.stringify(params.allowedValue)}`;
    default:
      return base;
  }
}

/** Validate already-parsed data against an already-parsed schema. */
export function validateData(schema: unknown, data: unknown): ValidationResult {
  const { validate, draft } = compileSchema(schema);
  const valid = validate(data) === true;
  return { valid, draft, errors: valid ? [] : normalizeErrors(validate.errors) };
}

/**
 * The whole pipeline from text to result. Throws `JsonParseError` (with
 * `.source`) or `SchemaError`.
 */
export function validateJson(schemaText: string, dataText: string): ValidationResult {
  const schema = parseJson(schemaText, 'schema');
  const data = parseJson(dataText, 'data');
  return validateData(schema, data);
}

/** Errors as pretty JSON, for the "Copy errors" button. */
export function errorsToJson(errors: readonly ValidationIssue[]): string {
  return JSON.stringify(
    errors.map((e) => ({
      instancePath: e.path === '(root)' ? '' : e.path,
      keyword: e.keyword,
      message: e.message,
      schemaPath: e.schemaPath,
      params: e.params,
    })),
    null,
    2,
  );
}

/** Split a JSON Pointer into unescaped segments. "(root)" and "" give []. */
export function pointerSegments(pointer: string): string[] {
  if (pointer === '' || pointer === '(root)') return [];
  return pointer
    .replace(/^\//, '')
    .split('/')
    .map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));
}

/**
 * Best-effort location of an error path inside raw JSON text: walks the
 * pointer's object keys in order, searching for each as a quoted key after the
 * previous match. Array indices are skipped. Returns the offset of the last
 * key found, or undefined when nothing matched.
 */
export function findPathOffset(text: string, pointer: string): number | undefined {
  const keys = pointerSegments(pointer).filter((s) => !/^\d+$/.test(s));
  let cursor = 0;
  let found: number | undefined;
  for (const key of keys) {
    const needle = JSON.stringify(key);
    const at = text.indexOf(needle, cursor);
    if (at === -1) break;
    found = at;
    cursor = at + needle.length;
  }
  return found;
}

export type InferredSchema = Record<string, unknown>;

/**
 * Infer a starter draft 2020-12 schema from a JSON value: primitive types,
 * `integer` vs `number`, objects with every key required, arrays typed from
 * their first element.
 */
export function inferSchema(data: unknown): InferredSchema {
  return { $schema: 'https://json-schema.org/draft/2020-12/schema', ...inferNode(data) };
}

function inferNode(value: unknown): InferredSchema {
  if (value === null) return { type: 'null' };
  if (Array.isArray(value)) {
    return value.length === 0 ? { type: 'array' } : { type: 'array', items: inferNode(value[0]) };
  }
  switch (typeof value) {
    case 'boolean':
      return { type: 'boolean' };
    case 'number':
      return { type: Number.isInteger(value) ? 'integer' : 'number' };
    case 'string':
      return { type: 'string' };
    case 'object': {
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record);
      if (keys.length === 0) return { type: 'object' };
      const properties: Record<string, InferredSchema> = {};
      for (const key of keys) properties[key] = inferNode(record[key]);
      return { type: 'object', properties, required: keys };
    }
    default:
      // bigint / symbol / function / undefined cannot appear in parsed JSON.
      return {};
  }
}

/** Infer a schema straight from JSON text and return it pretty-printed. */
export function inferSchemaText(dataText: string): string {
  return JSON.stringify(inferSchema(parseJson(dataText, 'data')), null, 2);
}
