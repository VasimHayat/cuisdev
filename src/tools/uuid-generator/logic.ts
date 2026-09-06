/**
 * UUID Generator — pure functions, no DOM.
 *
 * Generates RFC 9562 UUIDs (v4 random, v7 time-ordered, nil and max), formats
 * batches for pasting into code, and parses/inspects existing UUIDs (version,
 * variant and the embedded timestamp for v1, v6 and v7).
 */

export class UuidError extends Error {
  override name = 'UuidError';
}

export type UuidVersion = 'v4' | 'v7' | 'nil' | 'max';
export type OutputFormat = 'lines' | 'comma' | 'json' | 'ts';

export interface FormatOptions {
  uppercase?: boolean;
  removeHyphens?: boolean;
  /** Wrap each UUID in double quotes (lines / comma formats only; JSON and TS are always quoted). */
  quotes?: boolean;
  format?: OutputFormat;
}

export interface GenerateOptions extends FormatOptions {
  version: UuidVersion;
  /** How many UUIDs to produce (1–1000). */
  count: number;
}

export interface ParsedUuid {
  /** Canonical lower-case, hyphenated form. */
  uuid: string;
  /** 0 for nil/max or non-RFC variants, otherwise the version nibble (1–8). */
  version: number;
  versionLabel: string;
  variant: 'NCS' | 'RFC 9562' | 'Microsoft' | 'Reserved';
  /** Embedded timestamp for v1, v6 and v7. */
  timestamp?: Date | undefined;
  /** One-line human summary. */
  summary: string;
}

export const MIN_COUNT = 1;
export const MAX_COUNT = 1000;
export const NIL_UUID = '00000000-0000-0000-0000-000000000000';
export const MAX_UUID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

const HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

/** 100-ns ticks between the Gregorian epoch (1582-10-15) and the Unix epoch. */
const GREGORIAN_OFFSET_100NS = 0x01b21dd213814000n;

/** Random bytes source, injectable for tests. Must fill and return `bytes`. */
export type RandomSource = (bytes: Uint8Array) => Uint8Array;

const defaultRandom: RandomSource = (bytes) => {
  crypto.getRandomValues(bytes);
  return bytes;
};

/** Format 16 bytes as the canonical 8-4-4-4-12 string. */
export function bytesToUuid(bytes: Uint8Array): string {
  if (bytes.length !== 16) {
    throw new UuidError(`A UUID needs exactly 16 bytes, got ${bytes.length}.`);
  }
  let s = '';
  for (let i = 0; i < 16; i++) {
    if (i === 4 || i === 6 || i === 8 || i === 10) s += '-';
    s += HEX[bytes[i] as number];
  }
  return s;
}

