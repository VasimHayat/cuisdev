import { describe, expect, it } from 'vitest';

import {
  BaseError,
  MAX_WORDS,
  baseName,
  bitLength,
  cleanInput,
  convertAll,
  digitRange,
  fitsInBits,
  groupDigits,
  numberToWords,
  parseInBase,
  toBase,
  twosComplement,
} from './logic';

describe('cleanInput', () => {
  it('strips underscores, spaces and a matching prefix', () => {
    expect(cleanInput('1010_1010', 2)).toEqual({ digits: '10101010', negative: false });
    expect(cleanInput('0b1010', 2)).toEqual({ digits: '1010', negative: false });
    expect(cleanInput('0XdeadBEEF', 16)).toEqual({ digits: 'deadBEEF', negative: false });
    expect(cleanInput('0o755', 8)).toEqual({ digits: '755', negative: false });
  });

  it('keeps a prefix that is not valid for the base', () => {
    // 0b1010 in hexadecimal is a perfectly good number.
    expect(cleanInput('0b1010', 16)).toEqual({ digits: '0b1010', negative: false });
  });

  it('reads the sign', () => {
    expect(cleanInput('-42', 10)).toEqual({ digits: '42', negative: true });
    expect(cleanInput('+42', 10)).toEqual({ digits: '42', negative: false });
  });
});

describe('parseInBase', () => {
  it('parses each standard base', () => {
    expect(parseInBase('11111111', 2)).toBe(255n);
    expect(parseInBase('777', 8)).toBe(511n);
    expect(parseInBase('3735928559', 10)).toBe(3_735_928_559n);
    expect(parseInBase('deadbeef', 16)).toBe(3_735_928_559n);
    expect(parseInBase('DEADBEEF', 16)).toBe(3_735_928_559n);
  });

  it('parses prefixes, separators and negatives', () => {
    expect(parseInBase('0xff', 16)).toBe(255n);
    expect(parseInBase('0b1111_1111', 2)).toBe(255n);
    expect(parseInBase(' -0o10 ', 8)).toBe(-8n);
    expect(parseInBase('1 0 1', 2)).toBe(5n);
  });

  it('is exact well past 2^53', () => {
    expect(parseInBase('ffffffffffffffff', 16)).toBe(18_446_744_073_709_551_615n);
    expect(parseInBase('9007199254740993', 10)).toBe(9_007_199_254_740_993n);
  });

  it('handles zero and leading zeros', () => {
    expect(parseInBase('0', 10)).toBe(0n);
    expect(parseInBase('0000', 2)).toBe(0n);
    expect(parseInBase('007', 8)).toBe(7n);
  });

  it('names the offending digit and the base', () => {
    expect(() => parseInBase('102', 2)).toThrow(BaseError);
    expect(() => parseInBase('9', 2)).toThrow(
      '“9” is not a valid binary digit — binary uses 0 and 1.',
    );
    expect(() => parseInBase('8', 8)).toThrow('“8” is not a valid octal digit — octal uses 0–7.');
    expect(() => parseInBase('g', 16)).toThrow(
      '“g” is not a valid hexadecimal digit — hexadecimal uses 0–9 and A–F.',
    );
    expect(() => parseInBase('z', 20)).toThrow(/base 20 uses 0–9 and A–J/);
  });

  it('rejects empty input and impossible bases', () => {
    expect(() => parseInBase('   ', 2)).toThrow(/Enter a binary number/);
    expect(() => parseInBase('-', 10)).toThrow(BaseError);
    expect(() => parseInBase('1', 1)).toThrow(/between 2 and 36/);
    expect(() => parseInBase('1', 37)).toThrow(/between 2 and 36/);
    expect(() => parseInBase('1', 2.5)).toThrow(BaseError);
  });
});

describe('toBase', () => {
  it('renders the standard bases', () => {
    expect(toBase(255n, 2)).toBe('11111111');
    expect(toBase(255n, 8)).toBe('377');
    expect(toBase(255n, 16)).toBe('ff');
    expect(toBase(3_735_928_559n, 16)).toBe('deadbeef');
    expect(toBase(35n, 36)).toBe('z');
  });

  it('upper-cases and groups on request', () => {
    expect(toBase(3_735_928_559n, 16, { uppercase: true })).toBe('DEADBEEF');
    expect(toBase(3_735_928_559n, 16, { uppercase: true, group: true })).toBe('DE AD BE EF');
    expect(toBase(255n, 2, { group: true })).toBe('1111 1111');
    expect(toBase(1_234_567n, 10, { group: true })).toBe('1 234 567');
  });

  it('keeps the sign in front of grouped digits', () => {
    expect(toBase(-255n, 2, { group: true })).toBe('-1111 1111');
    expect(toBase(-42n, 10)).toBe('-42');
  });

  it('rejects out-of-range bases', () => {
    expect(() => toBase(1n, 64)).toThrow(BaseError);
  });
});

