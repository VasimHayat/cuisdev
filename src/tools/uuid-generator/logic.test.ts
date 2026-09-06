import { describe, expect, it } from 'vitest';

import {
  MAX_UUID,
  NIL_UUID,
  UuidError,
  bytesToUuid,
  createV7Generator,
  extractTimestamp,
  formatUuids,
  generate,
  generateUuids,
  isValidUuid,
  normalizeUuid,
  parseUuid,
  uuidToBytes,
  uuidV4,
  uuidV7,
  v7Timestamp,
} from './logic';

const CANONICAL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Deterministic "random" source that fills every byte with `fill`. */
const constant = (fill: number) => (bytes: Uint8Array) => bytes.fill(fill);

describe('uuidV4', () => {
  it('produces canonical lower-case UUIDs with version 4 and RFC variant', () => {
    for (let i = 0; i < 50; i++) {
      const id = uuidV4();
      expect(id).toMatch(CANONICAL);
      expect(id[14]).toBe('4');
      expect('89ab').toContain(id[19] as string);
    }
  });

  it('is unique across a large batch', () => {
    const ids = new Set(Array.from({ length: 2000 }, () => uuidV4()));
    expect(ids.size).toBe(2000);
  });

  it('sets version and variant bits over an injected random source', () => {
    expect(uuidV4(constant(0xff))).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
    expect(uuidV4(constant(0x00))).toBe('00000000-0000-4000-8000-000000000000');
  });
});

describe('uuidV7', () => {
  it('encodes the 48-bit millisecond timestamp big-endian in the first 6 bytes', () => {
    const ts = 0x017f22e279b0; // 2022-02-22T19:22:22.000Z from RFC 9562 §A.6
    const id = uuidV7(ts, constant(0));
    expect(id.startsWith('017f22e2-79b0-7')).toBe(true);
    expect(v7Timestamp(id)).toBe(ts);
    expect(parseUuid(id).timestamp?.toISOString()).toBe('2022-02-22T19:22:22.000Z');
  });

  it('sets the version nibble to 7 and the variant bits to 10', () => {
    const bytes = uuidToBytes(uuidV7(Date.now(), constant(0xff)));
    expect((bytes[6] as number) >> 4).toBe(7);
    expect((bytes[8] as number) >> 6).toBe(0b10);
    // The random bits are untouched.
    expect(bytes[7]).toBe(0xff);
    expect(bytes[15]).toBe(0xff);
  });

  it('places rand_a in the 12 bits after the version', () => {
    const id = uuidV7(0, constant(0), 0xabc);
    expect(id).toBe('00000000-0000-7abc-8000-000000000000');
  });

  it('handles timestamps above 2^32 ms (i.e. every real date)', () => {
    const ts = 1_800_000_000_000;
    expect(v7Timestamp(uuidV7(ts, constant(0)))).toBe(ts);
  });

  it('rejects out-of-range timestamps', () => {
    expect(() => uuidV7(-1)).toThrow(UuidError);
    expect(() => uuidV7(2 ** 48)).toThrow(/48 bits/);
    expect(() => uuidV7(Number.NaN)).toThrow(/out of range/);
  });

  it('is lexicographically monotonic when generated within the same millisecond', () => {
    const next = createV7Generator(() => 1_700_000_000_000);
    const ids = Array.from({ length: 500 }, () => next());
    for (let i = 1; i < ids.length; i++) {
      expect((ids[i] as string) > (ids[i - 1] as string)).toBe(true);
    }
    expect(new Set(ids).size).toBe(500);
  });

  it('keeps ordering when the counter overflows by advancing the timestamp', () => {
    // The seed is capped at 0x7ff, so 2048 increments exhaust the 12-bit counter.
    const next = createV7Generator(
      () => 1000,
      (bytes) => bytes.fill(0xff),
    );
    const ids = Array.from({ length: 3000 }, () => next());
    expect(v7Timestamp(ids[0] as string)).toBe(1000);
    expect(v7Timestamp(ids[2048] as string)).toBe(1000);
    expect(v7Timestamp(ids[2049] as string)).toBe(1001);
    expect(v7Timestamp(ids[2999] as string)).toBe(1001);
    for (let i = 1; i < ids.length; i++)
      expect((ids[i] as string) > (ids[i - 1] as string)).toBe(true);
  });

  it('never goes backwards if the wall clock does', () => {
    let t = 5000;
    const next = createV7Generator(() => t);
    const a = next();
    t = 4000; // clock jumps back
    const b = next();
    expect(b > a).toBe(true);
    expect(v7Timestamp(b)).toBe(5000);
  });
});

