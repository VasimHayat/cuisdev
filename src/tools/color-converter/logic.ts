/**
 * Color Converter — pure functions, no DOM.
 *
 * Parsing and colour-space conversion use culori; contrast, CMYK and the
 * shade/tint scale are computed here so every branch can be unit-tested.
 */
import {
  type Color,
  clampChroma,
  colorsNamed,
  converter,
  differenceCiede2000,
  formatHex,
  formatHex8,
  inGamut,
  nearest,
  parse,
} from 'culori';

export class ColorError extends Error {
  override name = 'ColorError';
}

export interface ColorRow {
  /** Stable id used for `data-format` and copy buttons. */
  id: string;
  label: string;
  value: string;
}

export interface Rgb255 {
  r: number;
  g: number;
  b: number;
  alpha: number;
}

export interface Cmyk {
  c: number;
  m: number;
  y: number;
  k: number;
}

export interface NamedMatch {
  name: string;
  hex: string;
  /** CIEDE2000 difference; 0 means an exact match. */
  deltaE: number;
}

export interface ContrastReport {
  ratio: number;
  aaNormal: boolean;
  aaLarge: boolean;
  aaaNormal: boolean;
  aaaLarge: boolean;
}

export interface Shade {
  /** `tint-5` … `base` … `shade-5` */
  id: string;
  /** Human label used in copy buttons, e.g. "Tint 5". */
  name: string;
  hex: string;
  /** OKLCH lightness as a percentage, for the caption. */
  lightness: number;
  kind: 'tint' | 'base' | 'shade';
}

export const SAMPLE_COLOR = '#3b82f6';
export const DEFAULT_TEXT_COLOR = '#ffffff';
export const DEFAULT_BACKGROUND_COLOR = '#1d4ed8';

const toRgb = converter('rgb');
const toHsl = converter('hsl');
const toHwb = converter('hwb');
const toLab = converter('lab');
const toLch = converter('lch');
const toOklab = converter('oklab');
const toOklch = converter('oklch');

const NAMED_COLORS = Object.keys(colorsNamed);
const nearestNamed = nearest(NAMED_COLORS, differenceCiede2000());
const deltaE = differenceCiede2000();
const rgbInGamut = inGamut('rgb');

const BARE_HEX = /^[0-9a-f]{3,8}$/i;

/** Round to `digits` decimals, normalising -0 to 0. */
export function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  return rounded === 0 ? 0 : rounded;
}

function pct(value: number, digits = 2): string {
  return `${round(value * 100, digits)}%`;
}

function hue(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) return 0;
  const wrapped = value % 360;
  return round(wrapped < 0 ? wrapped + 360 : wrapped, 2);
}

function alphaOf(color: Color): number {
  const alpha = color.alpha;
  if (alpha === undefined || Number.isNaN(alpha)) return 1;
  return Math.min(1, Math.max(0, alpha));
}

/**
 * Parse any CSS colour: hex (3/4/6/8 digits), rgb()/rgba(), hsl()/hsla(),
 * hwb(), lab(), lch(), oklab(), oklch() and the CSS named colours. A bare hex
 * value without the leading `#` is accepted too.
 */
export function parseColor(input: string): Color {
  const text = input.trim();
  if (text === '') {
    throw new ColorError('Enter a color — for example #3b82f6, rgb(59 130 246) or tomato.');
  }
  const candidate = BARE_HEX.test(text) ? `#${text}` : text;
  const parsed = parse(candidate);
  if (!parsed) {
    throw new ColorError(
      `“${text}” is not a CSS color. Try a hex value like #3b82f6, a function like ` +
        `rgb(59 130 246), hsl(217 91% 60%) or oklch(0.62 0.19 260), or a named color like tomato.`,
    );
  }
  return parsed;
}

/** sRGB channels as integers 0–255 (out-of-gamut values are clamped). */
export function toRgb255(color: Color): Rgb255 {
  const rgb = toRgb(color);
  const channel = (value: number): number => Math.min(255, Math.max(0, Math.round(value * 255)));
  return {
    r: channel(rgb.r),
    g: channel(rgb.g),
    b: channel(rgb.b),
    alpha: alphaOf(color),
  };
}

