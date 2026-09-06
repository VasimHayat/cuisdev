import { describe, expect, it } from 'vitest';

import {
  CASES,
  CaseConverterError,
  MAX_CHARS,
  SAMPLE,
  assertWithinLimit,
  capitalize,
  convertAll,
  convertCase,
  formatAll,
  getCase,
  splitWords,
  toAlternatingCase,
  toCamelCase,
  toDotCase,
  toInverseCase,
  toKebabCase,
  toLowerCase,
  toPascalCase,
  toScreamingSnakeCase,
  toSentenceCase,
  toSnakeCase,
  toTitleCase,
  toTrainCase,
  toUpperCase,
} from './logic';

describe('splitWords', () => {
  it('splits camelCase and PascalCase boundaries', () => {
    expect(splitWords('helloWorld')).toEqual(['hello', 'World']);
    expect(splitWords('HelloWorld')).toEqual(['Hello', 'World']);
  });

  it('keeps acronyms together', () => {
    expect(splitWords('XMLHttpRequest')).toEqual(['XML', 'Http', 'Request']);
    expect(splitWords('parseHTML')).toEqual(['parse', 'HTML']);
    expect(splitWords('ABC')).toEqual(['ABC']);
  });

  it('splits on punctuation and separators', () => {
    expect(splitWords('foo_bar-baz.qux/quux')).toEqual(['foo', 'bar', 'baz', 'qux', 'quux']);
  });

  it('keeps digits attached to the word they follow, but numbers stand alone', () => {
    expect(splitWords('html5Parser')).toEqual(['html5', 'Parser']);
    expect(splitWords('top 10 songs')).toEqual(['top', '10', 'songs']);
  });

  it('handles apostrophes and Unicode letters', () => {
    expect(splitWords("don't stop")).toEqual(["don't", 'stop']);
    expect(splitWords('Straße Ünicode')).toEqual(['Straße', 'Ünicode']);
    expect(splitWords('日本語 テキスト')).toEqual(['日本語', 'テキスト']);
  });

  it('returns an empty array when there are no words', () => {
    expect(splitWords('')).toEqual([]);
    expect(splitWords('--- ...')).toEqual([]);
  });
});

describe('capitalize', () => {
  it('upper-cases the first character and lower-cases the rest', () => {
    expect(capitalize('hELLO')).toBe('Hello');
    expect(capitalize('')).toBe('');
  });
});

describe('prose cases', () => {
  it('upper- and lower-cases the whole text', () => {
    expect(toUpperCase('Grüße, Welt!')).toBe('GRÜSSE, WELT!');
    expect(toLowerCase('Grüße, WELT!')).toBe('grüße, welt!');
  });

  it('title-cases while keeping small words lower-case', () => {
    expect(toTitleCase('the lord of the rings')).toBe('The Lord of the Rings');
  });

  it('always capitalises the first and last word of a title', () => {
    expect(toTitleCase('a room with a view')).toBe('A Room With a View');
    expect(toTitleCase('what are you waiting for')).toBe('What Are You Waiting For');
  });

  it('preserves punctuation and spacing in titles', () => {
    expect(toTitleCase('"hello,  world" — again')).toBe('"Hello,  World" — Again');
  });

  it('title-cases each line independently', () => {
    expect(toTitleCase('first line\nsecond line')).toBe('First Line\nSecond Line');
  });

  it('sentence-cases after ., ! and ?', () => {
    expect(toSentenceCase('HELLO there. how are you? fine! thanks')).toBe(
      'Hello there. How are you? Fine! Thanks',
    );
  });

  it('sentence-cases the first letter of every line', () => {
    expect(toSentenceCase('first LINE\n  second line')).toBe('First line\n  Second line');
  });

  it('alternates case starting lower and skips characters without case', () => {
    expect(toAlternatingCase('alternating')).toBe('aLtErNaTiNg');
    expect(toAlternatingCase('ab cd')).toBe('aB cD');
  });

  it('inverts the case of every letter', () => {
    expect(toInverseCase('Inverse Case')).toBe('iNVERSE cASE');
    expect(toInverseCase(toInverseCase('Round Trip'))).toBe('Round Trip');
  });
});

describe('identifier cases', () => {
  const input = 'XMLHttpRequest response code';

  it('produces camelCase and PascalCase', () => {
    expect(toCamelCase(input)).toBe('xmlHttpRequestResponseCode');
    expect(toPascalCase(input)).toBe('XmlHttpRequestResponseCode');
  });

  it('produces snake_case and SCREAMING_SNAKE_CASE', () => {
    expect(toSnakeCase(input)).toBe('xml_http_request_response_code');
    expect(toScreamingSnakeCase(input)).toBe('XML_HTTP_REQUEST_RESPONSE_CODE');
  });

  it('produces kebab-case, dot.case and Train-Case', () => {
    expect(toKebabCase(input)).toBe('xml-http-request-response-code');
    expect(toDotCase(input)).toBe('xml.http.request.response.code');
    expect(toTrainCase(input)).toBe('Xml-Http-Request-Response-Code');
  });

  it('converts each line separately and keeps blank lines', () => {
    expect(toSnakeCase('first name\n\nlast name')).toBe('first_name\n\nlast_name');
    expect(toCamelCase('user id\nemail address')).toBe('userId\nemailAddress');
  });

  it('normalises CRLF line endings', () => {
    expect(toKebabCase('one two\r\nthree four')).toBe('one-two\nthree-four');
  });

  it('drops apostrophes and punctuation from identifiers', () => {
    expect(toSnakeCase("don't stop, believing!")).toBe('dont_stop_believing');
  });

  it('returns an empty string for input with no words', () => {
    expect(toCamelCase('...')).toBe('');
  });
});

describe('CASES table', () => {
  it('exposes all thirteen conversions with unique ids', () => {
    expect(CASES).toHaveLength(13);
    expect(new Set(CASES.map((c) => c.id)).size).toBe(13);
  });

  it('converts by id and reports unknown ids', () => {
    expect(convertCase('hello world', 'pascal')).toBe('HelloWorld');
    // @ts-expect-error — deliberately passing an id that does not exist
    expect(() => getCase('nope')).toThrow(CaseConverterError);
  });

  it('convertAll returns one labelled result per case', () => {
    const results = convertAll('hello world');
    expect(results).toHaveLength(13);
    expect(results.find((r) => r.id === 'kebab')?.value).toBe('hello-world');
    expect(results.find((r) => r.id === 'upper')?.label).toBe('UPPER CASE');
  });

  it('formatAll labels every block', () => {
    const text = formatAll('hello world');
    expect(text).toContain('camelCase\nhelloWorld');
    expect(text).toContain('SCREAMING_SNAKE_CASE\nHELLO_WORLD');
    expect(text.split('\n\n')).toHaveLength(13);
  });

  it('converts the built-in sample without throwing', () => {
    const results = convertAll(SAMPLE);
    expect(results.find((r) => r.id === 'snake')?.value).toBe(
      'the_quick_brown_fox_jumps_over_the_lazy_dog\nxml_http_request_returns_json',
    );
  });
});

describe('assertWithinLimit', () => {
  it('accepts text at the limit', () => {
    expect(() => assertWithinLimit('a'.repeat(MAX_CHARS))).not.toThrow();
  });

  it('throws a helpful error above the limit', () => {
    expect(() => convertAll('a'.repeat(MAX_CHARS + 1))).toThrow(CaseConverterError);
    expect(() => convertAll('a'.repeat(MAX_CHARS + 1))).toThrow(/The limit is 100,000/);
  });
});
