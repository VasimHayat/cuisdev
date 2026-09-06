import { describe, expect, it } from 'vitest';

import {
  beautify,
  byteLength,
  canMinify,
  CodeFormatError,
  fileNameFor,
  isLanguageId,
  isReady,
  LANGUAGE_IDS,
  LANGUAGES,
  minify,
  minifyHtml,
  minifyJsonText,
  minifyUnavailableMessage,
  normalizeSource,
  prettierConfig,
  SAMPLES,
  savingsPercent,
  toFormatError,
} from './logic';

/** Await a promise that must reject, and hand back the rejection value typed. */
async function rejection<T>(promise: Promise<unknown>): Promise<T> {
  try {
    await promise;
  } catch (err) {
    return err as T;
  }
  throw new Error('expected the promise to reject');
}

describe('language table', () => {
  it('exposes every language with a matching id', () => {
    expect(LANGUAGE_IDS).toEqual(['html', 'css', 'scss', 'javascript', 'typescript', 'json']);
    for (const id of LANGUAGE_IDS) expect(LANGUAGES[id].id).toBe(id);
  });

  it('recognises known language ids and rejects others', () => {
    expect(isLanguageId('scss')).toBe(true);
    expect(isLanguageId('python')).toBe(false);
    expect(isLanguageId('constructor')).toBe(false);
  });

  it('marks TypeScript and SCSS as not minifiable and explains why', () => {
    expect(canMinify('javascript')).toBe(true);
    expect(canMinify('json')).toBe(true);
    expect(canMinify('typescript')).toBe(false);
    expect(canMinify('scss')).toBe(false);
    expect(minifyUnavailableMessage('typescript')).toBe(
      'Minify is not available for TypeScript — compile it to JavaScript first, then minify.',
    );
    expect(minifyUnavailableMessage('scss')).toContain('compile it to CSS first');
    expect(minifyUnavailableMessage('css')).toBeUndefined();
  });

  it('names downloads per language and mode', () => {
    expect(fileNameFor('javascript', 'beautify')).toBe('code.js');
    expect(fileNameFor('javascript', 'minify')).toBe('code.min.js');
    expect(fileNameFor('html', 'minify')).toBe('code.min.html');
    expect(fileNameFor('typescript', 'beautify')).toBe('code.ts');
  });

  it('ships a sample for every language', () => {
    for (const id of LANGUAGE_IDS) expect(SAMPLES[id].trim().length).toBeGreaterThan(40);
  });
});

describe('normalizeSource', () => {
  it('strips a BOM and normalises CRLF and lone CR', () => {
    expect(normalizeSource('﻿a\r\nb\rc')).toBe('a\nb\nc');
  });

  it('leaves plain LF text alone', () => {
    expect(normalizeSource('a\nb')).toBe('a\nb');
  });
});

describe('byteLength and savingsPercent', () => {
  it('counts UTF-8 bytes, not code units', () => {
    expect(byteLength('abc')).toBe(3);
    expect(byteLength('héllo — 😀')).toBe(15);
  });

  it('reports the share of bytes removed', () => {
    expect(savingsPercent(100, 40)).toBe(60);
    expect(savingsPercent(1000, 333)).toBe(66.7);
    expect(savingsPercent(0, 0)).toBe(0);
    expect(savingsPercent(100, 100)).toBe(0);
    expect(savingsPercent(100, 120)).toBe(-20);
  });
});

describe('prettierConfig', () => {
  it('defaults to two spaces, 80 columns, semicolons and trailing commas', () => {
    expect(prettierConfig('javascript')).toEqual({
      parser: 'babel',
      tabWidth: 2,
      useTabs: false,
      printWidth: 80,
      singleQuote: false,
      semi: true,
      trailingComma: 'all',
      endOfLine: 'lf',
    });
  });

  it('maps tab indentation and the remaining options', () => {
    const config = prettierConfig('typescript', {
      indent: 'tab',
      printWidth: 120,
      singleQuote: true,
      semicolons: false,
      trailingCommas: false,
    });
    expect(config).toMatchObject({
      parser: 'typescript',
      useTabs: true,
      tabWidth: 2,
      printWidth: 120,
      singleQuote: true,
      semi: false,
      trailingComma: 'none',
    });
  });

  it('uses the postcss parsers for CSS and SCSS', () => {
    expect(prettierConfig('css').parser).toBe('css');
    expect(prettierConfig('scss', { indent: 4 }).parser).toBe('scss');
    expect(prettierConfig('scss', { indent: 4 }).tabWidth).toBe(4);
  });
});

