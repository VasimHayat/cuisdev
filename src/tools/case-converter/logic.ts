/**
 * Case Converter — pure functions, no DOM.
 *
 * Prose cases (UPPER, lower, Title, Sentence, aLtErNaTiNg, iNVERSE) work on the
 * text as written so punctuation and spacing survive. Identifier cases
 * (camelCase, snake_case, …) run the word splitter over each line separately,
 * because a list of names should convert to a list of identifiers.
 */

export class CaseConverterError extends Error {
  override name = 'CaseConverterError';
}

/** 13 conversions × a long text is a lot of DOM; keep the input sane. */
export const MAX_CHARS = 100_000;

export function assertWithinLimit(text: string): void {
  if (text.length <= MAX_CHARS) return;
  throw new CaseConverterError(
    `Text is ${text.length.toLocaleString('en-US')} characters. The limit is ${MAX_CHARS.toLocaleString('en-US')} — convert a smaller section.`,
  );
}

// ---------------------------------------------------------------------------
// Word splitting
// ---------------------------------------------------------------------------

/**
 * Matches, in order: an acronym run before a capitalised word (`XML` in
 * `XMLHttpRequest`), a normal word with optional internal apostrophes and
 * trailing digits (`Http`, `don't`, `html5`), an all-caps run, a bare number,
 * and finally any other letter run (scripts without upper/lower case).
 */
