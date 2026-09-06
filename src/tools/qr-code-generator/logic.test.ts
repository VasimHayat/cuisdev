import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RENDER_OPTIONS,
  ERROR_CORRECTION_LEVELS,
  MAX_BYTES,
  PRESET_LABELS,
  QR_PRESETS,
  QrError,
  SAMPLES,
  analyzeQr,
  buildMailto,
  buildPayload,
  buildSms,
  buildTel,
  buildVCard,
  buildWifiPayload,
  describeQrError,
  escapeVCard,
  escapeWifi,
  isHexColor,
  normalizePayload,
  normalizePhone,
  toLibraryOptions,
  toSvg,
  utf8Length,
  validateRenderOptions,
} from './logic';

describe('normalizePayload', () => {
  it('strips a BOM and surrounding whitespace, keeps inner content', () => {
    expect(normalizePayload('﻿https://example.com\r\n')).toBe('https://example.com');
    expect(normalizePayload('  a b  ')).toBe('a b');
    expect(normalizePayload('line1\r\nline2')).toBe('line1\r\nline2');
    expect(normalizePayload('')).toBe('');
  });
});

describe('escapeWifi / buildWifiPayload', () => {
  it('escapes every special character with a backslash', () => {
    expect(escapeWifi('a;b,c:d\\e"f')).toBe('a\\;b\\,c\\:d\\\\e\\"f');
    expect(escapeWifi('plain')).toBe('plain');
  });

  it('builds a WPA payload in the standard order', () => {
    expect(buildWifiPayload({ ssid: 'MyNetwork', password: 'secret', encryption: 'WPA' })).toBe(
      'WIFI:T:WPA;S:MyNetwork;P:secret;H:false;;',
    );
  });

  it('defaults to WPA and hidden=false, and flags hidden networks', () => {
    expect(buildWifiPayload({ ssid: 'Net', password: 'pw' })).toBe(
      'WIFI:T:WPA;S:Net;P:pw;H:false;;',
    );
    expect(buildWifiPayload({ ssid: 'Net', password: 'pw', hidden: true })).toBe(
      'WIFI:T:WPA;S:Net;P:pw;H:true;;',
    );
  });

  it('supports WEP and open networks (no P: field)', () => {
    expect(buildWifiPayload({ ssid: 'Old', password: 'abcde', encryption: 'WEP' })).toBe(
      'WIFI:T:WEP;S:Old;P:abcde;H:false;;',
    );
    expect(buildWifiPayload({ ssid: 'Cafe', encryption: 'nopass' })).toBe(
      'WIFI:T:nopass;S:Cafe;H:false;;',
    );
    // A password given for an open network is ignored.
    expect(buildWifiPayload({ ssid: 'Cafe', encryption: 'nopass', password: 'x' })).toBe(
      'WIFI:T:nopass;S:Cafe;H:false;;',
    );
  });

  it('escapes SSID and password and trims the SSID', () => {
    expect(
      buildWifiPayload({ ssid: '  Home; "Wi-Fi"  ', password: 'p:a,s\\s', encryption: 'WPA' }),
    ).toBe('WIFI:T:WPA;S:Home\\; \\"Wi-Fi\\";P:p\\:a\\,s\\\\s;H:false;;');
  });

  it('rejects a missing SSID, a missing password and an unknown encryption', () => {
    expect(() => buildWifiPayload({ ssid: '   ', password: 'x' })).toThrow(/SSID\) is required/);
    expect(() => buildWifiPayload({ ssid: 'Net' })).toThrow(/password is required for WPA and WEP/);
    expect(() => buildWifiPayload({ ssid: 'Net', encryption: 'WEP' })).toThrow(QrError);
    expect(() =>
      buildWifiPayload({ ssid: 'Net', password: 'x', encryption: 'WPA3' as never }),
    ).toThrow(/Unknown Wi-Fi encryption "WPA3"/);
  });
});