describe('minifyHtml', () => {
  it('drops whitespace-only gaps between tags', () => {
    expect(minifyHtml('<ul>\n  <li>one</li>\n  <li>two</li>\n</ul>')).toBe(
      '<ul><li>one</li><li>two</li></ul>',
    );
  });

  it('collapses runs of whitespace inside text', () => {
    expect(minifyHtml('<p>hello    big\n  world</p>')).toBe('<p>hello big world</p>');
  });

  it('keeps a single space where text is padded around a tag', () => {
    expect(minifyHtml('<p>a <b>b</b> c</p>')).toBe('<p>a <b>b</b> c</p>');
  });

  it('removes comments but keeps conditional ones', () => {
    expect(minifyHtml('<p>a</p><!-- drop me --><p>b</p>')).toBe('<p>a</p><p>b</p>');
    expect(minifyHtml('<!--[if lt IE 9]><script src="s.js"></script><![endif]-->')).toBe(
      '<!--[if lt IE 9]><script src="s.js"></script><![endif]-->',
    );
    expect(minifyHtml('<!--<![endif]-->')).toBe('<!--<![endif]-->');
  });

  it('preserves the contents of pre, textarea, script and style', () => {
    expect(minifyHtml('<pre>  a   b\n  c</pre>')).toBe('<pre>  a   b\n  c</pre>');
    expect(minifyHtml('<textarea>\n  keep  me\n</textarea>')).toBe(
      '<textarea>\n  keep  me\n</textarea>',
    );
    expect(minifyHtml('<script>\n  var a = "  x  ";\n</script>')).toBe(
      '<script>\n  var a = "  x  ";\n</script>',
    );
    expect(minifyHtml('<style>\n  a { color : red }\n</style>')).toBe(
      '<style>\n  a { color : red }\n</style>',
    );
  });

  it('collapses whitespace between attributes without touching values', () => {
    expect(minifyHtml('<a   href="/a  b"\n   class="x"  >link</a>')).toBe(
      '<a href="/a  b" class="x">link</a>',
    );
  });

  it('keeps the doctype and self-closing tags', () => {
    expect(minifyHtml('<!doctype   html>\n<br />\n<img src="a.png" />')).toBe(
      '<!doctype html><br /><img src="a.png" />',
    );
  });

  it('survives unterminated comments, tags and raw-text elements', () => {
    expect(minifyHtml('<p>a</p><!-- never closed')).toBe('<p>a</p>');
    expect(minifyHtml('<div class="x"')).toBe('<div class="x"');
    expect(minifyHtml('<script>var a = 1;')).toBe('<script>var a = 1;');
    expect(minifyHtml('a < b')).toBe('a < b');
  });

  it('handles empty input and CRLF sources', () => {
    expect(minifyHtml('')).toBe('');
    expect(minifyHtml('   \n  ')).toBe('');
    expect(minifyHtml('<p>a</p>\r\n<p>b</p>')).toBe('<p>a</p><p>b</p>');
  });
});

describe('minifyJsonText', () => {
  it('removes all insignificant whitespace', () => {
    expect(minifyJsonText('{\n  "a": [1, 2],\n  "b": "x y"\n}')).toBe('{"a":[1,2],"b":"x y"}');
  });

  it('returns an empty string for blank input', () => {
    expect(minifyJsonText('   ')).toBe('');
  });

  it('reports the line and column of a syntax error', () => {
    try {
      minifyJsonText('{\n  "a": 1,\n}');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(CodeFormatError);
      const error = err as CodeFormatError;
      expect(error.message).toContain('JSON syntax error');
      expect(error.message).toMatch(/line 3, column \d+/);
      expect(error.position?.line).toBe(3);
      expect(error.position?.offset).toBeGreaterThan(0);
    }
  });

  it('preserves unicode and escapes', () => {
    expect(minifyJsonText('{ "emoji": "😀", "tab": "a\\tb" }')).toBe(
      '{"emoji":"😀","tab":"a\\tb"}',
    );
  });
});

describe('toFormatError', () => {
  it('keeps only the first line of a Prettier code frame and adds the position', () => {
    const error = toFormatError(
      {
        message: 'Unexpected token (2:7)\n> 2 | const\n    |       ^',
        loc: { start: { line: 2, column: 7 } },
      },
      'const a = 1;\nconst',
      'javascript',
    );
    expect(error).toBeInstanceOf(CodeFormatError);
    expect(error.message).toBe('JavaScript syntax error: Unexpected token (line 2, column 7)');
    expect(error.position).toEqual({ line: 2, column: 7, offset: 18 });
  });

  it('understands terser line/col properties and csso message prefixes', () => {
    expect(
      toFormatError({ message: 'Unexpected token: eof', line: 1, col: 3 }, 'a{', 'javascript'),
    ).toMatchObject({ position: { line: 1, column: 3 } });
    expect(
      toFormatError({ message: 'CssSyntaxError: Unclosed block (1:1)' }, 'a{', 'css').message,
    ).toBe('CSS syntax error: Unclosed block');
  });

  it('falls back to a generic message and passes CodeFormatError through', () => {
    expect(toFormatError({}, '', 'html').message).toBe(
      'HTML syntax error: the input could not be parsed',
    );
    const original = new CodeFormatError('already wrapped');
    expect(toFormatError(original, '', 'html')).toBe(original);
  });
});

