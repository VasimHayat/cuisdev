/**
 * QR Code Generator — pure functions, no DOM.
 *
 * Payload builders for the content presets (Wi-Fi, email, phone, SMS, vCard),
 * option validation and thin wrappers around the `qrcode` package that turn
 * its terse errors into helpful messages. Canvas rendering lives in client.ts.
 */
import QRCode from 'qrcode';

export class QrError extends Error {
  override name = 'QrError';
}

export const QR_PRESETS = ['text', 'wifi', 'email', 'phone', 'sms', 'vcard'] as const;
export type QrPreset = (typeof QR_PRESETS)[number];

export const ERROR_CORRECTION_LEVELS = ['L', 'M', 'Q', 'H'] as const;
export type ErrorCorrectionLevel = (typeof ERROR_CORRECTION_LEVELS)[number];

/** Byte-mode capacity of a version-40 symbol per error-correction level (ISO/IEC 18004). */
export const MAX_BYTES: Record<ErrorCorrectionLevel, number> = {
  L: 2953,
  M: 2331,
  Q: 1663,
  H: 1273,
};

export const MIN_SIZE = 128;
export const MAX_SIZE = 1024;
export const MIN_MARGIN = 0;
export const MAX_MARGIN = 8;

export interface QrRenderOptions {
  /** Output width/height in pixels (PNG) or the SVG's width/height attributes. */
  size: number;
  errorCorrection: ErrorCorrectionLevel;
  /** Quiet zone in modules (the spec recommends 4). */
  margin: number;
  /** CSS hex colour for the dark modules. */
  foreground: string;
  /** CSS hex colour for the light modules / background. */
  background: string;
}

export const DEFAULT_RENDER_OPTIONS: QrRenderOptions = {
  size: 256,
  errorCorrection: 'M',
  margin: 4,
  foreground: '#000000',
  background: '#ffffff',
};

export interface QrInfo {
  /** Symbol version 1–40. */
  version: number;
  /** Modules per side (21 for version 1, +4 per version). */
  modules: number;
  /** UTF-8 byte length of the payload. */
  bytes: number;
  /** Payload length in characters (code points). */
  characters: number;
}

// --- payload helpers -------------------------------------------------------------

/** Strip a UTF-8 BOM and surrounding whitespace — a trailing newline would break a URL. */
export function normalizePayload(text: string): string {
  return text.replace(/^\uFEFF/, '').trim();
}

/** Human-readable names for the content presets. */
export const PRESET_LABELS: Record<QrPreset, string> = {
  text: 'Text or URL',
  wifi: 'Wi-Fi network',
  email: 'Email',
  phone: 'Phone number',
  sms: 'SMS message',
  vcard: 'Contact (vCard)',
};

/** Every field any preset can use. Fields a preset does not need are ignored. */
export interface PresetFields {
  text?: string;
  ssid?: string;
  password?: string;
  encryption?: WifiEncryption;
  hidden?: boolean;
  to?: string;
  subject?: string;
  body?: string;
  phone?: string;
  message?: string;
  name?: string;
  email?: string;
  org?: string;
}

/** Realistic sample data per preset, used by the Sample button. */
export const SAMPLES: Record<QrPreset, PresetFields> = {
  text: { text: 'https://www.cuisdev.com/tools/qr-code-generator/' },
  wifi: { ssid: 'Cuisdev Guest', password: 'welcome-2026', encryption: 'WPA', hidden: false },
  email: {
    to: 'hello@example.com',
    subject: 'Table for two on Friday',
    body: 'Hi,\n\nDo you have a table for two at 7 pm this Friday?\n\nThanks!',
  },
  phone: { phone: '+1 555 123 4567' },
  sms: { phone: '+1 555 123 4567', message: 'Hi! Please call me back when you get a moment.' },
  vcard: {
    name: 'Ada Lovelace',
    phone: '+44 20 7946 0958',
    email: 'ada@example.com',
    org: 'Analytical Engines Ltd',
  },
};

/** Build the string that gets encoded for a preset. Throws QrError on invalid fields. */
export function buildPayload(preset: QrPreset, fields: PresetFields): string {
  switch (preset) {
    case 'text':
      return normalizePayload(fields.text ?? '');
    case 'wifi':
      return buildWifiPayload({
        ssid: fields.ssid ?? '',
        password: fields.password,
        encryption: fields.encryption,
        hidden: fields.hidden,
      });
    case 'email':
      return buildMailto({ to: fields.to ?? '', subject: fields.subject, body: fields.body });
    case 'phone':
      return buildTel(fields.phone ?? '');
    case 'sms':
      return buildSms({ phone: fields.phone ?? '', message: fields.message });
    case 'vcard':
      return buildVCard({
        name: fields.name ?? '',
        phone: fields.phone,
        email: fields.email,
        org: fields.org,
      });
    default:
      throw new QrError(`Unknown content type "${String(preset)}".`);
  }
}

