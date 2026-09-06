import { describe, expect, it } from 'vitest';

import {
  CROP_ASPECTS,
  ImageError,
  MAX_FILE_BYTES,
  PRESETS,
  aspectOf,
  assertUsableFile,
  centeredCrop,
  clampCrop,
  describeCrop,
  describeSizes,
  extensionFor,
  formatBytes,
  formatDimensions,
  getAspect,
  getPreset,
  isImageFile,
  isLossy,
  matchAspect,
  parseDimension,
  parseOffset,
  parsePercent,
  parseQuality,
  previewLayout,
  previewRect,
  qualityFor,
  resizedFileName,
  resolveCrop,
  resolveOutputType,
  resolveTarget,
  scaleByPercent,
} from './logic';

const source = { width: 1600, height: 900 };

describe('presets and aspects', () => {
  it('exposes the documented presets', () => {
    expect(PRESETS.map((p) => p.id)).toEqual([
      '1920x1080',
      '1280x720',
      '1080x1080',
      '800x600',
      '512x512',
      '32x32',
      '16x16',
    ]);
    expect(getPreset('512x512')).toMatchObject({ width: 512, height: 512 });
  });

  it('exposes the documented crop shapes', () => {
    expect(CROP_ASPECTS.map((a) => a.id)).toEqual(['none', '1:1', '4:3', '16:9', '3:2', 'custom']);
    expect(getAspect('16:9').ratio).toBeCloseTo(16 / 9);
    expect(getAspect('none').ratio).toBeNull();
  });

  it('complains about unknown ids', () => {
    expect(() => getPreset('nope')).toThrow(/Unknown size preset “nope”/);
    expect(() => getAspect('nope')).toThrow(/Unknown crop shape “nope”/);
  });
});

describe('assertUsableFile', () => {
  it('accepts images and rejects everything else', () => {
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
    expect(isImageFile({ name: 'x.WEBP', type: '' })).toBe(true);
    expect(isImageFile({ name: 'x.doc', type: '' })).toBe(false);
  });
});

describe('number parsing', () => {
  it('parses required dimensions', () => {
    expect(parseDimension('800', 'Width')).toBe(800);
    expect(() => parseDimension('', 'Width')).toThrow(/Width is required/);
    expect(() => parseDimension('12.5', 'Width')).toThrow(/whole number of pixels — got “12\.5”/);
    expect(() => parseDimension('0', 'Height')).toThrow(/Height must be between 1 and 20000/);
    expect(() => parseDimension('20001', 'Height')).toThrow(/between 1 and 20000/);
  });

  it('parses offsets, where zero and blank are fine', () => {
    expect(parseOffset('', 'Crop X')).toBe(0);
    expect(parseOffset('0', 'Crop X')).toBe(0);
    expect(parseOffset('120', 'Crop Y')).toBe(120);
    expect(() => parseOffset('-1', 'Crop X')).toThrow(/between 0 and 20000 pixels — got -1/);
    expect(() => parseOffset('abc', 'Crop X')).toThrow(/whole number of pixels/);
  });

  it('parses percentages', () => {
    expect(parsePercent('50')).toBe(50);
    expect(parsePercent(12.5)).toBe(12.5);
    expect(() => parsePercent('')).toThrow(/Scale is required/);
    expect(() => parsePercent('0')).toThrow(/between 1 and 500% — got 0/);
    expect(() => parsePercent('501')).toThrow(/between 1 and 500%/);
    expect(() => parsePercent('half')).toThrow(/must be a number between 1 and 500%/);
  });

  it('parses quality', () => {
    expect(parseQuality('85')).toBe(85);
    expect(() => parseQuality('5')).toThrow(/between 10 and 100 — got 5/);
    expect(() => parseQuality('x')).toThrow(ImageError);
  });
});

describe('matchAspect / scaleByPercent', () => {
  it('derives the locked edge from the source ratio', () => {
    expect(aspectOf(source)).toBeCloseTo(16 / 9);
    expect(matchAspect(source, { width: 800, height: 0 }, 'width')).toEqual({
      width: 800,
      height: 450,
    });
    expect(matchAspect(source, { width: 0, height: 450 }, 'height')).toEqual({
      width: 800,
      height: 450,
    });
  });

  it('never produces a zero edge', () => {
    expect(matchAspect({ width: 1000, height: 3 }, { width: 2, height: 0 }, 'width').height).toBe(
      1,
    );
  });

  it('leaves the size alone for an unusable source', () => {
    expect(matchAspect({ width: 0, height: 0 }, { width: 5, height: 6 }, 'width')).toEqual({
      width: 5,
      height: 6,
    });
  });

  it('scales by percentage', () => {
    expect(scaleByPercent(source, 50)).toEqual({ width: 800, height: 450 });
    expect(scaleByPercent(source, 200)).toEqual({ width: 3200, height: 1800 });
    expect(scaleByPercent({ width: 10, height: 10 }, 1)).toEqual({ width: 1, height: 1 });
  });
});

describe('centeredCrop', () => {
  it('returns the whole image with no ratio', () => {
    expect(centeredCrop(source, null)).toEqual({ x: 0, y: 0, width: 1600, height: 900 });
  });

  it('crops the sides of a wide image for a square', () => {
    expect(centeredCrop(source, 1)).toEqual({ x: 350, y: 0, width: 900, height: 900 });
  });

  it('crops the top and bottom of a tall image', () => {
    expect(centeredCrop({ width: 900, height: 1600 }, 1)).toEqual({
      x: 0,
      y: 350,
      width: 900,
      height: 900,
    });
  });

  it('handles 16:9 on a 4:3 source', () => {
    expect(centeredCrop({ width: 1200, height: 900 }, 16 / 9)).toEqual({
      x: 0,
      y: 113,
      width: 1200,
      height: 675,
    });
  });

  it('treats a nonsense ratio as no crop', () => {
    expect(centeredCrop(source, 0)).toEqual({ x: 0, y: 0, width: 1600, height: 900 });
  });
});

