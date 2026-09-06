import { describe, expect, it } from 'vitest';

import {
  ConvertError,
  csvToJson,
  delimiterName,
  describe as describeText,
  flattenRecord,
  jsonToCsv,
  offsetToLineColumn,
  parseJson,
  stripBom,
  toRows,
} from './logic';

const PEOPLE = JSON.stringify([
  { id: 1, name: 'Ada', address: { city: 'London', zip: 'N1' }, tags: ['a', 'b'] },
  { id: 2, name: 'Linus, Jr.', address: { city: 'Helsinki' }, active: true },
]);

describe('jsonToCsv', () => {
  it('flattens nested objects to dot-notation columns and stringifies arrays', () => {
    const { csv, rows, columns } = jsonToCsv(PEOPLE);
    expect(csv).toBe(
      'id,name,address.city,address.zip,tags,active\n' +
        '1,Ada,London,N1,"[""a"",""b""]",\n' +
        '2,"Linus, Jr.",Helsinki,,,true\n',
    );
    expect(rows).toBe(2);
    expect(columns).toBe(6);
  });

  it('supports semicolon, tab and pipe delimiters', () => {
    const json = '[{"a":1,"b":"x"}]';
    expect(jsonToCsv(json, { delimiter: ';' }).csv).toBe('a;b\n1;x\n');
    expect(jsonToCsv(json, { delimiter: '\t' }).csv).toBe('a\tb\n1\tx\n');
    expect(jsonToCsv(json, { delimiter: '|' }).csv).toBe('a|b\n1|x\n');
  });

  it('can omit the header row', () => {
    expect(jsonToCsv('[{"a":1},{"a":2}]', { header: false }).csv).toBe('1\n2\n');
  });

  it('can quote every field', () => {
    expect(jsonToCsv('[{"a":1,"b":"x"}]', { quoteAll: true }).csv).toBe('"a","b"\n"1","x"\n');
  });

  it('escapes quotes and newlines inside values', () => {
    expect(jsonToCsv('[{"q":"say \\"hi\\"","n":"a\\nb"}]').csv).toBe('q,n\n"say ""hi""","a\nb"\n');
  });

  it('returns an empty result for an empty array', () => {
    expect(jsonToCsv('[]')).toEqual({ csv: '', rows: 0, columns: 0 });
  });

  it('handles BOM, CRLF and unicode', () => {
    expect(jsonToCsv('﻿[\r\n{"名前":"👋"}\r\n]').csv).toBe('名前\n👋\n');
  });

  it('rejects a top-level object and points at the nested array', () => {
    expect(() => jsonToCsv('{"data":[{"a":1}]}')).toThrow(/under "data"/);
    expect(() => jsonToCsv('{"a":1}')).toThrow(/Wrap a single record in \[ \]/);
  });

  it('rejects arrays that contain non-objects', () => {
    expect(() => jsonToCsv('[1,2]')).toThrow(/item 0 is a number/);
    expect(() => jsonToCsv('[{"a":1},null]')).toThrow(/item 1 is null/);
    expect(() => jsonToCsv('[{"a":1},[1]]')).toThrow(/item 1 is an array/);
    expect(() => jsonToCsv('[{"a":1},"x"]')).toThrow(/item 1 is a string/);
    expect(() => jsonToCsv('[{"a":1},true]')).toThrow(/item 1 is a boolean/);
  });

  it('rejects top-level primitives', () => {
    expect(() => jsonToCsv('"x"')).toThrow(/top-level value is a string/);
    expect(() => jsonToCsv('42')).toThrow(/top-level value is a number/);
    expect(() => jsonToCsv('null')).toThrow(/top-level value is null/);
  });

  it('surfaces JSON syntax errors with a position', () => {
    let caught: ConvertError | undefined;
    try {
      jsonToCsv('[{"a":1,}]');
    } catch (err) {
      caught = err as ConvertError;
    }
    expect(caught).toBeInstanceOf(ConvertError);
    expect(caught?.message).toMatch(/^Invalid JSON at line 1, column 9/);
    expect(caught?.offset).toBe(8);
  });

  it('rejects empty input', () => {
    expect(() => jsonToCsv('  ')).toThrow(/empty/);
  });
});

describe('flattenRecord', () => {
  it('flattens deeply and treats empty objects / null specially', () => {
    expect(flattenRecord({ a: { b: { c: 1 } }, e: {}, n: null, u: undefined, s: 'x' })).toEqual({
      'a.b.c': 1,
      e: '{}',
      n: '',
      u: '',
      s: 'x',
    });
  });
});

describe('toRows', () => {
  it('returns the array unchanged when valid', () => {
    const rows = [{ a: 1 }];
    expect(toRows(rows)).toBe(rows);
  });
});

