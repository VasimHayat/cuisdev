import { describe, expect, it } from 'vitest';

import { UrlEncodeError, decode, decodeOnce, encode, looksEncoded, parseUrl } from './logic';

describe('encode', () => {
  it('component-encodes reserved characters and spaces', () => {
    expect(encode('a b&c=d/e?f')).toBe('a%20b%26c%3Dd%2Fe%3Ff');
  });

  it('component leaves the unreserved set alone', () => {
    expect(encode("AZaz09-_.!~*'()")).toBe("AZaz09-_.!~*'()");
  });

  it('encodes UTF-8 (accents, emoji, CJK)', () => {
    expect(encode('café')).toBe('caf%C3%A9');
    expect(encode('👋')).toBe('%F0%9F%91%8B');
    expect(encode('日本')).toBe('%E6%97%A5%E6%9C%AC');
  });

  it('full-URL mode keeps delimiters so the URL still works', () => {
    expect(encode('https://example.com/a b?q=x y&z=1#h', 'full')).toBe(
      'https://example.com/a%20b?q=x%20y&z=1#h',
    );
  });

  it('form mode uses + for spaces and escapes the extra form characters', () => {
    expect(encode("a b!'()~*", 'form')).toBe('a+b%21%27%28%29%7E*');
  });

  it('returns empty for empty input', () => {
    expect(encode('')).toBe('');
    expect(encode('', 'full')).toBe('');
    expect(encode('', 'form')).toBe('');
  });

  it('preserves BOM and Windows line endings as escapes', () => {
    expect(encode('﻿a\r\nb')).toBe('%EF%BB%BFa%0D%0Ab');
  });

  it('reports lone surrogates with an offset', () => {
    expect(() => encode('ab\uD800cd')).toThrow(UrlEncodeError);
    expect(() => encode('ab\uD800cd')).toThrow(/lone surrogate .* offset 2/);
  });

  it('handles 1 MB of input quickly', () => {
    const big = 'a b/'.repeat(250_000);
    const start = performance.now();
    expect(encode(big)).toHaveLength(2_000_000);
    expect(performance.now() - start).toBeLessThan(2000);
  });
});

describe('decodeOnce / decode', () => {
  it('decodes percent-escapes and UTF-8 sequences', () => {
    expect(decodeOnce('caf%C3%A9%20au%20lait')).toBe('café au lait');
    expect(decodeOnce('%F0%9F%91%8B')).toBe('👋');
  });

  it('accepts lower-case hex', () => {
    expect(decodeOnce('%c3%a9')).toBe('é');
  });

  it('leaves + alone in component mode but turns it into a space in form mode', () => {
    expect(decodeOnce('a+b', 'component')).toBe('a+b');
    expect(decodeOnce('a+b%21', 'form')).toBe('a b!');
  });

  it('full-URL mode keeps encoded delimiters encoded (like decodeURI)', () => {
    expect(decodeOnce('a%2Fb%20c%3F', 'full')).toBe('a%2Fb c%3F');
    expect(decodeOnce('a%2Fb%20c%3F', 'component')).toBe('a/b c?');
  });

  it('returns input unchanged when there is nothing to decode', () => {
    expect(decodeOnce('plain text')).toBe('plain text');
    expect(decode('plain text')).toEqual({ text: 'plain text', passes: 0 });
  });

  it('reports a malformed % sequence with its offset', () => {
    expect(() => decodeOnce('abc%2')).toThrow(UrlEncodeError);
    expect(() => decodeOnce('abc%2')).toThrow(/"%2" at offset 3/);
    expect(() => decodeOnce('100%')).toThrow(/at offset 3/);
    expect(() => decodeOnce('x%G1y')).toThrow(/"%G1" at offset 1/);
    try {
      decodeOnce('x%G1y');
    } catch (err) {
      expect((err as UrlEncodeError).offset).toBe(1);
    }
  });

  it('reports invalid UTF-8 byte sequences', () => {
    expect(() => decodeOnce('%FF%FE')).toThrow(/not form valid UTF-8/);
    expect(() => decodeOnce('ok%C3')).toThrow(/offset 2/);
  });

  it('decodes a single pass by default', () => {
    expect(decode('%2520')).toEqual({ text: '%20', passes: 1 });
  });

  it('decodes until stable for multiply-encoded input', () => {
    expect(decode('%252520', { untilStable: true })).toEqual({ text: ' ', passes: 3 });
    expect(decode('a%252Bb', { untilStable: true, mode: 'form' })).toEqual({
      text: 'a b',
      passes: 3,
    });
  });

  it('round-trips arbitrary text in every mode', () => {
    const text = "Ünïcödé — 日本語 🚀 a+b&c=d/e?f#g ~!*'()\r\n﻿%";
    expect(decode(encode(text, 'component'), { mode: 'component' }).text).toBe(text);
    expect(decode(encode(text, 'form'), { mode: 'form' }).text).toBe(text);
    const simple = 'plain text with spaces and ümlauts';
    expect(decode(encode(simple, 'full'), { mode: 'full' }).text).toBe(simple);
  });

  it('looksEncoded detects percent-escapes', () => {
    expect(looksEncoded('a%20b')).toBe(true);
    expect(looksEncoded('100% sure')).toBe(false);
  });
});

describe('parseUrl', () => {
  it('breaks a URL into its parts with decoded query params', () => {
    const parsed = parseUrl(
      'https://user:p%40ss@example.com:8443/path/to%20it?q=caf%C3%A9+au+lait&lang=fr&empty=#frag%20ment',
    );
    expect(parsed).toEqual({
      protocol: 'https',
      username: 'user',
      password: 'p@ss',
      host: 'example.com',
      port: '8443',
      path: '/path/to it',
      query: [
        { key: 'q', value: 'café au lait' },
        { key: 'lang', value: 'fr' },
        { key: 'empty', value: '' },
      ],
      hash: 'frag ment',
    });
  });

  it('omits the port when it is the scheme default', () => {
    expect(parseUrl('http://example.com:80/')?.port).toBe('');
  });

  it('returns null for text that is not an absolute URL', () => {
    expect(parseUrl('hello world')).toBeNull();
    expect(parseUrl('/relative/path?x=1')).toBeNull();
    expect(parseUrl('example.com/no-scheme')).toBeNull();
    expect(parseUrl('')).toBeNull();
    expect(parseUrl('https://exa mple.com')).toBeNull();
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseUrl('  https://example.com/  ')?.host).toBe('example.com');
  });

  it('accepts not-yet-encoded spaces in the path and query', () => {
    const parsed = parseUrl('https://example.com/a b?q=café au lait&x=1#top');
    expect(parsed?.path).toBe('/a b');
    expect(parsed?.query).toEqual([
      { key: 'q', value: 'café au lait' },
      { key: 'x', value: '1' },
    ]);
    expect(parsed?.hash).toBe('top');
  });

  it('keeps malformed escapes in the path rather than failing', () => {
    expect(parseUrl('https://example.com/100%')?.path).toBe('/100%');
  });
});