describe('groupDigits', () => {
  it('groups from the right and leaves short values alone', () => {
    expect(groupDigits('1', 4)).toBe('1');
    expect(groupDigits('11111', 4)).toBe('1 1111');
    expect(groupDigits('1234567', 3)).toBe('1 234 567');
    expect(groupDigits('1234', 0)).toBe('1234');
  });
});

describe('bit helpers', () => {
  it('measures bit length', () => {
    expect(bitLength(0n)).toBe(0);
    expect(bitLength(1n)).toBe(1);
    expect(bitLength(255n)).toBe(8);
    expect(bitLength(256n)).toBe(9);
    expect(bitLength(-255n)).toBe(8);
  });

  it('checks whether a value fits a width', () => {
    expect(fitsInBits(255n, 8)).toBe(true);
    expect(fitsInBits(256n, 8)).toBe(false);
    expect(fitsInBits(-128n, 8)).toBe(true);
    expect(fitsInBits(-129n, 8)).toBe(false);
    expect(fitsInBits(18_446_744_073_709_551_615n, 64)).toBe(true);
  });

  it('computes two’s complement patterns', () => {
    expect(twosComplement(-1n, 8)).toEqual({
      bits: 8,
      binary: '11111111',
      hex: 'ff',
      unsigned: '255',
    });
    expect(twosComplement(-128n, 8).binary).toBe('10000000');
    expect(twosComplement(5n, 16)).toMatchObject({ binary: '0000000000000101', hex: '0005' });
    expect(twosComplement(-1n, 64).hex).toBe('ffffffffffffffff');
    expect(twosComplement(0n, 32)).toMatchObject({ hex: '00000000', unsigned: '0' });
  });

  it('explains when a value is too wide', () => {
    expect(() => twosComplement(300n, 8)).toThrow(/does not fit in 8 bits \(-128 to 255\)/);
    expect(() => twosComplement(-200n, 8)).toThrow(BaseError);
  });
});

describe('numberToWords', () => {
  it('spells small numbers', () => {
    expect(numberToWords(0n)).toBe('zero');
    expect(numberToWords(7n)).toBe('seven');
    expect(numberToWords(13n)).toBe('thirteen');
    expect(numberToWords(20n)).toBe('twenty');
    expect(numberToWords(42n)).toBe('forty-two');
    expect(numberToWords(100n)).toBe('one hundred');
    expect(numberToWords(101n)).toBe('one hundred one');
    expect(numberToWords(999n)).toBe('nine hundred ninety-nine');
  });

  it('spells the scales', () => {
    expect(numberToWords(1000n)).toBe('one thousand');
    expect(numberToWords(1_000_000n)).toBe('one million');
    expect(numberToWords(1_000_000_000n)).toBe('one billion');
    expect(numberToWords(1_000_000_000_000n)).toBe('one trillion');
    expect(numberToWords(3_735_928_559n)).toBe(
      'three billion seven hundred thirty-five million nine hundred twenty-eight thousand five hundred fifty-nine',
    );
  });

  it('skips empty groups and handles negatives', () => {
    expect(numberToWords(1_000_007n)).toBe('one million seven');
    expect(numberToWords(-42n)).toBe('minus forty-two');
  });

  it('refuses values above 10^15 − 1', () => {
    expect(numberToWords(MAX_WORDS)).toMatch(/^nine hundred ninety-nine trillion/);
    expect(() => numberToWords(MAX_WORDS + 1n)).toThrow(BaseError);
    expect(() => numberToWords(-(MAX_WORDS + 1n))).toThrow(/10\^15/);
  });
});

describe('naming helpers', () => {
  it('names bases and their digit ranges', () => {
    expect(baseName(2)).toBe('binary');
    expect(baseName(16)).toBe('hexadecimal');
    expect(baseName(20)).toBe('base 20');
    expect(digitRange(2)).toBe('0 and 1');
    expect(digitRange(10)).toBe('0–9');
    expect(digitRange(36)).toBe('0–9 and A–Z');
  });
});

describe('convertAll', () => {
  it('returns the four standard bases', () => {
    const rows = convertAll(255n);
    expect(rows.map((r) => r.id)).toEqual(['2', '8', '10', '16']);
    expect(rows.map((r) => r.value)).toEqual(['11111111', '377', '255', 'ff']);
  });

  it('appends a custom base and applies formatting', () => {
    const rows = convertAll(255n, { uppercase: true, group: true }, 36);
    expect(rows).toHaveLength(5);
    expect(rows.at(-1)).toMatchObject({ id: 'custom', label: 'Base 36', value: '73' });
    expect(rows[0]?.value).toBe('1111 1111');
  });

  it('round-trips through parseInBase', () => {
    for (const row of convertAll(-1_234_567_890_123n, {}, 7)) {
      expect(parseInBase(row.value, row.base)).toBe(-1_234_567_890_123n);
    }
  });
});