describe('generateUuids', () => {
  it('produces the requested count for every version', () => {
    expect(generateUuids('v4', 5)).toHaveLength(5);
    expect(generateUuids('v7', 5)).toHaveLength(5);
    expect(generateUuids('nil', 2)).toEqual([NIL_UUID, NIL_UUID]);
    expect(generateUuids('max', 1)).toEqual([MAX_UUID]);
  });

  it('validates the count with a specific message', () => {
    expect(() => generateUuids('v4', 0)).toThrow(/between 1 and 1000, got 0/);
    expect(() => generateUuids('v4', 1001)).toThrow(UuidError);
    expect(() => generateUuids('v4', 2.5)).toThrow(/whole number/);
    expect(() => generateUuids('v4', Number.NaN)).toThrow(/got NaN/);
  });

  it('rejects unknown versions', () => {
    expect(() => generateUuids('v9' as never, 1)).toThrow(/Unknown UUID version "v9"/);
  });

  it('generates 1000 UUIDs quickly', () => {
    const start = performance.now();
    const ids = generateUuids('v7', 1000);
    expect(performance.now() - start).toBeLessThan(500);
    expect(new Set(ids).size).toBe(1000);
  });
});

describe('formatUuids', () => {
  const ids = ['017f22e2-79b0-7cc3-98c4-dc0c0c07398f', '00000000-0000-4000-8000-000000000000'];

  it('defaults to one per line, lower-case, hyphenated', () => {
    expect(formatUuids(ids)).toBe(ids.join('\n'));
  });

  it('applies uppercase, hyphen removal and quotes', () => {
    expect(
      formatUuids([ids[0] as string], { uppercase: true, removeHyphens: true, quotes: true }),
    ).toBe('"017F22E279B07CC398C4DC0C0C07398F"');
  });

  it('formats comma-separated with optional quotes', () => {
    expect(formatUuids(ids, { format: 'comma' })).toBe(`${ids[0]}, ${ids[1]}`);
    expect(formatUuids(ids, { format: 'comma', quotes: true })).toBe(`"${ids[0]}", "${ids[1]}"`);
  });

  it('formats a JSON array that parses back to the same list', () => {
    const json = formatUuids(ids, { format: 'json' });
    expect(JSON.parse(json)).toEqual(ids);
    expect(formatUuids([], { format: 'json' })).toBe('[]');
  });

  it('formats a TypeScript array', () => {
    expect(formatUuids([ids[0] as string], { format: 'ts' })).toBe(
      `const uuids: string[] = [\n  '${ids[0]}',\n];`,
    );
    expect(formatUuids([], { format: 'ts' })).toBe('const uuids: string[] = [];');
  });

  it('rejects unknown formats', () => {
    expect(() => formatUuids(ids, { format: 'xml' as never })).toThrow(/Unknown output format/);
  });

  it('generate() composes generation and formatting', () => {
    const out = generate({ version: 'nil', count: 3, format: 'comma' });
    expect(out).toBe(`${NIL_UUID}, ${NIL_UUID}, ${NIL_UUID}`);
  });
});

