import { describe, expect, it } from 'vitest';

import {
  CLASSIC_SENTENCE,
  CLASSIC_WORDS,
  FORMAT_EXTENSIONS,
  FORMAT_MIME_TYPES,
  LOREM_FORMATS,
  LOREM_UNITS,
  LoremError,
  MAX_COUNT,
  WORDS,
  capitalize,
  countWords,
  formatItems,
  generateItems,
  generateLorem,
  generateParagraph,
  generateSentence,
  mulberry32,
  pickWords,
  randomInt,
  randomSeed,
  validateOptions,
} from './logic';

describe('vocabulary', () => {
  it('ships roughly 200 unique lowercase words', () => {
    expect(WORDS.length).toBeGreaterThanOrEqual(200);
    expect(new Set(WORDS).size).toBe(WORDS.length);
    for (const w of WORDS) expect(w).toMatch(/^[a-z]+$/);
  });

  it('classic opening words match the classic sentence', () => {
    expect(CLASSIC_SENTENCE.startsWith(CLASSIC_WORDS.join(' ').replace('amet', 'amet,'))).toBe(
      true,
    );
  });
});

describe('mulberry32', () => {
  it('is deterministic for a seed and produces floats in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    expect(mulberry32(42)()).toBeCloseTo(0.6011037519201636, 12);
  });

  it('different seeds give different sequences', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it('coerces non-integer and negative seeds to uint32', () => {
    expect(mulberry32(1.9)()).toBe(mulberry32(1)());
    expect(mulberry32(-1)()).toBe(mulberry32(0xffffffff)());
  });
});

describe('randomInt / randomSeed', () => {
  it('stays within the inclusive range and hits both ends', () => {
    const rng = mulberry32(9);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const n = randomInt(rng, 3, 6);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(6);
      seen.add(n);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it('randomSeed returns a uint32-range integer', () => {
    const s = randomSeed();
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThan(0x100000000);
  });
});

describe('pickWords', () => {
  it('returns the requested number of vocabulary words', () => {
    const words = pickWords(mulberry32(5), 50);
    expect(words).toHaveLength(50);
    for (const w of words) expect(WORDS).toContain(w);
  });

  it('never repeats a word twice in a row, including against `previous`', () => {
    const words = pickWords(mulberry32(11), 500, ['a', 'b'], 'a');
    expect(words[0]).toBe('b');
    for (let i = 1; i < words.length; i++) expect(words[i]).not.toBe(words[i - 1]);
  });

  it('allows repeats when the vocabulary has a single word', () => {
    expect(pickWords(mulberry32(1), 3, ['solo'])).toEqual(['solo', 'solo', 'solo']);
  });

  it('rejects an empty vocabulary', () => {
    expect(() => pickWords(mulberry32(1), 3, [])).toThrow(LoremError);
    expect(() => pickWords(mulberry32(1), 3, [])).toThrow(/vocabulary must not be empty/);
  });

  it('returns nothing for a zero count', () => {
    expect(pickWords(mulberry32(1), 0)).toEqual([]);
  });
});

describe('capitalize', () => {
  it('upper-cases only the first character', () => {
    expect(capitalize('lorem ipsum')).toBe('Lorem ipsum');
    expect(capitalize('')).toBe('');
    expect(capitalize('Ünïcode')).toBe('Ünïcode');
  });
});

describe('generateSentence', () => {
  it('is exact for a seed', () => {
    expect(generateSentence(mulberry32(1))).toBe(
      'Lorem hac conubia sociosqu deserunt, massa phasellus efficitur aptent eros felis.',
    );
    expect(generateSentence(mulberry32(7))).toBe(
      'Incididunt torquent orci habitant diam facilisi.',
    );
  });

  it('has 6–14 words, starts with a capital, ends with a period, at most one comma', () => {
    const rng = mulberry32(2024);
    for (let i = 0; i < 300; i++) {
      const s = generateSentence(rng);
      const words = s.split(' ');
      expect(words.length).toBeGreaterThanOrEqual(6);
      expect(words.length).toBeLessThanOrEqual(14);
      expect(s).toMatch(/^[A-Z][a-z]* /);
      expect(s.endsWith('.')).toBe(true);
      expect((s.match(/,/g) ?? []).length).toBeLessThanOrEqual(1);
      // A comma never sits on the first two words or the last word before the period.
      expect(s).not.toMatch(/^\S+,|^\S+ \S+,|,\s\S+\.$/);
    }
  });

  it('sometimes uses a comma and sometimes does not', () => {
    const rng = mulberry32(77);
    const sentences = Array.from({ length: 100 }, () => generateSentence(rng));
    expect(sentences.some((s) => s.includes(','))).toBe(true);
    expect(sentences.some((s) => !s.includes(','))).toBe(true);
  });
});

describe('generateParagraph', () => {
  it('contains 4–8 sentences joined by single spaces', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 200; i++) {
      const p = generateParagraph(rng);
      const sentences = p.split('. ');
      expect(sentences.length).toBeGreaterThanOrEqual(4);
      expect(sentences.length).toBeLessThanOrEqual(8);
      expect(p).not.toMatch(/\s{2}|\n/);
    }
  });

  it('uses the supplied opening sentence first', () => {
    const p = generateParagraph(mulberry32(3), CLASSIC_SENTENCE);
    expect(p.startsWith(`${CLASSIC_SENTENCE} `)).toBe(true);
  });
});

