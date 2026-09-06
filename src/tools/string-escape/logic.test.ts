import { describe, expect, it } from 'vitest';

import {
  type EscapeTarget,
  StringEscapeError,
  TARGETS,
  canUnescape,
  escape,
  getTarget,
  unescape,
} from './logic';

const REVERSIBLE = TARGETS.filter((t) => t.canUnescape).map((t) => t.id);
const NASTY = 'He said "hi" & <b>\'bye\'</b>\r\n\ttab\\slash `tick` $HOME 日本 🚀 \u2028 \uFEFF';

describe('targets', () => {
  it('lists eight targets and marks regex and sql as one-way', () => {
    expect(TARGETS.map((t) => t.id)).toEqual([
      'json',
      'javascript',
      'html-attribute',
      'xml',
      'csv',
      'shell',
      'regex',
      'sql',
    ]);
    expect(canUnescape('json')).toBe(true);
    expect(canUnescape('regex')).toBe(false);
    expect(canUnescape('sql')).toBe(false);
    expect(getTarget('csv').label).toBe('CSV field');
    for (const t of TARGETS) expect(t.hint.length).toBeGreaterThan(20);
  });

  it('rejects an unknown target', () => {
    expect(() => escape('x', 'yaml' as EscapeTarget)).toThrow(StringEscapeError);
    expect(() => escape('x', 'yaml' as EscapeTarget)).toThrow(
      /Unknown target "yaml".*json, javascript/,
    );
    expect(() => unescape('x', 'yaml' as EscapeTarget)).toThrow(/Unknown target/);
  });

  it('returns empty output for empty input (except the shell, which needs quotes)', () => {
    for (const t of TARGETS) {
      expect(escape('', t.id)).toBe(t.id === 'shell' ? "''" : '');
      if (t.canUnescape) expect(unescape('', t.id)).toBe('');
    }
  });

  it('round-trips arbitrary text through every reversible target', () => {
    for (const target of REVERSIBLE) {
      expect(unescape(escape(NASTY, target), target), target).toBe(NASTY);
    }
  });

  it('handles 1 MB of input quickly', () => {
    const big = 'a "quoted" \\ line\n'.repeat(60_000);
    const start = performance.now();
    for (const target of REVERSIBLE) expect(unescape(escape(big, target), target)).toBe(big);
    expect(performance.now() - start).toBeLessThan(5000);
  });
});

describe('json', () => {
  it('escapes quotes, backslashes and control characters like JSON.stringify', () => {
    expect(escape('say "hi"\\\n\t\u0001', 'json')).toBe('say \\"hi\\"\\\\\\n\\t\\u0001');
    expect(escape('café 日本 🚀 /', 'json')).toBe('café 日本 🚀 /');
  });

  it('unescapes every JSON escape, surrogate pairs and a quoted literal', () => {
    expect(unescape('a\\"b\\\\c\\/d\\b\\f\\n\\r\\t', 'json')).toBe('a"b\\c/d\b\f\n\r\t');
    expect(unescape('\\u00e9\\ud83d\\ude80', 'json')).toBe('é🚀');
    expect(unescape('"wrapped \\"in\\" quotes"', 'json')).toBe('wrapped "in" quotes');
    expect(unescape('no escapes here', 'json')).toBe('no escapes here');
  });

  it('reports invalid JSON escapes with an offset', () => {
    expect(() => unescape('ab\\qcd', 'json')).toThrow(/Unknown escape "\\q" at offset 2/);
    expect(() => unescape('abc\\', 'json')).toThrow(/Trailing backslash at offset 3/);
    expect(() => unescape('x\\u12G4', 'json')).toThrow(/Invalid \\u escape at offset 1.*"\\u12G4"/);
    expect(() => unescape("it\\'s", 'json')).toThrow(/Unknown escape "\\'"/);
    try {
      unescape('ab\\q', 'json');
    } catch (err) {
      expect((err as StringEscapeError).offset).toBe(2);
    }
  });
});

