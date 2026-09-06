/**
 * Password Generator — pure functions, no DOM.
 *
 * Random-character passwords and word passphrases from `crypto.getRandomValues`
 * with rejection sampling (no modulo bias), plus an entropy-based strength
 * estimate. Nothing here stores or transmits anything.
 */

export class PasswordError extends Error {
  override name = 'PasswordError';
}

export const MIN_LENGTH = 8;
export const MAX_LENGTH = 128;
export const DEFAULT_LENGTH = 20;
export const MIN_WORDS = 3;
export const MAX_WORDS = 10;
export const DEFAULT_WORDS = 4;

export const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
export const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const DIGITS = '0123456789';
export const DEFAULT_SYMBOLS = '!@#$%^&*()-_=+[]{};:,.<>?/~';
/** Characters that are easy to confuse in many fonts. */
export const AMBIGUOUS = '0O1lI|';

export interface PasswordOptions {
  length?: number;
  lowercase?: boolean;
  uppercase?: boolean;
  digits?: boolean;
  symbols?: boolean;
  /** Custom symbol set; falls back to DEFAULT_SYMBOLS when empty. */
  symbolSet?: string;
  /** Drop 0 O 1 l I | from the pool. */
  excludeAmbiguous?: boolean;
  /** Guarantee at least one character from every selected class. */
  requireEach?: boolean;
}

export type Separator = '-' | '.' | ' ' | '_' | 'custom';

export interface PassphraseOptions {
  words?: number;
  separator?: Separator;
  customSeparator?: string;
  capitalize?: boolean;
  appendNumber?: boolean;
}

export type StrengthLabel = 'Weak' | 'Fair' | 'Strong' | 'Very strong';

export interface Strength {
  bits: number;
  label: StrengthLabel;
  /** 1–4, drives the meter width class. 0 is reserved for "nothing generated". */
  level: 0 | 1 | 2 | 3 | 4;
}

/** Random 32-bit unsigned integers, injectable for tests. Must fill and return `out`. */
export type RandomSource = (out: Uint32Array) => Uint32Array;

const defaultRandom: RandomSource = (out) => {
  crypto.getRandomValues(out);
  return out;
};

/**
 * Uniform integer in [0, max) via rejection sampling: draw 32-bit words and
 * discard any that fall in the partial bucket at the top of the range, so every
 * value is equally likely (a plain `% max` would favour small values).
 */
export function randomInt(max: number, random: RandomSource = defaultRandom): number {
  if (!Number.isInteger(max) || max <= 0 || max > 0x1_0000_0000) {
    throw new PasswordError(`randomInt needs a whole number between 1 and 2^32, got ${max}.`);
  }
  if (max === 1) return 0;
  const limit = 0x1_0000_0000 - (0x1_0000_0000 % max);
  const buf = new Uint32Array(1);
  for (;;) {
    const value = random(buf)[0] as number;
    if (value < limit) return value % max;
  }
}

/** Fisher–Yates shuffle in place using the CSPRNG. */
export function shuffle<T>(items: T[], random: RandomSource = defaultRandom): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, random);
    const tmp = items[i] as T;
    items[i] = items[j] as T;
    items[j] = tmp;
  }
  return items;
}

/** Remove duplicate characters, preserving first occurrence. */
export function uniqueChars(s: string): string {
  return Array.from(new Set(Array.from(s))).join('');
}

function stripAmbiguous(set: string, on: boolean | undefined): string {
  if (!on) return set;
  return Array.from(set)
    .filter((c) => !AMBIGUOUS.includes(c))
    .join('');
}

/** The character classes enabled by `options`, each already filtered. */
export function characterClasses(options: PasswordOptions): string[] {
  const classes: string[] = [];
  if (options.lowercase) classes.push(stripAmbiguous(LOWERCASE, options.excludeAmbiguous));
  if (options.uppercase) classes.push(stripAmbiguous(UPPERCASE, options.excludeAmbiguous));
  if (options.digits) classes.push(stripAmbiguous(DIGITS, options.excludeAmbiguous));
  if (options.symbols) {
    const custom = uniqueChars((options.symbolSet ?? '').replace(/\s+/g, ''));
    classes.push(
      stripAmbiguous(custom !== '' ? custom : DEFAULT_SYMBOLS, options.excludeAmbiguous),
    );
  }
  return classes.filter((c) => c.length > 0);
}

