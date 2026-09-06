import { describe, expect, it } from 'vitest';

import {
  LIMITS,
  MAX_CHARS,
  MAX_WPM,
  SAMPLE,
  STOP_WORDS,
  WordCounterError,
  analyze,
  assertValidWpm,
  assertWithinLimit,
  byteSize,
  countCharacters,
  countCharactersNoSpaces,
  countLines,
  countParagraphs,
  formatDuration,
  formatStatsText,
  limitStatus,
  splitSentences,
  splitSentencesRegex,
  splitWords,
  splitWordsRegex,
  topWords,
} from './logic';

describe('splitWordsRegex (fallback path)', () => {
  it('counts words separated by spaces and punctuation', () => {
    expect(splitWordsRegex('Hello, world! Again.')).toEqual(['Hello', 'world', 'Again']);
  });

  it('keeps contractions and hyphenated words as one word', () => {
    expect(splitWordsRegex("don't stop state-of-the-art")).toEqual([
      "don't",
      'stop',
      'state-of-the-art',
    ]);
  });

  it('counts numbers and accented words', () => {
    expect(splitWordsRegex('42 Grüße für dich')).toEqual(['42', 'Grüße', 'für', 'dich']);
  });

  it('returns an empty array for whitespace or punctuation only', () => {
    expect(splitWordsRegex('   \n\t ')).toEqual([]);
    expect(splitWordsRegex('--- ...')).toEqual([]);
  });
});

describe('splitWords', () => {
  it('agrees with the fallback on plain English text', () => {
    const text = 'The quick brown fox jumps over the lazy dog';
    expect(splitWords(text)).toHaveLength(9);
    expect(splitWords(text, false)).toHaveLength(9);
  });
});

describe('splitSentencesRegex (fallback path)', () => {
  it('splits on ., ! and ?', () => {
    expect(splitSentencesRegex('One. Two! Three? Four')).toHaveLength(4);
  });

  it('splits on line breaks and ignores empty fragments', () => {
    expect(splitSentencesRegex('First line\n\nSecond line\n')).toEqual([
      'First line',
      'Second line',
    ]);
  });

  it('keeps a closing quote with the sentence it ends', () => {
    expect(splitSentencesRegex('"Stop!" she said. Then she left.')).toEqual([
      '"Stop!"',
      'she said.',
      'Then she left.',
    ]);
  });
});

describe('splitSentences', () => {
  it('counts three sentences either way', () => {
    const text = 'First one. Second one! Third one?';
    expect(splitSentences(text)).toHaveLength(3);
    expect(splitSentences(text, false)).toHaveLength(3);
  });
});

describe('counters', () => {
  it('counts characters by code point, so an emoji is one character', () => {
    expect(countCharacters('ab 👋')).toBe(4);
    expect(countCharactersNoSpaces('ab 👋')).toBe(3);
  });

  it('counts paragraphs separated by blank lines', () => {
    expect(countParagraphs('one\ntwo\n\nthree')).toBe(2);
    expect(countParagraphs('')).toBe(0);
  });

  it('counts lines, ignoring one trailing newline and normalising CRLF', () => {
    expect(countLines('a\nb\n')).toBe(2);
    expect(countLines('a\r\nb')).toBe(2);
    expect(countLines('')).toBe(0);
  });

  it('measures UTF-8 byte size', () => {
    expect(byteSize('abc')).toBe(3);
    expect(byteSize('é')).toBe(2);
    expect(byteSize('👋')).toBe(4);
  });
});

describe('topWords', () => {
  const words = 'the cat sat on the mat the cat ran'.split(' ');

  it('excludes stop words by default and ranks by count', () => {
    const top = topWords(words);
    expect(top[0]).toEqual({ word: 'cat', count: 2, percent: 22.2 });
    expect(top.some((entry) => entry.word === 'the')).toBe(false);
  });

  it('includes stop words when asked', () => {
    const top = topWords(words, { excludeStopWords: false });
    expect(top[0]?.word).toBe('the');
    expect(top[0]?.count).toBe(3);
  });

  it('is case-insensitive and honours the limit', () => {
    expect(topWords(['Cat', 'cat', 'CAT'], { limit: 1 })).toEqual([
      { word: 'cat', count: 3, percent: 100 },
    ]);
  });

  it('breaks ties alphabetically and returns nothing for no words', () => {
    const top = topWords(['pear', 'apple'], { limit: 2 });
    expect(top.map((entry) => entry.word)).toEqual(['apple', 'pear']);
    expect(topWords([])).toEqual([]);
  });

  it('ships a stop-word list containing the usual suspects', () => {
    expect(STOP_WORDS.has('the')).toBe(true);
    expect(STOP_WORDS.has('elephant')).toBe(false);
  });
});