describe('csvToJson', () => {
  it('parses a header row into objects', () => {
    const { json, rows, columns, warnings } = csvToJson('name,age\nAda,36\nLinus,54\n');
    expect(JSON.parse(json)).toEqual([
      { name: 'Ada', age: '36' },
      { name: 'Linus', age: '54' },
    ]);
    expect(rows).toBe(2);
    expect(columns).toBe(2);
    expect(warnings).toEqual([]);
  });

  it('converts numbers and booleans with dynamicTyping', () => {
    const { json } = csvToJson('a,b,c\n1,true,x\n-2.5,false,\n', { dynamicTyping: true });
    expect(JSON.parse(json)).toEqual([
      { a: 1, b: true, c: 'x' },
      { a: -2.5, b: false, c: null },
    ]);
  });

  it('returns arrays of arrays without a header row', () => {
    const { json, columns } = csvToJson('1,2,3\n4,5\n', { header: false, minify: true });
    expect(json).toBe('[["1","2","3"],["4","5"]]\n');
    expect(columns).toBe(3);
  });

  it('auto-detects semicolon and tab delimiters and reports which one it used', () => {
    const semi = csvToJson('a;b\n1;2');
    expect(JSON.parse(semi.json)).toEqual([{ a: '1', b: '2' }]);
    expect(semi.delimiter).toBe(';');
    const tab = csvToJson('a\tb\n1\t2');
    expect(JSON.parse(tab.json)).toEqual([{ a: '1', b: '2' }]);
    expect(tab.delimiter).toBe('\t');
    expect(csvToJson('a,b\n1,2').delimiter).toBe(',');
  });

  it('respects an explicit delimiter', () => {
    const piped = csvToJson('a|b\n1,x|2', { delimiter: '|' });
    expect(JSON.parse(piped.json)).toEqual([{ a: '1,x', b: '2' }]);
    expect(piped.delimiter).toBe('|');
  });

  it('falls back to a comma when the delimiter cannot be detected', () => {
    expect(csvToJson('onlyone\nvalue').delimiter).toBe(',');
  });

  it('honours pretty indent and minify', () => {
    expect(csvToJson('a\n1', { indent: 4 }).json).toBe('[\n    {\n        "a": "1"\n    }\n]\n');
    expect(csvToJson('a\n1', { minify: true }).json).toBe('[{"a":"1"}]\n');
  });

  it('handles quoted fields with delimiters, quotes and newlines', () => {
    const { json } = csvToJson('a,b\n"x, y","say ""hi"""\n"line1\nline2",z\n', { minify: true });
    expect(json).toBe('[{"a":"x, y","b":"say \\"hi\\""},{"a":"line1\\nline2","b":"z"}]\n');
  });

  it('strips a BOM, accepts CRLF and skips blank lines', () => {
    const { json, rows } = csvToJson('﻿a,b\r\n1,2\r\n\r\n3,4\r\n', { minify: true });
    expect(json).toBe('[{"a":"1","b":"2"},{"a":"3","b":"4"}]\n');
    expect(rows).toBe(2);
  });

  it('trims header whitespace', () => {
    expect(JSON.parse(csvToJson(' a , b \n1,2').json)).toEqual([{ a: '1', b: '2' }]);
  });

  it('warns about ragged rows, renamed duplicate headers and undetectable delimiters', () => {
    const ragged = csvToJson('a,b\n1,2,3\n');
    expect(ragged.warnings[0]).toMatch(/^Line 2: Too many fields/);

    const dupes = csvToJson('a,a\n1,2');
    expect(dupes.warnings[0]).toMatch(/Duplicate column names were renamed: "a" → "a_1"/);

    const single = csvToJson('onlyone\nvalue');
    expect(single.warnings[0]).toMatch(/Could not detect the delimiter/);
    expect(JSON.parse(single.json)).toEqual([{ onlyone: 'value' }]);
  });

  it('throws a positioned error for an unterminated quote', () => {
    let caught: ConvertError | undefined;
    try {
      csvToJson('a,b\n1,"oops\n');
    } catch (err) {
      caught = err as ConvertError;
    }
    expect(caught).toBeInstanceOf(ConvertError);
    expect(caught?.message).toMatch(/^Invalid CSV at line 2, column 4: Quoted field unterminated/);
    expect(caught?.message).toMatch(/doubled \(""\)/);
    expect(caught?.line).toBe(2);
  });

  it('rejects empty input', () => {
    expect(() => csvToJson('\n\n')).toThrow(/empty/);
  });

  it('round-trips JSON → CSV → JSON', () => {
    const source = [
      { id: 1, name: 'Ada', ok: true },
      { id: 2, name: 'Bob, Jr.', ok: false },
    ];
    const { csv } = jsonToCsv(JSON.stringify(source));
    expect(JSON.parse(csvToJson(csv, { dynamicTyping: true }).json)).toEqual(source);
  });
});

describe('helpers', () => {
  it('names delimiters', () => {
    expect(delimiterName(',')).toBe('comma');
    expect(delimiterName(';')).toBe('semicolon');
    expect(delimiterName('\t')).toBe('tab');
    expect(delimiterName('|')).toBe('pipe');
    expect(delimiterName('auto')).toBe('auto');
  });

  it('parseJson strips a BOM and reports positions', () => {
    expect(parseJson('﻿[1]')).toEqual([1]);
    expect(() => parseJson('[1,')).toThrow(/Invalid JSON at line 1, column 4/);
    expect(stripBom('x')).toBe('x');
    expect(offsetToLineColumn('a\nb', 2)).toEqual({ line: 2, column: 1 });
  });

  it('describe counts lines and bytes', () => {
    expect(describeText('')).toBe('');
    expect(describeText('a,b\n1,2\n')).toBe('2 lines · 8 B');
  });
});
