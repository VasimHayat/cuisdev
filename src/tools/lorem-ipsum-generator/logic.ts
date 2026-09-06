/**
 * Lorem Ipsum Generator — pure functions, no DOM.
 *
 * Text is produced from a seeded PRNG (mulberry32) so that the same seed and
 * options always yield the same output. The UI picks a fresh seed for every
 * Generate click; unit tests pass a fixed seed and assert exact strings.
 */

export class LoremError extends Error {
  override name = 'LoremError';
}

export const LOREM_UNITS = ['paragraphs', 'sentences', 'words'] as const;
export type LoremUnit = (typeof LOREM_UNITS)[number];

export const LOREM_FORMATS = ['plain', 'html', 'markdown', 'json'] as const;
export type LoremFormat = (typeof LOREM_FORMATS)[number];

export const MIN_COUNT = 1;
export const MAX_COUNT = 100;

export interface LoremOptions {
  /** What to count: paragraphs, sentences or words. */
  unit: LoremUnit;
  /** How many units, 1–100. */
  count: number;
  /** Begin with the classic "Lorem ipsum dolor sit amet…" opening. Default true. */
  startWithLorem?: boolean;
  /** Output format. Default 'plain'. */
  format?: LoremFormat;
  /** PRNG seed (any finite number). Random when omitted. */
  seed?: number;
}

export interface LoremResult {
  /** The generated units before formatting — one paragraph, sentence or word per item. */
  items: string[];
  /** The formatted text ready to copy or download. */
  output: string;
  /** Number of words across all items. */
  words: number;
  /** Length of `output` in UTF-16 code units. */
  characters: number;
  /** The seed that produced this result (useful for reproducing it). */
  seed: number;
}

/** The classic opening sentence of the Cicero-derived placeholder text. */
export const CLASSIC_SENTENCE =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';

/** The classic opening words, used when generating by word count. */
export const CLASSIC_WORDS: readonly string[] = [
  'Lorem',
  'ipsum',
  'dolor',
  'sit',
  'amet',
  'consectetur',
  'adipiscing',
  'elit',
];

