/**
 * Image Format Converter — pure helpers. Decoding and canvas encoding live in
 * `client.ts`; everything that is just strings and numbers lives here so it can
 * be unit-tested without a browser.
 */

export class ImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageError';
  }
}

/** Hard ceiling for a single input file. */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

/** Formats a canvas may be asked to encode to. AVIF is feature-detected at runtime. */
export type TargetFormat = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/avif';

export const TARGET_FORMATS: readonly TargetFormat[] = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
];

/** MIME type → file extension. */
export const EXTENSIONS: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'image/svg+xml': 'svg',
  'image/tiff': 'tif',
};

/** File extension → MIME type, for browsers that report an empty `File.type`. */
export const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
  tif: 'image/tiff',
  tiff: 'image/tiff',
};

/** Short display names for the results list. */
export const FORMAT_LABELS: Readonly<Record<string, string>> = {
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/jpg': 'JPEG',
  'image/webp': 'WebP',
  'image/avif': 'AVIF',
  'image/gif': 'GIF',
  'image/bmp': 'BMP',
  'image/x-icon': 'ICO',
  'image/vnd.microsoft.icon': 'ICO',
  'image/svg+xml': 'SVG',
  'image/tiff': 'TIFF',
};

/** Encoders that take a quality argument. */
const LOSSY = new Set(['image/jpeg', 'image/webp', 'image/avif']);

/** Targets with no alpha channel: transparency has to be flattened onto a colour. */
const OPAQUE_TARGETS = new Set(['image/jpeg']);

export interface FileLike {
  name: string;
  type: string;
  size: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 1 ? '' : name.slice(dot + 1).toLowerCase();
}

export function baseName(name: string): string {
  const withoutPath = name.split(/[/\\]/).pop() ?? '';
  const dot = withoutPath.lastIndexOf('.');
  const stem = dot < 1 ? withoutPath : withoutPath.slice(0, dot);
  return stem.trim() === '' ? 'image' : stem;
}

export function extensionFor(mime: string): string {
  return EXTENSIONS[mime] ?? 'png';
}

export function formatLabel(mime: string): string {
  return FORMAT_LABELS[mime] ?? (mime === '' ? 'unknown' : mime);
}

/** Best guess at the source type: trust the browser, fall back to the extension. */
export function sourceType(file: Pick<FileLike, 'name' | 'type'>): string {
  if (file.type.startsWith('image/')) return file.type;
  return MIME_BY_EXTENSION[fileExtension(file.name)] ?? '';
}

export function isSupportedInput(file: Pick<FileLike, 'name' | 'type'>): boolean {
  return sourceType(file) !== '';
}

export function isLossy(mime: string): boolean {
  return LOSSY.has(mime);
}

/** JPEG has no alpha, so a transparent source has to be flattened first. */
export function needsBackground(target: string): boolean {
  return OPAQUE_TARGETS.has(target);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
}

export function formatDimensions(size: Dimensions): string {
  return `${size.width} × ${size.height}`;
}

export function describeSizes(before: number, after: number): string {
  return `${formatBytes(before)} → ${formatBytes(after)}`;
}

/** "PNG → JPEG" for a result row. */
export function describeConversion(from: string, to: string): string {
  return `${formatLabel(from)} → ${formatLabel(to)}`;
}

export function assertUsableFile(file: FileLike): void {
  if (!isSupportedInput(file)) {
    throw new ImageError(
      `“${file.name}” is not an image this tool can read. Supported inputs are PNG, JPEG, WebP, AVIF, GIF, BMP, ICO and SVG.`,
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ImageError(
      `“${file.name}” is ${formatBytes(file.size)} — larger than the ${formatBytes(MAX_FILE_BYTES)} limit.`,
    );
  }
  if (file.size === 0) {
    throw new ImageError(`“${file.name}” is empty (0 bytes), so there is nothing to convert.`);
  }
}

export function parseQuality(raw: string | number): number {
  const value = typeof raw === 'number' ? raw : Number(raw.trim());
  if (!Number.isFinite(value)) {
    throw new ImageError(`Quality must be a number between 10 and 100 — got “${String(raw)}”.`);
  }
  const rounded = Math.round(value);
  if (rounded < 10 || rounded > 100) {
    throw new ImageError(`Quality must be between 10 and 100 — got ${rounded}.`);
  }
  return rounded;
}

export function qualityFor(mime: string, quality: number): number | undefined {
  return isLossy(mime) ? quality / 100 : undefined;
}

/** Accept `#abc`, `abc`, `#AABBCC`; always return lower-case `#rrggbb`. */
export function normalizeHexColor(value: string): string {
  const raw = value.trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{3}$/.test(raw)) {
    return `#${[...raw].map((c) => c + c).join('')}`;
  }
  if (/^[0-9a-f]{6}$/.test(raw)) return `#${raw}`;
  throw new ImageError(
    `Background colour must be a hex value like #ffffff — got “${value.trim()}”.`,
  );
}

/** `logo.png` + `image/webp` → `logo.webp`. */
export function convertedFileName(originalName: string, target: string): string {
  return `${baseName(originalName)}.${extensionFor(target)}`;
}

/** Which targets to offer. AVIF only appears when the browser can encode it. */
export function availableTargets(supportsAvif: boolean): TargetFormat[] {
  return TARGET_FORMATS.filter((format) => format !== 'image/avif' || supportsAvif);
}

/** Converting PNG → PNG is legal but pointless; the UI says so. */
export function isNoOp(from: string, to: string): boolean {
  return from !== '' && (from === to || (from === 'image/jpg' && to === 'image/jpeg'));
}

/**
 * SVGs (and some ICOs) carry no intrinsic pixel size. Fall back to a square
 * that is big enough to stay sharp, and keep the aspect ratio when one edge
 * is known.
 */
export function fallbackDimensions(size: Partial<Dimensions>, fallback = 512): Dimensions {
  const width =
    Number.isFinite(size.width) && (size.width ?? 0) > 0 ? Math.round(size.width ?? 0) : 0;
  const height =
    Number.isFinite(size.height) && (size.height ?? 0) > 0 ? Math.round(size.height ?? 0) : 0;
  if (width > 0 && height > 0) return { width, height };
  if (width > 0) return { width, height: width };
  if (height > 0) return { width: height, height };
  return { width: fallback, height: fallback };
}
