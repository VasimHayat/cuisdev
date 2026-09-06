import { describe, expect, it } from 'vitest';

import {
  ImageError,
  MAX_FILE_BYTES,
  assertUsableFile,
  baseName,
  describeSizes,
  extensionFor,
  fileExtension,
  fitWithin,
  formatBytes,
  formatDimensions,
  isImageFile,
  isLossy,
  outputFileName,
  parseLimit,
  parseQuality,
  qualityFor,
  resolveOutputType,
  savingsPercent,
  summarise,
} from './logic';

const png = { name: 'photo.png', type: 'image/png', size: 1024 };

describe('fileExtension / baseName', () => {
  it('reads the extension case-insensitively', () => {
    expect(fileExtension('Holiday.JPEG')).toBe('jpeg');
    expect(fileExtension('archive.tar.gz')).toBe('gz');
  });

  it('returns an empty extension for dotfiles and bare names', () => {
    expect(fileExtension('.gitignore')).toBe('');
    expect(fileExtension('README')).toBe('');
  });

  it('strips paths and extensions for the stem', () => {
    expect(baseName('folder/sub/holiday.jpeg')).toBe('holiday');
    expect(baseName('C:\\photos\\beach.png')).toBe('beach');
    expect(baseName('no-extension')).toBe('no-extension');
    expect(baseName('')).toBe('image');
    expect(baseName('.env')).toBe('.env');
  });
});

describe('isImageFile', () => {
  it('accepts anything with an image/* MIME type', () => {
    expect(isImageFile({ name: 'x', type: 'image/heic' })).toBe(true);
  });

  it('falls back to the extension when the browser reports no type', () => {
    expect(isImageFile({ name: 'scan.BMP', type: '' })).toBe(true);
    expect(isImageFile({ name: 'notes.txt', type: '' })).toBe(false);
    expect(isImageFile({ name: 'archive.zip', type: 'application/zip' })).toBe(false);
  });
});

describe('assertUsableFile', () => {
  it('accepts a normal image', () => {
    expect(() => {
      assertUsableFile(png);
    }).not.toThrow();
  });

  it('rejects non-images by name', () => {
    expect(() => {
      assertUsableFile({ name: 'notes.txt', type: 'text/plain', size: 10 });
    }).toThrow(/“notes\.txt” is not an image/);
  });

  it('rejects files over the 50 MB limit', () => {
    expect(() => {
      assertUsableFile({ name: 'huge.png', type: 'image/png', size: MAX_FILE_BYTES + 1 });
    }).toThrow(/larger than the 50 MB limit/);
  });

  it('rejects empty files', () => {
    expect(() => {
      assertUsableFile({ name: 'empty.png', type: 'image/png', size: 0 });
    }).toThrow(/is empty \(0 bytes\)/);
  });

  it('throws ImageError instances', () => {
    try {
      assertUsableFile({ name: 'a.txt', type: 'text/plain', size: 1 });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ImageError);
      expect((err as ImageError).name).toBe('ImageError');
    }
  });
});

describe('formatBytes', () => {
  it('formats each magnitude', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(999)).toBe('999 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB');
    expect(formatBytes(20 * 1024)).toBe('20 KB');
  });

  it('guards against nonsense input', () => {
    expect(formatBytes(Number.NaN)).toBe('—');
    expect(formatBytes(-5)).toBe('—');
  });
});

describe('formatDimensions / describeSizes', () => {
  it('renders both row fragments', () => {
    expect(formatDimensions({ width: 1920, height: 1080 })).toBe('1920 × 1080');
    expect(describeSizes(2048, 1024)).toBe('2.0 KB → 1.0 KB');
  });
});

describe('resolveOutputType', () => {
  it('keeps encodable originals', () => {
    expect(resolveOutputType('image/jpeg', 'original')).toBe('image/jpeg');
    expect(resolveOutputType('image/webp', 'original')).toBe('image/webp');
  });

  it('falls back to PNG for formats a canvas cannot encode', () => {
    expect(resolveOutputType('image/gif', 'original')).toBe('image/png');
    expect(resolveOutputType('image/svg+xml', 'original')).toBe('image/png');
    expect(resolveOutputType('', 'original')).toBe('image/png');
  });

  it('honours an explicit choice', () => {
    expect(resolveOutputType('image/gif', 'image/webp')).toBe('image/webp');
  });
});