const WORD_PATTERN =
  /\p{Lu}+(?=\p{Lu}\p{Ll})|\p{Lu}?\p{Ll}+(?:['’]\p{L}+)*\p{Nd}*|\p{Lu}+\p{Nd}*|\p{Nd}+|\p{L}+\p{Nd}*/gu;

/**
 * Split text into words, understanding camelCase and PascalCase boundaries,
 * acronyms, digits, punctuation and Unicode letters.
 *
 * `splitWords('XMLHttpRequest')` → `['XML', 'Http', 'Request']`
 */
export function splitWords(text: string): string[] {
  return text.match(WORD_PATTERN) ?? [];
}

/** Words with apostrophes removed — `don't` is one identifier part, `dont`. */
function identifierWords(line: string): string[] {
  return splitWords(line)
    .map((word) => word.replace(/['’]/g, ''))
    .filter((word) => word !== '');
}

function lower(word: string): string {
  return word.toLocaleLowerCase();
}

function upper(word: string): string {
  return word.toLocaleUpperCase();
}

/** Upper-case the first character (code-point safe), lower-case the rest. */
export function capitalize(word: string): string {
  const chars = [...word.toLocaleLowerCase()];
  const first = chars[0];
  if (first === undefined) return '';
  return first.toLocaleUpperCase() + chars.slice(1).join('');
}

/** Run `fn` over each line, normalising CRLF to LF. */
function mapLines(text: string, fn: (line: string) => string): string {
  return text
    .split('\n')
    .map((line) => fn(line.replace(/\r$/, '')))
    .join('\n');
}

function joinIdentifier(text: string, join: (words: string[]) => string): string {
  return mapLines(text, (line) => join(identifierWords(line)));
}

// ---------------------------------------------------------------------------
// Prose cases
// ---------------------------------------------------------------------------

/** Words that stay lower-case in a title unless they are first or last. */
export const TITLE_SMALL_WORDS: ReadonlySet<string> = new Set([
  'a',
  'an',
  'the',
  'of',
  'in',
  'on',
  'at',
  'to',
  'for',
  'and',
  'but',
  'or',
]);

export function toUpperCase(text: string): string {
  return text.toLocaleUpperCase();
}

export function toLowerCase(text: string): string {
  return text.toLocaleLowerCase();
}

/**
 * Title Case, aware of small words: `the lord of the rings` →
 * `The Lord of the Rings`. The first and last word are always capitalised.
 */
export function toTitleCase(text: string): string {
  return mapLines(text, (line) => {
    const tokens = line.split(/(\s+)/);
    const wordPositions = tokens
      .map((token, index) => (token.trim() === '' ? -1 : index))
      .filter((index) => index >= 0);
    const first = wordPositions[0];
    const last = wordPositions.at(-1);

    return tokens
      .map((token, index) => {
        if (token.trim() === '') return token;
        const bare = token.replace(/[^\p{L}\p{Nd}'’]/gu, '');
        if (index !== first && index !== last && TITLE_SMALL_WORDS.has(lower(bare))) {
          return lower(token);
        }
        return capitalizeToken(token);
      })
      .join('');
  });
}

/** Lower-case a token, then upper-case its first letter (skipping punctuation). */
function capitalizeToken(token: string): string {
  let done = false;
  return [...token.toLocaleLowerCase()]
    .map((char) => {
      if (done || char.toLocaleUpperCase() === char.toLocaleLowerCase()) return char;
      done = true;
      return char.toLocaleUpperCase();
    })
    .join('');
}

/**
 * Sentence case: everything lower-case, with the first letter of the text, of
 * every line and of every sentence (after `.`, `!` or `?`) capitalised.
 */
export function toSentenceCase(text: string): string {
  return text
    .toLocaleLowerCase()
    .replace(
      /(^|[.!?]["'”’)\]]?[ \t]+|\n[ \t]*)(\p{L})/gu,
      (_match, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase()}`,
    );
}

/** aLtErNaTiNg case, starting lower; characters without case are skipped. */
export function toAlternatingCase(text: string): string {
  let useUpper = false;
  let out = '';
  for (const char of text) {
    const lowered = char.toLocaleLowerCase();
    const uppered = char.toLocaleUpperCase();
    if (lowered === uppered) {
      out += char;
      continue;
    }
    out += useUpper ? uppered : lowered;
    useUpper = !useUpper;
  }
  return out;
}

/** iNVERSE case: every letter swaps case. */
export function toInverseCase(text: string): string {
  let out = '';
  for (const char of text) {
    const uppered = char.toLocaleUpperCase();
    out += char === uppered ? char.toLocaleLowerCase() : uppered;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Identifier cases
// ---------------------------------------------------------------------------

export function toCamelCase(text: string): string {
  return joinIdentifier(text, (words) =>
    words.map((word, index) => (index === 0 ? lower(word) : capitalize(word))).join(''),
  );
}

export function toPascalCase(text: string): string {
  return joinIdentifier(text, (words) => words.map(capitalize).join(''));
}

export function toSnakeCase(text: string): string {
  return joinIdentifier(text, (words) => words.map(lower).join('_'));
}

export function toScreamingSnakeCase(text: string): string {
  return joinIdentifier(text, (words) => words.map(upper).join('_'));
}

export function toKebabCase(text: string): string {
  return joinIdentifier(text, (words) => words.map(lower).join('-'));
}

export function toDotCase(text: string): string {
  return joinIdentifier(text, (words) => words.map(lower).join('.'));
}

export function toTrainCase(text: string): string {
  return joinIdentifier(text, (words) => words.map(capitalize).join('-'));
}

// ---------------------------------------------------------------------------
// The table of conversions
// ---------------------------------------------------------------------------

export type CaseId =
  | 'upper'
  | 'lower'
  | 'title'
  | 'sentence'
  | 'camel'
  | 'pascal'
  | 'snake'
  | 'screaming-snake'
  | 'kebab'
  | 'dot'
  | 'train'
  | 'alternating'
  | 'inverse';

export interface CaseDefinition {
  id: CaseId;
  /** Name shown in the output row, written in the case it produces. */
  label: string;
  /** Where it is normally used — shown next to the label. */
  hint: string;
  convert: (text: string) => string;
}

export const CASES: readonly CaseDefinition[] = [
  { id: 'upper', label: 'UPPER CASE', hint: 'Headings, shouting', convert: toUpperCase },
  { id: 'lower', label: 'lower case', hint: 'Normalising input', convert: toLowerCase },
  { id: 'title', label: 'Title Case', hint: 'Headlines, titles', convert: toTitleCase },
  { id: 'sentence', label: 'Sentence case', hint: 'Body copy, UI text', convert: toSentenceCase },
  { id: 'camel', label: 'camelCase', hint: 'JavaScript variables', convert: toCamelCase },
  { id: 'pascal', label: 'PascalCase', hint: 'Classes, components', convert: toPascalCase },
  { id: 'snake', label: 'snake_case', hint: 'Python, SQL columns', convert: toSnakeCase },
  {
    id: 'screaming-snake',
    label: 'SCREAMING_SNAKE_CASE',
    hint: 'Constants, env vars',
    convert: toScreamingSnakeCase,
  },
  { id: 'kebab', label: 'kebab-case', hint: 'URLs, CSS classes', convert: toKebabCase },
  { id: 'dot', label: 'dot.case', hint: 'Config keys, namespaces', convert: toDotCase },
  { id: 'train', label: 'Train-Case', hint: 'HTTP headers', convert: toTrainCase },
  {
    id: 'alternating',
    label: 'aLtErNaTiNg',
    hint: 'Memes and mockery',
    convert: toAlternatingCase,
  },
  { id: 'inverse', label: 'iNVERSE', hint: 'Fixing a stuck Caps Lock', convert: toInverseCase },
];

export function getCase(id: CaseId): CaseDefinition {
  const found = CASES.find((c) => c.id === id);
  if (!found) throw new CaseConverterError(`Unknown case "${id}".`);
  return found;
}

export function convertCase(text: string, id: CaseId): string {
  assertWithinLimit(text);
  return getCase(id).convert(text);
}

export interface CaseResult {
  id: CaseId;
  label: string;
  value: string;
}

export function convertAll(text: string): CaseResult[] {
  assertWithinLimit(text);
  return CASES.map((definition) => ({
    id: definition.id,
    label: definition.label,
    value: definition.convert(text),
  }));
}

/** Every conversion as labelled plain text — what "Copy all" puts on the clipboard. */
export function formatAll(text: string): string {
  return convertAll(text)
    .map((result) => `${result.label}\n${result.value}`)
    .join('\n\n');
}

export const SAMPLE = 'the quick brown fox jumps over the lazy dog\nXMLHttpRequest returns JSON';
