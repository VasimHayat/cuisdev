import { describe, expect, it } from 'vitest';

import {
  buildRegex,
  captureGroupNames,
  DEFAULT_MATCH_LIMIT,
  describeMatchCount,
  findMatches,
  highlightSegments,
  isGlobal,
  matchesToText,
  normalizeFlags,
  RegexError,
  replaceMatches,
  runRegex,
  validateFlags,
} from './logic';

describe('normalizeFlags', () => {
  it('drops duplicates and whitespace, keeps order', () => {
    expect(normalizeFlags('ggim')).toBe('gim');
    expect(normalizeFlags(' g i ')).toBe('gi');
  });

  it('accepts an array of flags', () => {
    expect(normalizeFlags(['g', 'i', 'g'])).toBe('gi');
    expect(normalizeFlags([])).toBe('');
  });
});

describe('validateFlags', () => {
  it('accepts every supported flag', () => {
    expect(() => validateFlags('gimsy')).not.toThrow();
    expect(() => validateFlags('v')).not.toThrow();
  });

  it('rejects an unknown flag by name', () => {
    expect(() => validateFlags('gq')).toThrow(RegexError);
    expect(() => validateFlags('gq')).toThrow(/Unknown flag "q"/);
  });

  it('rejects u and v together', () => {
    expect(() => validateFlags('uv')).toThrow(/cannot be used together/);
  });
});

describe('buildRegex', () => {
  it('compiles a pattern with flags', () => {
    const re = buildRegex('a.c', 'gi');
    expect(re.source).toBe('a.c');
    expect(re.flags).toBe('gi');
  });

  it('reports the engine message for a syntax error', () => {
    expect(() => buildRegex('(')).toThrow(RegexError);
    expect(() => buildRegex('(')).toThrow(/Invalid regular expression/);
    expect(() => buildRegex('a{2,1}')).toThrow(/Invalid regular expression/);
  });

  it('reports an unterminated character class', () => {
    expect(() => buildRegex('[a-z')).toThrow(/character class/i);
  });
});

describe('captureGroupNames', () => {
  it('numbers plain groups and names named ones', () => {
    expect(captureGroupNames('(\\w+)@(?<domain>\\w+)')).toEqual([undefined, 'domain']);
  });

  it('ignores non-capturing groups and lookarounds', () => {
    expect(captureGroupNames('(?:no)(yes)(?=ahead)(?<!behind)(?<n>x)')).toEqual([undefined, 'n']);
  });

  it('ignores parentheses inside character classes and escapes', () => {
    expect(captureGroupNames('[(]\\((a)')).toEqual([undefined]);
  });

  it('returns an empty list when there are no groups', () => {
    expect(captureGroupNames('\\d+')).toEqual([]);
  });
});

describe('findMatches', () => {
  it('finds every match with the g flag', () => {
    const { matches, truncated } = findMatches('\\d+', 'g', 'a1 bb22 c333');
    expect(matches.map((m) => m.value)).toEqual(['1', '22', '333']);
    expect(matches[0]).toMatchObject({ index: 0, start: 1, end: 2 });
    expect(truncated).toBe(false);
  });

  it('returns only the first match without g', () => {
    expect(findMatches('\\d+', '', 'a1 bb22').matches).toHaveLength(1);
  });

  it('honours the i and m flags', () => {
    expect(findMatches('abc', 'gi', 'ABC abc').matches).toHaveLength(2);
    expect(findMatches('^b', 'gm', 'a\nb\nb').matches).toHaveLength(2);
    expect(findMatches('^b', 'g', 'a\nb').matches).toHaveLength(0);
  });

  it('honours the s flag for dot-matches-newline', () => {
    expect(findMatches('a.b', 'g', 'a\nb').matches).toHaveLength(0);
    expect(findMatches('a.b', 'gs', 'a\nb').matches).toHaveLength(1);
  });

  it('reports numbered and named capture groups with ranges', () => {
    const { matches } = findMatches('(?<user>\\w+)@(\\w+)', 'g', 'ada@example');
    const groups = matches[0]?.groups ?? [];
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ index: 1, name: 'user', label: 'user', value: 'ada' });
    expect(groups[0]).toMatchObject({ start: 0, end: 3 });
    expect(groups[1]).toMatchObject({ index: 2, name: undefined, label: '2', value: 'example' });
  });

  it('marks groups that did not participate', () => {
    const { matches } = findMatches('(a)|(b)', 'g', 'b');
    const groups = matches[0]?.groups ?? [];
    expect(groups[0]).toMatchObject({ value: undefined, start: -1, end: -1 });
    expect(groups[1]).toMatchObject({ value: 'b' });
  });

  it('does not loop forever on zero-length matches', () => {
    const { matches } = findMatches('a*', 'g', 'aab');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.length).toBeLessThan(10);
    expect(matches[0]?.value).toBe('aa');
  });

  it('treats an empty pattern or empty text as no matches', () => {
    expect(findMatches('', 'g', 'abc').matches).toEqual([]);
    expect(findMatches('a', 'g', '').matches).toEqual([]);
  });

  it('stops at the limit and flags truncation', () => {
    const { matches, truncated } = findMatches('a', 'g', 'a'.repeat(50), { limit: 10 });
    expect(matches).toHaveLength(10);
    expect(truncated).toBe(true);
    expect(DEFAULT_MATCH_LIMIT).toBeGreaterThan(100);
  });

  it('handles unicode with the u flag', () => {
    const { matches } = findMatches('\\p{Emoji_Presentation}', 'gu', 'hi 👋 there 🚀');
    expect(matches.map((m) => m.value)).toEqual(['👋', '🚀']);
  });

  it('throws a RegexError for an invalid pattern', () => {
    expect(() => findMatches('(', 'g', 'abc')).toThrow(RegexError);
  });
});

