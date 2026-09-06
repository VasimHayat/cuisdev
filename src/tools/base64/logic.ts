/**
 * Base64 encode/decode — pure functions, no DOM. Handles UTF-8 text, binary
 * bytes, the URL-safe alphabet (RFC 4648 §5), missing padding and whitespace.
 */

export class Base64Error extends Error {
  override name = 'Base64Error';
}

export interface EncodeOptions {
  /** Use `-` and `_` instead of `+` and `/`, and drop `=` padding. */
  urlSafe?: boolean;
  /** Insert a line break every N characters (76 for MIME). 0 disables. */
  wrapAt?: number;
}

const STANDARD_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;
const CHUNK = 0x8000;

export function bytesToBase64(bytes: Uint8Array, options: EncodeOptions = {}): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  let out = btoa(binary);
  if (options.urlSafe) out = toUrlSafe(out);
  if (options.wrapAt && options.wrapAt > 0) out = wrap(out, options.wrapAt);
  return out;
}

export function base64ToBytes(input: string): Uint8Array<ArrayBuffer> {
  const normalized = normalizeBase64(input);
  if (!STANDARD_PATTERN.test(normalized)) {
    const bad = normalized.match(/[^A-Za-z0-9+/=]/)?.[0];
    throw new Base64Error(
      bad !== undefined
        ? `Invalid character "${bad}" — Base64 only uses A–Z, a–z, 0–9, + and / (or - and _).`
        : 'Invalid Base64: padding "=" may only appear at the end.',
    );
  }
  if (normalized.length % 4 === 1) {
    throw new Base64Error('Invalid Base64 length — a single trailing character cannot be decoded.');
  }
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function encodeText(text: string, options: EncodeOptions = {}): string {
  return bytesToBase64(new TextEncoder().encode(text), options);
}

/** Decode to UTF-8 text. Throws Base64Error if the bytes are not valid UTF-8. */
export function decodeText(input: string): string {
  const bytes = base64ToBytes(input);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Base64Error(
      'Decoded successfully, but the result is not UTF-8 text. It is probably binary data — use Download to save it as a file.',
    );
  }
}

export function isValidBase64(input: string): boolean {
  try {
    base64ToBytes(input);
    return true;
  } catch {
    return false;
  }
}

/** Strip whitespace, convert the URL-safe alphabet and restore padding. */
export function normalizeBase64(input: string): string {
  let s = input.replace(/\s+/g, '');
  // Data URLs: keep only the payload
  const comma = s.indexOf(',');
  if (s.startsWith('data:') && comma !== -1) s = s.slice(comma + 1);
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  const unpadded = s.replace(/=+$/, '');
  const remainder = unpadded.length % 4;
  // A remainder of 1 can never be valid; leave it so the length check reports it.
  if (remainder === 0 || remainder === 1) return unpadded;
  return unpadded + '='.repeat(4 - remainder);
}

export function toUrlSafe(standard: string): string {
  return standard.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function wrap(text: string, width: number): string {
  if (width <= 0 || text.length <= width) return text;
  const lines: string[] = [];
  for (let i = 0; i < text.length; i += width) lines.push(text.slice(i, i + width));
  return lines.join('\n');
}

export function toDataUrl(bytes: Uint8Array, mimeType = 'application/octet-stream'): string {
  return `data:${mimeType};base64,${bytesToBase64(bytes)}`;
}

/** Best-effort sniff of common binary signatures for a friendlier download name. */
export function sniffExtension(bytes: Uint8Array): string {
  const hex = (n: number) =>
    Array.from(bytes.subarray(0, n), (b) => b.toString(16).padStart(2, '0')).join('');
  if (hex(4) === '89504e47') return 'png';
  if (hex(3) === 'ffd8ff') return 'jpg';
  if (hex(4) === '47494638') return 'gif';
  if (hex(4) === '25504446') return 'pdf';
  if (hex(4) === '504b0304') return 'zip';
  if (hex(4) === '52494646') return 'webp';
  return 'bin';
}