/** ~200 unique Latin(ish) words in the traditional lorem ipsum vocabulary. */
export const WORDS: readonly string[] = [
  'lorem',
  'ipsum',
  'dolor',
  'sit',
  'amet',
  'consectetur',
  'adipiscing',
  'elit',
  'sed',
  'do',
  'eiusmod',
  'tempor',
  'incididunt',
  'ut',
  'labore',
  'et',
  'dolore',
  'magna',
  'aliqua',
  'enim',
  'ad',
  'minim',
  'veniam',
  'quis',
  'nostrud',
  'exercitation',
  'ullamco',
  'laboris',
  'nisi',
  'aliquip',
  'ex',
  'ea',
  'commodo',
  'consequat',
  'duis',
  'aute',
  'irure',
  'in',
  'reprehenderit',
  'voluptate',
  'velit',
  'esse',
  'cillum',
  'eu',
  'fugiat',
  'nulla',
  'pariatur',
  'excepteur',
  'sint',
  'occaecat',
  'cupidatat',
  'non',
  'proident',
  'sunt',
  'culpa',
  'qui',
  'officia',
  'deserunt',
  'mollit',
  'anim',
  'id',
  'est',
  'laborum',
  'a',
  'ac',
  'accumsan',
  'aenean',
  'aliquam',
  'ante',
  'arcu',
  'at',
  'auctor',
  'augue',
  'bibendum',
  'blandit',
  'condimentum',
  'congue',
  'convallis',
  'cras',
  'curabitur',
  'cursus',
  'dapibus',
  'diam',
  'dictum',
  'dignissim',
  'donec',
  'efficitur',
  'egestas',
  'eget',
  'eleifend',
  'elementum',
  'erat',
  'eros',
  'etiam',
  'euismod',
  'facilisi',
  'facilisis',
  'fames',
  'faucibus',
  'felis',
  'fermentum',
  'feugiat',
  'finibus',
  'fringilla',
  'fusce',
  'gravida',
  'habitant',
  'hac',
  'hendrerit',
  'iaculis',
  'imperdiet',
  'integer',
  'interdum',
  'justo',
  'lacinia',
  'lacus',
  'laoreet',
  'lectus',
  'leo',
  'libero',
  'ligula',
  'lobortis',
  'luctus',
  'maecenas',
  'malesuada',
  'massa',
  'mattis',
  'mauris',
  'maximus',
  'metus',
  'mi',
  'molestie',
  'morbi',
  'nam',
  'nec',
  'neque',
  'netus',
  'nibh',
  'nisl',
  'nullam',
  'nunc',
  'odio',
  'orci',
  'ornare',
  'pellentesque',
  'per',
  'pharetra',
  'phasellus',
  'placerat',
  'platea',
  'porta',
  'porttitor',
  'posuere',
  'potenti',
  'praesent',
  'pretium',
  'primis',
  'proin',
  'pulvinar',
  'purus',
  'quam',
  'quisque',
  'rhoncus',
  'risus',
  'rutrum',
  'sagittis',
  'sapien',
  'scelerisque',
  'sem',
  'semper',
  'senectus',
  'sodales',
  'sollicitudin',
  'suscipit',
  'suspendisse',
  'tellus',
  'tempus',
  'tincidunt',
  'tortor',
  'tristique',
  'turpis',
  'ultrices',
  'ultricies',
  'urna',
  'varius',
  'vehicula',
  'vel',
  'venenatis',
  'vestibulum',
  'vitae',
  'vivamus',
  'viverra',
  'volutpat',
  'vulputate',
  'inceptos',
  'himenaeos',
  'taciti',
  'sociosqu',
  'litora',
  'torquent',
  'conubia',
  'nostra',
  'aptent',
  'class',
];

export const FORMAT_EXTENSIONS: Record<LoremFormat, string> = {
  plain: 'txt',
  html: 'html',
  markdown: 'md',
  json: 'json',
};

export const FORMAT_MIME_TYPES: Record<LoremFormat, string> = {
  plain: 'text/plain',
  html: 'text/html',
  markdown: 'text/markdown',
  json: 'application/json',
};

// --- PRNG ---------------------------------------------------------------------

/**
 * mulberry32 — a tiny, fast 32-bit seeded PRNG. Returns floats in [0, 1).
 * Non-integer or out-of-range seeds are coerced to uint32 like `>>> 0` would.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Inclusive integer in [min, max] drawn from `rng`. */
export function randomInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** A non-deterministic seed for interactive use. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0x100000000);
}

// --- generation -----------------------------------------------------------------

/** Pick `count` words, never repeating the same word twice in a row. */
export function pickWords(
  rng: () => number,
  count: number,
  vocabulary: readonly string[] = WORDS,
  previous = '',
): string[] {
  if (vocabulary.length === 0) throw new LoremError('The vocabulary must not be empty.');
  const out: string[] = [];
  let prev = previous;
  for (let i = 0; i < count; i++) {
    let word = vocabulary[Math.floor(rng() * vocabulary.length)] as string;
    // Avoid "ipsum ipsum" — only possible when the vocabulary has more than one word.
    if (vocabulary.length > 1) {
      while (word === prev) word = vocabulary[Math.floor(rng() * vocabulary.length)] as string;
    }
    out.push(word);
    prev = word;
  }
  return out;
}

export function capitalize(text: string): string {
  return text.length === 0 ? text : text.charAt(0).toUpperCase() + text.slice(1);
}

/** One sentence of 6–14 words, capitalised, with an occasional comma, ending in a period. */
export function generateSentence(rng: () => number, vocabulary: readonly string[] = WORDS): string {
  const length = randomInt(rng, 6, 14);
  const words = pickWords(rng, length, vocabulary);
  if (length >= 8 && rng() < 0.6) {
    const commaAt = randomInt(rng, 2, length - 3);
    words[commaAt] = `${words[commaAt]},`;
  }
  return `${capitalize(words.join(' '))}.`;
}