describe('buildMailto', () => {
  it('builds a bare mailto link', () => {
    expect(buildMailto({ to: 'ada@example.com' })).toBe('mailto:ada@example.com');
  });

  it('percent-encodes subject and body and normalises CRLF', () => {
    expect(
      buildMailto({ to: 'ada@example.com', subject: 'Hello & welcome', body: 'Line 1\r\nLine 2' }),
    ).toBe('mailto:ada@example.com?subject=Hello%20%26%20welcome&body=Line%201%0ALine%202');
  });

  it('omits empty subject/body and trims the address', () => {
    expect(buildMailto({ to: ' ada@example.com ', subject: '  ', body: '' })).toBe(
      'mailto:ada@example.com',
    );
    expect(buildMailto({ to: 'ada@example.com', body: 'hi' })).toBe(
      'mailto:ada@example.com?body=hi',
    );
  });

  it('rejects empty and malformed addresses', () => {
    expect(() => buildMailto({ to: '' })).toThrow(/Email address is required/);
    expect(() => buildMailto({ to: 'not-an-email' })).toThrow(
      /"not-an-email" does not look like an email address/,
    );
    expect(() => buildMailto({ to: 'a@b' })).toThrow(QrError);
  });
});

describe('normalizePhone / buildTel / buildSms', () => {
  it('keeps a leading + and digits only', () => {
    expect(normalizePhone('+1 (555) 123-4567')).toBe('+15551234567');
    expect(normalizePhone('0800.123.456')).toBe('0800123456');
    expect(normalizePhone('  +44 20 7946 0958 ')).toBe('+442079460958');
  });

  it('rejects empty and non-numeric numbers', () => {
    expect(() => normalizePhone('   ')).toThrow(/Phone number is required/);
    expect(() => normalizePhone('call me')).toThrow(/not a valid phone number/);
    expect(() => normalizePhone('+')).toThrow(QrError);
    expect(() => normalizePhone('12+34')).toThrow(/not a valid phone number/);
  });

  it('buildTel prefixes tel:', () => {
    expect(buildTel('+1 555 123 4567')).toBe('tel:+15551234567');
  });

  it('buildSms emits smsto: with an optional message', () => {
    expect(buildSms({ phone: '+1 555 123 4567' })).toBe('smsto:+15551234567');
    expect(buildSms({ phone: '+1 555 123 4567', message: '  ' })).toBe('smsto:+15551234567');
    expect(buildSms({ phone: '555 1234', message: 'Hi there\r\nBye' })).toBe(
      'smsto:5551234:Hi there\nBye',
    );
  });
});

describe('escapeVCard / buildVCard', () => {
  it('escapes backslashes, semicolons, commas and newlines', () => {
    expect(escapeVCard('a\\b;c,d\ne\r\nf')).toBe('a\\\\b\\;c\\,d\\ne\\nf');
  });

  it('builds a minimal vCard 3.0 with CRLF line endings', () => {
    expect(buildVCard({ name: 'Ada Lovelace' })).toBe(
      'BEGIN:VCARD\r\nVERSION:3.0\r\nN:Lovelace;Ada;;;\r\nFN:Ada Lovelace\r\nEND:VCARD',
    );
  });

  it('includes org, phone and email when provided', () => {
    const card = buildVCard({
      name: 'Grace Brewster Hopper',
      org: 'US Navy, Reserve',
      phone: '+1 (555) 000-1111',
      email: 'grace@example.com',
    });
    expect(card.split('\r\n')).toEqual([
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:Hopper;Grace Brewster;;;',
      'FN:Grace Brewster Hopper',
      'ORG:US Navy\\, Reserve',
      'TEL;TYPE=CELL:+15550001111',
      'EMAIL;TYPE=INTERNET:grace@example.com',
      'END:VCARD',
    ]);
  });

  it('handles a single-word name and collapses whitespace', () => {
    expect(buildVCard({ name: '  Cher  ' })).toContain('N:;Cher;;;\r\nFN:Cher');
    expect(buildVCard({ name: 'Ada   Lovelace' })).toContain('FN:Ada Lovelace');
  });

  it('rejects a missing name, a bad phone and a bad email', () => {
    expect(() => buildVCard({ name: '' })).toThrow(/Contact name is required/);
    expect(() => buildVCard({ name: 'Ada', phone: 'abc' })).toThrow(/not a valid phone number/);
    expect(() => buildVCard({ name: 'Ada', email: 'nope' })).toThrow(
      /"nope" does not look like an email address/,
    );
  });
});

