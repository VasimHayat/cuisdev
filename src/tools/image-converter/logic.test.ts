import { describe, expect, it } from 'vitest';

import {
  ImageError,
  MAX_FILE_BYTES,
  TARGET_FORMATS,
  assertUsableFile,
  availableTargets,
  baseName,
  convertedFileName,
  describeConversion,
  describeSizes,
  extensionFor,
  fallbackDimensions,
  fileExtension,
  formatBytes,
  formatDimensions,
  formatLabel,
  isLossy,
  isNoOp,
  isSupportedInput,
  needsBackground,
  normalizeHexColor,
  parseQuality,
  qualityFor,
  sourceType,
} from './logic';

describe('sourceType / isSupportedInput', () => {
  it('trusts an image MIME type from the browser', () => {
    expect(sourceType({ name: 'a.bin', type: 'image/webp' })).toBe('image/webp');
  });

  it('falls back to the extension when the type is missing', () => {
    expect(sourceType({ name: 'logo.SVG', type: '' })).toBe('image/svg+xml');
    expect(sourceType({ name: 'favicon.ico', type: '' })).toBe('image/x-icon');
    expect(sourceType({ name: 'photo.jfif', type: '' })).toBe('image/jpeg');
  });

  it('rejects everything else', () => {
    expect(sourceType({ name: 'notes.txt', type: 'text/plain' })).toBe('');
    expect(isSupportedInput({ name: 'notes.txt', type: 'text/plain' })).toBe(false);
    expect(isSupportedInput({ name: 'scan.bmp', type: '' })).toBe(true);
  });
});

describe('file name helpers', () => {
  it('extracts extensions and stems', () => {
    expect(fileExtension('Chart.PNG')).toBe('png');
    expect(fileExtension('noext')).toBe('');
    expect(baseName('a/b/chart.png')).toBe('chart');
    expect(baseName('')).toBe('image');
  });

  it('renames to the target extension', () => {
    expect(convertedFileName('logo.png', 'image/webp')).toBe('logo.webp');
    expect(convertedFileName('photo.HEIC', 'image/jpeg')).toBe('photo.jpg');
    expect(convertedFileName('icon', 'image/avif')).toBe('icon.avif');
  });

  it('maps unknown MIME types to png', () => {
    expect(extensionFor('image/unknown')).toBe('png');
    expect(extensionFor('image/vnd.microsoft.icon')).toBe('ico');
  });
});

describe('assertUsableFile', () => {
  it('accepts a supported image', () => {
    expect(() => {
      assertUsableFile({ name: 'a.png', type: 'image/png', size: 100 });
    }).not.toThrow();
  });

  it('rejects unsupported files with a list of what works', () => {
    expect(() => {
      assertUsableFile({ name: 'doc.pdf', type: 'application/pdf', size: 100 });
    }).toThrow(/Supported inputs are PNG, JPEG, WebP, AVIF, GIF, BMP, ICO and SVG/);
  });

  it('rejects oversized and empty files', () => {
    expect(() => {
      assertUsableFile({ name: 'big.png', type: 'image/png', size: MAX_FILE_BYTES + 1 });
    }).toThrow(/larger than the 50 MB limit/);
    expect(() => {
      assertUsableFile({ name: 'zero.png', type: 'image/png', size: 0 });
    }).toThrow(/is empty \(0 bytes\)/);
  });

  it('throws ImageError', () => {
    expect(() => {
      assertUsableFile({ name: 'x.zip', type: 'application/zip', size: 1 });
    }).toThrow(ImageError);
  });
});

describe('format traits', () => {
  it('knows which encoders take quality', () => {
    expect(isLossy('image/jpeg')).toBe(true);
    expect(isLossy('image/webp')).toBe(true);
    expect(isLossy('image/avif')).toBe(true);
    expect(isLossy('image/png')).toBe(false);
    expect(qualityFor('image/webp', 90)).toBeCloseTo(0.9);
    expect(qualityFor('image/png', 90)).toBeUndefined();
  });

  it('knows which targets have to be flattened onto a background', () => {
    expect(needsBackground('image/jpeg')).toBe(true);
    expect(needsBackground('image/png')).toBe(false);
    expect(needsBackground('image/webp')).toBe(false);
  });

  it('labels formats for display', () => {
    expect(formatLabel('image/svg+xml')).toBe('SVG');
    expect(formatLabel('image/jpeg')).toBe('JPEG');
    expect(formatLabel('')).toBe('unknown');
    expect(formatLabel('image/heic')).toBe('image/heic');
    expect(describeConversion('image/png', 'image/jpeg')).toBe('PNG → JPEG');
  });

  it('spots a pointless conversion', () => {
    expect(isNoOp('image/png', 'image/png')).toBe(true);
    expect(isNoOp('image/jpg', 'image/jpeg')).toBe(true);
    expect(isNoOp('image/png', 'image/webp')).toBe(false);
    expect(isNoOp('', 'image/png')).toBe(false);
  });
});

describe('availableTargets', () => {
  it('hides AVIF when the browser cannot encode it', () => {
    expect(availableTargets(false)).toEqual(['image/png', 'image/jpeg', 'image/webp']);
    expect(availableTargets(true)).toEqual([...TARGET_FORMATS]);
  });
});

describe('parseQuality', () => {
  it('accepts the valid range', () => {
    expect(parseQuality('90')).toBe(90);
    expect(parseQuality(10)).toBe(10);
  });

  it('rejects everything else', () => {
    expect(() => parseQuality('0')).toThrow(/between 10 and 100 — got 0/);
    expect(() => parseQuality('120')).toThrow(/between 10 and 100 — got 120/);
    expect(() => parseQuality('best')).toThrow(/must be a number between 10 and 100/);
  });
});

describe('normalizeHexColor', () => {
  it('expands and normalises hex values', () => {
    expect(normalizeHexColor('#FFF')).toBe('#ffffff');
    expect(normalizeHexColor('abc')).toBe('#aabbcc');
    expect(normalizeHexColor('  #12AB34 ')).toBe('#12ab34');
  });

  it('rejects anything that is not hex', () => {
    expect(() => normalizeHexColor('white')).toThrow(/hex value like #ffffff — got “white”/);
    expect(() => normalizeHexColor('#12345')).toThrow(/hex value like #ffffff/);
    expect(() => normalizeHexColor('')).toThrow(ImageError);
  });
});

describe('fallbackDimensions', () => {
  it('keeps a fully known size', () => {
    expect(fallbackDimensions({ width: 300, height: 150 })).toEqual({ width: 300, height: 150 });
  });

  it('squares off a half-known size', () => {
    expect(fallbackDimensions({ width: 200, height: 0 })).toEqual({ width: 200, height: 200 });
    expect(fallbackDimensions({ height: 40 })).toEqual({ width: 40, height: 40 });
  });

  it('falls back for sizeless SVGs', () => {
    expect(fallbackDimensions({})).toEqual({ width: 512, height: 512 });
    expect(fallbackDimensions({ width: 0, height: 0 }, 256)).toEqual({ width: 256, height: 256 });
  });

  it('rounds fractional sizes', () => {
    expect(fallbackDimensions({ width: 100.4, height: 50.6 })).toEqual({ width: 100, height: 51 });
  });
});

describe('size formatting', () => {
  it('formats bytes and dimensions', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(-1)).toBe('—');
    expect(formatDimensions({ width: 800, height: 600 })).toBe('800 × 600');
    expect(describeSizes(4096, 1024)).toBe('4.0 KB → 1.0 KB');
  });
});
