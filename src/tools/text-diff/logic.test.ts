import { describe, expect, it } from 'vitest';

import {
  MAX_CHARS_FOR_CHARACTERS,
  MAX_SEGMENT_CHARS,
  SAMPLE_CHANGED,
  SAMPLE_ORIGINAL,
  TextDiffError,
  assertWithinLimits,
  buildLineOps,
  buildRows,
  computeDiff,
  diffSegments,
  formatStats,
  normalizeLine,
  splitLines,
  toInlineRows,
  toUnifiedDiff,
} from './logic';

describe('splitLines', () => {
  it('returns an empty array for empty text', () => {
    expect(splitLines('')).toEqual([]);
  });

  it('normalises CRLF and lone CR line endings', () => {
    expect(splitLines('a\r\nb\rc')).toEqual(['a', 'b', 'c']);
  });

  it('strips a BOM and a single trailing newline but keeps blank lines', () => {
    expect(splitLines('﻿a\n\nb\n')).toEqual(['a', '', 'b']);
  });
});

describe('normalizeLine', () => {
  it('is a no-op without options', () => {
    expect(normalizeLine('  Hello   World  ')).toBe('  Hello   World  ');
  });

  it('trims and collapses whitespace when ignoreWhitespace is set', () => {
    expect(normalizeLine('  Hello   World  ', { ignoreWhitespace: true })).toBe('Hello World');
  });

  it('lower-cases when ignoreCase is set', () => {
    expect(normalizeLine('Hello', { ignoreCase: true })).toBe('hello');
  });
});

describe('buildLineOps', () => {
  it('marks every line equal for identical text', () => {
    const { ops } = buildLineOps('a\nb', 'a\nb');
    expect(ops.map((op) => op.type)).toEqual(['equal', 'equal']);
    expect(ops[0]).toMatchObject({ oldLine: 1, newLine: 1, oldText: 'a', newText: 'a' });
  });

  it('reports every line as added when the original is empty', () => {
    const { ops } = buildLineOps('', 'a\nb');
    expect(ops.map((op) => op.type)).toEqual(['add', 'add']);
    expect(ops[1]).toMatchObject({ newLine: 2, newText: 'b', oldLine: null });
  });

  it('reports every line as deleted when the changed side is empty', () => {
    const { ops } = buildLineOps('a\nb', '');
    expect(ops.map((op) => op.type)).toEqual(['del', 'del']);
  });

  it('emits deletions before the additions that replace them', () => {
    const { ops } = buildLineOps('one\ntwo\nthree', 'one\nTWO\nthree');
    expect(ops.map((op) => op.type)).toEqual(['equal', 'del', 'add', 'equal']);
    expect(ops[1]?.oldText).toBe('two');
    expect(ops[2]?.newText).toBe('TWO');
  });

  it('does not treat the last line as changed when one text has no trailing newline', () => {
    const { ops } = buildLineOps('alpha\nbravo\ncharlie', 'alpha\nBRAVO\ncharlie\ndelta');
    expect(ops.map((op) => op.type)).toEqual(['equal', 'del', 'add', 'equal', 'add']);
  });

  it('ignores a trailing newline difference between the two texts', () => {
    const { ops } = buildLineOps('a\nb', 'a\nb\n');
    expect(ops.every((op) => op.type === 'equal')).toBe(true);
  });

  it('treats case-only changes as equal with ignoreCase', () => {
    const { ops } = buildLineOps('one\ntwo', 'one\nTWO', { ignoreCase: true });
    expect(ops.every((op) => op.type === 'equal')).toBe(true);
    // The original text of both sides is preserved for display.
    expect(ops[1]).toMatchObject({ oldText: 'two', newText: 'TWO' });
  });

  it('treats indentation-only changes as equal with ignoreWhitespace', () => {
    const { ops } = buildLineOps('a\n  b  ', 'a\nb', { ignoreWhitespace: true });
    expect(ops.every((op) => op.type === 'equal')).toBe(true);
  });

  it('falls back to a full replacement when the edit budget is exhausted', () => {
    const original = Array.from({ length: 40 }, (_, i) => `old-${i}`).join('\n');
    const changed = Array.from({ length: 40 }, (_, i) => `new-${i}`).join('\n');
    const result = buildLineOps(original, changed, { maxEditLength: 1 });
    expect(result.approximate).toBe(true);
    expect(result.ops.filter((op) => op.type === 'del')).toHaveLength(40);
    expect(result.ops.filter((op) => op.type === 'add')).toHaveLength(40);
  });
});