describe('isHexColor / validateRenderOptions', () => {
  it('accepts 3, 4, 6 and 8 digit hex colours only', () => {
    expect(isHexColor('#000')).toBe(true);
    expect(isHexColor('#000f')).toBe(true);
    expect(isHexColor('#1A2b3C')).toBe(true);
    expect(isHexColor('#1a2b3c80')).toBe(true);
    expect(isHexColor('000000')).toBe(false);
    expect(isHexColor('#12345')).toBe(false);
    expect(isHexColor('red')).toBe(false);
  });

  it('returns defaults when nothing is overridden', () => {
    expect(validateRenderOptions()).toEqual(DEFAULT_RENDER_OPTIONS);
    expect(validateRenderOptions({ size: 512 }).size).toBe(512);
  });

  it('rejects out-of-range or fractional sizes and margins', () => {
    expect(() => validateRenderOptions({ size: 64 })).toThrow(
      /between 128 and 1024 pixels — got 64/,
    );
    expect(() => validateRenderOptions({ size: 2048 })).toThrow(QrError);
    expect(() => validateRenderOptions({ size: 200.5 })).toThrow(/whole number/);
    expect(() => validateRenderOptions({ size: Number.NaN })).toThrow(/got NaN/);
    expect(() => validateRenderOptions({ margin: -1 })).toThrow(/between 0 and 8 modules — got -1/);
    expect(() => validateRenderOptions({ margin: 9 })).toThrow(QrError);
  });

  it('rejects unknown error-correction levels', () => {
    expect(() => validateRenderOptions({ errorCorrection: 'X' as never })).toThrow(
      /Unknown error-correction level "X"/,
    );
    for (const level of ERROR_CORRECTION_LEVELS) {
      expect(validateRenderOptions({ errorCorrection: level }).errorCorrection).toBe(level);
    }
  });

  it('rejects invalid or identical colours', () => {
    expect(() => validateRenderOptions({ foreground: 'black' })).toThrow(
      /Foreground colour "black" must be a hex colour/,
    );
    expect(() => validateRenderOptions({ background: 'rgb(0,0,0)' })).toThrow(
      /Background colour "rgb\(0,0,0\)" must be a hex colour/,
    );
    expect(() => validateRenderOptions({ foreground: '#FFFFFF', background: '#ffffff' })).toThrow(
      /identical/,
    );
  });
});

describe('toLibraryOptions', () => {
  it('maps to the qrcode option names', () => {
    expect(toLibraryOptions(DEFAULT_RENDER_OPTIONS)).toEqual({
      errorCorrectionLevel: 'M',
      margin: 4,
      width: 256,
      color: { dark: '#000000', light: '#ffffff' },
    });
  });
});

describe('utf8Length', () => {
  it('counts bytes, not characters', () => {
    expect(utf8Length('abc')).toBe(3);
    expect(utf8Length('héllo')).toBe(6);
    expect(utf8Length('日本')).toBe(6);
    expect(utf8Length('👋')).toBe(4);
    expect(utf8Length('')).toBe(0);
  });
});

describe('describeQrError', () => {
  it('passes QrError through untouched', () => {
    const original = new QrError('custom');
    expect(describeQrError(original, 'x', 'M')).toBe(original);
  });

  it('explains capacity errors with the byte count and level limit', () => {
    const payload = 'a'.repeat(3000);
    const err = describeQrError(
      new Error('The amount of data is too big to be stored in a QR Code'),
      payload,
      'M',
    );
    expect(err).toBeInstanceOf(QrError);
    expect(err.message).toContain('3,000 bytes');
    expect(err.message).toContain(`level M is ${MAX_BYTES.M.toLocaleString()} bytes`);
    expect(err.message).toContain('lower the error correction to L');
  });

  it('does not suggest lowering the level when already at L', () => {
    const err = describeQrError(new Error('too big'), 'abc', 'L');
    expect(err.message).toContain('Shorten the content.');
    expect(err.message).not.toContain('lower the error correction');
  });

  it('maps empty-input and unknown errors', () => {
    expect(describeQrError(new Error('No input text'), '', 'M').message).toBe(
      'Enter some content to encode.',
    );
    expect(describeQrError('weird', 'x', 'M').message).toBe(
      'Could not generate the QR code: weird',
    );
    expect(describeQrError(new Error('boom'), 'x', 'M').message).toBe(
      'Could not generate the QR code: boom',
    );
  });
});

