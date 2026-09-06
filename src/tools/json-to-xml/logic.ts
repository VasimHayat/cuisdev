/**
 * JSON ↔ XML conversion — pure functions, no DOM. Built on `fast-xml-parser`.
 *
 * Conventions (the same ones fast-xml-parser uses, so round-trips work):
 *   - keys starting with the attribute prefix (`@_` by default) are attributes
 *   - `#text` holds the text content of an element that also has attributes
 *   - arrays repeat the element; arrays nested inside arrays use `<item>`
 */
import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser';

export class ConvertError extends Error {
  override name = 'ConvertError';
  offset: number | undefined;
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
export const DEFAULT_ATTRIBUTE_PREFIX = '@_';
export const TEXT_NODE_NAME = '#text';
export const ARRAY_ITEM_NAME = 'item';

export interface JsonToXmlOptions {
  /** Wrapper element. Empty string = no wrapper (the JSON must then have one top-level key). */
  rootName?: string;
  indent?: Indent;
  /** Prepend `<?xml version="1.0" encoding="UTF-8"?>`. Default true. */
  declaration?: boolean;
  /** Keys with this prefix become attributes. Empty string disables attributes. */
  attributePrefix?: string;
}

export interface XmlToJsonOptions {
  /** Drop attributes instead of emitting them as prefixed keys. */
  ignoreAttributes?: boolean;
  /** Convert numeric/boolean-looking text and attributes. Default true. */
  parseValues?: boolean;
  minify?: boolean;
  indent?: Indent;
  attributePrefix?: string;
}

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

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
    const pos = /position (\d+)/.exec(raw);
    const lc = /line (\d+) column (\d+)/i.exec(raw);
    let offset: number | undefined;
    if (pos) offset = Number(pos[1]);
    else if (lc) offset = lineColumnToOffset(source, Number(lc[1]), Number(lc[2]));
    else if (/end of (JSON )?(input|data)/i.test(raw)) offset = source.length;
    const detail = raw
      .replace(/\s*in JSON at position \d+.*$/, '')
      .replace(/\s*\(line \d+ column \d+\)\s*$/, '')
      .replace(/^JSON\.parse:\s*/, '')
      .trim();
    if (offset === undefined) throw new ConvertError(`Invalid JSON: ${detail}.`);
    const { line, column } = offsetToLineColumn(source, offset);
    throw new ConvertError(
      `Invalid JSON at line ${line}, column ${column}: ${detail}. Check for trailing commas, single quotes or unquoted keys.`,
      { offset, line, column },
    );
  }
}

// XML Name production (simplified): letter/underscore/colon start, then letters, digits, - . _ :
const XML_NAME = /^[\p{L}_:][\p{L}\p{N}_.:-]*$/u;

export function isValidXmlName(name: string): boolean {
  return XML_NAME.test(name) && !/^xml/i.test(name);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function explainBadName(name: string): string {
  if (name === '') return 'it is empty';
  if (/^xml/i.test(name)) return 'names starting with "xml" are reserved';
  if (/^[^\p{L}_:]/u.test(name)) return 'it must start with a letter or "_"';
  return 'it contains characters such as spaces or symbols';
}

/**
 * Walk the JSON, rejecting keys that cannot be element/attribute names and
 * wrapping arrays-of-arrays in `<item>` elements (fast-xml-parser would emit
 * `<0>` otherwise).
 */
export function prepareForXml(value: unknown, attributePrefix: string, path = '$'): unknown {
  if (Array.isArray(value)) {
    return value.map((item, i) => {
      const child = prepareForXml(item, attributePrefix, `${path}[${i}]`);
      return Array.isArray(child) ? { [ARRAY_ITEM_NAME]: child } : child;
    });
  }
  if (!isPlainObject(value)) return value;

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    const isAttribute = attributePrefix !== '' && key.startsWith(attributePrefix);
    const name = isAttribute ? key.slice(attributePrefix.length) : key;
    if (key !== TEXT_NODE_NAME && !isValidXmlName(name)) {
      const kind = isAttribute ? 'attribute' : 'element';
      throw new ConvertError(
        `Key "${key}" at ${path} cannot be used as an XML ${kind} name because ${explainBadName(name)}. Allowed: letters, digits, "-", "_" and ".", starting with a letter or "_".`,
      );
    }
    if (isAttribute && (isPlainObject(child) || Array.isArray(child))) {
      throw new ConvertError(
        `Attribute "${key}" at ${path} must be a string, number, boolean or null — attributes cannot hold objects or arrays.`,
      );
    }
    out[key] = prepareForXml(child, attributePrefix, `${path}.${key}`);
  }
  return out;
}

