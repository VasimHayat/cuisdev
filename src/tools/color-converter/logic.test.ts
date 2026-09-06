import { describe, expect, it } from 'vitest';

import {
  ColorError,
  contrastRatio,
  contrastReport,
  convert,
  convertAll,
  formatCmykString,
  formatHex8String,
  formatHexString,
  formatHslString,
  formatHwbString,
  formatLabString,
  formatLchString,
  formatOklabString,
  formatOklchString,
  formatRatio,
  formatRgbString,
  formatRgbaString,
  isOutOfGamut,
  nearestNamedColor,
  parseColor,
  relativeLuminance,
  round,
  shadesAndTints,
  toCmyk,
  toRgb255,
  wcagLevels,
} from './logic';

const BLUE = parseColor('#3b82f6');

describe('parseColor', () => {
  it('parses 6-digit hex', () => {
    expect(toRgb255(parseColor('#3b82f6'))).toEqual({ r: 59, g: 130, b: 246, alpha: 1 });
  });

  it('parses 3- and 4-digit hex, expanding each digit', () => {
    expect(formatHexString(parseColor('#f00'))).toBe('#ff0000');
    expect(toRgb255(parseColor('#f008')).alpha).toBeCloseTo(0.533, 2);
  });

  it('parses 8-digit hex with alpha', () => {
    expect(toRgb255(parseColor('#3b82f680')).alpha).toBeCloseTo(0.502, 2);
  });

  it('accepts a bare hex value without the leading #', () => {
    expect(formatHexString(parseColor('3b82f6'))).toBe('#3b82f6');
  });

  it('parses legacy and modern rgb() syntax', () => {
    expect(formatHexString(parseColor('rgb(59, 130, 246)'))).toBe('#3b82f6');
    expect(formatHexString(parseColor('rgb(59 130 246)'))).toBe('#3b82f6');
    expect(toRgb255(parseColor('rgba(59, 130, 246, 0.5)')).alpha).toBe(0.5);
  });

  it('parses hsl(), hwb(), lab(), lch(), oklab() and oklch()', () => {
    expect(formatHexString(parseColor('hsl(0, 100%, 50%)'))).toBe('#ff0000');
    expect(formatHexString(parseColor('hwb(0 0% 0%)'))).toBe('#ff0000');
    expect(formatHexString(parseColor('lab(100 0 0)'))).toBe('#ffffff');
    expect(formatHexString(parseColor('lch(0 0 0)'))).toBe('#000000');
    expect(formatHexString(parseColor('oklab(1 0 0)'))).toBe('#ffffff');
    expect(formatHexString(parseColor('oklch(0.5 0 0)'))).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('parses named colours, ignoring surrounding whitespace and case', () => {
    expect(formatHexString(parseColor('  RebeccaPurple '))).toBe('#663399');
    expect(formatHexString(parseColor('tomato'))).toBe('#ff6347');
  });

  it('throws a helpful ColorError for empty input', () => {
    expect(() => parseColor('   ')).toThrow(ColorError);
    expect(() => parseColor('')).toThrow(/Enter a color/);
  });

  it('throws a helpful ColorError naming the bad value', () => {
    expect(() => parseColor('bluish')).toThrow(/“bluish” is not a CSS color/);
    expect(() => parseColor('#12345')).toThrow(ColorError);
    expect(() => parseColor('rgb(300)')).toThrow(ColorError);
  });
});

describe('format helpers', () => {
  it('formats hex with and without alpha', () => {
    expect(formatHexString(BLUE)).toBe('#3b82f6');
    expect(formatHex8String(BLUE)).toBe('#3b82f6ff');
    expect(formatHex8String(parseColor('rgba(59, 130, 246, 0.5)'))).toBe('#3b82f680');
  });

  it('formats rgb and rgba', () => {
    expect(formatRgbString(BLUE)).toBe('rgb(59, 130, 246)');
    expect(formatRgbaString(BLUE)).toBe('rgba(59, 130, 246, 1)');
    expect(formatRgbaString(parseColor('#3b82f680'))).toMatch(/^rgba\(59, 130, 246, 0\.50\d?\)$/);
  });

  it('switches to hsla/hwb-with-alpha notation when the colour is translucent', () => {
    expect(formatHslString(parseColor('#ff0000'))).toBe('hsl(0, 100%, 50%)');
    expect(formatHslString(parseColor('rgba(255, 0, 0, 0.25)'))).toBe('hsla(0, 100%, 50%, 0.25)');
    expect(formatHwbString(parseColor('#ff0000'))).toBe('hwb(0 0% 0%)');
    expect(formatHwbString(parseColor('rgba(255, 0, 0, 0.25)'))).toBe('hwb(0 0% 0% / 0.25)');
  });

  it('formats the CIE and OKLab spaces with sensible precision', () => {
    expect(formatLabString(parseColor('#ffffff'))).toBe('lab(100 0 0)');
    expect(formatLchString(parseColor('#000000'))).toBe('lch(0 0 0)');
    expect(formatOklabString(parseColor('#ffffff'))).toBe('oklab(1 0 0)');
    expect(formatOklchString(BLUE)).toMatch(/^oklch\(0\.6\d+ 0\.1\d+ 2\d\d(\.\d+)?\)$/);
    expect(formatLabString(parseColor('rgba(255, 255, 255, 0.5)'))).toBe('lab(100 0 0 / 0.5)');
    expect(formatLchString(parseColor('rgba(0, 0, 0, 0.5)'))).toBe('lch(0 0 0 / 0.5)');
    expect(formatOklabString(parseColor('rgba(255, 255, 255, 0.5)'))).toBe('oklab(1 0 0 / 0.5)');
    expect(formatOklchString(parseColor('rgba(255, 255, 255, 0.5)'))).toBe('oklch(1 0 0 / 0.5)');
  });

  it('normalises hue for achromatic and negative-hue colours', () => {
    expect(formatHslString(parseColor('#808080'))).toBe('hsl(0, 0%, 50.2%)');
    expect(formatHslString(parseColor('hsl(-90, 50%, 50%)'))).toBe('hsl(270, 50%, 50%)');
  });

  it('rounds and normalises -0', () => {
    expect(round(1.006, 2)).toBe(1.01);
    expect(round(-0.0001, 2)).toBe(0);
    expect(Object.is(round(-0.0001, 2), -0)).toBe(false);
    expect(round(1.23456, 4)).toBe(1.2346);
    expect(round(59.5)).toBe(59.5);
  });
});

describe('CMYK', () => {
  it('converts primaries', () => {
    expect(toCmyk(parseColor('#ff0000'))).toEqual({ c: 0, m: 1, y: 1, k: 0 });
    expect(formatCmykString(parseColor('#00ff00'))).toBe('cmyk(100%, 0%, 100%, 0%)');
  });

  it('returns pure key for black and no ink for white', () => {
    expect(toCmyk(parseColor('#000000'))).toEqual({ c: 0, m: 0, y: 0, k: 1 });
    expect(formatCmykString(parseColor('#ffffff'))).toBe('cmyk(0%, 0%, 0%, 0%)');
  });

  it('converts a mixed colour', () => {
    expect(formatCmykString(BLUE)).toBe('cmyk(76%, 47.2%, 0%, 3.5%)');
  });
});

describe('nearest named colour', () => {
  it('finds the exact name for a named colour', () => {
    expect(nearestNamedColor(parseColor('#ff6347')).name).toBe('tomato');
    expect(nearestNamedColor(parseColor('#ff6347')).deltaE).toBe(0);
  });

  it('finds the closest name for an arbitrary colour', () => {
    const match = nearestNamedColor(BLUE);
    expect(match.name).toBe('dodgerblue');
    expect(match.hex).toBe('#1e90ff');
    expect(match.deltaE).toBeGreaterThan(0);
  });
});

describe('contrast', () => {
  it('reports 21:1 for black on white in both directions', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 10);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 10);
  });

  it('reports 1:1 for identical colours', () => {
    expect(contrastRatio('#3b82f6', '#3b82f6')).toBeCloseTo(1, 10);
  });

  it('computes relative luminance at the extremes', () => {
    expect(relativeLuminance(parseColor('#000000'))).toBeCloseTo(0, 10);
    expect(relativeLuminance(parseColor('#ffffff'))).toBeCloseTo(1, 10);
    // Below the 0.04045 threshold the transfer function is linear.
    expect(relativeLuminance(parseColor('#0a0a0a'))).toBeCloseTo(0.003035, 5);
  });

  it('grades WCAG levels at each threshold', () => {
    expect(wcagLevels(2.9)).toEqual({
      aaNormal: false,
      aaLarge: false,
      aaaNormal: false,
      aaaLarge: false,
    });
    expect(wcagLevels(3)).toMatchObject({ aaLarge: true, aaNormal: false });
    expect(wcagLevels(4.5)).toMatchObject({ aaNormal: true, aaaLarge: true, aaaNormal: false });
    expect(wcagLevels(7)).toEqual({
      aaNormal: true,
      aaLarge: true,
      aaaNormal: true,
      aaaLarge: true,
    });
  });

  it('builds a full report and formats the ratio without overstating it', () => {
    const report = contrastReport('#ffffff', '#000000');
    expect(report.ratio).toBeCloseTo(21, 10);
    expect(report.aaaNormal).toBe(true);
    expect(formatRatio(21)).toBe('21.00:1');
    expect(formatRatio(4.4999)).toBe('4.49:1');
  });
});

