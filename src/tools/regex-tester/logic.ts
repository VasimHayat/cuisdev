/**
 * Regex Tester — pure functions, no DOM. Everything the UI needs (matching,
 * capture groups, highlight segments, replacement) lives here so it can be unit
 * tested and, in the browser, run inside a Web Worker where a catastrophically
 * backtracking pattern cannot freeze the page.
 */

export class RegexError extends Error {
  override name = 'RegexError';
}

/** Flags a user may type. `d` (hasIndices) is added internally for group ranges. */
export const USER_FLAGS = ['g', 'i', 'm', 's', 'u', 'v', 'y'] as const;
export type RegexFlag = (typeof USER_FLAGS)[number];

/** Matching stops here so a pathological pattern cannot produce a million rows. */
export const DEFAULT_MATCH_LIMIT = 2000;

export interface CaptureGroup {
  /** 1-based position of the group in the pattern. */
  index: number;
  /** Group name for `(?<name>…)`, otherwise undefined. */
  name: string | undefined;
  /** `name` when the group is named, otherwise the number as a string. */
  label: string;
  /** undefined when the group did not participate in the match. */
  value: string | undefined;
  /** -1 when the group did not participate. */
  start: number;
  end: number;
}

export interface RegexMatch {
  /** 0-based position in the result list. */
  index: number;
  value: string;
  start: number;
  end: number;
  groups: CaptureGroup[];
}

export interface MatchOutcome {
  matches: RegexMatch[];
  /** True when matching stopped at the limit. */
  truncated: boolean;
}

export interface RegexRequest {
  pattern: string;
  flags: string;
  text: string;
  /** When set, the replacement result is computed too. */
  replacement?: string | undefined;
  limit?: number | undefined;
}

export type RegexResult =
  | {
      ok: true;
      matches: RegexMatch[];
      truncated: boolean;
      /** null when no replacement was requested. */
      replaced: string | null;
    }
  | { ok: false; error: string };

/** Remove duplicate flag characters, preserving the order they were given in. */
export function normalizeFlags(flags: string | readonly string[]): string {
  const chars = typeof flags === 'string' ? [...flags] : flags.flatMap((f) => [...f]);
  const seen = new Set<string>();
  for (const char of chars) if (char.trim() !== '') seen.add(char);
  return [...seen].join('');
}

/** Throw a friendly RegexError for flags the engine would reject cryptically. */
export function validateFlags(flags: string): void {
  const allowed: readonly string[] = USER_FLAGS;
  for (const char of flags) {
    if (char === 'd') continue; // harmless, added internally
    if (!allowed.includes(char)) {
      throw new RegexError(`Unknown flag "${char}" — valid flags are g, i, m, s, u, v and y.`);
    }
  }
  if (flags.includes('u') && flags.includes('v')) {
    throw new RegexError(
      'Flags u and v cannot be used together — v is the newer Unicode mode, pick one.',
    );
  }
}

/**
 * Compile a pattern, turning the engine's SyntaxError into a RegexError with
 * the engine's own (usually very specific) message.
 */
export function buildRegex(pattern: string, flags: string | readonly string[] = ''): RegExp {
  const normalized = normalizeFlags(flags);
  validateFlags(normalized);
  try {
    return new RegExp(pattern, normalized);
  } catch (err) {
    throw new RegexError(err instanceof Error ? err.message : 'Invalid regular expression.');
  }
}

/**
 * Names of the capturing groups in source order: `undefined` for a plain
 * `(…)`, the name for `(?<name>…)`. Non-capturing groups, lookarounds and
 * anything inside a character class are ignored.
 */
export function captureGroupNames(pattern: string): (string | undefined)[] {
  const names: (string | undefined)[] = [];
  let inClass = false;
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === '\\') {
      i++;
      continue;
    }
    if (inClass) {
      if (char === ']') inClass = false;
      continue;
    }
    if (char === '[') {
      inClass = true;
      continue;
    }
    if (char !== '(') continue;
    if (pattern[i + 1] !== '?') {
      names.push(undefined);
      continue;
    }
    const named = /^\(\?<(?![=!])([^>]*)>/.exec(pattern.slice(i));
    if (named) names.push(named[1]);
  }
  return names;
}

/** True when the flags make the regex walk the whole string. */
export function isGlobal(flags: string): boolean {
  return flags.includes('g') || flags.includes('y');
}