export function jsonToXml(input: string, options: JsonToXmlOptions = {}): string {
  const value = parseJson(input);
  const rootName = (options.rootName ?? 'root').trim();
  const attributePrefix = options.attributePrefix ?? DEFAULT_ATTRIBUTE_PREFIX;
  const indent = options.indent ?? 2;

  if (rootName !== '' && !isValidXmlName(rootName)) {
    throw new ConvertError(
      `"${rootName}" is not a valid XML element name because ${explainBadName(rootName)}. Use letters, digits, "-", "_" or "." and start with a letter or "_".`,
    );
  }

  let tree: unknown;
  if (rootName === '') {
    if (!isPlainObject(value) || Object.keys(value).length !== 1) {
      throw new ConvertError(
        'Without a root element name, the JSON must be an object with exactly one top-level key, which becomes the root element. Enter a root name (for example "root") or wrap your data in one key.',
      );
    }
    tree = prepareForXml(value, attributePrefix);
  } else if (Array.isArray(value)) {
    tree = { [rootName]: { [ARRAY_ITEM_NAME]: prepareForXml(value, attributePrefix) } };
  } else {
    tree = { [rootName]: prepareForXml(value, attributePrefix) };
  }

  const builder = new XMLBuilder({
    format: true,
    indentBy: ' '.repeat(indent),
    ignoreAttributes: attributePrefix === '',
    attributeNamePrefix: attributePrefix,
    textNodeName: TEXT_NODE_NAME,
    suppressEmptyNode: false,
    suppressBooleanAttributes: false,
  });
  const body = (builder.build(tree) as string).replace(/\n+$/, '') + '\n';
  const declaration = options.declaration ?? true;
  return declaration ? `<?xml version="1.0" encoding="UTF-8"?>\n${body}` : body;
}

/** Validate XML syntax; throws ConvertError with line/column on failure. */
export function validateXml(input: string): void {
  const source = stripBom(input);
  if (source.trim() === '') {
    throw new ConvertError('Input is empty — paste some XML to convert.');
  }
  const result = XMLValidator.validate(source);
  if (result !== true) {
    const { line, col, msg } = result.err;
    const column = typeof col === 'number' && col > 0 ? col : 1;
    const offset = lineColumnToOffset(source, line, column);
    const detail = msg.replace(/\.$/, '');
    throw new ConvertError(`Invalid XML at line ${line}, column ${column}: ${detail}.`, {
      offset,
      line,
      column,
    });
  }
}

export function xmlToJson(input: string, options: XmlToJsonOptions = {}): string {
  const source = stripBom(input);
  validateXml(source);
  const parseValues = options.parseValues ?? true;
  const parser = new XMLParser({
    ignoreAttributes: options.ignoreAttributes ?? false,
    attributeNamePrefix: options.attributePrefix ?? DEFAULT_ATTRIBUTE_PREFIX,
    textNodeName: TEXT_NODE_NAME,
    parseTagValue: parseValues,
    parseAttributeValue: parseValues,
    ignoreDeclaration: true,
    ignorePiTags: true,
    trimValues: true,
    processEntities: true,
  });
  const value = parser.parse(source) as Record<string, unknown>;
  const roots = Object.keys(value);
  if (roots.length === 0) {
    throw new ConvertError(
      'No XML elements found — the document needs a root element like <root>…</root>.',
    );
  }
  if (roots.length > 1) {
    throw new ConvertError(
      `XML must have exactly one root element, but found ${roots.length} (<${roots.join('>, <')}>). Wrap them in a single parent element.`,
    );
  }
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
