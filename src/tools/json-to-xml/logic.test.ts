import { describe, expect, it } from 'vitest';

import {
  ConvertError,
  describe as describeText,
  isValidXmlName,
  jsonToXml,
  lineColumnToOffset,
  offsetToLineColumn,
  parseJson,
  prepareForXml,
  stripBom,
  validateXml,
  xmlToJson,
} from './logic';

const DECL = '<?xml version="1.0" encoding="UTF-8"?>\n';

describe('jsonToXml', () => {
  it('wraps an object in the root element with a declaration', () => {
    expect(jsonToXml('{"name":"app","port":8080,"debug":false}')).toBe(
      DECL + '<root>\n  <name>app</name>\n  <port>8080</port>\n  <debug>false</debug>\n</root>\n',
    );
  });

  it('repeats elements for arrays and nests objects', () => {
    expect(jsonToXml('{"tags":["a","b"],"db":{"host":"x"}}', { declaration: false })).toBe(
      '<root>\n  <tags>a</tags>\n  <tags>b</tags>\n  <db>\n    <host>x</host>\n  </db>\n</root>\n',
    );
  });

  it('turns @_ keys into attributes and #text into text content', () => {
    expect(jsonToXml('{"a":{"@_id":"7","#text":"hi"}}', { declaration: false })).toBe(
      '<root>\n  <a id="7">hi</a>\n</root>\n',
    );
  });

  it('supports a custom attribute prefix and disabling attributes', () => {
    expect(
      jsonToXml('{"a":{"$id":1,"#text":"t"}}', { declaration: false, attributePrefix: '$' }),
    ).toBe('<root>\n  <a id="1">t</a>\n</root>\n');
    expect(() => jsonToXml('{"@_id":1}', { attributePrefix: '' })).toThrow(/Key "@_id"/);
  });

  it('uses a custom root name and 4-space indent', () => {
    expect(jsonToXml('{"a":1}', { rootName: 'config', indent: 4, declaration: false })).toBe(
      '<config>\n    <a>1</a>\n</config>\n',
    );
  });

  it('wraps top-level arrays in <item> elements', () => {
    expect(jsonToXml('[1,{"b":2}]', { declaration: false })).toBe(
      '<root>\n  <item>1</item>\n  <item>\n    <b>2</b>\n  </item>\n</root>\n',
    );
  });

  it('wraps arrays nested inside arrays in <item>', () => {
    expect(jsonToXml('{"m":[[1,2],[3]]}', { declaration: false })).toBe(
      '<root>\n  <m>\n    <item>1</item>\n    <item>2</item>\n  </m>\n  <m>\n    <item>3</item>\n  </m>\n</root>\n',
    );
  });

  it('escapes special characters', () => {
    expect(jsonToXml('{"s":"a < b & c"}', { declaration: false })).toBe(
      '<root>\n  <s>a &lt; b &amp; c</s>\n</root>\n',
    );
  });

  it('emits self-closing tags for null and empty tags for empty strings', () => {
    expect(jsonToXml('{"n":null,"e":""}', { declaration: false })).toBe(
      '<root>\n  <n/>\n  <e></e>\n</root>\n',
    );
  });

  it('uses the single top-level key as root when the root name is blank', () => {
    expect(jsonToXml('{"note":{"to":"Ada"}}', { rootName: '', declaration: false })).toBe(
      '<note>\n  <to>Ada</to>\n</note>\n',
    );
    expect(() => jsonToXml('{"a":1,"b":2}', { rootName: '' })).toThrow(/exactly one top-level key/);
    expect(() => jsonToXml('[1]', { rootName: '  ' })).toThrow(/exactly one top-level key/);
  });

  it('rejects invalid root names', () => {
    expect(() => jsonToXml('{}', { rootName: '1abc' })).toThrow(/must start with a letter/);
    expect(() => jsonToXml('{}', { rootName: 'my root' })).toThrow(/spaces or symbols/);
    expect(() => jsonToXml('{}', { rootName: 'xmlThing' })).toThrow(/reserved/);
  });

  it('rejects keys that are not valid XML names, with a path', () => {
    expect(() => jsonToXml('{"a":{"first name":1}}')).toThrow(
      /Key "first name" at \$\.a cannot be used as an XML element name/,
    );
    expect(() => jsonToXml('{"":1}')).toThrow(/it is empty/);
    expect(() => jsonToXml('{"items":[{"1x":1}]}')).toThrow(/at \$\.items\[0\]/);
    expect(() => jsonToXml('{"@_bad name":1}')).toThrow(/XML attribute name/);
  });

  it('rejects attributes holding objects or arrays', () => {
    expect(() => jsonToXml('{"a":{"@_x":{"y":1}}}')).toThrow(/attributes cannot hold objects/);
  });

  it('handles BOM, CRLF and unicode', () => {
    expect(jsonToXml('﻿{\r\n"名":"👋"\r\n}', { declaration: false })).toBe(
      '<root>\n  <名>👋</名>\n</root>\n',
    );
  });

  it('surfaces JSON syntax errors with a position', () => {
    let caught: ConvertError | undefined;
    try {
      jsonToXml('{"a":1,}');
    } catch (err) {
      caught = err as ConvertError;
    }
    expect(caught).toBeInstanceOf(ConvertError);
    expect(caught?.message).toMatch(/^Invalid JSON at line 1, column 8/);
    expect(caught?.offset).toBe(7);
    expect(() => jsonToXml('')).toThrow(/empty/);
  });
});