describe('extensionFor / isLossy / qualityFor', () => {
  it('maps MIME types to extensions', () => {
    expect(extensionFor('image/jpeg')).toBe('jpg');
    expect(extensionFor('image/webp')).toBe('webp');
    expect(extensionFor('image/vnd.microsoft.icon')).toBe('ico');
    expect(extensionFor('image/unknown')).toBe('png');
  });

  it('knows which encoders take a quality argument', () => {
    expect(isLossy('image/jpeg')).toBe(true);
    expect(isLossy('image/webp')).toBe(true);
    expect(isLossy('image/png')).toBe(false);
    expect(qualityFor('image/jpeg', 80)).toBeCloseTo(0.8);
    expect(qualityFor('image/png', 80)).toBeUndefined();
  });
});

describe('parseQuality', () => {
  it('accepts numbers and numeric strings', () => {
    expect(parseQuality(80)).toBe(80);
    expect(parseQuality(' 55 ')).toBe(55);
    expect(parseQuality(79.6)).toBe(80);
  });

  it('rejects out-of-range and non-numeric values', () => {
    expect(() => parseQuality(9)).toThrow(/between 10 and 100 — got 9/);
    expect(() => parseQuality(101)).toThrow(/between 10 and 100 — got 101/);
    expect(() => parseQuality('high')).toThrow(/must be a number between 10 and 100/);
  });
});

describe('parseLimit', () => {
  it('treats blank as no limit', () => {
    expect(parseLimit('', 'Max width')).toBeUndefined();
    expect(parseLimit('   ', 'Max width')).toBeUndefined();
  });

  it('parses whole numbers', () => {
    expect(parseLimit('1920', 'Max width')).toBe(1920);
  });

  it('rejects fractions, text and out-of-range values', () => {
    expect(() => parseLimit('12.5', 'Max width')).toThrow(/whole number of pixels — got “12\.5”/);
    expect(() => parseLimit('wide', 'Max width')).toThrow(/whole number of pixels/);
    expect(() => parseLimit('0', 'Max height')).toThrow(/Max height must be between 1 and 20000/);
    expect(() => parseLimit('99999', 'Max height')).toThrow(/between 1 and 20000 pixels/);
  });
});

describe('fitWithin', () => {
  const source = { width: 4000, height: 3000 };

  it('returns the source unchanged with no limits', () => {
    expect(fitWithin(source)).toEqual({ width: 4000, height: 3000 });
  });

  it('never upscales', () => {
    expect(fitWithin({ width: 100, height: 50 }, { maxWidth: 4000 })).toEqual({
      width: 100,
      height: 50,
    });
  });

  it('constrains by width, keeping the aspect ratio', () => {
    expect(fitWithin(source, { maxWidth: 2000 })).toEqual({ width: 2000, height: 1500 });
  });

  it('constrains by height', () => {
    expect(fitWithin(source, { maxHeight: 300 })).toEqual({ width: 400, height: 300 });
  });

  it('uses whichever limit binds hardest', () => {
    expect(fitWithin(source, { maxWidth: 2000, maxHeight: 300 })).toEqual({
      width: 400,
      height: 300,
    });
  });

  it('never rounds an edge down to zero', () => {
    expect(fitWithin({ width: 1000, height: 3 }, { maxWidth: 10 })).toEqual({
      width: 10,
      height: 1,
    });
  });

  it('rejects an unusable source size', () => {
    expect(() => fitWithin({ width: 0, height: 10 })).toThrow(/unusable size \(0 × 10\)/);
  });
});

describe('outputFileName', () => {
  it('renames with the new extension', () => {
    expect(outputFileName('holiday.jpeg', 'image/webp')).toBe('holiday-compressed.webp');
    expect(outputFileName('shot.PNG', 'image/jpeg')).toBe('shot-compressed.jpg');
    expect(outputFileName('no-extension', 'image/png')).toBe('no-extension-compressed.png');
  });
});

describe('savingsPercent / summarise', () => {
  it('reports savings to one decimal place', () => {
    expect(savingsPercent(1000, 750)).toBe(25);
    expect(savingsPercent(1000, 667)).toBe(33.3);
    expect(savingsPercent(0, 100)).toBe(0);
  });

  it('reports a negative percentage when the file grew', () => {
    expect(savingsPercent(1000, 1200)).toBe(-20);
  });

  it('flags results that are not worth keeping', () => {
    const grew = summarise(1000, 1200);
    expect(grew.larger).toBe(true);
    expect(grew.label).toBe('Already optimised');

    const shrank = summarise(1000, 400);
    expect(shrank.larger).toBe(false);
    expect(shrank.label).toBe('60% smaller');
    expect(shrank.after).toBe(400);
  });

  it('treats an identical size as already optimised', () => {
    expect(summarise(500, 500).larger).toBe(true);
  });
});
