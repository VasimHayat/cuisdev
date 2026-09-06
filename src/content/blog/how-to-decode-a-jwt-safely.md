---
title: 'How to decode a JWT safely (and what decoding does not tell you)'
description: 'A JSON Web Token is three Base64URL segments anyone can read. Learn how to decode one, what the standard claims mean, and why decoding is not the same as verifying.'
pubDate: 2026-09-06
tags: ['jwt', 'security', 'auth']
tools: ['jwt-decoder', 'base64']
---

A JSON Web Token (JWT) looks like `xxxxx.yyyyy.zzzzz`: three segments separated by dots. Decoding it takes one line of code — and misunderstanding what that means causes real security bugs. This guide covers both.

## The three segments

1. **Header** — Base64URL-encoded JSON describing the token: `{"alg":"HS256","typ":"JWT"}`. `alg` is the signing algorithm; `kid` (key ID) may say which key signed it.
2. **Payload** — Base64URL-encoded JSON of _claims_: who the token is about, who issued it, when it expires.
3. **Signature** — bytes computed over `header.payload` with the issuer's key. This is the only part that is protected.

Base64URL is Base64 with `-` and `_` instead of `+` and `/`, and no `=` padding. Standard `atob()` needs the characters swapped back and padding restored before it will decode a segment.

## Decoding in JavaScript

```js
function decodeSegment(segment) {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

const [header, payload] = token.split('.');
console.log(decodeSegment(header), decodeSegment(payload));
```

The `TextDecoder` step matters: claims can contain non-ASCII characters (names, addresses) that `atob` alone would mangle.

## The standard claims

| Claim | Meaning    | Notes                                                 |
| ----- | ---------- | ----------------------------------------------------- |
| `iss` | Issuer     | Who created the token                                 |
| `sub` | Subject    | Usually the user ID                                   |
| `aud` | Audience   | Who the token is for — verify it matches your service |
| `exp` | Expiration | Unix seconds. Reject after this time                  |
| `nbf` | Not before | Reject before this time                               |
| `iat` | Issued at  | Unix seconds                                          |
| `jti` | JWT ID     | Unique ID, used to prevent replay                     |

Times are Unix **seconds**, not milliseconds — a common bug when comparing with `Date.now()`.

## Decoding is not verifying

Anyone can decode a JWT. Anyone can also _create_ one with any claims they like. What they cannot do without the key is produce a valid signature. Therefore:

- **Never trust claims from a token you have not verified.** The browser may decode a token to show "Logged in as Ada" — that is fine for UI. A server deciding what Ada may access must verify the signature first.
- **Verify `alg` against an allow-list.** Historic attacks set `alg` to `none` or switched RS256 to HS256 so the public key was used as an HMAC secret. Use a maintained library, and configure the algorithms you accept.
- **Check `exp`, `nbf`, `aud` and `iss`** — a valid signature on an expired token, or a token meant for a different service, is still a rejection.
- **Treat JWTs as sensitive.** A token _is_ the credential. Do not paste production tokens into random websites; the [JWT Decoder](/tools/jwt-decoder/) runs entirely in your browser and sends nothing anywhere, which is the property to look for.

## HS256 vs RS256 in one paragraph

HS256 uses a shared secret: the same key signs and verifies, so every service that verifies tokens could also forge them. RS256 (and ES256, EdDSA) uses a private key to sign and a public key to verify, so verifiers cannot forge. For anything beyond a single service talking to itself, asymmetric algorithms are the safer default.

## Debugging checklist

1. Does the token have exactly three segments?
2. Does each segment decode as Base64URL (no `+`, `/` or `=`)?
3. Is `exp` in the future _in seconds_?
4. Does `aud` match your service and `iss` match your identity provider?
5. Does `kid` correspond to a key you actually have?

The [JWT Decoder](/tools/jwt-decoder/) shows the header, payload, expiry countdown and — if you paste the shared secret for an HS256 token — whether the signature matches, all locally. For the encoding underneath, see [Is Base64 encryption?](/blog/is-base64-encryption/)