describe('javascript', () => {
  it('escapes all three quote styles, line terminators and control characters', () => {
    expect(escape('\'a\' "b" `c` \\', 'javascript')).toBe('\\\'a\\\' \\"b\\" \\`c\\` \\\\');
    expect(escape('x\ny\rz\t\b\f\v\0\u001b\u007f', 'javascript')).toBe(
      'x\\ny\\rz\\t\\b\\f\\v\\x00\\x1b\\x7f',
    );
    expect(escape('a\u2028b\u2029c', 'javascript')).toBe('a\\u2028b\\u2029c');
    expect(escape('lone \ud800 surrogate', 'javascript')).toBe('lone \\ud800 surrogate');
    expect(escape('日本 🚀 ${x}', 'javascript')).toBe('日本 🚀 ${x}');
  });

  it('unescapes named, hex, unicode, code-point, octal and identity escapes', () => {
    expect(unescape('\\n\\r\\t\\b\\f\\v', 'javascript')).toBe('\n\r\t\b\f\v');
    expect(unescape('\\x41\\u0042\\u{1F680}\\101\\0', 'javascript')).toBe('AB🚀A\0');
    expect(unescape('\\\'\\"\\`\\\\\\/\\q', 'javascript')).toBe('\'"`\\/q');
    expect(unescape('line\\\ncontinued\\\r\nagain', 'javascript')).toBe('linecontinuedagain');
    expect(unescape("'single'", 'javascript')).toBe('single');
    expect(unescape('`tick`', 'javascript')).toBe('tick');
    expect(unescape('\\3777', 'javascript')).toBe('\u00ff7');
  });

  it('reports malformed JavaScript escapes', () => {
    expect(() => unescape('a\\xZZ', 'javascript')).toThrow(/Invalid \\x escape at offset 1/);
    expect(() => unescape('a\\u12', 'javascript')).toThrow(/expected 4 hex digits.*\\u\{1F600\}/);
    expect(() => unescape('a\\u{110000}', 'javascript')).toThrow(/Invalid \\u\{…\} escape/);
    expect(() => unescape('a\\u{zz}', 'javascript')).toThrow(/Invalid \\u\{…\} escape/);
    expect(() => unescape('a\\', 'javascript')).toThrow(/Trailing backslash at offset 1/);
  });
});

describe('html-attribute and xml', () => {
  it('escapes the five special characters with the right apostrophe entity', () => {
    expect(escape('<a href="x" title=\'y\'>Tom & Jerry</a>', 'html-attribute')).toBe(
      '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;Tom &amp; Jerry&lt;/a&gt;',
    );
    expect(escape('<a href="x" title=\'y\'>Tom & Jerry</a>', 'xml')).toBe(
      '&lt;a href=&quot;x&quot; title=&apos;y&apos;&gt;Tom &amp; Jerry&lt;/a&gt;',
    );
    expect(escape('café 日本', 'xml')).toBe('café 日本');
  });

  it('unescapes named and numeric references, leaving unknown names alone', () => {
    expect(
      unescape('&lt;b&gt; &amp;amp; &quot;&#39;&apos; &#x1F680; &#233;', 'html-attribute'),
    ).toBe("<b> &amp; \"'' 🚀 é");
    expect(unescape('a&nbsp;b &copy; &bogus;', 'html-attribute')).toBe('a\u00a0b &copy; &bogus;');
    expect(unescape('&apos;&quot; &nbsp;', 'xml')).toBe('\'" &nbsp;');
    expect(unescape('&#0;&#xD800;&#1114112;', 'xml')).toBe('\ufffd\ufffd\ufffd');
    expect(unescape('Tom & Jerry', 'xml')).toBe('Tom & Jerry');
  });
});