describe('diffSegments', () => {
  it('returns unmarked segments for line granularity', () => {
    const { left, right } = diffSegments('a b', 'a c', 'lines');
    expect(left).toEqual([{ text: 'a b', kind: 'equal' }]);
    expect(right).toEqual([{ text: 'a c', kind: 'equal' }]);
  });

  it('marks changed words for word granularity', () => {
    const { left, right } = diffSegments('the quick fox', 'the slow fox', 'words');
    expect(left.filter((s) => s.kind === 'removed').map((s) => s.text)).toEqual(['quick']);
    expect(right.filter((s) => s.kind === 'added').map((s) => s.text)).toEqual(['slow']);
    expect(left.map((s) => s.text).join('')).toBe('the quick fox');
  });

  it('marks changed characters for character granularity', () => {
    const { right } = diffSegments('cat', 'cart', 'chars');
    expect(right.filter((s) => s.kind === 'added').map((s) => s.text)).toEqual(['r']);
  });

  it('honours ignoreCase inside a line', () => {
    const { right } = diffSegments('Hello world', 'hello WORLD', 'words', { ignoreCase: true });
    expect(right.every((s) => s.kind === 'equal')).toBe(true);
  });

  it('skips segmenting very long lines', () => {
    const long = 'x'.repeat(MAX_SEGMENT_CHARS + 1);
    const { left } = diffSegments(long, `${long}y`, 'chars');
    expect(left).toHaveLength(1);
    expect(left[0]?.kind).toBe('equal');
  });
});

describe('buildRows', () => {
  it('pairs a deletion with the following addition as one changed row', () => {
    const { ops } = buildLineOps('one\ntwo', 'one\ntoo');
    const rows = buildRows(ops, { granularity: 'words' });
    expect(rows.map((r) => r.kind)).toEqual(['equal', 'changed']);
    expect(rows[1]?.left).toMatchObject({ line: 2, text: 'two' });
    expect(rows[1]?.right).toMatchObject({ line: 2, text: 'too' });
  });

  it('leaves unpaired deletions and additions on their own side', () => {
    const { ops } = buildLineOps('a\nb\nc\nd', 'a\nd');
    const rows = buildRows(ops);
    const removed = rows.filter((r) => r.kind === 'removed');
    expect(removed).toHaveLength(2);
    expect(removed.every((r) => r.right === null)).toBe(true);
  });

  it('marks pure insertions as added rows with no left cell', () => {
    const { ops } = buildLineOps('a\nc', 'a\nb\nc');
    const rows = buildRows(ops);
    const added = rows.filter((r) => r.kind === 'added');
    expect(added).toHaveLength(1);
    expect(added[0]?.left).toBeNull();
    expect(added[0]?.right?.text).toBe('b');
  });
});

describe('toInlineRows', () => {
  it('uses +/- signs and one line number per side', () => {
    const { ops } = buildLineOps('one\ntwo', 'one\nTWO');
    const rows = toInlineRows(ops);
    expect(rows.map((r) => r.sign)).toEqual([' ', '-', '+']);
    expect(rows[1]).toMatchObject({ kind: 'removed', oldLine: 2, newLine: null, text: 'two' });
    expect(rows[2]).toMatchObject({ kind: 'added', oldLine: null, newLine: 2, text: 'TWO' });
  });

  it('keeps deletions before additions and carries word highlighting', () => {
    const { ops } = buildLineOps('the quick fox\ntail', 'the slow fox\ntail');
    const rows = toInlineRows(ops, { granularity: 'words' });
    expect(rows.map((r) => r.kind)).toEqual(['removed', 'added', 'equal']);
    expect(rows[0]?.segments.filter((s) => s.kind === 'removed').map((s) => s.text)).toEqual([
      'quick',
    ]);
    expect(rows[1]?.segments.filter((s) => s.kind === 'added').map((s) => s.text)).toEqual([
      'slow',
    ]);
    expect(rows[2]?.segments).toEqual([{ text: 'tail', kind: 'equal' }]);
  });
});

