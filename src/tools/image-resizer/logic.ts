/**
 * Image Resizer & Cropper — pure geometry and naming helpers. No DOM: the
 * canvas drawing, decoding and encoding live in `client.ts`.
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

export interface Dimensions {
  width: number;
  height: number;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ResizeMode = 'exact' | 'percent' | 'preset';

export type OutputFormat = 'original' | 'image/png' | 'image/jpeg' | 'image/webp';

export interface SizePreset {
  id: string;
  label: string;
  width: number;
  height: number;
}

export const PRESETS: readonly SizePreset[] = [
  { id: '1920x1080', label: '1920 × 1080 — Full HD', width: 1920, height: 1080 },
  { id: '1280x720', label: '1280 × 720 — HD', width: 1280, height: 720 },
  { id: '1080x1080', label: '1080 × 1080 — square post', width: 1080, height: 1080 },
  { id: '800x600', label: '800 × 600', width: 800, height: 600 },
  { id: '512x512', label: '512 × 512 — app icon', width: 512, height: 512 },
  { id: '32x32', label: '32 × 32 — favicon', width: 32, height: 32 },
  { id: '16x16', label: '16 × 16 — favicon', width: 16, height: 16 },
];

export interface CropAspect {
  id: string;
  label: string;
  /** `null` means "use the whole image". */
  ratio: number | null;
}

export const CROP_ASPECTS: readonly CropAspect[] = [
  { id: 'none', label: 'No crop', ratio: null },
  { id: '1:1', label: 'Square (1:1)', ratio: 1 },
  { id: '4:3', label: 'Landscape (4:3)', ratio: 4 / 3 },
  { id: '16:9', label: 'Widescreen (16:9)', ratio: 16 / 9 },
  { id: '3:2', label: 'Photo (3:2)', ratio: 3 / 2 },
  { id: 'custom', label: 'Custom (x, y, width, height)', ratio: null },
];

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
};

const ENCODABLE = new Set(['image/jpeg', 'image/png', 'image/webp']);
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

// --- names and formats -----------------------------------------------------------

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

export function qualityFor(mime: string, quality: number): number | undefined {
  return isLossy(mime) ? quality / 100 : undefined;
}

export function isImageFile(file: Pick<FileLike, 'name' | 'type'>): boolean {
  if (file.type.startsWith('image/')) return true;
  return IMAGE_EXTENSIONS.has(fileExtension(file.name));
}

export function resolveOutputType(originalType: string, choice: OutputFormat): string {
  if (choice !== 'original') return choice;
  return ENCODABLE.has(originalType) ? originalType : 'image/png';
}

/** `photo.jpg` at 800 × 450 → `photo-800x450.jpg`. */
export function resizedFileName(originalName: string, size: Dimensions, mime: string): string {
  return `${baseName(originalName)}-${size.width}x${size.height}.${extensionFor(mime)}`;
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

export function assertUsableFile(file: FileLike): void {
  if (!isImageFile(file)) {
    throw new ImageError(
      `“${file.name}” is not an image. Drop a PNG, JPEG, WebP, GIF, BMP, AVIF or ICO file instead.`,
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ImageError(
      `“${file.name}” is ${formatBytes(file.size)} — larger than the ${formatBytes(MAX_FILE_BYTES)} limit.`,
    );
  }
  if (file.size === 0) {
    throw new ImageError(`“${file.name}” is empty (0 bytes), so there is nothing to resize.`);
  }
}

// --- numbers ---------------------------------------------------------------------

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

/** A required pixel measurement: whole number, 1 … 20000. */
export function parseDimension(raw: string | number, label: string): number {
  const text = typeof raw === 'number' ? String(raw) : raw.trim();
  if (text === '') throw new ImageError(`${label} is required — enter a number of pixels.`);
  const value = Number(text);
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new ImageError(`${label} must be a whole number of pixels — got “${text}”.`);
  }
  if (value < 1 || value > MAX_DIMENSION) {
    throw new ImageError(`${label} must be between 1 and ${MAX_DIMENSION} pixels — got ${value}.`);
  }
  return value;
}

/** An offset may be zero, so it gets its own parser. */
export function parseOffset(raw: string | number, label: string): number {
  const text = typeof raw === 'number' ? String(raw) : raw.trim();
  if (text === '') return 0;
  const value = Number(text);
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new ImageError(`${label} must be a whole number of pixels — got “${text}”.`);
  }
  if (value < 0 || value > MAX_DIMENSION) {
    throw new ImageError(`${label} must be between 0 and ${MAX_DIMENSION} pixels — got ${value}.`);
  }
  return value;
}

export function parsePercent(raw: string | number): number {
  const text = typeof raw === 'number' ? String(raw) : raw.trim();
  if (text === '') throw new ImageError('Scale is required — enter a percentage.');
  const value = Number(text);
  if (!Number.isFinite(value)) {
    throw new ImageError(`Scale must be a number between 1 and 500% — got “${text}”.`);
  }
  if (value < 1 || value > 500) {
    throw new ImageError(`Scale must be between 1 and 500% — got ${value}.`);
  }
  return value;
}

