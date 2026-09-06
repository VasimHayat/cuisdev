import { describe, expect, it } from 'vitest';

import {
  AMBIGUOUS,
  DEFAULT_SYMBOLS,
  DIGITS,
  LOWERCASE,
  PasswordError,
  UPPERCASE,
  WORDS,
  buildPool,
  characterClasses,
  entropyBits,
  generatePassphrase,
  generatePassword,
  generatePasswords,
  passphraseEntropy,
  passwordEntropy,
  randomInt,
  resolveSeparator,
  shuffle,
  strengthFor,
  uniqueChars,
} from './logic';

/** Deterministic source that returns the given 32-bit values in order, then repeats the last. */
const sequence = (...values: number[]) => {
  let i = 0;
  return (out: Uint32Array) => {
    out[0] = values[Math.min(i, values.length - 1)] as number;
    i++;
    return out;
  };
};

describe('randomInt', () => {
  it('returns values in [0, max) that cover the whole range', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const n = randomInt(7);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7);
      seen.add(n);
    }
    expect(seen.size).toBe(7);
  });

  it('uses rejection sampling: discards draws in the biased top bucket', () => {
    // For max = 3 the limit is 2^32 - (2^32 % 3) = 4294967295. The value
    // 4294967295 must be rejected (it would map to 0 and skew the distribution);
    // the next draw 4 maps to 1.
    const source = sequence(4294967295, 4);
    expect(randomInt(3, source)).toBe(1);
  });

  it('short-circuits for max = 1 without consuming randomness', () => {
    let calls = 0;
    const source = (out: Uint32Array) => {
      calls++;
      return out;
    };
    expect(randomInt(1, source)).toBe(0);
    expect(calls).toBe(0);
  });

  it('rejects invalid bounds with a specific message', () => {
    expect(() => randomInt(0)).toThrow(PasswordError);
    expect(() => randomInt(-5)).toThrow(/between 1 and 2\^32, got -5/);
    expect(() => randomInt(2.5)).toThrow(/got 2.5/);
    expect(() => randomInt(2 ** 33)).toThrow(PasswordError);
  });
});

describe('shuffle', () => {
  it('is a permutation of the input', () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const shuffled = shuffle([...items]);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
  });

  it('is deterministic for an injected source', () => {
    // Every draw returns 0, so each element (from the end) swaps with index 0.
    expect(shuffle(['a', 'b', 'c', 'd'], sequence(0))).toEqual(['b', 'c', 'd', 'a']);
  });
});

describe('character classes and pool', () => {
  it('uniqueChars removes duplicates and keeps first occurrence', () => {
    expect(uniqueChars('aabbcca')).toBe('abc');
    expect(uniqueChars('')).toBe('');
  });

  it('builds classes for the enabled options only', () => {
    expect(characterClasses({ lowercase: true })).toEqual([LOWERCASE]);
    expect(characterClasses({ uppercase: true, digits: true })).toEqual([UPPERCASE, DIGITS]);
    expect(characterClasses({ symbols: true })).toEqual([DEFAULT_SYMBOLS]);
    expect(characterClasses({})).toEqual([]);
  });

  it('excludes ambiguous characters from every class', () => {
    const pool = buildPool({
      lowercase: true,
      uppercase: true,
      digits: true,
      symbols: true,
      excludeAmbiguous: true,
    });
    for (const c of AMBIGUOUS) expect(pool).not.toContain(c);
    expect(pool).toContain('a');
    expect(pool).toContain('2');
  });

  it('uses a custom symbol set, ignoring whitespace and duplicates', () => {
    expect(characterClasses({ symbols: true, symbolSet: '## $$ ' })).toEqual(['#$']);
    // Empty custom set falls back to the default.
    expect(characterClasses({ symbols: true, symbolSet: '   ' })).toEqual([DEFAULT_SYMBOLS]);
  });

  it('buildPool throws a helpful error when nothing is enabled', () => {
    expect(() => buildPool({})).toThrow(PasswordError);
    expect(() => buildPool({ lowercase: false, symbols: false })).toThrow(
      /enable at least one of lowercase, uppercase, digits or symbols/,
    );
    // A custom symbol set made only of ambiguous characters is empty after filtering.
    expect(() => buildPool({ symbols: true, symbolSet: '|', excludeAmbiguous: true })).toThrow(
      PasswordError,
    );
  });
});