describe('beautify (Prettier, loaded on demand)', () => {
  it('formats JavaScript with the chosen quote and semicolon options', async () => {
    const out = await beautify('const a={b:1,c:[1,2]}', 'javascript', {
      singleQuote: true,
      semicolons: false,
    });
    expect(out).toBe('const a = { b: 1, c: [1, 2] }\n');
  });

  it('honours indentation and print width', async () => {
    const wide = await beautify('const list=[111,222,333,444];', 'javascript', {
      indent: 4,
      printWidth: 80,
    });
    expect(wide).toBe('const list = [111, 222, 333, 444];\n');
    const narrow = await beautify('function f(alpha,beta){return alpha+beta}', 'javascript', {
      indent: 'tab',
    });
    expect(narrow).toContain('\treturn alpha + beta;');
  });

  it('formats HTML, CSS, SCSS, TypeScript and JSON', async () => {
    expect(await beautify('<div><p>x</p></div>', 'html')).toContain('<p>x</p>');
    expect(await beautify('a{color:red}', 'css')).toBe('a {\n  color: red;\n}\n');
    expect(await beautify('.a{.b{color:red}}', 'scss')).toContain('.b {');
    expect(await beautify('const x:number=1', 'typescript')).toBe('const x: number = 1;\n');
    expect(await beautify('{"a":[1,2]}', 'json')).toContain('"a": [1, 2]');
  });

  it('returns an empty string for blank input without loading anything', async () => {
    expect(await beautify('   \n ', 'html')).toBe('');
  });

  it('throws a located CodeFormatError for invalid JavaScript', async () => {
    await expect(beautify('const a = {', 'javascript')).rejects.toBeInstanceOf(CodeFormatError);
    const error = await rejection<CodeFormatError>(beautify('const a = {', 'javascript'));
    expect(error.message).toMatch(/^JavaScript syntax error: .*line 1, column \d+\)$/);
    expect(error.position?.line).toBe(1);
  });

  it('throws for invalid CSS', async () => {
    await expect(beautify('a{color:', 'css')).rejects.toThrow(/CSS syntax error/);
  });

  it('reports which language and mode are already downloaded', async () => {
    await beautify('a{color:red}', 'css');
    expect(isReady('css', 'beautify')).toBe(true);
    expect(isReady('typescript', 'minify')).toBe(true);
    expect(isReady('html', 'minify')).toBe(true);
  });
});

describe('minify', () => {
  it('minifies JavaScript with terser', async () => {
    const out = await minify(
      'function hi(name){ const greet = "hi " + name; return greet; }',
      'javascript',
    );
    expect(out).toContain('function hi(');
    expect(out.length).toBeLessThan(50);
    expect(out).not.toContain('\n');
  });

  it('minifies CSS with csso', async () => {
    expect(await minify('a { color : red; }  /* gone */ b {}', 'css')).toBe('a{color:red}');
  });

  it('minifies HTML and JSON without a library', async () => {
    expect(await minify('<p>  a  </p>\n<p>b</p>', 'html')).toBe('<p> a </p><p>b</p>');
    expect(await minify('{ "a" : 1 }', 'json')).toBe('{"a":1}');
  });

  it('refuses TypeScript and SCSS with a specific message', async () => {
    await expect(minify('const a = 1', 'typescript')).rejects.toThrow(
      /not available for TypeScript/,
    );
    await expect(minify('.a{color:red}', 'scss')).rejects.toThrow(/not available for SCSS/);
  });

  it('reports terser syntax errors with a position', async () => {
    const error = await rejection<CodeFormatError>(minify('const a = {', 'javascript'));
    expect(error).toBeInstanceOf(CodeFormatError);
    expect(error.message).toContain('JavaScript syntax error');
    expect(error.position?.line).toBe(1);
  });

  it('returns an empty string for blank input', async () => {
    expect(await minify('', 'javascript')).toBe('');
    expect(await minify('  \n', 'css')).toBe('');
  });

  it('minifies every sample it claims to support', async () => {
    for (const id of LANGUAGE_IDS) {
      if (!canMinify(id)) continue;
      const out = await minify(SAMPLES[id], id);
      expect(byteLength(out)).toBeLessThan(byteLength(SAMPLES[id]));
    }
  });
});