export function getPreset(id: string): SizePreset {
  const preset = PRESETS.find((p) => p.id === id);
  if (!preset) {
    throw new ImageError(`Unknown size preset “${id}”. Pick one from the Preset list.`);
  }
  return preset;
}

export function getAspect(id: string): CropAspect {
  const aspect = CROP_ASPECTS.find((a) => a.id === id);
  if (!aspect) {
    throw new ImageError(`Unknown crop shape “${id}”. Pick one from the Crop list.`);
  }
  return aspect;
}

// --- geometry --------------------------------------------------------------------

/** The other edge implied by the source aspect ratio when the lock is on. */
export function matchAspect(
  source: Dimensions,
  size: Dimensions,
  changed: 'width' | 'height',
): Dimensions {
  if (source.width < 1 || source.height < 1) return size;
  if (changed === 'width') {
    return { width: size.width, height: Math.max(1, Math.round(size.width / aspectOf(source))) };
  }
  return { width: Math.max(1, Math.round(size.height * aspectOf(source))), height: size.height };
}

export function aspectOf(size: Dimensions): number {
  return size.width / size.height;
}

export function scaleByPercent(source: Dimensions, percent: number): Dimensions {
  return {
    width: Math.max(1, Math.round((source.width * percent) / 100)),
    height: Math.max(1, Math.round((source.height * percent) / 100)),
  };
}

/** The largest rectangle of `ratio` that fits, centred on the source. */
export function centeredCrop(source: Dimensions, ratio: number | null): CropRect {
  if (ratio === null || !Number.isFinite(ratio) || ratio <= 0) {
    return { x: 0, y: 0, width: source.width, height: source.height };
  }
  let width = source.width;
  let height = source.height;
  if (aspectOf(source) > ratio) width = Math.round(source.height * ratio);
  else height = Math.round(source.width / ratio);
  width = Math.min(source.width, Math.max(1, width));
  height = Math.min(source.height, Math.max(1, height));
  return {
    x: Math.round((source.width - width) / 2),
    y: Math.round((source.height - height) / 2),
    width,
    height,
  };
}

/** Keep a crop inside the image, with a specific error when it starts outside. */
export function clampCrop(source: Dimensions, crop: CropRect): CropRect {
  if (crop.x >= source.width) {
    throw new ImageError(
      `Crop X (${crop.x}) is outside the image, which is only ${source.width} px wide.`,
    );
  }
  if (crop.y >= source.height) {
    throw new ImageError(
      `Crop Y (${crop.y}) is outside the image, which is only ${source.height} px tall.`,
    );
  }
  const width = Math.min(crop.width, source.width - crop.x);
  const height = Math.min(crop.height, source.height - crop.y);
  if (width < 1 || height < 1) {
    throw new ImageError('The crop area has no pixels in it — increase its width and height.');
  }
  return { x: crop.x, y: crop.y, width, height };
}

/** The crop for one source image, given the chosen shape and the numeric boxes. */
export function resolveCrop(
  source: Dimensions,
  aspectId: string,
  custom: CropRect | null,
): CropRect {
  const aspect = getAspect(aspectId);
  if (aspectId === 'custom') {
    if (!custom) return { x: 0, y: 0, width: source.width, height: source.height };
    return clampCrop(source, custom);
  }
  return centeredCrop(source, aspect.ratio);
}

/** The output size, given the crop that will be drawn from. */
export function resolveTarget(
  mode: ResizeMode,
  cropped: Dimensions,
  options: { width?: number; height?: number; percent?: number; preset?: string },
): Dimensions {
  switch (mode) {
    case 'percent':
      return scaleByPercent(cropped, options.percent ?? 100);
    case 'preset': {
      const preset = getPreset(options.preset ?? '');
      return { width: preset.width, height: preset.height };
    }
    default: {
      const width = options.width ?? cropped.width;
      const height = options.height ?? cropped.height;
      return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
    }
  }
}

export interface PreviewLayout {
  scale: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

/** Fit the source into the preview canvas box, centred. */
export function previewLayout(source: Dimensions, box: Dimensions): PreviewLayout {
  if (source.width < 1 || source.height < 1) {
    throw new ImageError('The image reported an unusable size, so it cannot be previewed.');
  }
  const scale = Math.min(box.width / source.width, box.height / source.height);
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  return {
    scale,
    width,
    height,
    offsetX: Math.round((box.width - width) / 2),
    offsetY: Math.round((box.height - height) / 2),
  };
}

/** Map a crop in source pixels into preview-canvas coordinates. */
export function previewRect(crop: CropRect, layout: PreviewLayout): CropRect {
  return {
    x: layout.offsetX + crop.x * layout.scale,
    y: layout.offsetY + crop.y * layout.scale,
    width: Math.max(1, crop.width * layout.scale),
    height: Math.max(1, crop.height * layout.scale),
  };
}

/** "crop 120, 40 → 800 × 600" for the status line. */
export function describeCrop(crop: CropRect, source: Dimensions): string {
  if (
    crop.x === 0 &&
    crop.y === 0 &&
    crop.width === source.width &&
    crop.height === source.height
  ) {
    return 'no crop';
  }
  return `crop ${crop.x}, ${crop.y} → ${formatDimensions(crop)}`;
}
