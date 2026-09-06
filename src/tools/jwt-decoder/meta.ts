import type { ToolMeta } from '@/tools/_types';

export const meta: ToolMeta = {
  slug: 'jwt-decoder',
  name: 'JWT Decoder',
  shortName: 'JWT Decoder',
  seoTitle: 'JWT Decoder Online — Decode & Verify Tokens',
  tagline:
    'Decode a JWT, read its claims and expiry dates, and verify HS256 signatures — all in your browser.',
  description:
    'Free online JWT decoder. Inspect the header, payload and claims of a JSON Web Token, see when it expires and verify HS256/384/512 signatures in your browser.',
  category: 'encoding',
  icon: 'key',
  keywords: [
    'jwt decoder',
    'jwt decode',
    'decode jwt online',
    'jwt token decoder',
    'jwt viewer',
    'jwt debugger',
    'json web token decoder',
    'jwt payload',
    'jwt claims',
    'jwt expiration',
    'verify jwt signature',
    'jwt hs256',
  ],
  intro: [
    'A JSON Web Token (JWT, RFC 7519) is three base64url-encoded segments separated by dots: a header that names the signing algorithm, a payload of claims such as the subject, issuer and expiry, and a signature that proves the first two parts have not been changed. Because the payload is only encoded, not encrypted, anyone holding the token can read it — which is exactly what you need to do when a login fails, a session ends too early or an API returns 401.',
    'Paste a token (an Authorization: Bearer header works too) and this decoder shows the header and payload as formatted JSON, lists every claim with what it means, and turns the exp, nbf and iat timestamps into real dates with a relative time, flagging tokens that have already expired or are not yet valid. If the token is signed with HS256, HS384 or HS512 you can enter the shared secret to check the signature using your browser’s WebCrypto API; RSA and ECDSA tokens are decoded but need the issuer’s public key to verify.',
    'Tokens are credentials, so nothing you paste here is transmitted, logged or stored. Decoding and verification run entirely in your browser, and the page keeps working with the network disconnected.',
  ],
  howTo: [
    'Paste the JWT — or the whole Authorization: Bearer header — into the Encoded JWT box.',
    'Read the decoded Header and Payload, and check the Claims table for dates, relative times and an Expired badge.',
    'To verify an HS256, HS384 or HS512 token, type the shared secret into the Secret field; the status line reports whether the signature matches.',
    'Click Copy header or Copy payload to grab the JSON, or Clear to start again.',
  ],
  example: {
    input:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    output:
      '{\n  "alg": "HS256",\n  "typ": "JWT"\n}\n\n{\n  "sub": "1234567890",\n  "name": "John Doe",\n  "iat": 1516239022\n}',
    note: 'The well-known jwt.io example token. Its iat claim decodes to 2018-01-18T01:30:22Z, and the signature verifies with the secret "your-256-bit-secret".',
  },
  faq: [
    {
      question: 'Is it safe to paste a JWT into an online decoder?',
      answer:
        'Only if the decoder never sends it anywhere. A JWT is a bearer credential: whoever holds it can act as the user until it expires. This tool decodes and verifies entirely in your browser — you can check the network tab or go offline — so the token never reaches a server. Still, prefer expired or test tokens when you can.',
    },
    {
      question: 'How do I decode a JWT without the secret?',
      answer:
        'You do not need the secret to read a JWT. The header and payload are plain base64url-encoded JSON, so any decoder can display them. The secret (or public key) is only needed to <strong>verify</strong> the signature, i.e. to prove the token was issued by the expected party and has not been modified.',
    },
    {
      question: 'What do exp, iat and nbf mean?',
      answer:
        'They are “NumericDate” claims: seconds since 1970-01-01T00:00:00Z. <code>iat</code> is when the token was issued, <code>exp</code> is when it stops being valid and <code>nbf</code> (not before) is the earliest moment it may be used. The Claims table converts each one to a date and shows how far in the past or future it is.',
    },
    {
      question: 'Why does my JWT say it has expired?',
      answer:
        'The <code>exp</code> claim is earlier than the current time on your computer. Access tokens are often valid for only 5–60 minutes, so a token copied from a log is usually already expired. Check your system clock as well — servers commonly allow only a minute or two of skew.',
    },
    {
      question: 'Can this tool verify RS256 tokens?',
      answer:
        'It decodes them but cannot verify them. RS256, ES256 and PS256 use asymmetric keys: the issuer signs with a private key and you verify with its public key (usually published at a JWKS URL). This tool verifies only the HMAC family (HS256, HS384, HS512), where a single shared secret is used for both signing and checking.',
    },
    {
      question: 'What is the difference between a JWT, a JWS and a JWE?',
      answer:
        'A JWS (JSON Web Signature) is a signed token with three segments — the kind decoded here. A JWE (JSON Web Encryption) has five segments and an encrypted payload that cannot be read without the key. “JWT” is the umbrella term for both when the payload is a set of claims; in practice almost every JWT you meet is a JWS.',
    },
  ],
  related: ['base64', 'url-encoder', 'string-escape'],
  status: 'stable',
  added: '2026-09-06',
};