describe('clampCrop / resolveCrop', () => {
  it('trims a crop that runs past the edge', () => {
    expect(clampCrop(source, { x: 1500, y: 800, width: 400, height: 400 })).toEqual({
      x: 1500,
      y: 800,
      width: 100,
      height: 100,
    });
  });

  it('rejects an origin outside the image', () => {
    expect(() => clampCrop(source, { x: 1600, y: 0, width: 10, height: 10 })).toThrow(
      /Crop X \(1600\) is outside the image, which is only 1600 px wide/,
    );
    expect(() => clampCrop(source, { x: 0, y: 900, width: 10, height: 10 })).toThrow(
      /Crop Y \(900\) is outside the image, which is only 900 px tall/,
    );
  });

  it('rejects an empty crop', () => {
    expect(() => clampCrop(source, { x: 0, y: 0, width: 0, height: 10 })).toThrow(
      /crop area has no pixels/,
    );
  });

  it('resolves the crop for each mode', () => {
    expect(resolveCrop(source, 'none', null)).toEqual({ x: 0, y: 0, width: 1600, height: 900 });
    expect(resolveCrop(source, '1:1', null).width).toBe(900);
    expect(resolveCrop(source, 'custom', { x: 10, y: 20, width: 100, height: 50 })).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    });
    expect(resolveCrop(source, 'custom', null)).toEqual({
      x: 0,
      y: 0,
      width: 1600,
      height: 900,
    });
  });
});

describe('resolveTarget', () => {
  const cropped = { width: 900, height: 900 };

  it('uses the exact boxes', () => {
    expect(resolveTarget('exact', cropped, { width: 300, height: 200 })).toEqual({
      width: 300,
      height: 200,
    });
  });

  it('falls back to the cropped size when a box is missing', () => {
    expect(resolveTarget('exact', cropped, {})).toEqual({ width: 900, height: 900 });
  });

  it('scales by percentage', () => {
    expect(resolveTarget('percent', cropped, { percent: 25 })).toEqual({
      width: 225,
      height: 225,
    });
  });

  it('uses a preset', () => {
    expect(resolveTarget('preset', cropped, { preset: '1280x720' })).toEqual({
      width: 1280,
      height: 720,
    });
    expect(() => resolveTarget('preset', cropped, { preset: 'bogus' })).toThrow(
      /Unknown size preset/,
    );
  });
});

describe('preview geometry', () => {
  it('fits and centres the source in the preview box', () => {
    const layout = previewLayout({ width: 1600, height: 900 }, { width: 480, height: 320 });
    expect(layout.width).toBe(480);
    expect(layout.height).toBe(270);
    expect(layout.offsetX).toBe(0);
    expect(layout.offsetY).toBe(25);
  });

  it('letterboxes a tall image', () => {
    const layout = previewLayout({ width: 100, height: 400 }, { width: 480, height: 320 });
    expect(layout.height).toBe(320);
    expect(layout.width).toBe(80);
    expect(layout.offsetX).toBe(200);
  });

  it('maps a crop into preview coordinates', () => {
    const layout = previewLayout({ width: 1600, height: 900 }, { width: 480, height: 320 });
    const rect = previewRect({ x: 800, y: 450, width: 800, height: 450 }, layout);
    expect(rect.x).toBeCloseTo(240);
    expect(rect.y).toBeCloseTo(160);
    expect(rect.width).toBeCloseTo(240);
    expect(rect.height).toBeCloseTo(135);
  });

  it('refuses to lay out an unusable source', () => {
    expect(() => previewLayout({ width: 0, height: 0 }, { width: 10, height: 10 })).toThrow(
      /unusable size/,
    );
  });
});

describe('output naming and formats', () => {
  it('names files after their new size', () => {
    expect(resizedFileName('photo.jpeg', { width: 800, height: 450 }, 'image/jpeg')).toBe(
      'photo-800x450.jpg',
    );
    expect(resizedFileName('a/b/logo.png', { width: 32, height: 32 }, 'image/png')).toBe(
      'logo-32x32.png',
    );
  });

  it('keeps encodable originals and falls back to PNG', () => {
    expect(resolveOutputType('image/webp', 'original')).toBe('image/webp');
    expect(resolveOutputType('image/gif', 'original')).toBe('image/png');
    expect(resolveOutputType('image/gif', 'image/jpeg')).toBe('image/jpeg');
    expect(extensionFor('image/webp')).toBe('webp');
  });

  it('applies quality only to lossy targets', () => {
    expect(isLossy('image/png')).toBe(false);
    expect(qualityFor('image/jpeg', 50)).toBeCloseTo(0.5);
    expect(qualityFor('image/png', 50)).toBeUndefined();
  });
});

describe('formatting', () => {
  it('formats sizes and crops', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatDimensions({ width: 4, height: 3 })).toBe('4 × 3');
    expect(describeSizes(2048, 512)).toBe('2.0 KB → 512 B');
    expect(describeCrop({ x: 0, y: 0, width: 1600, height: 900 }, source)).toBe('no crop');
    expect(describeCrop({ x: 10, y: 20, width: 100, height: 50 }, source)).toBe(
      'crop 10, 20 → 100 × 50',
    );
  });
});