describe('normalizeUuid / isValidUuid', () => {
  const id = '550e8400-e29b-41d4-a716-446655440000';

  it('accepts canonical, upper-case, braces, urn prefix and bare hex', () => {
    expect(normalizeUuid(id)).toBe(id);
    expect(normalizeUuid(id.toUpperCase())).toBe(id);
    expect(normalizeUuid(`{${id}}`)).toBe(id);
    expect(normalizeUuid(`urn:uuid:${id}`)).toBe(id);
    expect(normalizeUuid(id.replace(/-/g, ''))).toBe(id);
    expect(normalizeUuid(`\uFEFF  ${id}\r\n`)).toBe(id);
  });

  it('rejects empty input', () => {
    expect(() => normalizeUuid('   ')).toThrow(/Paste a UUID/);
  });

  it('rejects non-hex characters, naming the offender', () => {
    expect(() => normalizeUuid('550e8400-e29b-41d4-a716-44665544000g')).toThrow(
      /Invalid character "g"/,
    );
  });

  it('rejects wrong lengths with the count', () => {
    expect(() => normalizeUuid('550e8400-e29b')).toThrow(/this one has 12/);
  });

  it('rejects misplaced hyphens', () => {
    expect(() => normalizeUuid('550e8400e-29b-41d4-a716-446655440000')).toThrow(/8-4-4-4-12/);
  });

  it('isValidUuid returns booleans', () => {
    expect(isValidUuid(id)).toBe(true);
    expect(isValidUuid('nope')).toBe(false);
  });
});

describe('parseUuid', () => {
  it('identifies a v4 UUID', () => {
    const p = parseUuid('550e8400-e29b-41d4-a716-446655440000');
    expect(p.version).toBe(4);
    expect(p.variant).toBe('RFC 9562');
    expect(p.versionLabel).toBe('Random');
    expect(p.timestamp).toBeUndefined();
    expect(p.summary).toContain('Version 4');
  });

  it('extracts the timestamp from the RFC 9562 v7 example', () => {
    const p = parseUuid('017F22E2-79B0-7CC3-98C4-DC0C0C07398F');
    expect(p.version).toBe(7);
    expect(p.timestamp?.toISOString()).toBe('2022-02-22T19:22:22.000Z');
  });

  it('extracts the timestamp from the RFC 9562 v1 example', () => {
    const p = parseUuid('C232AB00-9414-11EC-B3C8-9F6BDECED846');
    expect(p.version).toBe(1);
    expect(p.timestamp?.toISOString()).toBe('2022-02-22T19:22:22.000Z');
  });

  it('extracts the timestamp from the RFC 9562 v6 example', () => {
    const p = parseUuid('1EC9414C-232A-6B00-B3C8-9F6BDECED846');
    expect(p.version).toBe(6);
    expect(p.timestamp?.toISOString()).toBe('2022-02-22T19:22:22.000Z');
  });

  it('recognises nil and max UUIDs', () => {
    expect(parseUuid(NIL_UUID).versionLabel).toBe('Nil UUID');
    expect(parseUuid(MAX_UUID.toUpperCase()).versionLabel).toBe('Max UUID');
  });

  it('reports non-RFC variants without inventing a version', () => {
    const ncs = parseUuid('550e8400-e29b-41d4-0716-446655440000');
    expect(ncs.variant).toBe('NCS');
    expect(ncs.version).toBe(0);
    expect(parseUuid('550e8400-e29b-41d4-c716-446655440000').variant).toBe('Microsoft');
    expect(parseUuid('550e8400-e29b-41d4-e716-446655440000').variant).toBe('Reserved');
  });

  it('labels unknown version nibbles', () => {
    expect(parseUuid('550e8400-e29b-01d4-a716-446655440000').versionLabel).toBe('Unknown version');
    expect(parseUuid('550e8400-e29b-31d4-a716-446655440000').versionLabel).toBe('Name-based (MD5)');
  });

  it('extractTimestamp returns undefined for versions without a clock', () => {
    expect(extractTimestamp(new Uint8Array(16), 4)).toBeUndefined();
    expect(extractTimestamp(new Uint8Array(16), 5)).toBeUndefined();
  });

  it('handles v1 timestamps before 1970', () => {
    // All-zero clock = 1582-10-15T00:00:00Z
    const p = parseUuid('00000000-0000-1000-8000-000000000000');
    expect(p.timestamp?.toISOString()).toBe('1582-10-15T00:00:00.000Z');
  });
});

describe('byte helpers', () => {
  it('round-trips bytes and strings', () => {
    const id = '017f22e2-79b0-7cc3-98c4-dc0c0c07398f';
    expect(bytesToUuid(uuidToBytes(id))).toBe(id);
  });

  it('bytesToUuid rejects wrong lengths', () => {
    expect(() => bytesToUuid(new Uint8Array(15))).toThrow(/exactly 16 bytes, got 15/);
  });
});
