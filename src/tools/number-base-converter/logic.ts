/**
 * Number Base Converter — pure functions, no DOM.
 *
 * Everything runs on BigInt, so values are exact at any width: no rounding at
 * 2^53, and 64-bit two's complement is computed rather than approximated.
 */

export class BaseError extends Error {
  override name = 'BaseError';
}

export interface FormatOptions {
  /** Upper-case the letter digits of bases above 10. */
  uppercase?: boolean;
  /** Insert separators every few digits (4 for binary, 3 for decimal, 2 for hex). */
  group?: boolean;
}

export interface BaseRow {
  /** `2`, `8`, `10`, `16` or `custom`. */
  id: string;
  base: number;
  label: string;
  value: string;
}

export interface TwosComplement {
  bits: number;
  binary: string;
  hex: string;
  /** The bit pattern read as an unsigned integer. */
  unsigned: string;
}

export const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
export const MIN_BASE = 2;
export const MAX_BASE = 36;
export const BIT_WIDTHS = [8, 16, 32, 64] as const;
export type BitWidth = (typeof BIT_WIDTHS)[number];

/** 0xDEADBEEF — recognisable in every base. */
export const SAMPLE_DECIMAL = '3735928559';

/** Separator distance per base; anything else groups in threes. */
export const GROUP_SIZE: Readonly<Record<number, number>> = { 2: 4, 8: 3, 10: 3, 16: 2 };

const BASE_NAMES: Readonly<Record<number, string>> = {
  2: 'binary',
  8: 'octal',
  10: 'decimal',
  16: 'hexadecimal',
};

const PREFIXES: Readonly<Record<number, RegExp>> = {
  2: /^0b/i,
  8: /^0o/i,
  16: /^0x/i,
};

const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES = ['', ' thousand', ' million', ' billion', ' trillion'];

/** Largest value `numberToWords` will spell out: 10^15 − 1. */
export const MAX_WORDS = 10n ** 15n - 1n;

/** "binary", "hexadecimal", or "base 36" for the rest. */
export function baseName(base: number): string {
  return BASE_NAMES[base] ?? `base ${base}`;
}

/** "0 and 1", "0–7", "0–9 and A–F", … — used in error messages. */
export function digitRange(base: number): string {
  if (base === 2) return '0 and 1';
  if (base <= 10) return `0–${base - 1}`;
  const last = (DIGITS[base - 1] ?? 'z').toUpperCase();
  return `0–9 and A–${last}`;
}

function assertBase(base: number): void {
  if (!Number.isInteger(base) || base < MIN_BASE || base > MAX_BASE) {
    throw new BaseError(`Base must be a whole number between ${MIN_BASE} and ${MAX_BASE}.`);
  }
}

/** Strip whitespace, `_` separators and a base prefix that matches `base`. */
export function cleanInput(text: string, base: number): { digits: string; negative: boolean } {
  let cleaned = text.replace(/[\s_]/g, '');
  let negative = false;
  if (cleaned.startsWith('-')) {
    negative = true;
    cleaned = cleaned.slice(1);
  } else if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  }
  const prefix = PREFIXES[base];
  if (prefix?.test(cleaned)) cleaned = cleaned.replace(prefix, '');
  return { digits: cleaned, negative };
}

/** Parse a string written in `base` into an exact BigInt. */
export function parseInBase(text: string, base: number): bigint {
  assertBase(base);
  const { digits, negative } = cleanInput(text, base);
  if (digits === '') {
    throw new BaseError(
      `Enter a ${baseName(base)} number — ${baseName(base)} uses ${digitRange(base)}.`,
    );
  }
  let value = 0n;
  const big = BigInt(base);
  for (const char of digits) {
    const index = DIGITS.indexOf(char.toLowerCase());
    if (index === -1 || index >= base) {
      throw new BaseError(
        `“${char}” is not a valid ${baseName(base)} digit — ${baseName(base)} uses ${digitRange(base)}.`,
      );
    }
    value = value * big + BigInt(index);
  }
  return negative ? -value : value;
}

