import { describe, expect, it } from 'vitest';

import {
  type EncodeMode,
  HtmlEntityError,
  NAMED_ENTITIES,
  decode,
  encode,
  findUnknownEntities,
  hasEntities,
} from './logic';

describe('entity table', () => {
  it('ships every HTML 4 entity plus common HTML5 names', () => {
    expect(NAMED_ENTITIES.size).toBeGreaterThanOrEqual(250);
    for (const name of ['nbsp', 'copy', 'reg', 'hellip', 'mdash', 'ndash', 'lsquo', 'rsquo']) {
      expect(NAMED_ENTITIES.has(name)).toBe(true);
    }
    for (const name of ['ldquo', 'rdquo', 'bull', 'euro', 'trade', 'Omega', 'rarr', 'apos']) {
      expect(NAMED_ENTITIES.has(name)).toBe(true);
    }
    expect(NAMED_ENTITIES.get('eacute')).toBe(0xe9);
    expect(NAMED_ENTITIES.get('euro')).toBe(0x20ac);
  });
});

describe('encode', () => {
  it('essential mode escapes only & < > " and the apostrophe', () => {
    expect(encode(`<a href="x">Tom & Jerry's</a> café`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt; café',
    );
  });

  it('non-ascii mode uses named entities when one exists, numeric otherwise', () => {
    expect(encode('café — 5 € & 日', 'non-ascii')).toBe(
      'caf&eacute; &mdash; 5 &euro; &amp; &#26085;',
    );
  });

  it('non-ascii mode keeps emoji as a single code point reference', () => {
    expect(encode('👋', 'non-ascii')).toBe('&#128075;');
  });

  it('decimal mode encodes every character except line breaks', () => {
    expect(encode('Hi!\n', 'decimal')).toBe('&#72;&#105;&#33;\n');
    expect(encode('👋', 'decimal')).toBe('&#128075;');
  });

  it('hex mode encodes every character in upper-case hex', () => {
    expect(encode('Hi ©', 'hex')).toBe('&#x48;&#x69;&#x20;&#xA9;');
    expect(encode('a\r\nb', 'hex')).toBe('&#x61;\r\n&#x62;');
  });

  it('returns empty for empty input', () => {
    for (const mode of ['essential', 'non-ascii', 'decimal', 'hex'] as EncodeMode[]) {
      expect(encode('', mode)).toBe('');
    }
  });

  it('rejects an unknown mode', () => {
    expect(() => encode('x', 'base64' as EncodeMode)).toThrow(HtmlEntityError);
    expect(() => encode('x', 'base64' as EncodeMode)).toThrow(/Unknown encode mode "base64"/);
  });

  it('handles 1 MB of input quickly', () => {
    const big = '<p class="x">Tom & Jerry</p>\n'.repeat(35_000);
    const start = performance.now();
    const out = encode(big, 'non-ascii');
    expect(out).toContain('&lt;p class=&quot;x&quot;&gt;');
    expect(performance.now() - start).toBeLessThan(2000);
  });
});

describe('decode', () => {
  it('decodes named entities', () => {
    expect(decode('&lt;b&gt;Tom &amp; Jerry&lt;/b&gt; &hellip; &mdash; &euro;')).toBe(
      '<b>Tom & Jerry</b> … — €',
    );
  });

  it('is case-sensitive for named entities', () => {
    expect(decode('&Omega; &omega;')).toBe('Ω ω');
    expect(decode('&Eacute;&eacute;')).toBe('Éé');
  });

  it('decodes decimal and hex references, with or without a semicolon', () => {
    expect(decode('&#65;&#x42;&#X43;')).toBe('ABC');
    expect(decode('&#65 &#x42')).toBe('A B');
    expect(decode('&#128075;')).toBe('👋');
  });

  it('tolerates a missing semicolon on legacy entities only', () => {
    expect(decode('&copy 2024 &reg &nbsp;x')).toBe('© 2024 ®  x');
    expect(decode('&copy2024')).toBe('©2024');
    expect(decode('&ampersand')).toBe('&ersand');
    expect(decode('&hellip &mdash')).toBe('&hellip &mdash');
  });

  it('leaves literal ampersands and unknown entities untouched', () => {
    expect(decode('Tom & Jerry')).toBe('Tom & Jerry');
    expect(decode('a &b c &&& &;')).toBe('a &b c &&& &;');
    expect(decode('&foo; &bar')).toBe('&foo; &bar');
  });

  it('applies the Windows-1252 remap for &#128;–&#159;', () => {
    expect(decode('&#150; &#151; &#147;quoted&#148; &#133;')).toBe('– — “quoted” …');
  });

  it('replaces invalid code points with U+FFFD', () => {
    expect(decode('&#0;&#xD800;&#1114112;')).toBe('���');
  });

  it('returns input unchanged when there is no ampersand', () => {
    const text = 'plain <text> with\r\nline breaks and ﻿BOM';
    expect(decode(text)).toBe(text);
  });

  it('round-trips arbitrary text in every mode', () => {
    const text = '<div data-x="1" title=\'y\'>Ünïcödé — 日本語 🚀 & «quotes»\r\n\ttab ﻿</div>';
    for (const mode of ['essential', 'non-ascii', 'decimal', 'hex'] as EncodeMode[]) {
      expect(decode(encode(text, mode))).toBe(text);
    }
  });
});

describe('helpers', () => {
  it('findUnknownEntities lists names that are not in the table', () => {
    expect(findUnknownEntities('&foo; &amp; &bar; &foo;')).toEqual(['&foo;', '&bar;']);
    expect(findUnknownEntities('&amp; &#65;')).toEqual([]);
  });

  it('hasEntities detects decodable references', () => {
    expect(hasEntities('a &amp; b')).toBe(true);
    expect(hasEntities('&#65;')).toBe(true);
    expect(hasEntities('&#x41')).toBe(true);
    expect(hasEntities('Tom & Jerry &foo;')).toBe(false);
  });
});