/** Escape the characters that are special in the WIFI: URI scheme (`\ ; , : "`). */
export function escapeWifi(value: string): string {
  return value.replace(/([\\;,:"])/g, '\\$1');
}

export type WifiEncryption = 'WPA' | 'WEP' | 'nopass';

export interface WifiOptions {
  ssid: string;
  password?: string | undefined;
  /** WPA covers WPA/WPA2/WPA3. Default WPA. */
  encryption?: WifiEncryption | undefined;
  hidden?: boolean | undefined;
}

/**
 * Build the de-facto standard Wi-Fi payload understood by iOS and Android:
 * `WIFI:T:WPA;S:MyNetwork;P:secret;H:false;;`
 */
export function buildWifiPayload(options: WifiOptions): string {
  const ssid = options.ssid.trim();
  const encryption = options.encryption ?? 'WPA';
  const password = options.password ?? '';

  if (ssid === '') throw new QrError('Wi-Fi network name (SSID) is required.');
  if (!['WPA', 'WEP', 'nopass'].includes(encryption)) {
    throw new QrError(`Unknown Wi-Fi encryption "${String(encryption)}" — use WPA, WEP or nopass.`);
  }
  if (encryption !== 'nopass' && password === '') {
    throw new QrError(
      'Wi-Fi password is required for WPA and WEP networks — choose "None" for an open network.',
    );
  }

  let payload = `WIFI:T:${encryption};S:${escapeWifi(ssid)};`;
  if (encryption !== 'nopass') payload += `P:${escapeWifi(password)};`;
  payload += `H:${options.hidden ? 'true' : 'false'};;`;
  return payload;
}

export interface EmailOptions {
  to: string;
  subject?: string | undefined;
  body?: string | undefined;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** `mailto:` URL with percent-encoded subject and body (RFC 6068). */
export function buildMailto(options: EmailOptions): string {
  const to = options.to.trim();
  if (to === '') throw new QrError('Email address is required.');
  if (!EMAIL_PATTERN.test(to)) {
    throw new QrError(`"${to}" does not look like an email address (expected name@example.com).`);
  }
  const params: string[] = [];
  const subject = options.subject?.trim() ?? '';
  const body = options.body ?? '';
  if (subject !== '') params.push(`subject=${encodeURIComponent(subject)}`);
  if (body !== '') params.push(`body=${encodeURIComponent(body.replace(/\r\n?/g, '\n'))}`);
  return `mailto:${to}${params.length > 0 ? `?${params.join('&')}` : ''}`;
}

/** Keep a leading `+` and digits; drop spaces, dots, dashes and parentheses. */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === '') throw new QrError('Phone number is required.');
  const plus = trimmed.startsWith('+') ? '+' : '';
  const digits = trimmed.replace(/[\s().-]/g, '').replace(/^\+/, '');
  if (digits === '' || !/^\d+$/.test(digits)) {
    throw new QrError(
      `"${trimmed}" is not a valid phone number — use digits with an optional leading + (e.g. +1 555 123 4567).`,
    );
  }
  return plus + digits;
}

/** `tel:+15551234567` */
export function buildTel(phone: string): string {
  return `tel:${normalizePhone(phone)}`;
}

export interface SmsOptions {
  phone: string;
  message?: string | undefined;
}

/** `smsto:+15551234567:Hello` — the SMSTO form is the most widely supported. */
export function buildSms(options: SmsOptions): string {
  const number = normalizePhone(options.phone);
  const message = options.message?.replace(/\r\n?/g, '\n').trim() ?? '';
  return message === '' ? `smsto:${number}` : `smsto:${number}:${message}`;
}

export interface VCardOptions {
  /** Full name, e.g. "Ada Lovelace". The last word becomes the family name. */
  name: string;
  phone?: string | undefined;
  email?: string | undefined;
  org?: string | undefined;
}

/** Escape `\ ; ,` and newlines in a vCard property value (RFC 2426 §2.4.2). */
export function escapeVCard(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n?|\n/g, '\\n');
}

/** Minimal vCard 3.0 with CRLF line endings, as required by the spec. */
export function buildVCard(options: VCardOptions): string {
  const name = options.name.trim().replace(/\s+/g, ' ');
  if (name === '') throw new QrError('Contact name is required for a vCard.');

  const parts = name.split(' ');
  const family = parts.length > 1 ? (parts.pop() as string) : '';
  const given = parts.join(' ');

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${escapeVCard(family)};${escapeVCard(given)};;;`,
    `FN:${escapeVCard(name)}`,
  ];
  const org = options.org?.trim() ?? '';
  if (org !== '') lines.push(`ORG:${escapeVCard(org)}`);
  const phone = options.phone?.trim() ?? '';
  if (phone !== '') lines.push(`TEL;TYPE=CELL:${normalizePhone(phone)}`);
  const email = options.email?.trim() ?? '';
  if (email !== '') {
    if (!EMAIL_PATTERN.test(email)) {
      throw new QrError(`"${email}" does not look like an email address.`);
    }
    lines.push(`EMAIL;TYPE=INTERNET:${escapeVCard(email)}`);
  }
  lines.push('END:VCARD');
  return lines.join('\r\n');
}

// --- options --------------------------------------------------------------------

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

/** Validate and normalise render options, throwing QrError with a specific message. */
export function validateRenderOptions(options: Partial<QrRenderOptions> = {}): QrRenderOptions {
  const merged = { ...DEFAULT_RENDER_OPTIONS, ...options };

  if (!Number.isInteger(merged.size) || merged.size < MIN_SIZE || merged.size > MAX_SIZE) {
    throw new QrError(
      `Size must be a whole number between ${MIN_SIZE} and ${MAX_SIZE} pixels — got ${String(merged.size)}.`,
    );
  }
  if (!ERROR_CORRECTION_LEVELS.includes(merged.errorCorrection)) {
    throw new QrError(
      `Unknown error-correction level "${String(merged.errorCorrection)}" — use L, M, Q or H.`,
    );
  }
  if (
    !Number.isInteger(merged.margin) ||
    merged.margin < MIN_MARGIN ||
    merged.margin > MAX_MARGIN
  ) {
    throw new QrError(
      `Margin must be a whole number between ${MIN_MARGIN} and ${MAX_MARGIN} modules — got ${String(merged.margin)}.`,
    );
  }
  if (!isHexColor(merged.foreground)) {
    throw new QrError(
      `Foreground colour "${merged.foreground}" must be a hex colour like #000000.`,
    );
  }
  if (!isHexColor(merged.background)) {
    throw new QrError(
      `Background colour "${merged.background}" must be a hex colour like #ffffff.`,
    );
  }
  if (merged.foreground.toLowerCase() === merged.background.toLowerCase()) {
    throw new QrError(
      'Foreground and background colours are identical — the code would be invisible.',
    );
  }
  return merged;
}