/** Insert a space every `size` digits, counting from the right. */
export function groupDigits(text: string, size: number): string {
  if (size <= 0 || text.length <= size) return text;
  const negative = text.startsWith('-');
  const body = negative ? text.slice(1) : text;
  const groups: string[] = [];
  for (let end = body.length; end > 0; end -= size) {
    groups.unshift(body.slice(Math.max(0, end - size), end));
  }
  return `${negative ? '-' : ''}${groups.join(' ')}`;
}

/** Render a value in `base`, optionally upper-cased and grouped. */
export function toBase(value: bigint, base: number, options: FormatOptions = {}): string {
  assertBase(base);
  let text = value.toString(base);
  if (options.uppercase) text = text.toUpperCase();
  if (options.group) text = groupDigits(text, GROUP_SIZE[base] ?? 3);
  return text;
}

/** Bits needed to hold the magnitude; 0 needs none. */
export function bitLength(value: bigint): number {
  const magnitude = value < 0n ? -value : value;
  return magnitude === 0n ? 0 : magnitude.toString(2).length;
}

/** True when the value fits a `bits`-wide field, signed or unsigned. */
export function fitsInBits(value: bigint, bits: number): boolean {
  const width = BigInt(bits);
  return value >= -(2n ** (width - 1n)) && value <= 2n ** width - 1n;
}

/** The `bits`-wide two's complement pattern of `value`. */
export function twosComplement(value: bigint, bits: BitWidth): TwosComplement {
  if (!fitsInBits(value, bits)) {
    const signedMin = -(2n ** (BigInt(bits) - 1n));
    const unsignedMax = 2n ** BigInt(bits) - 1n;
    throw new BaseError(
      `${value} does not fit in ${bits} bits (${signedMin} to ${unsignedMax}). ` +
        'Choose a wider width.',
    );
  }
  const pattern = BigInt.asUintN(bits, value);
  return {
    bits,
    binary: pattern.toString(2).padStart(bits, '0'),
    hex: pattern.toString(16).padStart(bits / 4, '0'),
    unsigned: pattern.toString(10),
  };
}

function chunkToWords(chunk: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(chunk / 100);
  const rest = chunk % 100;
  if (hundreds > 0) parts.push(`${ONES[hundreds]} hundred`);
  if (rest > 0 && rest < 20) parts.push(ONES[rest] ?? '');
  else if (rest >= 20) {
    const tens = TENS[Math.floor(rest / 10)] ?? '';
    const unit = rest % 10;
    parts.push(unit > 0 ? `${tens}-${ONES[unit]}` : tens);
  }
  return parts.join(' ');
}

/** Spell a number out in English, up to 10^15 − 1. */
export function numberToWords(value: bigint): string {
  if (value === 0n) return 'zero';
  const negative = value < 0n;
  let rest = negative ? -value : value;
  if (rest > MAX_WORDS) {
    throw new BaseError(
      'Words are only shown up to 999,999,999,999,999 (10^15 − 1) — the value is larger than that.',
    );
  }
  const parts: string[] = [];
  let scale = 0;
  while (rest > 0n) {
    const chunk = Number(rest % 1000n);
    if (chunk > 0) parts.unshift(`${chunkToWords(chunk)}${SCALES[scale] ?? ''}`);
    rest /= 1000n;
    scale++;
  }
  return `${negative ? 'minus ' : ''}${parts.join(' ')}`;
}

/** The four standard bases, plus a custom one when `customBase` is given. */
export function convertAll(
  value: bigint,
  options: FormatOptions = {},
  customBase?: number,
): BaseRow[] {
  const rows: BaseRow[] = [
    { id: '2', base: 2, label: 'Binary', value: toBase(value, 2, options) },
    { id: '8', base: 8, label: 'Octal', value: toBase(value, 8, options) },
    { id: '10', base: 10, label: 'Decimal', value: toBase(value, 10, options) },
    { id: '16', base: 16, label: 'Hexadecimal', value: toBase(value, 16, options) },
  ];
  if (customBase !== undefined) {
    rows.push({
      id: 'custom',
      base: customBase,
      label: `Base ${customBase}`,
      value: toBase(value, customBase, options),
    });
  }
  return rows;
}