describe('shades and tints', () => {
  it('returns 2n+1 swatches ordered lightest first', () => {
    const scale = shadesAndTints(BLUE);
    expect(scale).toHaveLength(11);
    expect(scale[0]?.id).toBe('tint-5');
    expect(scale[5]?.id).toBe('base');
    expect(scale[5]?.name).toBe('Base color');
    expect(scale.at(-1)?.id).toBe('shade-5');
    const lightness = scale.map((s) => s.lightness);
    expect([...lightness].sort((a, b) => b - a)).toEqual(lightness);
  });

  it('produces valid sRGB hex for every step', () => {
    for (const step of shadesAndTints(parseColor('oklch(0.7 0.3 145)'))) {
      expect(step.hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('honours a custom step count and rejects a zero count', () => {
    expect(shadesAndTints(BLUE, 2)).toHaveLength(5);
    expect(() => shadesAndTints(BLUE, 0)).toThrow(ColorError);
  });
});

describe('gamut', () => {
  it('flags colours outside sRGB', () => {
    expect(isOutOfGamut(parseColor('oklch(0.7 0.4 150)'))).toBe(true);
    expect(isOutOfGamut(BLUE)).toBe(false);
  });
});

describe('convertAll', () => {
  it('returns every format in display order', () => {
    const rows = convertAll(BLUE);
    expect(rows.map((r) => r.id)).toEqual([
      'hex',
      'hex8',
      'rgb',
      'rgba',
      'hsl',
      'hwb',
      'lab',
      'lch',
      'oklab',
      'oklch',
      'cmyk',
      'named',
    ]);
    expect(rows.every((r) => r.value.length > 0 && r.label.length > 0)).toBe(true);
  });

  it('convert() parses and converts in one step', () => {
    const rows = convert('  tomato ');
    expect(rows.find((r) => r.id === 'hex')?.value).toBe('#ff6347');
    expect(rows.find((r) => r.id === 'named')?.value).toBe('tomato');
    expect(() => convert('not-a-colour')).toThrow(ColorError);
  });
});
