/**
 * Word & Character Counter — pure functions, no DOM.
 *
 * Words and sentences are segmented with `Intl.Segmenter` when the runtime has
 * it (it handles scripts without spaces and abbreviations far better) and fall
 * back to regular expressions otherwise. Both paths are unit-tested.
 */

export class WordCounterError extends Error {
  override name = 'WordCounterError';
}

/** Counting is linear, but the top-words table and the DOM are not free. */
export const MAX_CHARS = 1_000_000;

export const DEFAULT_READING_WPM = 200;
export const FAST_READING_WPM = 250;
export const SPEAKING_WPM = 130;
export const MIN_WPM = 50;
export const MAX_WPM = 1_000;
export const DEFAULT_TOP_WORDS = 10;

export function assertWithinLimit(text: string): void {
  if (text.length <= MAX_CHARS) return;
  throw new WordCounterError(
    `Text is ${text.length.toLocaleString('en-US')} characters. The limit is ${MAX_CHARS.toLocaleString('en-US')} — count a smaller section.`,
  );
}

/** Validate a reading speed coming from the UI. */
export function assertValidWpm(wpm: number): void {
  if (!Number.isFinite(wpm) || wpm < MIN_WPM || wpm > MAX_WPM) {
    throw new WordCounterError(
      `Reading speed must be a number between ${MIN_WPM} and ${MAX_WPM} words per minute.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Segmentation
// ---------------------------------------------------------------------------

interface WordLikeSegment {
  segment: string;
  isWordLike?: boolean;
}

interface SegmenterLike {
  segment(input: string): Iterable<WordLikeSegment>;
}

type SegmenterConstructor = new (
  locales?: string | string[],
  options?: { granularity: 'grapheme' | 'word' | 'sentence' },
) => SegmenterLike;

function getSegmenter(granularity: 'word' | 'sentence'): SegmenterLike | null {
  const intl = Intl as unknown as { Segmenter?: SegmenterConstructor };
  if (!intl.Segmenter) return null;
  try {
    return new intl.Segmenter(undefined, { granularity });
  } catch {
    return null;
  }
}

const HAS_LETTER = /[\p{L}\p{Nd}]/u;

/**
 * Fallback word splitter: letter/digit runs, allowing internal apostrophes and
 * hyphens so "don't" and "state-of-the-art" each count as one word.
 */
const WORD_PATTERN = /[\p{L}\p{Nd}]+(?:['’-][\p{L}\p{Nd}]+)*/gu;

export function splitWordsRegex(text: string): string[] {
  return text.match(WORD_PATTERN) ?? [];
}

export function splitWords(text: string, useSegmenter = true): string[] {
  const segmenter = useSegmenter ? getSegmenter('word') : null;
  if (!segmenter) return splitWordsRegex(text);
  const words: string[] = [];
  for (const part of segmenter.segment(text)) {
    if (part.isWordLike === true) words.push(part.segment);
  }
  return words;
}

/**
 * Fallback sentence splitter: break after `.`, `!`, `?` or `…` (plus any
 * closing quote or bracket) followed by whitespace, and at line breaks.
 */
export function splitSentencesRegex(text: string): string[] {
  return text
    .split(/(?<=[.!?…]["'”’)\]]*)\s+|\n+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => HAS_LETTER.test(sentence));
}

export function splitSentences(text: string, useSegmenter = true): string[] {
  const segmenter = useSegmenter ? getSegmenter('sentence') : null;
  if (!segmenter) return splitSentencesRegex(text);
  const sentences: string[] = [];
  for (const part of segmenter.segment(text)) {
    const trimmed = part.segment.trim();
    if (HAS_LETTER.test(trimmed)) sentences.push(trimmed);
  }
  return sentences;
}

/** Blocks of text separated by one or more blank lines. */
export function countParagraphs(text: string): number {
  return text.split(/\n\s*\n/).filter((block) => HAS_LETTER.test(block)).length;
}

/** Lines, counting a trailing newline as ending the last line. */
export function countLines(text: string): number {
  if (text === '') return 0;
  return text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n').length;
}

const encoder = new TextEncoder();

/** Size in bytes when encoded as UTF-8. */
export function byteSize(text: string): number {
  return encoder.encode(text).length;
}

/** Unicode code points, so an emoji counts as one character. */
export function countCharacters(text: string): number {
  return [...text].length;
}

export function countCharactersNoSpaces(text: string): number {
  return [...text].filter((char) => !/\s/u.test(char)).length;
}

// ---------------------------------------------------------------------------
// Word frequency
// ---------------------------------------------------------------------------

/** Common English function words, excluded from "Top words" by default. */
// prettier-ignore
export const STOP_WORDS: ReadonlySet<string> = new Set([
  'a', 'about', 'after', 'all', 'also', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'but', 'by',
  'can', 'could', 'did', 'do', 'does', 'doing', 'done', 'down', 'during',
  'each', 'for', 'from', 'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here',
  'hers', 'him', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself',
  'just', 'me', 'more', 'most', 'my', 'no', 'nor', 'not', 'now', 'of', 'off', 'on',
  'once', 'only', 'or', 'other', 'our', 'ours', 'out', 'over', 'own',
  'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'them',
  'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'us', 'very', 'was', 'we', 'were', 'what', 'when', 'where',
  'which', 'while', 'who', 'whom', 'why', 'will', 'with', 'would',
  'you', 'your', 'yours',
]);

export interface WordFrequency {
  word: string;
  count: number;
  /** Share of all words in the text, 0–100, rounded to one decimal. */
  percent: number;
}

export interface TopWordsOptions {
  excludeStopWords?: boolean;
  limit?: number;
}

/** Most frequent words, case-insensitive, ties broken alphabetically. */
export function topWords(words: readonly string[], options: TopWordsOptions = {}): WordFrequency[] {
  const excludeStopWords = options.excludeStopWords ?? true;
  const limit = options.limit ?? DEFAULT_TOP_WORDS;
  const counts = new Map<string, number>();

  for (const raw of words) {
    const word = raw.toLocaleLowerCase();
    if (excludeStopWords && STOP_WORDS.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  const total = words.length;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, Math.max(0, limit))
    .map(([word, count]) => ({
      word,
      count,
      percent: total === 0 ? 0 : Math.round((count / total) * 1000) / 10,
    }));
}

// ---------------------------------------------------------------------------
// Platform limits
// ---------------------------------------------------------------------------

export interface PlatformLimit {
  id: string;
  label: string;
  max: number;
}

export const LIMITS: readonly PlatformLimit[] = [
  { id: 'x', label: 'Twitter/X', max: 280 },
  { id: 'sms', label: 'SMS', max: 160 },
  { id: 'meta', label: 'Meta description', max: 160 },
  { id: 'title', label: 'Title tag', max: 60 },
];

export interface LimitStatus {
  used: number;
  remaining: number;
  over: boolean;
}

export function limitStatus(characters: number, max: number): LimitStatus {
  return { used: characters, remaining: max - characters, over: characters > max };
}

// ---------------------------------------------------------------------------
// Duration formatting
// ---------------------------------------------------------------------------

/** "0 sec", "45 sec", "1 min", "2 min 30 sec". */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total} sec`;
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} sec`;
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

export interface AnalyzeOptions {
  /** Use Intl.Segmenter when the runtime provides it (default true). */
  useSegmenter?: boolean;
  /** Reading speed in words per minute (default 200). */
  readingWpm?: number;
  /** Speaking speed in words per minute (default 130). */
  speakingWpm?: number;
  /** Leave common English words out of the top-words table (default true). */
  excludeStopWords?: boolean;
  /** How many rows the top-words table gets (default 10). */
  topWordCount?: number;
}

export interface TextStats {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  uniqueWords: number;
  sentences: number;
  paragraphs: number;
  lines: number;
  /** Mean word length in characters, one decimal. */
  averageWordLength: number;
  longestWord: string;
  bytes: number;
  readingWpm: number;
  readingSeconds: number;
  speakingWpm: number;
  speakingSeconds: number;
  top: WordFrequency[];
}

export function analyze(text: string, options: AnalyzeOptions = {}): TextStats {
  assertWithinLimit(text);
  const readingWpm = options.readingWpm ?? DEFAULT_READING_WPM;
  const speakingWpm = options.speakingWpm ?? SPEAKING_WPM;
  assertValidWpm(readingWpm);
  assertValidWpm(speakingWpm);

  const useSegmenter = options.useSegmenter ?? true;
  const words = splitWords(text, useSegmenter);
  const unique = new Set(words.map((word) => word.toLocaleLowerCase()));

  let longestWord = '';
  let totalLength = 0;
  for (const word of words) {
    const length = [...word].length;
    totalLength += length;
    if (length > [...longestWord].length) longestWord = word;
  }

  return {
    characters: countCharacters(text),
    charactersNoSpaces: countCharactersNoSpaces(text),
    words: words.length,
    uniqueWords: unique.size,
    sentences: splitSentences(text, useSegmenter).length,
    paragraphs: countParagraphs(text),
    lines: countLines(text),
    averageWordLength: words.length === 0 ? 0 : Math.round((totalLength / words.length) * 10) / 10,
    longestWord,
    bytes: byteSize(text),
    readingWpm,
    readingSeconds: words.length === 0 ? 0 : Math.round((words.length / readingWpm) * 60),
    speakingWpm,
    speakingSeconds: words.length === 0 ? 0 : Math.round((words.length / speakingWpm) * 60),
    top: topWords(words, {
      excludeStopWords: options.excludeStopWords ?? true,
      limit: options.topWordCount ?? DEFAULT_TOP_WORDS,
    }),
  };
}

/** The whole report as plain text — what the Copy stats button puts on the clipboard. */
export function formatStatsText(stats: TextStats): string {
  const number = (value: number) => value.toLocaleString('en-US');
  const lines = [
    `Characters: ${number(stats.characters)}`,
    `Characters (no spaces): ${number(stats.charactersNoSpaces)}`,
    `Words: ${number(stats.words)}`,
    `Unique words: ${number(stats.uniqueWords)}`,
    `Sentences: ${number(stats.sentences)}`,
    `Paragraphs: ${number(stats.paragraphs)}`,
    `Lines: ${number(stats.lines)}`,
    `Average word length: ${stats.averageWordLength} characters`,
    `Longest word: ${stats.longestWord === '' ? '—' : stats.longestWord}`,
    `Size: ${number(stats.bytes)} bytes (UTF-8)`,
    `Reading time (${stats.readingWpm} wpm): ${formatDuration(stats.readingSeconds)}`,
    `Speaking time (${stats.speakingWpm} wpm): ${formatDuration(stats.speakingSeconds)}`,
  ];
  if (stats.top.length > 0) {
    lines.push('', 'Top words:');
    for (const entry of stats.top) {
      lines.push(`  ${entry.word}: ${number(entry.count)} (${entry.percent}%)`);
    }
  }
  return lines.join('\n');
}

export const SAMPLE = [
  'Writing is thinking made visible. A good paragraph earns its length: every sentence',
  'moves the argument forward, and nothing is repeated for the sake of filling space.',
  '',
  'Counting words is the easy part. Deciding which words to keep is the work — cut the',
  'sentence that says nothing, and the paragraph that only restates the one before it.',
].join('\n');