/** One paragraph of 4–8 sentences. `first` (if given) replaces the opening sentence. */
export function generateParagraph(
  rng: () => number,
  first?: string,
  vocabulary: readonly string[] = WORDS,
): string {
  const length = randomInt(rng, 4, 8);
  const sentences: string[] = [];
  if (first !== undefined) sentences.push(first);
  while (sentences.length < length) sentences.push(generateSentence(rng, vocabulary));
  return sentences.join(' ');
}

export function validateOptions(options: LoremOptions): Required<LoremOptions> {
  if (!LOREM_UNITS.includes(options.unit)) {
    throw new LoremError(
      `Unknown unit "${String(options.unit)}" — choose paragraphs, sentences or words.`,
    );
  }
  const format = options.format ?? 'plain';
  if (!LOREM_FORMATS.includes(format)) {
    throw new LoremError(
      `Unknown format "${String(format)}" — choose plain, html, markdown or json.`,
    );
  }
  const { count } = options;
  if (typeof count !== 'number' || !Number.isInteger(count)) {
    throw new LoremError(
      `Count must be a whole number between ${MIN_COUNT} and ${MAX_COUNT} — got "${String(count)}".`,
    );
  }
  if (count < MIN_COUNT || count > MAX_COUNT) {
    throw new LoremError(
      `Count must be between ${MIN_COUNT} and ${MAX_COUNT} ${options.unit} — got ${count}.`,
    );
  }
  const seed = options.seed ?? randomSeed();
  if (!Number.isFinite(seed)) {
    throw new LoremError('Seed must be a finite number.');
  }
  return {
    unit: options.unit,
    count,
    startWithLorem: options.startWithLorem ?? true,
    format,
    seed,
  };
}

/** Generate the raw units (one item per paragraph / sentence / word). */
export function generateItems(options: LoremOptions): string[] {
  const opts = validateOptions(options);
  const rng = mulberry32(opts.seed);
  const items: string[] = [];

  switch (opts.unit) {
    case 'words': {
      if (opts.startWithLorem) items.push(...CLASSIC_WORDS.slice(0, opts.count));
      const remaining = opts.count - items.length;
      if (remaining > 0) items.push(...pickWords(rng, remaining, WORDS, items.at(-1) ?? ''));
      break;
    }
    case 'sentences': {
      if (opts.startWithLorem) items.push(CLASSIC_SENTENCE);
      while (items.length < opts.count) items.push(generateSentence(rng));
      break;
    }
    case 'paragraphs': {
      if (opts.startWithLorem) items.push(generateParagraph(rng, CLASSIC_SENTENCE));
      while (items.length < opts.count) items.push(generateParagraph(rng));
      break;
    }
  }
  return items;
}

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Turn generated items into the requested output format. */
export function formatItems(items: string[], unit: LoremUnit, format: LoremFormat): string {
  switch (format) {
    case 'json':
      return JSON.stringify(items, null, 2);
    case 'html':
      return unit === 'paragraphs'
        ? items.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n')
        : `<p>${escapeHtml(items.join(' '))}</p>`;
    case 'markdown':
    case 'plain':
      return unit === 'paragraphs' ? items.join('\n\n') : items.join(' ');
  }
}

export function countWords(items: readonly string[]): number {
  let total = 0;
  for (const item of items) total += item.match(/\S+/g)?.length ?? 0;
  return total;
}

/** Generate and format in one call. Deterministic for a given `seed`. */
export function generateLorem(options: LoremOptions): LoremResult {
  const opts = validateOptions(options);
  const items = generateItems(opts);
  const output = formatItems(items, opts.unit, opts.format);
  return { items, output, words: countWords(items), characters: output.length, seed: opts.seed };
}
