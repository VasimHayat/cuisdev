import { describe, expect, it } from 'vitest';

import {
  JwtError,
  base64UrlDecode,
  base64UrlEncode,
  base64UrlEncodeText,
  decodeJwt,
  describeClaims,
  formatRelative,
  getTiming,
  isHmacAlg,
  normalizeToken,
  numericDateMs,
  signHmac,
  verifyHmac,
} from './logic';

/** The canonical jwt.io example, signed with HS256 and the secret below. */
const SECRET = 'your-256-bit-secret';
const SAMPLE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
const [SAMPLE_HEADER, SAMPLE_PAYLOAD, SAMPLE_SIG] = SAMPLE.split('.') as [string, string, string];

const NOW = Date.UTC(2026, 8, 6, 12, 0, 0); // 2026-09-06T12:00:00Z
const seconds = (ms: number) => Math.floor(ms / 1000);

function token(header: object, payload: unknown, signature = 'c2ln'): string {
  return `${base64UrlEncodeText(JSON.stringify(header))}.${base64UrlEncodeText(
    JSON.stringify(payload),
  )}.${signature}`;
}

describe('base64url', () => {
  it('decodes unpadded base64url and round-trips bytes', () => {
    expect(new TextDecoder().decode(base64UrlDecode(SAMPLE_HEADER))).toBe(
      '{"alg":"HS256","typ":"JWT"}',
    );
    const bytes = new Uint8Array([0, 251, 255, 62, 63, 1]);
    const encoded = base64UrlEncode(bytes);
    expect(encoded).not.toMatch(/[+/=]/);
    expect([...base64UrlDecode(encoded)]).toEqual([...bytes]);
    expect(base64UrlEncodeText('👋 hi')).toBe('8J-RiyBoaQ');
  });

  it('rejects the standard alphabet and padding with a hint', () => {
    expect(() => base64UrlDecode('ab+c')).toThrow(JwtError);
    expect(() => base64UrlDecode('ab+c')).toThrow(/Invalid base64url character "\+".*URL-safe/);
    expect(() => base64UrlDecode('abc=')).toThrow(/without = padding/);
    expect(() => base64UrlDecode('ab c')).toThrow(/Invalid base64url character " "/);
  });

  it('rejects an impossible length', () => {
    expect(() => base64UrlDecode('abcde')).toThrow(/remainder of 1 character.*truncated/);
  });
});

describe('normalizeToken', () => {
  it('strips whitespace, line breaks, a BOM and an Authorization header prefix', () => {
    expect(normalizeToken(`  ${SAMPLE_HEADER}\n.${SAMPLE_PAYLOAD}\r\n.${SAMPLE_SIG} `)).toBe(
      SAMPLE,
    );
    expect(normalizeToken(`Bearer ${SAMPLE}`)).toBe(SAMPLE);
    expect(normalizeToken(`Authorization: Bearer ${SAMPLE}`)).toBe(SAMPLE);
    expect(normalizeToken(`\uFEFF${SAMPLE}`)).toBe(SAMPLE);
  });
});