describe('computeDiff', () => {
  it('reports identical text with zero counts', () => {
    const result = computeDiff('same\ntext', 'same\ntext');
    expect(result.identical).toBe(true);
    expect(result.stats).toEqual({ additions: 0, deletions: 0, unchanged: 2 });
  });

  it('counts additions and deletions for the sample config', () => {
    const result = computeDiff(SAMPLE_ORIGINAL, SAMPLE_CHANGED, { granularity: 'words' });
    expect(result.identical).toBe(false);
    expect(result.stats.additions).toBe(5);
    expect(result.stats.deletions).toBe(4);
    expect(result.rows.some((row) => row.kind === 'added')).toBe(true);
  });

  it('throws a helpful error above the character-granularity limit', () => {
    const huge = 'a'.repeat(MAX_CHARS_FOR_CHARACTERS + 1);
    expect(() => computeDiff(huge, 'b', { granularity: 'chars' })).toThrow(TextDiffError);
    expect(() => computeDiff(huge, 'b', { granularity: 'chars' })).toThrow(
      /Character-by-character comparison is limited/,
    );
    // The same input is fine when comparing by line.
    expect(() => computeDiff(huge, 'b', { granularity: 'lines' })).not.toThrow();
  });

  it('names the side that is too large', () => {
    const huge = 'a'.repeat(MAX_CHARS_FOR_CHARACTERS + 1);
    expect(() => assertWithinLimits('b', huge, 'chars')).toThrow(/^Changed is/);
  });

  it('handles a 5,000-line input without exploding', () => {
    const lines = Array.from({ length: 5000 }, (_, i) => `line ${i}`);
    const changed = [...lines];
    changed[2500] = 'line 2500 edited';
    const result = computeDiff(lines.join('\n'), changed.join('\n'));
    expect(result.stats).toEqual({ additions: 1, deletions: 1, unchanged: 4999 });
  });
});

describe('formatStats', () => {
  it('pluralises correctly', () => {
    expect(formatStats({ additions: 1, deletions: 0, unchanged: 2 })).toBe(
      '1 addition · 0 deletions · 2 unchanged lines',
    );
  });
});

describe('toUnifiedDiff', () => {
  it('returns an empty string when nothing changed', () => {
    expect(toUnifiedDiff('a\nb', 'a\nb')).toBe('');
  });

  it('emits standard --- / +++ / @@ headers', () => {
    const patch = toUnifiedDiff('one\ntwo\nthree', 'one\n2\nthree');
    expect(patch.split('\n').slice(0, 3)).toEqual([
      '--- a/original.txt',
      '+++ b/changed.txt',
      '@@ -1,3 +1,3 @@',
    ]);
    expect(patch).toContain('-two');
    expect(patch).toContain('+2');
    expect(patch.endsWith('\n')).toBe(true);
  });

  it('accepts custom file names and context size', () => {
    const original = Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join('\n');
    const changed = original.replace('line 6', 'line six');
    const patch = toUnifiedDiff(original, changed, {
      oldName: 'before.conf',
      newName: 'after.conf',
      context: 1,
    });
    expect(patch).toContain('--- a/before.conf');
    expect(patch).toContain('+++ b/after.conf');
    expect(patch).toContain('@@ -5,3 +5,3 @@');
    // With one line of context only three lines surround the change.
    expect(patch.split('\n').filter((l) => l.startsWith(' '))).toHaveLength(2);
  });

  it('produces separate hunks for far-apart changes', () => {
    const original = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join('\n');
    const changed = original.replace('line 2', 'LINE 2').replace('line 28', 'LINE 28');
    const patch = toUnifiedDiff(original, changed);
    expect(patch.split('\n').filter((l) => l.startsWith('@@'))).toHaveLength(2);
  });

  it('uses a zero-length range when the original is empty', () => {
    expect(toUnifiedDiff('', 'new line')).toContain('@@ -0,0 +1,1 @@');
  });

  it('round-trips: applying the additions reproduces the changed text', () => {
    const patch = toUnifiedDiff(SAMPLE_ORIGINAL, SAMPLE_CHANGED, { context: 100 });
    const rebuilt = patch
      .split('\n')
      .filter((line) => line.startsWith(' ') || line.startsWith('+'))
      .filter((line) => !line.startsWith('+++'))
      .map((line) => line.slice(1))
      .join('\n');
    expect(rebuilt).toBe(SAMPLE_CHANGED);
  });
});