describe('validateOptions', () => {
  it('fills in defaults', () => {
    const opts = validateOptions({ unit: 'words', count: 5, seed: 1 });
    expect(opts).toEqual({
      unit: 'words',
      count: 5,
      startWithLorem: true,
      format: 'plain',
      seed: 1,
    });
  });

  it('assigns a random seed when none is given', () => {
    const opts = validateOptions({ unit: 'words', count: 1 });
    expect(Number.isInteger(opts.seed)).toBe(true);
  });

  it('rejects an unknown unit', () => {
    expect(() => validateOptions({ unit: 'lines' as never, count: 1 })).toThrow(
      /Unknown unit "lines"/,
    );
  });

  it('rejects an unknown format', () => {
    expect(() => validateOptions({ unit: 'words', count: 1, format: 'yaml' as never })).toThrow(
      /Unknown format "yaml"/,
    );
  });

  it('rejects non-integer, NaN and out-of-range counts with specific messages', () => {
    expect(() => validateOptions({ unit: 'words', count: 2.5 })).toThrow(/whole number/);
    expect(() => validateOptions({ unit: 'words', count: Number.NaN })).toThrow(/whole number/);
    expect(() => validateOptions({ unit: 'words', count: 0 })).toThrow(
      /between 1 and 100 words — got 0/,
    );
    expect(() => validateOptions({ unit: 'paragraphs', count: MAX_COUNT + 1 })).toThrow(
      /between 1 and 100 paragraphs — got 101/,
    );
    expect(() => validateOptions({ unit: 'words', count: 0 })).toThrow(LoremError);
  });

  it('rejects a non-finite seed', () => {
    expect(() => validateOptions({ unit: 'words', count: 1, seed: Infinity })).toThrow(
      /Seed must be a finite number/,
    );
  });
});

describe('generateItems', () => {
  it('words: starts with the classic opening then continues from the vocabulary', () => {
    const items = generateItems({ unit: 'words', count: 12, seed: 42 });
    expect(items.slice(0, 8)).toEqual([...CLASSIC_WORDS]);
    expect(items).toEqual([...CLASSIC_WORDS, 'luctus', 'erat', 'suscipit', 'netus']);
  });

  it('words: truncates the classic opening for tiny counts', () => {
    expect(generateItems({ unit: 'words', count: 3, seed: 1 })).toEqual([
      'Lorem',
      'ipsum',
      'dolor',
    ]);
  });

  it('words: without the classic opening everything is from the vocabulary', () => {
    const items = generateItems({ unit: 'words', count: 5, seed: 42, startWithLorem: false });
    expect(items).toEqual(['luctus', 'erat', 'suscipit', 'netus', 'aute']);
  });

  it('sentences: first item is the classic sentence when requested', () => {
    const items = generateItems({ unit: 'sentences', count: 2, seed: 42 });
    expect(items[0]).toBe(CLASSIC_SENTENCE);
    expect(items[1]).toBe(
      'Erat suscipit netus aute hac qui mauris tempus facilisis cupidatat tristique.',
    );
    const plain = generateItems({ unit: 'sentences', count: 2, seed: 42, startWithLorem: false });
    expect(plain[0]).not.toBe(CLASSIC_SENTENCE);
  });

  it('paragraphs: the first paragraph opens with the classic sentence', () => {
    const items = generateItems({ unit: 'paragraphs', count: 3, seed: 42 });
    expect(items).toHaveLength(3);
    expect(items[0]?.startsWith(CLASSIC_SENTENCE)).toBe(true);
    expect(items[1]?.startsWith('Lorem ipsum dolor')).toBe(false);
  });

  it('paragraphs: without the classic opening no paragraph is forced to start with it', () => {
    const items = generateItems({ unit: 'paragraphs', count: 1, seed: 42, startWithLorem: false });
    expect(items[0]?.startsWith(CLASSIC_SENTENCE)).toBe(false);
  });

  it('handles the maximum count quickly', () => {
    const start = performance.now();
    const items = generateItems({ unit: 'paragraphs', count: MAX_COUNT, seed: 5 });
    expect(items).toHaveLength(MAX_COUNT);
    expect(performance.now() - start).toBeLessThan(500);
  });
});