describe('decodeJwt', () => {
  it('decodes header, payload and signature of the jwt.io sample', () => {
    const decoded = decodeJwt(SAMPLE);
    expect(decoded.header).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(decoded.payload).toEqual({ sub: '1234567890', name: 'John Doe', iat: 1516239022 });
    expect(decoded.signature).toBe(SAMPLE_SIG);
    expect(decoded.raw).toEqual({
      header: SAMPLE_HEADER,
      payload: SAMPLE_PAYLOAD,
      signature: SAMPLE_SIG,
    });
    expect(decoded.headerJson).toBe('{\n  "alg": "HS256",\n  "typ": "JWT"\n}');
    expect(JSON.parse(decoded.payloadJson)).toEqual(decoded.payload);
  });

  it('accepts a token pasted with line breaks or a Bearer prefix', () => {
    expect(
      decodeJwt(`Bearer ${SAMPLE_HEADER}.\n${SAMPLE_PAYLOAD}.\n${SAMPLE_SIG}`).payload.name,
    ).toBe('John Doe');
  });

  it('accepts an unsigned alg "none" token with an empty signature', () => {
    const unsigned = `${base64UrlEncodeText('{"alg":"none"}')}.${SAMPLE_PAYLOAD}.`;
    const decoded = decodeJwt(unsigned);
    expect(decoded.header.alg).toBe('none');
    expect(decoded.signature).toBe('');
  });

  it('rejects empty input', () => {
    expect(() => decodeJwt('')).toThrow(/Paste a JWT/);
    expect(() => decodeJwt('   \n')).toThrow(/Paste a JWT/);
  });

  it('explains a wrong number of segments', () => {
    expect(() => decodeJwt('abc')).toThrow(/3 dot-separated segments.*has 1\..*contains two dots/);
    expect(() => decodeJwt(`${SAMPLE_HEADER}.${SAMPLE_PAYLOAD}`)).toThrow(/has 2\..*trailing dot/);
    expect(() => decodeJwt('a.b.c.d.e')).toThrow(/has 5\..*encrypted JWE/);
  });

  it('reports which part is broken and why', () => {
    const notJson = `${base64UrlEncodeText('hello')}.${SAMPLE_PAYLOAD}.${SAMPLE_SIG}`;
    expect(() => decodeJwt(notJson)).toThrow(/Header is not valid JSON.*decoded to: hello/);

    const array = token({ alg: 'HS256' }, [1, 2]);
    expect(() => decodeJwt(array)).toThrow(/Payload must be a JSON object.*an array/);

    const nul = token({ alg: 'HS256' }, null);
    expect(() => decodeJwt(nul)).toThrow(/Payload must be a JSON object.*null/);

    const binary = `${SAMPLE_HEADER}.${base64UrlEncode(new Uint8Array([0xff, 0xfe]))}.x`;
    expect(() => decodeJwt(binary)).toThrow(/Payload decodes to bytes that are not UTF-8/);

    expect(() => decodeJwt(`.${SAMPLE_PAYLOAD}.${SAMPLE_SIG}`)).toThrow(/Header is empty/);

    try {
      decodeJwt(`${SAMPLE_HEADER}.${SAMPLE_PAYLOAD}.bad=sig`);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(JwtError);
      expect((err as JwtError).part).toBe('signature');
      expect((err as JwtError).message).toMatch(/^Signature: Invalid base64url character "="/);
    }
  });

  it('carries the failing part on the error', () => {
    try {
      decodeJwt(`${base64UrlEncodeText('{')}.${SAMPLE_PAYLOAD}.${SAMPLE_SIG}`);
      expect.unreachable();
    } catch (err) {
      expect((err as JwtError).part).toBe('header');
    }
  });

  it('handles a large payload quickly', () => {
    const big = token({ alg: 'HS256' }, { data: 'x'.repeat(1_000_000) });
    const start = performance.now();
    expect((decodeJwt(big).payload.data as string).length).toBe(1_000_000);
    expect(performance.now() - start).toBeLessThan(2000);
  });
});