/**
 * Run `pattern` over `text` and collect every match with its capture groups.
 * An empty pattern matches nothing here (rather than every position), because
 * an empty input box should not report thousands of zero-length matches.
 */
export function findMatches(
  pattern: string,
  flags: string | readonly string[],
  text: string,
  options: { limit?: number } = {},
): MatchOutcome {
  const limit = options.limit ?? DEFAULT_MATCH_LIMIT;
  const normalized = normalizeFlags(flags);
  validateFlags(normalized);
  if (pattern === '' || text === '') return { matches: [], truncated: false };

  const regex = buildRegex(pattern, normalizeFlags(`${normalized}d`));
  const names = captureGroupNames(pattern);
  const matches: RegexMatch[] = [];
  let truncated = false;

  if (!isGlobal(normalized)) {
    const single = regex.exec(text);
    if (single) matches.push(toMatch(single, 0, names));
    return { matches, truncated };
  }

  regex.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (matches.length >= limit) {
      truncated = true;
      break;
    }
    matches.push(toMatch(m, matches.length, names));
    // A zero-length match would otherwise loop forever on the same index.
    if (m[0] === '') regex.lastIndex += 1;
    if (regex.lastIndex > text.length) break;
  }
  return { matches, truncated };
}

function toMatch(m: RegExpExecArray, index: number, names: (string | undefined)[]): RegexMatch {
  const start = m.index;
  const value = m[0] ?? '';
  const indices = (m as RegExpExecArray & { indices?: ([number, number] | undefined)[] }).indices;
  const groups: CaptureGroup[] = [];
  for (let i = 1; i < m.length; i++) {
    const name = names[i - 1];
    const range = indices?.[i];
    groups.push({
      index: i,
      name,
      label: name ?? String(i),
      value: m[i],
      start: range ? range[0] : -1,
      end: range ? range[1] : -1,
    });
  }
  return { index, value, start, end: start + value.length, groups };
}

/**
 * Apply a replacement string. `$1`, `$<name>`, `$&`, `` $` ``, `$'` and `$$`
 * behave exactly as they do in `String.prototype.replace`, which is what this
 * uses. Without the `g` flag only the first match is replaced.
 */
export function replaceMatches(
  pattern: string,
  flags: string | readonly string[],
  text: string,
  replacement: string,
): string {
  if (pattern === '') return text;
  const regex = buildRegex(pattern, flags);
  return text.replace(regex, replacement);
}

export interface HighlightSegment {
  text: string;
  /** null for the text between matches. */
  matchIndex: number | null;
}

/**
 * Split `text` into plain and matched segments so the UI can rebuild it with
 * `<mark>` elements without ever touching innerHTML. Zero-length matches have
 * nothing to highlight and are skipped.
 */
export function highlightSegments(
  text: string,
  matches: readonly RegexMatch[],
): HighlightSegment[] {
  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.end <= match.start) continue;
    if (match.start < cursor) continue; // overlapping — keep the first one
    if (match.start > cursor) {
      segments.push({ text: text.slice(cursor, match.start), matchIndex: null });
    }
    segments.push({ text: text.slice(match.start, match.end), matchIndex: match.index });
    cursor = match.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), matchIndex: null });
  return segments;
}

/** One match per line — what the Copy matches button puts on the clipboard. */
export function matchesToText(matches: readonly RegexMatch[]): string {
  return matches.map((m) => m.value).join('\n');
}

export function describeMatchCount(count: number, truncated = false): string {
  if (truncated) return `First ${count.toLocaleString()} matches (stopped at the limit)`;
  if (count === 0) return 'No matches';
  if (count === 1) return '1 match';
  return `${count.toLocaleString()} matches`;
}

/**
 * Everything the UI needs, in one serializable call — this is what the Web
 * Worker runs, so a catastrophic pattern burns a worker instead of the page.
 */
export function runRegex(request: RegexRequest): RegexResult {
  try {
    const { matches, truncated } = findMatches(request.pattern, request.flags, request.text, {
      ...(request.limit === undefined ? {} : { limit: request.limit }),
    });
    const replaced =
      request.replacement === undefined
        ? null
        : replaceMatches(request.pattern, request.flags, request.text, request.replacement);
    return { ok: true, matches, truncated, replaced };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not run this regular expression.',
    };
  }
}