/** The full pool of allowed characters for `options`. Throws if it is empty. */
export function buildPool(options: PasswordOptions): string {
  const pool = uniqueChars(characterClasses(options).join(''));
  if (pool.length === 0) {
    throw new PasswordError(
      'No characters to choose from — enable at least one of lowercase, uppercase, digits or symbols.',
    );
  }
  return pool;
}

function validateLength(length: number): void {
  if (!Number.isInteger(length) || length < MIN_LENGTH || length > MAX_LENGTH) {
    throw new PasswordError(
      `Length must be a whole number between ${MIN_LENGTH} and ${MAX_LENGTH}, got ${String(length)}.`,
    );
  }
}

/** Generate one random-character password. */
export function generatePassword(
  options: PasswordOptions = {},
  random: RandomSource = defaultRandom,
): string {
  const opts: PasswordOptions = {
    length: DEFAULT_LENGTH,
    lowercase: true,
    uppercase: true,
    digits: true,
    symbols: true,
    requireEach: true,
    ...options,
  };
  const length = opts.length as number;
  validateLength(length);
  const classes = characterClasses(opts);
  const pool = buildPool(opts);

  const chars: string[] = [];
  if (opts.requireEach) {
    // One guaranteed pick from every class, then fill from the whole pool and shuffle
    // so the guaranteed characters do not sit at predictable positions.
    for (const cls of classes) chars.push(cls[randomInt(cls.length, random)] as string);
  }
  while (chars.length < length) chars.push(pool[randomInt(pool.length, random)] as string);
  return shuffle(chars, random).join('');
}

/** Generate `count` passwords with the same options. */
export function generatePasswords(
  count: number,
  options: PasswordOptions = {},
  random: RandomSource = defaultRandom,
): string[] {
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new PasswordError(
      `Count must be a whole number between 1 and 100, got ${String(count)}.`,
    );
  }
  return Array.from({ length: count }, () => generatePassword(options, random));
}

/** Resolve the separator string for a passphrase. */
export function resolveSeparator(options: PassphraseOptions): string {
  const sep = options.separator ?? '-';
  if (sep === 'custom') return options.customSeparator ?? '';
  return sep;
}

/** Generate a word passphrase like `maple-river-stone-lamp`. */
export function generatePassphrase(
  options: PassphraseOptions = {},
  random: RandomSource = defaultRandom,
): string {
  const count = options.words ?? DEFAULT_WORDS;
  if (!Number.isInteger(count) || count < MIN_WORDS || count > MAX_WORDS) {
    throw new PasswordError(
      `Word count must be a whole number between ${MIN_WORDS} and ${MAX_WORDS}, got ${String(count)}.`,
    );
  }
  const words: string[] = [];
  for (let i = 0; i < count; i++) {
    let w = WORDS[randomInt(WORDS.length, random)] as string;
    if (options.capitalize) w = w[0]?.toUpperCase() + w.slice(1);
    words.push(w);
  }
  if (options.appendNumber) words.push(String(randomInt(100, random)).padStart(2, '0'));
  return words.join(resolveSeparator(options));
}

/** Shannon-style search-space entropy: log2(pool^length). */
export function entropyBits(poolSize: number, length: number): number {
  if (poolSize <= 1 || length <= 0) return 0;
  return length * Math.log2(poolSize);
}

/** Entropy of a random-character password with these options (from generation parameters). */
export function passwordEntropy(options: PasswordOptions = {}): number {
  const opts: PasswordOptions = {
    length: DEFAULT_LENGTH,
    lowercase: true,
    uppercase: true,
    digits: true,
    symbols: true,
    ...options,
  };
  let pool: string;
  try {
    pool = buildPool(opts);
  } catch {
    return 0;
  }
  return entropyBits(pool.length, opts.length as number);
}

/** Entropy of a passphrase: words × log2(list size), plus the appended number if any. */
export function passphraseEntropy(options: PassphraseOptions = {}): number {
  const count = options.words ?? DEFAULT_WORDS;
  if (count <= 0) return 0;
  return entropyBits(WORDS.length, count) + (options.appendNumber ? Math.log2(100) : 0);
}

/** Map entropy bits to a label and meter level. */
export function strengthFor(bits: number): Strength {
  if (!Number.isFinite(bits) || bits <= 0) return { bits: 0, label: 'Weak', level: 0 };
  if (bits < 40) return { bits, label: 'Weak', level: 1 };
  if (bits < 64) return { bits, label: 'Fair', level: 2 };
  if (bits < 96) return { bits, label: 'Strong', level: 3 };
  return { bits, label: 'Very strong', level: 4 };
}

