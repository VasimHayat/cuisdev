/**
 * Image Compressor — pure helpers. No DOM and no canvas here: the encoding
 * itself lives in `client.ts`; everything that can be reasoned about with
 * numbers and strings lives (and is unit-tested) here.
 */

export class ImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageError';
  }
}

/** Hard ceiling for a single input file. */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

/** Largest edge a canvas is asked to allocate. */
export const MAX_DIMENSION = 20000;

/** The output format picker's values. */
export type OutputFormat = 'original' | 'image/jpeg' | 'image/webp' | 'image/png';

export const OUTPUT_FORMATS: readonly OutputFormat[] = [
  'original',
  'image/jpeg',
  'image/webp',
  'image/png',
];

/** File extension handed out per encoded MIME type. */
export const EXTENSIONS: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'image/svg+xml': 'svg',
};

/** Types every browser canvas can encode back out. */
const ENCODABLE = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Types whose encoder takes a quality argument. */
const LOSSY = new Set(['image/jpeg', 'image/webp', 'image/avif']);

const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'jfif',
  'webp',
  'gif',
  'bmp',
  'ico',
  'avif',
  'svg',
]);

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

export function isLossy(mime: string): boolean {
  return LOSSY.has(mime);
}

/** Browsers report `type: ''` for some files, so fall back to the extension. */
export function isImageFile(file: Pick<FileLike, 'name' | 'type'>): boolean {
  if (file.type.startsWith('image/')) return true;
  return IMAGE_EXTENSIONS.has(fileExtension(file.name));
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

/** Throw a specific, actionable error when a dropped file cannot be compressed. */
export function assertUsableFile(file: FileLike): void {
  if (!isImageFile(file)) {
    throw new ImageError(
      `“${file.name}” is not an image. Drop a PNG, JPEG, WebP, GIF, BMP, AVIF or ICO file instead.`,
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ImageError(
      `“${file.name}” is ${formatBytes(file.size)} — larger than the ${formatBytes(MAX_FILE_BYTES)} limit. ` +
        'Shrink it with a desktop tool first.',
    );
  }
  if (file.size === 0) {
    throw new ImageError(`“${file.name}” is empty (0 bytes), so there is nothing to compress.`);
  }
}

/** Which MIME type the canvas should encode to for one source image. */
export function resolveOutputType(originalType: string, choice: OutputFormat): string {
  if (choice !== 'original') return choice;
  return ENCODABLE.has(originalType) ? originalType : 'image/png';
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

/** `canvas.toBlob` wants 0–1, and ignores the argument for lossless formats. */
export function qualityFor(mime: string, quality: number): number | undefined {
  return isLossy(mime) ? quality / 100 : undefined;
}

/** Parse an optional "max width" / "max height" box. Blank means "no limit". */
export function parseLimit(raw: string, label: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new ImageError(`${label} must be a whole number of pixels — got “${trimmed}”.`);
  }
  if (value < 1 || value > MAX_DIMENSION) {
    throw new ImageError(`${label} must be between 1 and ${MAX_DIMENSION} pixels — got ${value}.`);
  }
  return value;
}

/** Scale down to fit the limits, preserving the aspect ratio. Never upscales. */
export function fitWithin(
  source: Dimensions,
  limits: { maxWidth?: number | undefined; maxHeight?: number | undefined } = {},
): Dimensions {
  const { width, height } = source;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new ImageError(
      `The image reported an unusable size (${width} × ${height}), so it cannot be compressed.`,
    );
  }
  let scale = 1;
  if (limits.maxWidth !== undefined && width > limits.maxWidth) {
    scale = Math.min(scale, limits.maxWidth / width);
  }
  if (limits.maxHeight !== undefined && height > limits.maxHeight) {
    scale = Math.min(scale, limits.maxHeight / height);
  }
  if (scale === 1) return { width: Math.round(width), height: Math.round(height) };
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** `holiday.jpeg` + `image/webp` → `holiday-compressed.webp`. */
export function outputFileName(originalName: string, mime: string): string {
  return `${baseName(originalName)}-compressed.${extensionFor(mime)}`;
}

/** Percentage of the original size saved, to one decimal place. Negative when it grew. */
export function savingsPercent(before: number, after: number): number {
  if (before <= 0) return 0;
  return Math.round(((before - after) / before) * 1000) / 10;
}

export interface CompressionSummary {
  before: number;
  after: number;
  percent: number;
  /** True when re-encoding produced a file at least as big as the original. */
  larger: boolean;
  label: string;
}

export function summarise(before: number, after: number): CompressionSummary {
  const percent = savingsPercent(before, after);
  const larger = after >= before;
  return {
    before,
    after,
    percent,
    larger,
    label: larger ? 'Already optimised' : `${percent}% smaller`,
  };
}

/** The "before → after" fragment of a result row. */
export function describeSizes(before: number, after: number): string {
  return `${formatBytes(before)} → ${formatBytes(after)}`;
}