describe('limits', () => {
  it('exposes the four platform limits', () => {
    expect(LIMITS.map((limit) => limit.max)).toEqual([280, 160, 160, 60]);
  });

  it('reports remaining characters and going over', () => {
    expect(limitStatus(100, 280)).toEqual({ used: 100, remaining: 180, over: false });
    expect(limitStatus(300, 280)).toEqual({ used: 300, remaining: -20, over: true });
    expect(limitStatus(280, 280).over).toBe(false);
  });
});

describe('formatDuration', () => {
  it('formats seconds, whole minutes and mixed durations', () => {
    expect(formatDuration(0)).toBe('0 sec');
    expect(formatDuration(45)).toBe('45 sec');
    expect(formatDuration(60)).toBe('1 min');
    expect(formatDuration(150)).toBe('2 min 30 sec');
  });
});

describe('analyze', () => {
  const text = 'The quick brown fox. The dog sleeps.';

  it('produces the headline counts', () => {
    const stats = analyze(text);
    expect(stats.words).toBe(7);
    expect(stats.uniqueWords).toBe(6);
    expect(stats.sentences).toBe(2);
    expect(stats.paragraphs).toBe(1);
    expect(stats.lines).toBe(1);
    expect(stats.characters).toBe(36);
    expect(stats.charactersNoSpaces).toBe(30);
  });

  it('reports the longest word and the average word length', () => {
    const stats = analyze('a bb cccc');
    expect(stats.longestWord).toBe('cccc');
    expect(stats.averageWordLength).toBe(2.3);
  });

  it('returns zeroes for empty text', () => {
    const stats = analyze('');
    expect(stats).toMatchObject({
      characters: 0,
      words: 0,
      uniqueWords: 0,
      sentences: 0,
      paragraphs: 0,
      lines: 0,
      averageWordLength: 0,
      longestWord: '',
      readingSeconds: 0,
      speakingSeconds: 0,
    });
  });

  it('scales reading and speaking time with the words per minute', () => {
    const words = Array.from({ length: 400 }, () => 'word').join(' ');
    expect(analyze(words, { readingWpm: 200 }).readingSeconds).toBe(120);
    expect(analyze(words, { readingWpm: 250 }).readingSeconds).toBe(96);
    expect(analyze(words).speakingSeconds).toBe(Math.round((400 / 130) * 60));
  });

  it('gives the same counts with the regex fallback as with Intl.Segmenter', () => {
    const withSegmenter = analyze(SAMPLE);
    const withoutSegmenter = analyze(SAMPLE, { useSegmenter: false });
    expect(withoutSegmenter.words).toBe(withSegmenter.words);
    expect(withoutSegmenter.sentences).toBe(withSegmenter.sentences);
  });

  it('can keep stop words in the top-words table', () => {
    const stats = analyze('the the the cat', { excludeStopWords: false, topWordCount: 1 });
    expect(stats.top).toEqual([{ word: 'the', count: 3, percent: 75 }]);
  });

  it('rejects an out-of-range reading speed', () => {
    expect(() => analyze('hi', { readingWpm: 0 })).toThrow(WordCounterError);
    expect(() => analyze('hi', { readingWpm: MAX_WPM + 1 })).toThrow(
      /between 50 and 1000 words per minute/,
    );
    expect(() => assertValidWpm(Number.NaN)).toThrow(WordCounterError);
    expect(() => assertValidWpm(200)).not.toThrow();
  });

  it('rejects text over the size limit', () => {
    expect(() => assertWithinLimit('a'.repeat(MAX_CHARS))).not.toThrow();
    expect(() => analyze('a'.repeat(MAX_CHARS + 1))).toThrow(/The limit is 1,000,000/);
  });

  it('counts the built-in sample as two paragraphs', () => {
    const stats = analyze(SAMPLE);
    expect(stats.paragraphs).toBe(2);
    expect(stats.lines).toBe(5);
    expect(stats.words).toBeGreaterThan(50);
  });
});

describe('formatStatsText', () => {
  it('renders a labelled report including the top words', () => {
    const text = formatStatsText(analyze('cat cat dog. The end.'));
    expect(text).toContain('Words: 5');
    expect(text).toContain('Sentences: 2');
    expect(text).toContain('Reading time (200 wpm):');
    expect(text).toContain('Top words:');
    expect(text).toContain('cat: 2');
  });

  it('shows a dash when there is no longest word', () => {
    expect(formatStatsText(analyze(''))).toContain('Longest word: —');
  });
});