/** Parse a UUID string into its 16 bytes (accepts braces, urn:uuid: and no hyphens). */
export function uuidToBytes(input: string): Uint8Array {
  const hex = normalizeUuid(input).replace(/-/g, '');
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/** Generate a version 4 (random) UUID. */
export function uuidV4(random: RandomSource = defaultRandom): string {
  if (random === defaultRandom && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = random(new Uint8Array(16));
  bytes[6] = ((bytes[6] as number) & 0x0f) | 0x40; // version 4
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80; // variant 10xx
  return bytesToUuid(bytes);
}

/**
 * Build a version 7 UUID from a Unix millisecond timestamp and 74 random bits.
 *
 * Layout (RFC 9562 §5.7): 48-bit unix_ts_ms | 4-bit ver (0111) | 12-bit rand_a |
 * 2-bit var (10) | 62-bit rand_b.
 *
 * `randA` may be supplied to implement a monotonic counter (§6.2, method 1).
 */
export function uuidV7(
  timestampMs: number = Date.now(),
  random: RandomSource = defaultRandom,
  randA?: number,
): string {
  if (!Number.isFinite(timestampMs) || timestampMs < 0 || timestampMs >= 2 ** 48) {
    throw new UuidError(
      `Timestamp ${String(timestampMs)} is out of range — v7 UUIDs hold 48 bits of milliseconds (0 to 2^48 − 1).`,
    );
  }
  const ts = Math.floor(timestampMs);
  const bytes = random(new Uint8Array(16));
  // 48-bit big-endian timestamp, split to stay within 32-bit integer maths.
  const hi = Math.floor(ts / 2 ** 32); // top 16 bits
  const lo = ts % 2 ** 32; // low 32 bits
  bytes[0] = (hi >>> 8) & 0xff;
  bytes[1] = hi & 0xff;
  bytes[2] = (lo >>> 24) & 0xff;
  bytes[3] = (lo >>> 16) & 0xff;
  bytes[4] = (lo >>> 8) & 0xff;
  bytes[5] = lo & 0xff;
  if (randA !== undefined) {
    const a = randA & 0x0fff;
    bytes[6] = a >>> 8;
    bytes[7] = a & 0xff;
  }
  bytes[6] = ((bytes[6] as number) & 0x0f) | 0x70; // version 7
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80; // variant 10xx
  return bytesToUuid(bytes);
}

/** Random 12-bit counter seed with the top bit clear: ≥ 2048 increments before overflow. */
function randomCounterSeed(random: RandomSource): number {
  const b = random(new Uint8Array(2));
  return (((b[0] as number) << 8) | (b[1] as number)) & 0x07ff;
}

/**
 * A v7 generator that is strictly monotonic: UUIDs created in the same
 * millisecond share the timestamp and increment the 12-bit rand_a counter
 * (RFC 9562 §6.2 method 1). If the counter overflows, the timestamp is nudged
 * forward by 1 ms so ordering still holds. The clock never runs backwards.
 */
export function createV7Generator(
  now: () => number = Date.now,
  random: RandomSource = defaultRandom,
): () => string {
  let lastTs = -1;
  let counter = 0;
  return () => {
    let ts = Math.max(now(), lastTs);
    if (ts === lastTs) {
      counter++;
      if (counter > 0x0fff) {
        ts++;
        counter = randomCounterSeed(random);
      }
    } else {
      counter = randomCounterSeed(random);
    }
    lastTs = ts;
    return uuidV7(ts, random, counter);
  };
}

/** Produce a batch of UUIDs (canonical lower-case, unformatted). */
export function generateUuids(
  version: UuidVersion,
  count: number,
  random: RandomSource = defaultRandom,
  now: () => number = Date.now,
): string[] {
  if (!Number.isInteger(count) || count < MIN_COUNT || count > MAX_COUNT) {
    throw new UuidError(
      `Count must be a whole number between ${MIN_COUNT} and ${MAX_COUNT}, got ${String(count)}.`,
    );
  }
  const out = new Array<string>(count);
  switch (version) {
    case 'v4':
      for (let i = 0; i < count; i++) out[i] = uuidV4(random);
      break;
    case 'v7': {
      const next = createV7Generator(now, random);
      for (let i = 0; i < count; i++) out[i] = next();
      break;
    }
    case 'nil':
      out.fill(NIL_UUID);
      break;
    case 'max':
      out.fill(MAX_UUID);
      break;
    default:
      throw new UuidError(`Unknown UUID version "${String(version)}" — choose v4, v7, nil or max.`);
  }
  return out;
}

/** Apply case, hyphen, quote and layout options to a list of UUIDs. */
export function formatUuids(uuids: string[], options: FormatOptions = {}): string {
  const format = options.format ?? 'lines';
  const items = uuids.map((u) => {
    let s = u;
    if (options.removeHyphens) s = s.replace(/-/g, '');
    if (options.uppercase) s = s.toUpperCase();
    return s;
  });
  switch (format) {
    case 'lines':
      return items.map((s) => (options.quotes ? `"${s}"` : s)).join('\n');
    case 'comma':
      return items.map((s) => (options.quotes ? `"${s}"` : s)).join(', ');
    case 'json':
      return items.length === 0 ? '[]' : `[\n${items.map((s) => `  "${s}"`).join(',\n')}\n]`;
    case 'ts':
      return items.length === 0
        ? 'const uuids: string[] = [];'
        : `const uuids: string[] = [\n${items.map((s) => `  '${s}',`).join('\n')}\n];`;
    default:
      throw new UuidError(
        `Unknown output format "${String(format)}" — choose lines, comma, json or ts.`,
      );
  }
}

/** Generate and format in one step. */
export function generate(
  options: GenerateOptions,
  random: RandomSource = defaultRandom,
  now: () => number = Date.now,
): string {
  return formatUuids(generateUuids(options.version, options.count, random, now), options);
}

/**
 * Normalise user input to the canonical lower-case hyphenated form. Accepts
 * `{…}` braces, a `urn:uuid:` prefix, upper case and 32 bare hex digits.
 * Throws UuidError with a specific reason otherwise.
 */
export function normalizeUuid(input: string): string {
  let s = input.replace(/^\uFEFF/, '').trim();
  if (s === '') throw new UuidError('Paste a UUID to inspect it.');
  if (s.startsWith('{') && s.endsWith('}')) s = s.slice(1, -1);
  s = s.replace(/^urn:uuid:/i, '').toLowerCase();

  const bare = s.replace(/-/g, '');
  const bad = /[^0-9a-f]/.exec(bare);
  if (bad) {
    throw new UuidError(
      `Invalid character "${bad[0]}" — a UUID only contains hex digits (0–9, a–f) and hyphens.`,
    );
  }
  if (bare.length !== 32) {
    throw new UuidError(
      `A UUID has 32 hex digits, this one has ${bare.length}. Check for missing or extra characters.`,
    );
  }
  if (
    s.includes('-') &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s)
  ) {
    throw new UuidError(
      'Hyphens are in the wrong places — the canonical layout is 8-4-4-4-12 hex digits.',
    );
  }
  return `${bare.slice(0, 8)}-${bare.slice(8, 12)}-${bare.slice(12, 16)}-${bare.slice(16, 20)}-${bare.slice(20)}`;
}

export function isValidUuid(input: string): boolean {
  try {
    normalizeUuid(input);
    return true;
  } catch {
    return false;
  }
}

const VERSION_LABELS: Record<number, string> = {
  1: 'Gregorian time-based',
  2: 'DCE Security',
  3: 'Name-based (MD5)',
  4: 'Random',
  5: 'Name-based (SHA-1)',
  6: 'Reordered Gregorian time-based',
  7: 'Unix Epoch time-based',
  8: 'Custom / experimental',
};

/** Inspect a UUID: version, variant and embedded timestamp where one exists. */
export function parseUuid(input: string): ParsedUuid {
  const uuid = normalizeUuid(input);
  const bytes = uuidToBytes(uuid);

  if (uuid === NIL_UUID) {
    return {
      uuid,
      version: 0,
      versionLabel: 'Nil UUID',
      variant: 'NCS',
      summary: 'Nil UUID — all 128 bits are zero (RFC 9562 §5.9).',
    };
  }
  if (uuid === MAX_UUID) {
    return {
      uuid,
      version: 0,
      versionLabel: 'Max UUID',
      variant: 'Reserved',
      summary: 'Max UUID — all 128 bits are one (RFC 9562 §5.10).',
    };
  }

  const variantByte = bytes[8] as number;
  let variant: ParsedUuid['variant'];
  if ((variantByte & 0x80) === 0) variant = 'NCS';
  else if ((variantByte & 0xc0) === 0x80) variant = 'RFC 9562';
  else if ((variantByte & 0xe0) === 0xc0) variant = 'Microsoft';
  else variant = 'Reserved';

  if (variant !== 'RFC 9562') {
    return {
      uuid,
      version: 0,
      versionLabel: 'Not an RFC 9562 UUID',
      variant,
      summary: `Variant "${variant}" — this layout does not define a version field.`,
    };
  }

  const version = (bytes[6] as number) >> 4;
  const versionLabel = VERSION_LABELS[version] ?? 'Unknown version';
  const timestamp = extractTimestamp(bytes, version);
  return {
    uuid,
    version,
    versionLabel,
    variant,
    timestamp,
    summary: `Version ${version} (${versionLabel}), variant ${variant}.`,
  };
}

/** Pull the embedded timestamp out of a v1, v6 or v7 UUID's bytes. */
export function extractTimestamp(bytes: Uint8Array, version: number): Date | undefined {
  const b = (i: number) => BigInt(bytes[i] as number);
  if (version === 7) {
    let ms = 0n;
    for (let i = 0; i < 6; i++) ms = (ms << 8n) | b(i);
    return new Date(Number(ms));
  }
  if (version === 1) {
    const timeLow = (b(0) << 24n) | (b(1) << 16n) | (b(2) << 8n) | b(3);
    const timeMid = (b(4) << 8n) | b(5);
    const timeHi = ((b(6) & 0x0fn) << 8n) | b(7);
    return gregorianTicksToDate((timeHi << 48n) | (timeMid << 32n) | timeLow);
  }
  if (version === 6) {
    const timeHigh = (b(0) << 24n) | (b(1) << 16n) | (b(2) << 8n) | b(3);
    const timeMid = (b(4) << 8n) | b(5);
    const timeLow = ((b(6) & 0x0fn) << 8n) | b(7);
    return gregorianTicksToDate((timeHigh << 28n) | (timeMid << 12n) | timeLow);
  }
  return undefined;
}

/** 100-ns ticks since 1582-10-15 → JS Date (millisecond precision, floor). */
function gregorianTicksToDate(ticks: bigint): Date {
  const unix100ns = ticks - GREGORIAN_OFFSET_100NS;
  const ms = unix100ns >= 0n ? unix100ns / 10000n : -((-unix100ns + 9999n) / 10000n);
  return new Date(Number(ms));
}

/** Milliseconds encoded in a v7 UUID, or undefined for other versions. */
export function v7Timestamp(uuid: string): number | undefined {
  const parsed = parseUuid(uuid);
  return parsed.version === 7 ? parsed.timestamp?.getTime() : undefined;
}