// --- qrcode wrappers -----------------------------------------------------------------

export function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Translate `qrcode` library errors into actionable messages. */
export function describeQrError(
  err: unknown,
  payload: string,
  level: ErrorCorrectionLevel,
): QrError {
  if (err instanceof QrError) return err;
  const message = err instanceof Error ? err.message : String(err);

  if (/too big/i.test(message)) {
    const bytes = utf8Length(payload);
    const hint =
      level === 'L'
        ? 'Shorten the content.'
        : 'Shorten the content or lower the error correction to L.';
    return new QrError(
      `This content is too long for a QR code (${bytes.toLocaleString()} bytes; the maximum at error-correction level ${level} is ${MAX_BYTES[level].toLocaleString()} bytes). ${hint}`,
    );
  }
  if (/no input text/i.test(message)) {
    return new QrError('Enter some content to encode.');
  }
  return new QrError(`Could not generate the QR code: ${message}`);
}

/** Compute version and module count without rendering. Throws QrError. */
export function analyzeQr(payload: string, level: ErrorCorrectionLevel = 'M'): QrInfo {
  if (payload === '') throw new QrError('Enter some content to encode.');
  try {
    const qr = QRCode.create(payload, { errorCorrectionLevel: level });
    return {
      version: qr.version,
      modules: qr.modules.size,
      bytes: utf8Length(payload),
      characters: [...payload].length,
    };
  } catch (err) {
    throw describeQrError(err, payload, level);
  }
}

/** Options object shared by `QRCode.toCanvas` and `QRCode.toString`. */
export function toLibraryOptions(options: QrRenderOptions) {
  return {
    errorCorrectionLevel: options.errorCorrection,
    margin: options.margin,
    width: options.size,
    color: { dark: options.foreground, light: options.background },
  };
}

/** Render the payload as a standalone SVG document string. */
export async function toSvg(
  payload: string,
  options: Partial<QrRenderOptions> = {},
): Promise<string> {
  const opts = validateRenderOptions(options);
  if (payload === '') throw new QrError('Enter some content to encode.');
  try {
    return await QRCode.toString(payload, { type: 'svg', ...toLibraryOptions(opts) });
  } catch (err) {
    throw describeQrError(err, payload, opts.errorCorrection);
  }
}
