/**
 * Image to Base64 — pure helpers: Base64 codec, data-URL parsing, signature
 * sniffing and snippet building. No DOM, so it is all unit-testable.
 *
 * The Base64 codec and the signature table are deliberately implemented here
 * rather than shared with the Base64 tool: each tool stays self-contained.
 */

export class ImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageError';
  }
}

/** Hard ceiling for a single input file. */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

/** Data URLs above this are usually a mistake in a stylesheet or HTML file. */
export const DATA_URL_WARN_BYTES = 100 * 1024;

/** An 8 × 8 checkerboard PNG used by the Sample buttons. */
export const SAMPLE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAHklEQVR42mNQSjvzHxn/' +
  'P6OEghnooABdAF0DHRQAAHBip+GJeDo+AAAAAElFTkSuQmCC';

export const EXTENSIONS: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'image/svg+xml': 'svg',
  'image/tiff': 'tif',
};

export const FORMAT_LABELS: Readonly<Record<string, string>> = {
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/webp': 'WebP',
  'image/avif': 'AVIF',
  'image/gif': 'GIF',
  'image/bmp': 'BMP',
  'image/x-icon': 'ICO',
  'image/vnd.microsoft.icon': 'ICO',
  'image/svg+xml': 'SVG',
  'image/tiff': 'TIFF',
};

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

// --- names ------------------------------------------------------------------------

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

export function isImageFile(file: Pick<FileLike, 'name' | 'type'>): boolean {
  if (file.type.startsWith('image/')) return true;
  return IMAGE_EXTENSIONS.has(fileExtension(file.name));
}

export function assertUsableFile(file: FileLike): void {
  if (!isImageFile(file)) {
    throw new ImageError(
      `“${file.name}” is not an image. Drop a PNG, JPEG, WebP, GIF, BMP, SVG, AVIF or ICO file instead.`,
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ImageError(
      `“${file.name}” is ${formatBytes(file.size)} — larger than the ${formatBytes(MAX_FILE_BYTES)} limit.`,
    );
  }
  if (file.size === 0) {
    throw new ImageError(`“${file.name}” is empty (0 bytes), so there is nothing to encode.`);
  }
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

/** Download name for a decoded data URL, e.g. `image.png`. */
export function downloadNameFor(mime: string, stem = 'image'): string {
  return `${stem}.${extensionFor(mime)}`;
}

// --- Base64 -----------------------------------------------------------------------

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const REVERSE = (() => {
  const table = new Int16Array(128).fill(-1);
  for (let i = 0; i < ALPHABET.length; i++) table[ALPHABET.charCodeAt(i)] = i;
  return table;
})();

export function bytesToBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  let chunk = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    chunk += ALPHABET[b0 >> 2];
    chunk += ALPHABET[((b0 & 0b11) << 4) | ((b1 ?? 0) >> 4)];
    chunk += b1 === undefined ? '=' : ALPHABET[((b1 & 0b1111) << 2) | ((b2 ?? 0) >> 6)];
    chunk += b2 === undefined ? '=' : ALPHABET[b2 & 0b111111];
    if (chunk.length >= 8192) {
      parts.push(chunk);
      chunk = '';
    }
  }
  if (chunk !== '') parts.push(chunk);
  return parts.join('');
}

export function base64ToBytes(input: string): Uint8Array<ArrayBuffer> {
  const clean = input.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (clean === '') throw new ImageError('There is no Base64 data to decode.');

  const body = clean.replace(/=+$/, '');
  const invalid = /[^A-Za-z0-9+/]/.exec(body);
  if (invalid) {
    throw new ImageError(
      `Invalid Base64 character “${invalid[0]}” at position ${invalid.index}. ` +
        'Paste only the Base64 text, or a complete data: URL.',
    );
  }
  if (body.length % 4 === 1) {
    throw new ImageError(
      `This Base64 string is ${body.length} characters long, which cannot be valid — the length must not leave a remainder of 1 when divided by 4.`,
    );
  }

  // A remainder of 1 is rejected above, so this length is exact.
  const bytes = new Uint8Array(Math.floor((body.length * 3) / 4));
  let out = 0;
  for (let i = 0; i < body.length; i += 4) {
    const c0 = REVERSE[body.charCodeAt(i)] ?? -1;
    const c1 = REVERSE[body.charCodeAt(i + 1)] ?? -1;
    const c2 = i + 2 < body.length ? (REVERSE[body.charCodeAt(i + 2)] ?? -1) : -1;
    const c3 = i + 3 < body.length ? (REVERSE[body.charCodeAt(i + 3)] ?? -1) : -1;
    bytes[out++] = (c0 << 2) | (c1 >> 4);
    if (c2 >= 0) bytes[out++] = ((c1 & 0b1111) << 4) | (c2 >> 2);
    if (c3 >= 0) bytes[out++] = ((c2 & 0b11) << 6) | c3;
  }
  return bytes;
}

// --- signatures --------------------------------------------------------------------

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    const byte = bytes[offset + i];
    if (byte === undefined) return '';
    out += String.fromCharCode(byte);
  }
  return out;
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((byte, i) => bytes[i] === byte);
}

