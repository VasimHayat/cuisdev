import { describe, expect, it } from 'vitest';

import {
  Base64Error,
  base64ToBytes,
  bytesToBase64,
  decodeText,
  encodeText,
  isValidBase64,
  normalizeBase64,
  sniffExtension,
  toDataUrl,
  toUrlSafe,
  wrap,
} from './logic';

describe('encodeText', () => {
  it('encodes ASCII', () => {
    expect(encodeText('Hello, World!')).toBe('SGVsbG8sIFdvcmxkIQ==');
  });

  it('encodes UTF-8 (emoji, accents)', () => {
    expect(encodeText('héllo 👋')).toBe('aMOpbGxvIPCfkYs=');
  });

  it('encodes the empty string', () => {
    expect(encodeText('')).toBe('');
  });

  it('supports the URL-safe alphabet without padding', () => {
    // "??>" -> "Pz8+" in standard, "Pz8-" url-safe
    expect(encodeText('??>', { urlSafe: true })).toBe('Pz8-');
    expect(encodeText('Hello, World!', { urlSafe: true })).toBe('SGVsbG8sIFdvcmxkIQ');
  });

  it('wraps at a fixed width', () => {
    const encoded = encodeText('a'.repeat(100), { wrapAt: 76 });
    const lines = encoded.split('\n');
    expect(lines[0]).toHaveLength(76);
    expect(lines).toHaveLength(2);
  });
});

describe('decodeText', () => {
  it('decodes standard Base64', () => {
    expect(decodeText('SGVsbG8sIFdvcmxkIQ==')).toBe('Hello, World!');
  });

  it('decodes URL-safe, unpadded input', () => {
    expect(decodeText('SGVsbG8sIFdvcmxkIQ')).toBe('Hello, World!');
    expect(decodeText('Pz8-')).toBe('??>');
  });

  it('ignores whitespace and line breaks', () => {
    expect(decodeText('SGVs\nbG8s IFdv\r\ncmxkIQ==')).toBe('Hello, World!');
  });

  it('accepts data URLs', () => {
    expect(decodeText('data:text/plain;base64,SGVsbG8=')).toBe('Hello');
  });

  it('round-trips UTF-8', () => {
    const text = 'Ünïcödé — 日本語 — 🚀';
    expect(decodeText(encodeText(text))).toBe(text);
  });

  it('rejects invalid characters with a helpful message', () => {
    expect(() => decodeText('SGVs*bG8=')).toThrow(Base64Error);
    expect(() => decodeText('SGVs*bG8=')).toThrow(/Invalid character "\*"/);
  });

  it('rejects impossible lengths', () => {
    expect(() => decodeText('A')).toThrow(/length/);
  });

  it('rejects misplaced padding', () => {
    expect(() => decodeText('SG=VsbG8=')).toThrow(/padding/);
  });

  it('reports binary data that is not UTF-8', () => {
    const png = bytesToBase64(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0xff, 0xfe]));
    expect(() => decodeText(png)).toThrow(/not UTF-8 text/);
  });
});

describe('bytes helpers', () => {
  it('round-trips arbitrary bytes, including large buffers', () => {
    const bytes = new Uint8Array(70_000);
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256;
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it('builds data URLs', () => {
    expect(toDataUrl(new Uint8Array([1, 2, 3]), 'application/x-test')).toBe(
      'data:application/x-test;base64,AQID',
    );
  });

  it('sniffs common file signatures', () => {
    expect(sniffExtension(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe('png');
    expect(sniffExtension(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpg');
    expect(sniffExtension(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe('pdf');
    expect(sniffExtension(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe('zip');
    expect(sniffExtension(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBe('gif');
    expect(sniffExtension(new Uint8Array([0x52, 0x49, 0x46, 0x46]))).toBe('webp');
    expect(sniffExtension(new Uint8Array([0, 1, 2, 3]))).toBe('bin');
  });
});

describe('normalisation', () => {
  it('normalizeBase64 restores padding and alphabet', () => {
    expect(normalizeBase64('Pz8-')).toBe('Pz8+');
    expect(normalizeBase64('SGVsbG8')).toBe('SGVsbG8=');
    expect(normalizeBase64('SGVsbG8=')).toBe('SGVsbG8=');
  });

  it('toUrlSafe swaps the alphabet and strips padding', () => {
    expect(toUrlSafe('Pz8+/w==')).toBe('Pz8-_w');
  });

  it('wrap leaves short strings alone', () => {
    expect(wrap('abc', 76)).toBe('abc');
    expect(wrap('abcdef', 0)).toBe('abcdef');
  });

  it('isValidBase64 returns booleans instead of throwing', () => {
    expect(isValidBase64('SGVsbG8=')).toBe(true);
    expect(isValidBase64('***')).toBe(false);
  });
});