describe('formatItems', () => {
  const paragraphs = ['Alpha beta.', 'Gamma <delta> & epsilon.'];
  const sentences = ['One two.', 'Three four.'];
  const words = ['one', 'two'];

  it('plain and markdown separate paragraphs by a blank line and join other units by spaces', () => {
    expect(formatItems(paragraphs, 'paragraphs', 'plain')).toBe(
      'Alpha beta.\n\nGamma <delta> & epsilon.',
    );
    expect(formatItems(paragraphs, 'paragraphs', 'markdown')).toBe(
      'Alpha beta.\n\nGamma <delta> & epsilon.',
    );
    expect(formatItems(sentences, 'sentences', 'plain')).toBe('One two. Three four.');
    expect(formatItems(words, 'words', 'markdown')).toBe('one two');
  });

  it('html wraps each paragraph in <p> and escapes special characters', () => {
    expect(formatItems(paragraphs, 'paragraphs', 'html')).toBe(
      '<p>Alpha beta.</p>\n<p>Gamma &lt;delta&gt; &amp; epsilon.</p>',
    );
    expect(formatItems(sentences, 'sentences', 'html')).toBe('<p>One two. Three four.</p>');
    expect(formatItems(words, 'words', 'html')).toBe('<p>one two</p>');
  });

  it('json emits a pretty-printed array of items', () => {
    const json = formatItems(sentences, 'sentences', 'json');
    expect(JSON.parse(json)).toEqual(sentences);
    expect(json).toBe('[\n  "One two.",\n  "Three four."\n]');
  });

  it('handles an empty item list', () => {
    expect(formatItems([], 'paragraphs', 'plain')).toBe('');
    expect(formatItems([], 'words', 'json')).toBe('[]');
  });
});

describe('countWords', () => {
  it('counts whitespace-separated tokens across items', () => {
    expect(countWords(['Alpha beta.', 'Gamma  delta\tepsilon.'])).toBe(5);
    expect(countWords(['one', 'two'])).toBe(2);
    expect(countWords([])).toBe(0);
    expect(countWords([''])).toBe(0);
  });
});

describe('generateLorem', () => {
  it('is fully deterministic for a seed (exact output)', () => {
    const result = generateLorem({ unit: 'sentences', count: 2, seed: 42 });
    expect(result.output).toBe(
      `${CLASSIC_SENTENCE} Erat suscipit netus aute hac qui mauris tempus facilisis cupidatat tristique.`,
    );
    expect(result.seed).toBe(42);
    expect(generateLorem({ unit: 'sentences', count: 2, seed: 42 })).toEqual(result);
  });

  it('reports word and character stats', () => {
    const result = generateLorem({ unit: 'paragraphs', count: 2, seed: 42 });
    expect(result.items).toHaveLength(2);
    expect(result.words).toBe(141);
    expect(result.characters).toBe(1029);
    expect(result.characters).toBe(result.output.length);
    expect(result.output.startsWith(CLASSIC_SENTENCE)).toBe(true);
  });

  it('words unit yields exactly `count` words in every format', () => {
    for (const format of LOREM_FORMATS) {
      const result = generateLorem({ unit: 'words', count: 25, seed: 8, format });
      expect(result.items).toHaveLength(25);
      expect(result.words).toBe(25);
    }
  });

  it('html output for sentences is a single paragraph', () => {
    const result = generateLorem({
      unit: 'sentences',
      count: 2,
      seed: 42,
      startWithLorem: false,
      format: 'html',
    });
    expect(result.output).toBe(
      '<p>Erat suscipit netus aute hac qui mauris tempus facilisis cupidatat tristique. Velit finibus nunc, malesuada lorem facilisis senectus eiusmod.</p>',
    );
  });

  it('json output round-trips to the items', () => {
    const result = generateLorem({ unit: 'paragraphs', count: 4, seed: 3, format: 'json' });
    expect(JSON.parse(result.output)).toEqual(result.items);
  });

  it('different seeds produce different text', () => {
    const a = generateLorem({ unit: 'paragraphs', count: 1, seed: 1, startWithLorem: false });
    const b = generateLorem({ unit: 'paragraphs', count: 1, seed: 2, startWithLorem: false });
    expect(a.output).not.toBe(b.output);
  });

  it('propagates validation errors', () => {
    expect(() => generateLorem({ unit: 'words', count: 101 })).toThrow(LoremError);
  });

  it('covers every unit', () => {
    for (const unit of LOREM_UNITS) {
      expect(generateLorem({ unit, count: 2, seed: 1 }).items).toHaveLength(2);
    }
  });
});

describe('format tables', () => {
  it('map every format to an extension and MIME type', () => {
    for (const format of LOREM_FORMATS) {
      expect(FORMAT_EXTENSIONS[format]).toMatch(/^[a-z]+$/);
      expect(FORMAT_MIME_TYPES[format]).toMatch(/^[a-z]+\/[a-z-]+$/);
    }
    expect(FORMAT_EXTENSIONS.markdown).toBe('md');
    expect(FORMAT_MIME_TYPES.json).toBe('application/json');
  });
});
