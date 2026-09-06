import { describe, expect, it } from 'vitest';

import {
  DATA_URL_WARN_BYTES,
  ImageError,
  MAX_FILE_BYTES,
  SAMPLE_PNG_BASE64,
  altTextFor,
  assertUsableFile,
  base64ToBytes,
  baseName,
  buildSnippets,
  bytesToBase64,
  describeEncoding,
  downloadNameFor,
  escapeHtmlAttribute,
  escapeMarkdownText,
  extensionFor,
  formatBytes,
  formatLabel,
  growthPercent,
  isImageFile,
  isOversized,
  oversizeWarning,
  parseDataUrl,
  sniffMime,
  toDataUrl,
} from './logic';

const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

describe('bytesToBase64 / base64ToBytes', () => {
  it('encodes each padding case', () => {
    expect(bytesToBase64(new Uint8Array([77, 97, 110]))).toBe('TWFu');
    expect(bytesToBase64(new Uint8Array([77, 97]))).toBe('TWE=');
    expect(bytesToBase64(new Uint8Array([77]))).toBe('TQ==');
    expect(bytesToBase64(new Uint8Array())).toBe('');
  });

  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array(600);
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 37) % 256;
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it('round-trips across the internal 8 KB chunk boundary', () => {
    const bytes = new Uint8Array(20000);
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251;
    const encoded = bytesToBase64(bytes);
    expect(encoded.length).toBe(Math.ceil(bytes.length / 3) * 4);
    expect(base64ToBytes(encoded)).toEqual(bytes);
  });

  it('tolerates whitespace, missing padding and the URL-safe alphabet', () => {
    expect(base64ToBytes('TWFu')).toEqual(new Uint8Array([77, 97, 110]));
    expect(base64ToBytes('TW\nFu')).toEqual(new Uint8Array([77, 97, 110]));
    expect(base64ToBytes('TWE')).toEqual(new Uint8Array([77, 97]));
    expect(base64ToBytes('Pz8-')).toEqual(base64ToBytes('Pz8+'));
  });

  it('rejects invalid characters with their position', () => {
    expect(() => base64ToBytes('ab*d')).toThrow(/Invalid Base64 character “\*” at position 2/);
  });

  it('rejects an impossible length', () => {
    expect(() => base64ToBytes('TWFuA')).toThrow(/5 characters long, which cannot be valid/);
  });

  it('rejects empty input', () => {
    expect(() => base64ToBytes('   ')).toThrow(/no Base64 data to decode/);
  });
});

describe('sniffMime', () => {
  it('recognises the common signatures', () => {
    expect(sniffMime(new Uint8Array(PNG_HEAD))).toBe('image/png');
    expect(sniffMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffMime(new TextEncoder().encode('GIF89a...'))).toBe('image/gif');
    expect(sniffMime(new TextEncoder().encode('RIFF????WEBPVP8 '))).toBe('image/webp');
    expect(sniffMime(new TextEncoder().encode('????ftypavif'))).toBe('image/avif');
    expect(sniffMime(new TextEncoder().encode('BM......'))).toBe('image/bmp');
    expect(sniffMime(new Uint8Array([0x00, 0x00, 0x01, 0x00, 0x01]))).toBe('image/x-icon');
  });

  it('recognises SVG text with or without an XML prolog', () => {
    expect(sniffMime(new TextEncoder().encode('<svg xmlns="..."></svg>'))).toBe('image/svg+xml');
    expect(sniffMime(new TextEncoder().encode('  <?xml version="1.0"?><svg></svg>'))).toBe(
      'image/svg+xml',
    );
  });

  it('returns an empty string for anything else', () => {
    expect(sniffMime(new TextEncoder().encode('hello there'))).toBe('');
    expect(sniffMime(new Uint8Array())).toBe('');
  });

  it('sniffs the built-in sample PNG', () => {
    expect(sniffMime(base64ToBytes(SAMPLE_PNG_BASE64))).toBe('image/png');
  });
});