describe('xmlToJson', () => {
  const XML =
    '<?xml version="1.0"?>\n<root>\n  <a>1</a>\n  <b id="7">hi</b>\n  <c>x</c>\n  <c>y</c>\n  <d/>\n</root>\n';

  it('parses elements, attributes and repeated elements', () => {
    expect(JSON.parse(xmlToJson(XML))).toEqual({
      root: { a: 1, b: { '#text': 'hi', '@_id': 7 }, c: ['x', 'y'], d: '' },
    });
  });

  it('can leave values as strings', () => {
    expect(JSON.parse(xmlToJson(XML, { parseValues: false }))).toEqual({
      root: { a: '1', b: { '#text': 'hi', '@_id': '7' }, c: ['x', 'y'], d: '' },
    });
  });

  it('can ignore attributes', () => {
    expect(JSON.parse(xmlToJson(XML, { ignoreAttributes: true }))).toEqual({
      root: { a: 1, b: 'hi', c: ['x', 'y'], d: '' },
    });
  });

  it('supports a custom attribute prefix, indent and minify', () => {
    expect(xmlToJson('<a x="1"/>', { attributePrefix: '$', minify: true })).toBe(
      '{"a":{"$x":1}}\n',
    );
    expect(xmlToJson('<a>1</a>', { indent: 4 })).toBe('{\n    "a": 1\n}\n');
  });

  it('parses booleans, decodes entities and CDATA', () => {
    expect(
      JSON.parse(xmlToJson('<r><t>true</t><e>a &amp; b</e><c><![CDATA[x<y]]></c></r>')),
    ).toEqual({
      r: { t: true, e: 'a & b', c: 'x<y' },
    });
  });

  it('drops comments and the declaration, strips BOM and accepts CRLF', () => {
    expect(
      xmlToJson('﻿<?xml version="1.0"?>\r\n<!-- c -->\r\n<a>1</a>\r\n', { minify: true }),
    ).toBe('{"a":1}\n');
  });

  it('rejects empty input', () => {
    expect(() => xmlToJson('')).toThrow(/empty/);
    expect(() => validateXml('  ')).toThrow(ConvertError);
  });

  it('reports mismatched tags with line and column', () => {
    let caught: ConvertError | undefined;
    try {
      xmlToJson('<root>\n  <a>\n</root>');
    } catch (err) {
      caught = err as ConvertError;
    }
    expect(caught).toBeInstanceOf(ConvertError);
    expect(caught?.message).toMatch(/^Invalid XML at line 3, column 1: Expected closing tag 'a'/);
    expect(caught?.line).toBe(3);
    expect(caught?.column).toBe(1);
    expect(caught?.offset).toBe(13);
  });

  it('reports text that is not XML and trailing garbage', () => {
    expect(() => xmlToJson('hello')).toThrow(/Invalid XML at line 1, column 1/);
    expect(() => xmlToJson('<a>1</a>junk')).toThrow(/Extra text at the end/);
    expect(() => xmlToJson('<a b=1/>')).toThrow(/Attribute 'b' is without value/);
  });

  it('rejects multiple root elements', () => {
    expect(() => xmlToJson('<a/><b/>')).toThrow(
      /exactly one root element, but found 2 \(<a>, <b>\)/,
    );
  });

  it('round-trips JSON → XML → JSON', () => {
    const json = '{"cfg":{"@_v":"2","name":"app","ports":[80,443],"ok":true}}';
    const xml = jsonToXml(json, { rootName: '' });
    expect(xmlToJson(xml, { minify: true })).toBe(
      '{"cfg":{"name":"app","ports":[80,443],"ok":true,"@_v":2}}\n',
    );
  });
});

describe('helpers', () => {
  it('validates XML names', () => {
    expect(isValidXmlName('a-b.c_d:e')).toBe(true);
    expect(isValidXmlName('_x1')).toBe(true);
    expect(isValidXmlName('名前')).toBe(true);
    expect(isValidXmlName('1a')).toBe(false);
    expect(isValidXmlName('a b')).toBe(false);
    expect(isValidXmlName('')).toBe(false);
    expect(isValidXmlName('XMLfoo')).toBe(false);
  });

  it('prepareForXml leaves primitives alone', () => {
    expect(prepareForXml(5, '@_')).toBe(5);
    expect(prepareForXml(null, '@_')).toBeNull();
  });

  it('position helpers and stripBom', () => {
    expect(offsetToLineColumn('ab\ncd', 4)).toEqual({ line: 2, column: 2 });
    expect(lineColumnToOffset('ab\ncd', 2, 2)).toBe(4);
    expect(lineColumnToOffset('ab', 5, 1)).toBe(2);
    expect(stripBom('﻿a')).toBe('a');
    expect(parseJson('﻿{}')).toEqual({});
  });

  it('describe counts lines and bytes', () => {
    expect(describeText('')).toBe('');
    expect(describeText('<a/>\n')).toBe('1 line · 5 B');
  });
});