/** True when the colour cannot be shown exactly in sRGB, so hex output is clamped. */
export function isOutOfGamut(color: Color): boolean {
  return !rgbInGamut(color);
}

export function formatHexString(color: Color): string {
  return formatHex(color) ?? '#000000';
}

export function formatHex8String(color: Color): string {
  return formatHex8(color) ?? '#000000ff';
}

export function formatRgbString(color: Color): string {
  const { r, g, b } = toRgb255(color);
  return `rgb(${r}, ${g}, ${b})`;
}

export function formatRgbaString(color: Color): string {
  const { r, g, b, alpha } = toRgb255(color);
  return `rgba(${r}, ${g}, ${b}, ${round(alpha, 3)})`;
}

export function formatHslString(color: Color): string {
  const hsl = toHsl(color);
  const alpha = alphaOf(color);
  const parts = `${hue(hsl.h)}, ${pct(hsl.s)}, ${pct(hsl.l)}`;
  return alpha < 1 ? `hsla(${parts}, ${round(alpha, 3)})` : `hsl(${parts})`;
}

export function formatHwbString(color: Color): string {
  const hwb = toHwb(color);
  const alpha = alphaOf(color);
  const parts = `${hue(hwb.h)} ${pct(hwb.w)} ${pct(hwb.b)}`;
  return alpha < 1 ? `hwb(${parts} / ${round(alpha, 3)})` : `hwb(${parts})`;
}

export function formatLabString(color: Color): string {
  const lab = toLab(color);
  const alpha = alphaOf(color);
  const parts = `${round(lab.l, 2)} ${round(lab.a, 2)} ${round(lab.b, 2)}`;
  return alpha < 1 ? `lab(${parts} / ${round(alpha, 3)})` : `lab(${parts})`;
}

export function formatLchString(color: Color): string {
  const lch = toLch(color);
  const alpha = alphaOf(color);
  const parts = `${round(lch.l, 2)} ${round(lch.c, 2)} ${hue(lch.h)}`;
  return alpha < 1 ? `lch(${parts} / ${round(alpha, 3)})` : `lch(${parts})`;
}

export function formatOklabString(color: Color): string {
  const oklab = toOklab(color);
  const alpha = alphaOf(color);
  const parts = `${round(oklab.l, 4)} ${round(oklab.a, 4)} ${round(oklab.b, 4)}`;
  return alpha < 1 ? `oklab(${parts} / ${round(alpha, 3)})` : `oklab(${parts})`;
}

export function formatOklchString(color: Color): string {
  const oklch = toOklch(color);
  const alpha = alphaOf(color);
  const parts = `${round(oklch.l, 4)} ${round(oklch.c, 4)} ${hue(oklch.h)}`;
  return alpha < 1 ? `oklch(${parts} / ${round(alpha, 3)})` : `oklch(${parts})`;
}

/** Naive (device-independent) CMYK — the conversion print previews and CSS tools use. */
export function toCmyk(color: Color): Cmyk {
  const { r, g, b } = toRgb255(color);
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;
  const k = 1 - Math.max(rf, gf, bf);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 1 };
  return {
    c: (1 - rf - k) / (1 - k),
    m: (1 - gf - k) / (1 - k),
    y: (1 - bf - k) / (1 - k),
    k,
  };
}

export function formatCmykString(color: Color): string {
  const { c, m, y, k } = toCmyk(color);
  return `cmyk(${pct(c, 1)}, ${pct(m, 1)}, ${pct(y, 1)}, ${pct(k, 1)})`;
}

/** Closest CSS named color by CIEDE2000 perceptual difference. */
export function nearestNamedColor(color: Color): NamedMatch {
  const hex = formatHexString(color);
  const name = nearestNamed(hex, 1)[0] ?? 'black';
  return { name, hex: formatHexString(parseColor(name)), deltaE: round(deltaE(hex, name), 2) };
}