describe('parseDataUrl', () => {
  const sample = `data:image/png;base64,${SAMPLE_PNG_BASE64}`;

  it('parses a full data URL', () => {
    const parsed = parseDataUrl(sample);
    expect(parsed.mime).toBe('image/png');
    expect(parsed.base64).toBe(SAMPLE_PNG_BASE64);
    expect(parsed.bytes.length).toBe(87);
    expect(parsed.sniffed).toBe(false);
  });

  it('parses a bare Base64 string by sniffing it', () => {
    const parsed = parseDataUrl(SAMPLE_PNG_BASE64);
    expect(parsed.mime).toBe('image/png');
    expect(parsed.sniffed).toBe(true);
  });

  it('trusts the bytes over a wrong declared type', () => {
    const parsed = parseDataUrl(`data:image/gif;base64,${SAMPLE_PNG_BASE64}`);
    expect(parsed.mime).toBe('image/png');
    expect(parsed.sniffed).toBe(true);
  });

  it('rejects a data URL with no comma', () => {
    expect(() => parseDataUrl('data:image/png;base64')).toThrow(/has no comma/);
  });

  it('rejects non-base64 data URLs', () => {
    expect(() => parseDataUrl('data:image/svg+xml,<svg/>')).toThrow(/missing the “;base64” marker/);
  });

  it('rejects empty input', () => {
    expect(() => parseDataUrl('  ')).toThrow(/Paste a data URL or a Base64 string/);
  });

  it('rejects bytes with no recognisable signature', () => {
    expect(() => parseDataUrl(bytesToBase64(new TextEncoder().encode('just text here')))).toThrow(
      /do not start with a known image signature/,
    );
  });

  it('keeps a declared type when the bytes cannot be sniffed', () => {
    const encoded = bytesToBase64(new TextEncoder().encode('just text here'));
    expect(parseDataUrl(`data:image/heic;base64,${encoded}`).mime).toBe('image/heic');
  });

  it('throws ImageError', () => {
    expect(() => parseDataUrl('data:image/png;base64,')).toThrow(ImageError);
  });
});

describe('snippets', () => {
  const snippets = buildSnippets({
    name: 'hero-image_2x.png',
    mime: 'image/png',
    base64: 'AAAA',
  });

  it('builds every flavour from one data URL', () => {
    expect(snippets.base64).toBe('AAAA');
    expect(snippets.dataUrl).toBe('data:image/png;base64,AAAA');
    expect(snippets.html).toBe('<img src="data:image/png;base64,AAAA" alt="hero image 2x" />');
    expect(snippets.css).toBe("background-image: url('data:image/png;base64,AAAA');");
    expect(snippets.markdown).toBe('![hero image 2x](data:image/png;base64,AAAA)');
  });

  it('escapes alt text taken from the file name', () => {
    const risky = buildSnippets({
      name: '<script>"x".png',
      mime: 'image/png',
      base64: 'AAAA',
    });
    expect(risky.html).toContain('alt="&lt;script&gt;&quot;x&quot;"');
    expect(escapeHtmlAttribute('a&b')).toBe('a&amp;b');
    expect(escapeMarkdownText('a[b]c')).toBe('a\\[b\\]c');
  });

  it('derives readable alt text', () => {
    expect(altTextFor('my_photo-01.JPG')).toBe('my photo 01');
    expect(altTextFor('')).toBe('image');
  });

  it('falls back to a generic type in the data URL', () => {
    expect(toDataUrl('', 'AAAA')).toBe('data:application/octet-stream;base64,AAAA');
  });
});

describe('file guards', () => {
  it('accepts images and rejects other files', () => {
    expect(() => {
      assertUsableFile({ name: 'a.png', type: 'image/png', size: 10 });
    }).not.toThrow();
    expect(() => {
      assertUsableFile({ name: 'a.txt', type: 'text/plain', size: 10 });
    }).toThrow(/is not an image/);
    expect(() => {
      assertUsableFile({ name: 'a.png', type: 'image/png', size: MAX_FILE_BYTES + 1 });
    }).toThrow(/larger than the 50 MB limit/);
    expect(() => {
      assertUsableFile({ name: 'a.png', type: 'image/png', size: 0 });
    }).toThrow(/is empty/);
  });

  it('detects images by extension when the type is blank', () => {
    expect(isImageFile({ name: 'icon.SVG', type: '' })).toBe(true);
    expect(isImageFile({ name: 'data.json', type: '' })).toBe(false);
  });
});

describe('reporting', () => {
  it('formats bytes and labels', () => {
    expect(formatBytes(999)).toBe('999 B');
    expect(formatBytes(1024 * 200)).toBe('200 KB');
    expect(formatLabel('image/webp')).toBe('WebP');
    expect(formatLabel('')).toBe('unknown');
    expect(extensionFor('image/svg+xml')).toBe('svg');
    expect(baseName('a/b/c.png')).toBe('c');
    expect(downloadNameFor('image/jpeg')).toBe('image.jpg');
    expect(downloadNameFor('image/png', 'logo')).toBe('logo.png');
  });

  it('measures the Base64 overhead', () => {
    expect(growthPercent(300, 400)).toBeCloseTo(33.3);
    expect(growthPercent(0, 100)).toBe(0);
    expect(describeEncoding('image/png', 3072, 4096)).toBe(
      'PNG · 3.0 KB → 4.0 KB data URL (+33.3%)',
    );
  });

  it('warns above the 100 KB rule of thumb', () => {
    expect(isOversized(DATA_URL_WARN_BYTES)).toBe(false);
    expect(isOversized(DATA_URL_WARN_BYTES + 1)).toBe(true);
    expect(oversizeWarning(200 * 1024)).toMatch(/200 KB, over the 100 KB rule of thumb/);
  });
});
