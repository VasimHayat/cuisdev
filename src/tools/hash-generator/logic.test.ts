import { describe, expect, it } from 'vitest';

import {
  ALGORITHMS,
  ALGORITHM_IDS,
  CHUNK_SIZE,
  HashError,
  base64ToHex,
  chunkBlob,
  compareDigest,
  createHasher,
  digestBytes,
  digestChunks,
  digestText,
  formatDigest,
  getAlgorithm,
  guessAlgorithmByLength,
  hashOne,
  hexToBase64,
} from './logic';

const FOX = 'The quick brown fox jumps over the lazy dog';

describe('known test vectors', () => {
  it('SHA-256 of "abc"', async () => {
    expect(await hashOne('sha256', 'abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('MD5 of the empty string', async () => {
    expect(await hashOne('md5', '')).toBe('d41d8cd98f00b204e9800998ecf8427e');
  });

  it('SHA-1 of "abc"', async () => {
    expect(await hashOne('sha1', 'abc')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
  });

  it('CRC32 of the quick brown fox', async () => {
    expect(await hashOne('crc32', FOX)).toBe('414fa339');
  });

  it('SHA-384 and SHA-512 of "abc"', async () => {
    expect(await hashOne('sha384', 'abc')).toBe(
      'cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7',
    );
    expect(await hashOne('sha512', 'abc')).toBe(
      'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
    );
  });

  it('SHA3-256 and SHA3-512 of "abc"', async () => {
    expect(await hashOne('sha3-256', 'abc')).toBe(
      '3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532',
    );
    expect(await hashOne('sha3-512', 'abc')).toBe(
      'b751850b1a57168a5693cd924b6b096e08f621827444f70d884f5d0240d2712e10e116e9192af3c91a7ec57647e3934057340b4cf408d5a56592f8274eec53f0',
    );
  });

  it('HMAC-SHA256 RFC 4231 test case 1', async () => {
    const key = String.fromCharCode(...new Array<number>(20).fill(0x0b));
    expect(await hashOne('sha256', 'Hi There', key)).toBe(
      'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7',
    );
  });

  it('HMAC-SHA256 RFC 4231 test case 2 ("Jefe")', async () => {
    expect(await hashOne('sha256', 'what do ya want for nothing?', 'Jefe')).toBe(
      '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
    );
  });

  it('HMAC-SHA1 RFC 2202 test case 2', async () => {
    expect(await hashOne('sha1', 'what do ya want for nothing?', 'Jefe')).toBe(
      'effcdf6ae5eb2fa2d27416d5f184df9c259a7c79',
    );
  });
});

describe('digestText / digestBytes', () => {
  it('returns a digest for every algorithm', async () => {
    const table = await digestText('abc');
    for (const id of ALGORITHM_IDS) expect(table[id]).toMatch(/^[0-9a-f]+$/);
    expect(table.crc32).toBe('352441c2');
  });

  it('digest lengths match the declared bit sizes', async () => {
    const table = await digestText('hello');
    for (const algo of ALGORITHMS) expect(table[algo.id]).toHaveLength(algo.bits / 4);
  });

  it('handles unicode as UTF-8', async () => {
    const table = await digestText('héllo 👋');
    expect(table.sha256).toBe(await hashOne('sha256', new TextEncoder().encode('héllo 👋')));
  });

  it('Windows line endings and a BOM change the digest (bytes are hashed as-is)', async () => {
    const lf = await hashOne('sha256', 'a\nb');
    const crlf = await hashOne('sha256', 'a\r\nb');
    const bom = await hashOne('sha256', '\uFEFFa\nb');
    expect(lf).not.toBe(crlf);
    expect(lf).not.toBe(bom);
  });

  it('with an HMAC key, SHA algorithms are keyed and MD5/CRC32 are null', async () => {
    const table = await digestText('Hi There', { hmacKey: 'secret' });
    expect(table.md5).toBeNull();
    expect(table.crc32).toBeNull();
    expect(table.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(table.sha256).not.toBe((await digestText('Hi There')).sha256);
  });

  it('an empty HMAC key behaves like no key', async () => {
    const plain = await digestText('abc');
    const emptyKey = await digestText('abc', { hmacKey: '' });
    expect(emptyKey).toEqual(plain);
  });

  it('restricts to the requested algorithms', async () => {
    const table = await digestBytes(new Uint8Array([1, 2, 3]), { algorithms: ['md5', 'crc32'] });
    expect(Object.keys(table).sort()).toEqual(['crc32', 'md5']);
  });

  it('hashOne throws a helpful error for HMAC on MD5/CRC32', async () => {
    await expect(hashOne('md5', 'x', 'k')).rejects.toThrow(HashError);
    await expect(hashOne('crc32', 'x', 'k')).rejects.toThrow(/does not support HMAC/);
  });
});

describe('streaming', () => {
  it('digestChunks equals hashing the concatenation, and reports progress', async () => {
    const data = new Uint8Array(100_000);
    for (let i = 0; i < data.length; i++) data[i] = (i * 7) % 256;
    const chunks = [data.subarray(0, 30_000), data.subarray(30_000, 70_000), data.subarray(70_000)];
    const progress: number[] = [];
    const streamed = await digestChunks(chunks, {}, (n) => progress.push(n));
    const whole = await digestBytes(data);
    expect(streamed).toEqual(whole);
    expect(progress).toEqual([30_000, 70_000, 100_000]);
  });

  it('streams HMAC too', async () => {
    const a = new TextEncoder().encode('what do ya want ');
    const b = new TextEncoder().encode('for nothing?');
    const table = await digestChunks([a, b], { hmacKey: 'Jefe', algorithms: ['sha256'] });
    expect(table.sha256).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
  });

  it('chunkBlob yields fixed-size pieces covering the whole blob', async () => {
    const bytes = new Uint8Array(10_001).map((_, i) => i % 251);
    const pieces: Uint8Array[] = [];
    for await (const c of chunkBlob(new Blob([bytes]), 4000)) pieces.push(c);
    expect(pieces.map((p) => p.length)).toEqual([4000, 4000, 2001]);
    const table = await digestChunks(chunkBlob(new Blob([bytes]), 4000), { algorithms: ['sha1'] });
    expect(table.sha1).toBe((await digestBytes(bytes, { algorithms: ['sha1'] })).sha1);
  });

  it('chunkBlob yields one empty chunk for an empty blob', async () => {
    const pieces: Uint8Array[] = [];
    for await (const c of chunkBlob(new Blob([]))) pieces.push(c);
    expect(pieces).toHaveLength(1);
    expect(pieces[0]).toHaveLength(0);
    const table = await digestChunks(chunkBlob(new Blob([])), { algorithms: ['md5'] });
    expect(table.md5).toBe('d41d8cd98f00b204e9800998ecf8427e');
  });

  it('chunkBlob rejects a bad chunk size', async () => {
    const iter = chunkBlob(new Blob([new Uint8Array(3)]), 0);
    await expect(iter.next()).rejects.toThrow(/Chunk size must be a positive whole number/);
  });

  it('default chunk size is 4 MiB', () => {
    expect(CHUNK_SIZE).toBe(4 * 1024 * 1024);
  });

  it('createHasher returns null for HMAC on unsupported algorithms', async () => {
    expect(await createHasher(getAlgorithm('md5'), 'k')).toBeNull();
    const h = await createHasher(getAlgorithm('sha256'), 'k');
    expect(h?.digestSize).toBe(32);
  });
});

describe('formatting', () => {
  const hex = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

  it('formats lower/upper hex', () => {
    expect(formatDigest(hex)).toBe(hex);
    expect(formatDigest(hex, { uppercase: true })).toBe(hex.toUpperCase());
    expect(formatDigest(hex.toUpperCase())).toBe(hex);
  });

  it('converts to Base64 (uppercase is irrelevant for Base64)', () => {
    const b64 = 'ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=';
    expect(formatDigest(hex, { base64: true })).toBe(b64);
    expect(formatDigest(hex, { base64: true, uppercase: true })).toBe(b64);
    expect(hexToBase64('414fa339')).toBe('QU+jOQ==');
  });

  it('hexToBase64 rejects malformed hex', () => {
    expect(() => hexToBase64('abc')).toThrow(HashError);
    expect(() => hexToBase64('zz')).toThrow(/not a valid hex digest/);
  });

  it('base64ToHex decodes standard and URL-safe input, else null', () => {
    expect(base64ToHex('QU+jOQ==')).toBe('414fa339');
    expect(base64ToHex('QU-jOQ')).toBe('414fa339');
    expect(base64ToHex('')).toBeNull();
    expect(base64ToHex('***')).toBeNull();
  });
});

describe('compareDigest', () => {
  const table = {
    sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    md5: '900150983cd24fb0d6963f7d28e17f72',
    crc32: '352441c2',
  };

  it('reports empty for blank input', () => {
    expect(compareDigest(table, '')).toEqual({ status: 'empty' });
    expect(compareDigest(table, '  \n')).toEqual({ status: 'empty' });
  });

  it('matches case-insensitively with surrounding whitespace', () => {
    expect(compareDigest(table, `  ${table.sha256.toUpperCase()}\r\n`)).toEqual({
      status: 'match',
      algorithm: 'sha256',
      label: 'SHA-256',
    });
  });

  it('matches a Base64 digest and a prefixed digest', () => {
    expect(compareDigest(table, 'ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=').status).toBe(
      'match',
    );
    expect(compareDigest(table, `sha256:${table.sha256}`).status).toBe('match');
    expect(compareDigest(table, 'MD5 = 900150983CD24FB0D6963F7D28E17F72').status).toBe('match');
  });

  it('matches colon-separated hex (openssl style)', () => {
    expect(compareDigest(table, '35:24:41:c2').status).toBe('match');
  });

  it('reports no-match for a different digest or junk', () => {
    expect(compareDigest(table, 'deadbeef')).toEqual({ status: 'no-match' });
    expect(compareDigest(table, 'not a hash!')).toEqual({ status: 'no-match' });
  });

  it('skips null (HMAC-unsupported) entries', () => {
    expect(compareDigest({ md5: null, sha256: table.sha256 }, table.sha256).status).toBe('match');
  });
});

describe('helpers', () => {
  it('getAlgorithm throws for unknown ids', () => {
    expect(() => getAlgorithm('sha9')).toThrow(/Unknown algorithm "sha9"/);
    expect(getAlgorithm('sha3-256').label).toBe('SHA3-256');
  });

  it('guessAlgorithmByLength suggests algorithms by digest length', () => {
    expect(guessAlgorithmByLength('352441c2').map((a) => a.id)).toEqual(['crc32']);
    expect(guessAlgorithmByLength('a'.repeat(64)).map((a) => a.id)).toEqual(['sha256', 'sha3-256']);
    expect(guessAlgorithmByLength('zz')).toEqual([]);
    expect(guessAlgorithmByLength('a'.repeat(7))).toEqual([]);
  });
});