describe('isGlobal', () => {
  it('is true for g or y', () => {
    expect(isGlobal('g')).toBe(true);
    expect(isGlobal('iy')).toBe(true);
    expect(isGlobal('im')).toBe(false);
  });
});

describe('replaceMatches', () => {
  it('expands numbered groups', () => {
    expect(replaceMatches('(\\w+)@(\\w+)', 'g', 'ada@example', '$2/$1')).toBe('example/ada');
  });

  it('expands named groups', () => {
    expect(
      replaceMatches('(?<user>\\w+)@(?<host>\\w+)', 'g', 'ada@example', '$<user> at $<host>'),
    ).toBe('ada at example');
  });

  it('expands $& for the whole match and $$ for a literal dollar', () => {
    expect(replaceMatches('\\d+', 'g', 'a1 b2', '[$&]')).toBe('a[1] b[2]');
    expect(replaceMatches('x', 'g', 'x', '$$')).toBe('$');
  });

  it('replaces only the first match without the g flag', () => {
    expect(replaceMatches('a', '', 'aaa', 'b')).toBe('baa');
    expect(replaceMatches('a', 'g', 'aaa', 'b')).toBe('bbb');
  });

  it('returns the text unchanged for an empty pattern', () => {
    expect(replaceMatches('', 'g', 'abc', 'x')).toBe('abc');
  });

  it('preserves Windows line endings it does not match', () => {
    expect(replaceMatches('b', 'g', 'a\r\nb\r\nc', 'B')).toBe('a\r\nB\r\nc');
  });
});

describe('highlightSegments', () => {
  it('splits text around matches', () => {
    const { matches } = findMatches('\\d+', 'g', 'a1b22c');
    expect(highlightSegments('a1b22c', matches)).toEqual([
      { text: 'a', matchIndex: null },
      { text: '1', matchIndex: 0 },
      { text: 'b', matchIndex: null },
      { text: '22', matchIndex: 1 },
      { text: 'c', matchIndex: null },
    ]);
  });

  it('handles adjacent matches with no text between them', () => {
    const { matches } = findMatches('\\d', 'g', '12');
    expect(highlightSegments('12', matches)).toEqual([
      { text: '1', matchIndex: 0 },
      { text: '2', matchIndex: 1 },
    ]);
  });

  it('skips zero-length matches', () => {
    const segments = highlightSegments('ab', [
      { index: 0, value: '', start: 0, end: 0, groups: [] },
    ]);
    expect(segments).toEqual([{ text: 'ab', matchIndex: null }]);
  });

  it('returns the whole text when nothing matched', () => {
    expect(highlightSegments('abc', [])).toEqual([{ text: 'abc', matchIndex: null }]);
    expect(highlightSegments('', [])).toEqual([]);
  });
});

describe('matchesToText and describeMatchCount', () => {
  it('joins matches one per line', () => {
    const { matches } = findMatches('\\w+', 'g', 'one two');
    expect(matchesToText(matches)).toBe('one\ntwo');
    expect(matchesToText([])).toBe('');
  });

  it('describes the count in English', () => {
    expect(describeMatchCount(0)).toBe('No matches');
    expect(describeMatchCount(1)).toBe('1 match');
    expect(describeMatchCount(7)).toBe('7 matches');
    expect(describeMatchCount(2000, true)).toMatch(/^First 2,000 matches/);
  });
});

describe('runRegex', () => {
  it('returns matches and the replacement in one call', () => {
    const result = runRegex({
      pattern: '(?<n>\\d+)',
      flags: 'g',
      text: 'a1 b22',
      replacement: '<$<n>>',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.matches).toHaveLength(2);
    expect(result.replaced).toBe('a<1> b<22>');
    expect(result.truncated).toBe(false);
  });

  it('omits the replacement when none was requested', () => {
    const result = runRegex({ pattern: 'a', flags: 'g', text: 'aa' });
    expect(result.ok && result.replaced).toBeNull();
  });

  it('reports a syntax error instead of throwing', () => {
    const result = runRegex({ pattern: '(', flags: 'g', text: 'a' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Invalid regular expression/);
  });

  it('reports an unknown flag instead of throwing', () => {
    const result = runRegex({ pattern: 'a', flags: 'q', text: 'a' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Unknown flag "q"/);
  });

  it('respects a custom limit', () => {
    const result = runRegex({ pattern: '.', flags: 'g', text: 'abcdef', limit: 2 });
    expect(result.ok && result.truncated).toBe(true);
  });
});