describe('csv', () => {
  it('quotes only when the field needs it and doubles inner quotes', () => {
    expect(escape('plain', 'csv')).toBe('plain');
    expect(escape('a,b', 'csv')).toBe('"a,b"');
    expect(escape('say "hi"', 'csv')).toBe('"say ""hi"""');
    expect(escape('two\nlines', 'csv')).toBe('"two\nlines"');
    expect(escape(' padded ', 'csv')).toBe('" padded "');
  });

  it('unescapes quoted fields and passes plain fields through', () => {
    expect(unescape('"say ""hi"", ok"', 'csv')).toBe('say "hi", ok');
    expect(unescape('plain', 'csv')).toBe('plain');
    expect(unescape('""', 'csv')).toBe('');
  });

  it('reports malformed CSV fields', () => {
    expect(() => unescape('"unterminated', 'csv')).toThrow(/Unterminated quoted field/);
    expect(() => unescape('"', 'csv')).toThrow(/Unterminated quoted field/);
    expect(() => unescape('"a"b"', 'csv')).toThrow(/Stray double quote at offset 2/);
    expect(() => unescape('say "hi"', 'csv')).toThrow(/Unexpected double quote at offset 4/);
  });
});

describe('shell', () => {
  it('single-quotes the text and splices inner quotes', () => {
    expect(escape('hello world', 'shell')).toBe("'hello world'");
    expect(escape("it's $HOME `x`", 'shell')).toBe("'it'\\''s $HOME `x`'");
    expect(escape('', 'shell')).toBe("''");
  });

  it('unescapes single quotes, double quotes, backslashes and concatenation', () => {
    expect(unescape("'it'\\''s'", 'shell')).toBe("it's");
    expect(unescape('"say \\"hi\\" \\$HOME \\\\ \\n"', 'shell')).toBe('say "hi" $HOME \\ \\n');
    expect(unescape('a\\ b\\$c', 'shell')).toBe('a b$c');
    expect(unescape('pre\'mid\'"end"', 'shell')).toBe('premidend');
    expect(unescape('multi\\\nline', 'shell')).toBe('multiline');
    expect(unescape('"back\\\nslash"', 'shell')).toBe('backslash');
  });

  it('reports unterminated quotes and trailing backslashes', () => {
    expect(() => unescape("'open", 'shell')).toThrow(/Unterminated single quote at offset 0/);
    expect(() => unescape('x "open', 'shell')).toThrow(/Unterminated double quote at offset 2/);
    expect(() => unescape('abc\\', 'shell')).toThrow(/Trailing backslash at offset 3/);
  });
});

describe('regex and sql (escape only)', () => {
  it('escapes every regex metacharacter and the slash delimiter', () => {
    expect(escape('1.5*(a+b)?^$|{x}[y]\\/z', 'regex')).toBe(
      '1\\.5\\*\\(a\\+b\\)\\?\\^\\$\\|\\{x\\}\\[y\\]\\\\\\/z',
    );
    expect(new RegExp(escape('a.b*c', 'regex')).test('a.b*c')).toBe(true);
    expect(new RegExp(escape('a.b*c', 'regex')).test('aXbbc')).toBe(false);
    expect(new RegExp(escape('price: $5 (approx)', 'regex'), 'u').test('price: $5 (approx)')).toBe(
      true,
    );
    expect(escape('word-hyphen_ok', 'regex')).toBe('word-hyphen_ok');
  });

  it('doubles single quotes for SQL and leaves everything else alone', () => {
    expect(escape('O\'Reilly\'s "book"\\n', 'sql')).toBe("O''Reilly''s \"book\"\\n");
  });

  it('refuses to unescape one-way targets with a helpful message', () => {
    expect(() => unescape('a\\.b', 'regex')).toThrow(StringEscapeError);
    expect(() => unescape('a\\.b', 'regex')).toThrow(
      /Regular expression escaping is one-way.*Switch to Escape/,
    );
    expect(() => unescape("O''Reilly", 'sql')).toThrow(/SQL string literal escaping is one-way/);
  });
});