/** Guess the MIME type from the first bytes. Returns `''` when nothing matches. */
export function sniffMime(bytes: Uint8Array): string {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  const gif = ascii(bytes, 0, 6);
  if (gif === 'GIF87a' || gif === 'GIF89a') return 'image/gif';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'image/webp';
  if (ascii(bytes, 4, 8) === 'ftypavif') return 'image/avif';
  if (ascii(bytes, 0, 2) === 'BM') return 'image/bmp';
  if (startsWith(bytes, [0x00, 0x00, 0x01, 0x00])) return 'image/x-icon';
  const head = ascii(bytes, 0, Math.min(bytes.length, 300)).trimStart().toLowerCase();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) {
    return 'image/svg+xml';
  }
  return '';
}

// --- data URLs ---------------------------------------------------------------------

export function toDataUrl(mime: string, base64: string): string {
  return `data:${mime || 'application/octet-stream'};base64,${base64}`;
}

export interface ParsedDataUrl {
  mime: string;
  base64: string;
  bytes: Uint8Array<ArrayBuffer>;
  /** True when the MIME type was sniffed from the bytes, not declared. */
  sniffed: boolean;
}

/**
 * Accept a full `data:` URL or a bare Base64 string. Bare input (and data URLs
 * with a wrong or missing type) fall back to sniffing the decoded bytes.
 */
export function parseDataUrl(input: string): ParsedDataUrl {
  const text = input.trim();
  if (text === '') throw new ImageError('Paste a data URL or a Base64 string to decode.');

  let declared = '';
  let payload = text;
  if (/^data:/i.test(text)) {
    const comma = text.indexOf(',');
    if (comma === -1) {
      throw new ImageError(
        'This data URL has no comma, so it contains no data. A data URL looks like data:image/png;base64,iVBORw0…',
      );
    }
    const header = text.slice(5, comma);
    if (!/;base64$/i.test(header)) {
      throw new ImageError(
        'Only base64-encoded data URLs are supported — this one is missing the “;base64” marker.',
      );
    }
    declared = header.slice(0, -';base64'.length).toLowerCase();
    payload = text.slice(comma + 1);
  }

  const bytes = base64ToBytes(payload);
  if (bytes.length === 0) {
    throw new ImageError('The Base64 decoded to zero bytes, so there is no image in it.');
  }
  const sniffed = sniffMime(bytes);
  if (sniffed === '' && declared === '') {
    throw new ImageError(
      'These bytes do not start with a known image signature (PNG, JPEG, GIF, WebP, AVIF, BMP, ICO or SVG). Check that you copied the whole string.',
    );
  }
  return {
    mime: sniffed === '' ? declared : sniffed,
    base64: payload.replace(/\s+/g, ''),
    bytes,
    sniffed: sniffed !== '' && sniffed !== declared,
  };
}

// --- snippets ----------------------------------------------------------------------

export function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Markdown link text cannot contain unescaped brackets. */
export function escapeMarkdownText(value: string): string {
  return value.replace(/([[\]\\])/g, '\\$1');
}

/** `hero-image_2x.png` → `hero image 2x`. */
export function altTextFor(name: string): string {
  const stem = baseName(name).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return stem === '' ? 'image' : stem;
}

export interface Snippets {
  base64: string;
  dataUrl: string;
  html: string;
  css: string;
  markdown: string;
}

export function buildSnippets(input: { name: string; mime: string; base64: string }): Snippets {
  const dataUrl = toDataUrl(input.mime, input.base64);
  const alt = altTextFor(input.name);
  return {
    base64: input.base64,
    dataUrl,
    html: `<img src="${dataUrl}" alt="${escapeHtmlAttribute(alt)}" />`,
    css: `background-image: url('${dataUrl}');`,
    markdown: `![${escapeMarkdownText(alt)}](${dataUrl})`,
  };
}

/** Base64 costs about a third more bytes than the binary it replaces. */
export function growthPercent(rawBytes: number, encodedLength: number): number {
  if (rawBytes <= 0) return 0;
  return Math.round(((encodedLength - rawBytes) / rawBytes) * 1000) / 10;
}

export function isOversized(dataUrlLength: number): boolean {
  return dataUrlLength > DATA_URL_WARN_BYTES;
}

/** The warning shown when a data URL is too big to be a good idea. */
export function oversizeWarning(dataUrlLength: number): string {
  return (
    `This data URL is ${formatBytes(dataUrlLength)}, over the ${formatBytes(DATA_URL_WARN_BYTES)} ` +
    'rule of thumb. Inlining an image this large bloats your HTML or CSS and stops it being cached ' +
    'separately — link to the file instead.'
  );
}

/** "PNG · 12 KB → 16 KB data URL (+33.3%)" for a result row. */
export function describeEncoding(mime: string, rawBytes: number, dataUrlLength: number): string {
  return (
    `${formatLabel(mime)} · ${formatBytes(rawBytes)} → ${formatBytes(dataUrlLength)} data URL ` +
    `(+${growthPercent(rawBytes, dataUrlLength)}%)`
  );
}