/** WCAG 2.x relative luminance of a colour (0 = black, 1 = white). */
export function relativeLuminance(color: Color): number {
  const rgb = toRgb(color);
  const linear = (channel: number): number => {
    const value = Math.min(1, Math.max(0, channel));
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(rgb.r) + 0.7152 * linear(rgb.g) + 0.0722 * linear(rgb.b);
}

/** WCAG contrast ratio between two colours: 1 (identical) up to 21 (black on white). */
export function contrastRatio(foreground: Color | string, background: Color | string): number {
  const fg = typeof foreground === 'string' ? parseColor(foreground) : foreground;
  const bg = typeof background === 'string' ? parseColor(background) : background;
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** WCAG 2.2 pass/fail for normal text (4.5:1 / 7:1) and large text (3:1 / 4.5:1). */
export function wcagLevels(ratio: number): Omit<ContrastReport, 'ratio'> {
  return {
    aaNormal: ratio >= 4.5,
    aaLarge: ratio >= 3,
    aaaNormal: ratio >= 7,
    aaaLarge: ratio >= 4.5,
  };
}

export function contrastReport(
  foreground: Color | string,
  background: Color | string,
): ContrastReport {
  const ratio = contrastRatio(foreground, background);
  return { ratio, ...wcagLevels(ratio) };
}

/** "4.56:1" — rounded down so the reported ratio never overstates the contrast. */
export function formatRatio(ratio: number): string {
  return `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1`;
}

/**
 * `steps` lighter tints and `steps` darker shades around the colour, produced by
 * moving OKLCH lightness towards white and black. Chroma is clamped so every
 * step is representable in sRGB. Ordered lightest first.
 */
export function shadesAndTints(color: Color, steps = 5): Shade[] {
  if (steps < 1) throw new ColorError('Shade count must be at least 1.');
  const base = toOklch(color);
  const baseL = Math.min(1, Math.max(0, base.l));
  const make = (l: number, id: string, name: string, kind: Shade['kind']): Shade => {
    const clamped = clampChroma({ ...base, l, mode: 'oklch' }, 'oklch');
    return { id, name, hex: formatHexString(clamped), lightness: round(l * 100, 1), kind };
  };

  const tints: Shade[] = [];
  const shades: Shade[] = [];
  for (let i = 1; i <= steps; i++) {
    tints.push(make(baseL + (1 - baseL) * (i / (steps + 1)), `tint-${i}`, `Tint ${i}`, 'tint'));
    shades.push(make(baseL - baseL * (i / (steps + 1)), `shade-${i}`, `Shade ${i}`, 'shade'));
  }
  return [...tints.reverse(), make(baseL, 'base', 'Base color', 'base'), ...shades];
}

/** Every output format for one colour, in display order. */
export function convertAll(color: Color): ColorRow[] {
  return [
    { id: 'hex', label: 'HEX', value: formatHexString(color) },
    { id: 'hex8', label: 'HEX with alpha', value: formatHex8String(color) },
    { id: 'rgb', label: 'RGB', value: formatRgbString(color) },
    { id: 'rgba', label: 'RGBA', value: formatRgbaString(color) },
    { id: 'hsl', label: 'HSL', value: formatHslString(color) },
    { id: 'hwb', label: 'HWB', value: formatHwbString(color) },
    { id: 'lab', label: 'LAB', value: formatLabString(color) },
    { id: 'lch', label: 'LCH', value: formatLchString(color) },
    { id: 'oklab', label: 'OKLAB', value: formatOklabString(color) },
    { id: 'oklch', label: 'OKLCH', value: formatOklchString(color) },
    { id: 'cmyk', label: 'CMYK', value: formatCmykString(color) },
    { id: 'named', label: 'Nearest named color', value: nearestNamedColor(color).name },
  ];
}

/** Parse and convert in one step — what the UI calls on every keystroke. */
export function convert(input: string): ColorRow[] {
  return convertAll(parseColor(input));
}