describe('dates and timing', () => {
  it('formats relative time in both directions', () => {
    expect(formatRelative(NOW, NOW)).toBe('just now');
    expect(formatRelative(NOW + 45_000, NOW)).toBe('in 45 seconds');
    expect(formatRelative(NOW - 60_000, NOW)).toBe('1 minute ago');
    expect(formatRelative(NOW + 3 * 3_600_000, NOW)).toBe('in 3 hours');
    expect(formatRelative(NOW - 2 * 86_400_000, NOW)).toBe('2 days ago');
    expect(formatRelative(NOW + 40 * 86_400_000, NOW)).toBe('in 1 month');
    expect(formatRelative(NOW - 800 * 86_400_000, NOW)).toBe('2 years ago');
  });

  it('reads NumericDate claims in seconds and tolerates milliseconds', () => {
    expect(numericDateMs(1516239022)).toBe(1516239022_000);
    expect(numericDateMs(1516239022000)).toBe(1516239022_000);
    expect(numericDateMs('1516239022')).toBeUndefined();
    expect(numericDateMs(Number.NaN)).toBeUndefined();
  });

  it('detects expired and not-yet-valid tokens', () => {
    expect(getTiming({ exp: seconds(NOW) - 1 }, NOW)).toEqual({
      expired: true,
      notYetValid: false,
      expiresInMs: -1000,
    });
    expect(getTiming({ exp: seconds(NOW) + 3600, nbf: seconds(NOW) + 60 }, NOW)).toEqual({
      expired: false,
      notYetValid: true,
      expiresInMs: 3_600_000,
    });
    expect(getTiming({ sub: 'no dates' }, NOW)).toEqual({ expired: false, notYetValid: false });
  });

  it('describes claims with registered ones first and dates expanded', () => {
    const rows = describeClaims(
      {
        name: 'John Doe',
        roles: ['admin', 'dev'],
        exp: seconds(NOW) - 86_400,
        iat: seconds(NOW) - 2 * 86_400,
        sub: '1234567890',
        nbf: seconds(NOW) + 600,
      },
      NOW,
    );
    expect(rows.map((r) => r.name)).toEqual(['sub', 'exp', 'nbf', 'iat', 'name', 'roles']);

    const exp = rows.find((r) => r.name === 'exp');
    expect(exp).toMatchObject({
      value: String(seconds(NOW) - 86_400),
      date: '2026-09-05T12:00:00.000Z',
      relative: '1 day ago',
      status: 'expired',
      meaning: expect.stringContaining('Expiration time'),
    });
    expect(rows.find((r) => r.name === 'nbf')).toMatchObject({
      status: 'not-yet-valid',
      relative: 'in 10 minutes',
    });
    expect(rows.find((r) => r.name === 'iat')).toMatchObject({ relative: '2 days ago' });
    expect(rows.find((r) => r.name === 'iat')?.status).toBeUndefined();
    expect(rows.find((r) => r.name === 'roles')).toEqual({
      name: 'roles',
      value: '["admin","dev"]',
      meaning: '',
    });
  });

  it('leaves a non-numeric exp without a date', () => {
    const [row] = describeClaims({ exp: 'tomorrow' }, NOW);
    expect(row).toEqual({ name: 'exp', value: 'tomorrow', meaning: expect.any(String) });
  });
});

describe('verifyHmac', () => {
  it('verifies the jwt.io sample with its well-known secret', async () => {
    await expect(verifyHmac(SAMPLE, SECRET)).resolves.toBe(true);
    await expect(verifyHmac(`Bearer ${SAMPLE}`, SECRET)).resolves.toBe(true);
  });

  it('rejects a wrong secret and a tampered payload', async () => {
    await expect(verifyHmac(SAMPLE, 'wrong-secret')).resolves.toBe(false);
    const tampered = `${SAMPLE_HEADER}.${base64UrlEncodeText(
      '{"sub":"1234567890","name":"Jane Doe","iat":1516239022}',
    )}.${SAMPLE_SIG}`;
    await expect(verifyHmac(tampered, SECRET)).resolves.toBe(false);
  });

  it('round-trips HS384 and HS512 tokens produced by signHmac', async () => {
    for (const alg of ['HS256', 'HS384', 'HS512'] as const) {
      const signed = await signHmac({ alg, typ: 'JWT' }, { sub: 'abc', n: 1 }, SECRET);
      expect(decodeJwt(signed).header.alg).toBe(alg);
      await expect(verifyHmac(signed, SECRET)).resolves.toBe(true);
      await expect(verifyHmac(signed, `${SECRET}!`)).resolves.toBe(false);
    }
  });

  it('refuses algorithms that a shared secret cannot check', async () => {
    await expect(verifyHmac(token({ alg: 'RS256' }, { a: 1 }), SECRET)).rejects.toThrow(
      /Algorithm "RS256" cannot be verified with a shared secret/,
    );
    await expect(verifyHmac(token({ typ: 'JWT' }, { a: 1 }), SECRET)).rejects.toThrow(
      /Algorithm missing/,
    );
    await expect(verifyHmac(token({ alg: 'none' }, { a: 1 }, ''), SECRET)).rejects.toThrow(
      /alg "none".*unsigned/,
    );
    await expect(verifyHmac(SAMPLE, '')).rejects.toThrow(/Enter the secret/);
  });

  it('treats an HS256 token with an empty signature as unverified', async () => {
    await expect(verifyHmac(`${SAMPLE_HEADER}.${SAMPLE_PAYLOAD}.`, SECRET)).resolves.toBe(false);
  });

  it('signHmac refuses non-HMAC headers', async () => {
    await expect(signHmac({ alg: 'RS256' }, {}, SECRET)).rejects.toThrow(/must be HS256/);
    expect(isHmacAlg('HS512')).toBe(true);
    expect(isHmacAlg('hs256')).toBe(false);
    expect(isHmacAlg('toString')).toBe(false);
    expect(isHmacAlg(undefined)).toBe(false);
  });
});