describe('analyzeQr', () => {
  it('reports version 1 with 21 modules for a short payload', () => {
    expect(analyzeQr('hello', 'M')).toEqual({ version: 1, modules: 21, bytes: 5, characters: 5 });
  });

  it('grows the version with payload size and error correction', () => {
    const low = analyzeQr('https://www.cuisdev.com/tools/qr-code-generator/', 'L');
    const high = analyzeQr('https://www.cuisdev.com/tools/qr-code-generator/', 'H');
    expect(high.version).toBeGreaterThan(low.version);
    expect(high.modules).toBe(17 + 4 * high.version);
  });

  it('counts unicode characters and bytes separately', () => {
    const info = analyzeQr('日本語 👋');
    expect(info.characters).toBe(5);
    expect(info.bytes).toBe(14);
  });

  it('fits the maximum byte-mode payload at each level and rejects one more byte', () => {
    for (const level of ERROR_CORRECTION_LEVELS) {
      const max = 'a'.repeat(MAX_BYTES[level]);
      expect(analyzeQr(max, level).version).toBe(40);
      expect(() => analyzeQr(`${max}a`, level)).toThrow(/too long for a QR code/);
    }
  });

  it('rejects an empty payload with a friendly message', () => {
    expect(() => analyzeQr('')).toThrow(/Enter some content/);
    expect(() => analyzeQr('')).toThrow(QrError);
  });
});

describe('toSvg', () => {
  it('produces a standalone SVG with the requested size and colours', async () => {
    const svg = await toSvg('https://example.com', { size: 300, foreground: '#112233' });
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg).toContain('width="300" height="300"');
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).toContain('stroke="#112233"');
    // version 2 (25 modules) + 2 × 4 margin
    expect(svg).toContain('viewBox="0 0 33 33"');
  });

  it('honours the margin option', async () => {
    const svg = await toSvg('hello', { margin: 0 });
    expect(svg).toContain('viewBox="0 0 21 21"');
  });

  it('rejects oversized payloads, empty input and bad options', async () => {
    await expect(toSvg('a'.repeat(3000), { errorCorrection: 'L' })).rejects.toThrow(
      /too long for a QR code/,
    );
    await expect(toSvg('')).rejects.toThrow(/Enter some content/);
    await expect(toSvg('x', { size: 1 })).rejects.toThrow(/Size must be/);
  });
});

describe('buildPayload / SAMPLES / PRESET_LABELS', () => {
  it('dispatches every preset to its builder', () => {
    expect(buildPayload('text', { text: '  https://example.com\n' })).toBe('https://example.com');
    expect(buildPayload('wifi', { ssid: 'Net', password: 'pw' })).toBe(
      'WIFI:T:WPA;S:Net;P:pw;H:false;;',
    );
    expect(buildPayload('email', { to: 'a@b.co', subject: 'Hi' })).toBe('mailto:a@b.co?subject=Hi');
    expect(buildPayload('phone', { phone: '+1 555' })).toBe('tel:+1555');
    expect(buildPayload('sms', { phone: '555', message: 'Yo' })).toBe('smsto:555:Yo');
    expect(buildPayload('vcard', { name: 'Ada Lovelace' })).toContain('FN:Ada Lovelace');
  });

  it('treats missing fields as empty and surfaces the builder errors', () => {
    expect(buildPayload('text', {})).toBe('');
    expect(() => buildPayload('wifi', {})).toThrow(/SSID\) is required/);
    expect(() => buildPayload('email', {})).toThrow(/Email address is required/);
    expect(() => buildPayload('phone', {})).toThrow(/Phone number is required/);
    expect(() => buildPayload('vcard', {})).toThrow(/Contact name is required/);
    expect(() => buildPayload('barcode' as never, {})).toThrow(/Unknown content type "barcode"/);
  });

  it('ships a valid, scannable sample and a label for every preset', () => {
    for (const preset of QR_PRESETS) {
      const payload = buildPayload(preset, SAMPLES[preset]);
      expect(payload).not.toBe('');
      expect(analyzeQr(payload).version).toBeLessThanOrEqual(10);
      expect(PRESET_LABELS[preset]).toMatch(/\S/);
    }
    expect(buildPayload('wifi', SAMPLES.wifi)).toBe(
      'WIFI:T:WPA;S:Cuisdev Guest;P:welcome-2026;H:false;;',
    );
  });
});