describe('generatePassword', () => {
  const has = (re: RegExp) => (s: string) => re.test(s);

  it('defaults to 20 characters with every class present', () => {
    for (let i = 0; i < 50; i++) {
      const pw = generatePassword();
      expect(pw).toHaveLength(20);
      expect(pw).toSatisfy(has(/[a-z]/));
      expect(pw).toSatisfy(has(/[A-Z]/));
      expect(pw).toSatisfy(has(/[0-9]/));
      expect(pw).toSatisfy(has(/[^a-zA-Z0-9]/));
    }
  });

  it('honours the length bounds', () => {
    expect(generatePassword({ length: 8 })).toHaveLength(8);
    expect(generatePassword({ length: 128 })).toHaveLength(128);
  });

  it('only draws from the selected classes', () => {
    const lower = generatePassword({
      length: 64,
      uppercase: false,
      digits: false,
      symbols: false,
    });
    expect(lower).toMatch(/^[a-z]{64}$/);
    const digitsOnly = generatePassword({
      length: 16,
      lowercase: false,
      uppercase: false,
      symbols: false,
    });
    expect(digitsOnly).toMatch(/^[0-9]{16}$/);
  });

  it('respects excludeAmbiguous and a custom symbol set', () => {
    const pw = generatePassword({ length: 128, excludeAmbiguous: true, symbolSet: '#!' });
    for (const c of AMBIGUOUS) expect(pw).not.toContain(c);
    expect(pw).toMatch(/^[a-km-zA-HJ-NP-Z2-9#!]+$/);
  });

  it('a single-character pool yields a repeated character', () => {
    expect(
      generatePassword({
        length: 8,
        lowercase: false,
        uppercase: false,
        digits: false,
        symbols: true,
        symbolSet: '#',
      }),
    ).toBe('########');
  });

  it('requireEach can be turned off', () => {
    // With a constant source every pick is the same index, so without requireEach
    // the whole password is one character; with it, the guaranteed picks differ.
    const source = sequence(0);
    const noGuarantee = generatePassword({ length: 8, requireEach: false }, source);
    expect(new Set(noGuarantee).size).toBe(1);
    const guaranteed = generatePassword({ length: 8, requireEach: true }, sequence(0));
    expect(new Set(guaranteed).size).toBe(4);
  });

  it('rejects invalid lengths with a specific message', () => {
    expect(() => generatePassword({ length: 7 })).toThrow(/between 8 and 128, got 7/);
    expect(() => generatePassword({ length: 129 })).toThrow(PasswordError);
    expect(() => generatePassword({ length: 10.5 })).toThrow(/whole number/);
    expect(() => generatePassword({ length: Number.NaN })).toThrow(/got NaN/);
  });

  it('throws when every class is disabled', () => {
    expect(() =>
      generatePassword({ lowercase: false, uppercase: false, digits: false, symbols: false }),
    ).toThrow(/No characters to choose from/);
  });

  it('generatePasswords produces distinct passwords and validates the count', () => {
    const list = generatePasswords(10, { length: 16 });
    expect(list).toHaveLength(10);
    expect(new Set(list).size).toBe(10);
    for (const pw of list) expect(pw).toHaveLength(16);
    expect(() => generatePasswords(0)).toThrow(/between 1 and 100, got 0/);
    expect(() => generatePasswords(101)).toThrow(PasswordError);
  });
});

describe('generatePassphrase', () => {
  it('joins 4 dictionary words with hyphens by default', () => {
    const phrase = generatePassphrase();
    const words = phrase.split('-');
    expect(words).toHaveLength(4);
    for (const w of words) expect(WORDS).toContain(w);
  });

  it('supports word count, separator, capitalisation and an appended number', () => {
    const phrase = generatePassphrase({
      words: 5,
      separator: '.',
      capitalize: true,
      appendNumber: true,
    });
    const parts = phrase.split('.');
    expect(parts).toHaveLength(6);
    for (const w of parts.slice(0, 5)) {
      expect(w).toMatch(/^[A-Z][a-z]+$/);
      expect(WORDS).toContain(w.toLowerCase());
    }
    expect(parts[5]).toMatch(/^\d{2}$/);
  });

  it('supports space, underscore and custom separators', () => {
    expect(generatePassphrase({ words: 3, separator: ' ' }).split(' ')).toHaveLength(3);
    expect(generatePassphrase({ words: 3, separator: '_' }).split('_')).toHaveLength(3);
    expect(
      generatePassphrase({ words: 3, separator: 'custom', customSeparator: '::' }).split('::'),
    ).toHaveLength(3);
    // Custom with nothing entered concatenates the words.
    expect(generatePassphrase({ words: 3, separator: 'custom' })).toMatch(/^[a-z]+$/);
  });

  it('resolveSeparator maps the option to a string', () => {
    expect(resolveSeparator({})).toBe('-');
    expect(resolveSeparator({ separator: ' ' })).toBe(' ');
    expect(resolveSeparator({ separator: 'custom', customSeparator: '+' })).toBe('+');
    expect(resolveSeparator({ separator: 'custom' })).toBe('');
  });

  it('is deterministic for an injected source', () => {
    expect(generatePassphrase({ words: 3 }, sequence(0))).toBe(
      `${WORDS[0]}-${WORDS[0]}-${WORDS[0]}`,
    );
    expect(generatePassphrase({ words: 3, appendNumber: true }, sequence(0))).toBe(
      `${WORDS[0]}-${WORDS[0]}-${WORDS[0]}-00`,
    );
  });

  it('rejects invalid word counts', () => {
    expect(() => generatePassphrase({ words: 2 })).toThrow(/between 3 and 10, got 2/);
    expect(() => generatePassphrase({ words: 11 })).toThrow(PasswordError);
    expect(() => generatePassphrase({ words: 3.5 })).toThrow(/whole number/);
  });
});

describe('word list', () => {
  it('has 300 unique, lower-case ASCII words of 4–8 letters', () => {
    expect(WORDS).toHaveLength(300);
    expect(new Set(WORDS).size).toBe(WORDS.length);
    for (const w of WORDS) expect(w).toMatch(/^[a-z]{4,8}$/);
  });
});

describe('entropy and strength', () => {
  it('entropyBits is log2(pool^length)', () => {
    expect(entropyBits(2, 8)).toBe(8);
    expect(entropyBits(64, 10)).toBe(60);
    expect(entropyBits(1, 20)).toBe(0);
    expect(entropyBits(10, 0)).toBe(0);
  });

  it('passwordEntropy reflects the pool size and length', () => {
    const pool = LOWERCASE.length + UPPERCASE.length + DIGITS.length + DEFAULT_SYMBOLS.length;
    expect(passwordEntropy()).toBeCloseTo(20 * Math.log2(pool), 6);
    expect(
      passwordEntropy({ length: 12, uppercase: false, digits: false, symbols: false }),
    ).toBeCloseTo(12 * Math.log2(26), 6);
    // Nothing enabled → no entropy instead of throwing.
    expect(
      passwordEntropy({ lowercase: false, uppercase: false, digits: false, symbols: false }),
    ).toBe(0);
  });

  it('passphraseEntropy counts words and the optional number', () => {
    expect(passphraseEntropy()).toBeCloseTo(4 * Math.log2(300), 6);
    expect(passphraseEntropy({ words: 6, appendNumber: true })).toBeCloseTo(
      6 * Math.log2(300) + Math.log2(100),
      6,
    );
    expect(passphraseEntropy({ words: 0 })).toBe(0);
  });

  it('strengthFor maps bits to five discrete levels', () => {
    expect(strengthFor(0)).toEqual({ bits: 0, label: 'Weak', level: 0 });
    expect(strengthFor(Number.NaN).level).toBe(0);
    expect(strengthFor(30)).toEqual({ bits: 30, label: 'Weak', level: 1 });
    expect(strengthFor(40)).toEqual({ bits: 40, label: 'Fair', level: 2 });
    expect(strengthFor(63.9).label).toBe('Fair');
    expect(strengthFor(64)).toEqual({ bits: 64, label: 'Strong', level: 3 });
    expect(strengthFor(96)).toEqual({ bits: 96, label: 'Very strong', level: 4 });
    expect(strengthFor(500).level).toBe(4);
  });
});