/**
 * 300 short, common, unambiguous English words (4–8 letters, no homophones of
 * each other, no offensive terms). log2(300) ≈ 8.2 bits per word.
 */
// prettier-ignore
export const WORDS: readonly string[] = [
  'acorn', 'actor', 'adobe', 'agent', 'album', 'alley', 'amber', 'anchor', 'angle', 'ankle',
  'apple', 'apron', 'arrow', 'atlas', 'attic', 'audio', 'award', 'bacon', 'badge', 'bagel',
  'baker', 'bamboo', 'banjo', 'barn', 'basil', 'beach', 'beam', 'bean', 'beard', 'bell', 'belt',
  'bench', 'berry', 'birch', 'blade', 'blaze', 'blend', 'bloom', 'board', 'boat', 'bolt', 'book',
  'boot', 'brick', 'bridge', 'broom', 'brush', 'bucket', 'bugle', 'cabin', 'cable', 'cactus',
  'camel', 'candle', 'canoe', 'canvas', 'cargo', 'carrot', 'castle', 'cedar', 'chair', 'chalk',
  'cheese', 'cherry', 'chess', 'chime', 'cider', 'circle', 'cliff', 'clock', 'cloud', 'clover',
  'coast', 'cobalt', 'cocoa', 'coin', 'comet', 'coral', 'cotton', 'crane', 'crayon', 'creek',
  'crest', 'crown', 'cube', 'curve', 'daisy', 'dance', 'delta', 'denim', 'desk', 'dime', 'diver',
  'dock', 'dolphin', 'donut', 'dragon', 'drum', 'dune', 'eagle', 'earth', 'easel', 'echo', 'elbow',
  'elder', 'ember', 'engine', 'fabric', 'falcon', 'feather', 'fence', 'fern', 'ferry', 'fiddle',
  'field', 'flame', 'flask', 'flint', 'flute', 'forest', 'fossil', 'frame', 'frost', 'galaxy',
  'garden', 'garlic', 'gecko', 'giant', 'ginger', 'glade', 'glass', 'globe', 'glove', 'goose',
  'grape', 'gravel', 'grove', 'guitar', 'hammer', 'harbor', 'harp', 'hawk', 'hazel', 'helmet',
  'heron', 'hill', 'honey', 'horse', 'hotel', 'igloo', 'iron', 'island', 'ivory', 'jacket', 'jade',
  'jaguar', 'jelly', 'jewel', 'jungle', 'kayak', 'kettle', 'kiwi', 'kite', 'koala', 'ladder',
  'lagoon', 'lake', 'lamp', 'lantern', 'laser', 'leaf', 'lemon', 'lever', 'lily', 'linen', 'lion',
  'lizard', 'llama', 'locket', 'lotus', 'lunar', 'magnet', 'mango', 'maple', 'marble', 'meadow',
  'melon', 'meteor', 'mint', 'mirror', 'mitten', 'moose', 'moss', 'motor', 'mural', 'nectar',
  'needle', 'nickel', 'noodle', 'north', 'nutmeg', 'oasis', 'ocean', 'olive', 'onion', 'opal',
  'orbit', 'orchid', 'otter', 'oyster', 'paddle', 'panda', 'paper', 'parrot', 'pearl', 'pebble',
  'pencil', 'pepper', 'piano', 'pillow', 'pilot', 'pine', 'planet', 'plum', 'pocket', 'poem',
  'polar', 'pond', 'poppy', 'prism', 'pumpkin', 'puzzle', 'quartz', 'quill', 'rabbit', 'radar',
  'raft', 'raven', 'rhino', 'ribbon', 'river', 'robin', 'rocket', 'rope', 'ruby', 'saddle',
  'salmon', 'sand', 'satin', 'scarf', 'shadow', 'shell', 'shore', 'silk', 'silver', 'sketch',
  'sled', 'slope', 'socket', 'sonar', 'spark', 'spoon', 'spruce', 'squid', 'stone', 'storm',
  'sugar', 'summit', 'sunset', 'swan', 'table', 'tango', 'tiger', 'timber', 'toast', 'token',
  'torch', 'tower', 'trail', 'tulip', 'tunnel', 'turtle', 'umbrella', 'unicorn', 'valley',
  'velvet', 'violet', 'violin', 'walnut', 'walrus', 'water', 'whale', 'wheat', 'willow', 'window',
  'winter', 'wolf', 'yacht', 'yarn', 'zebra',
];
