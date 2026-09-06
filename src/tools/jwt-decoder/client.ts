import { $, copyText, debounce, flashButton, formatBytes, setStatus } from '@/lib/dom';

import {
  type ClaimRow,
  type DecodedJwt,
  JwtError,
  decodeJwt,
  describeClaims,
  formatRelative,
  getTiming,
  isHmacAlg,
  numericDateMs,
  verifyHmac,
} from './logic';

/** The jwt.io example token; its signature verifies with SAMPLE_SECRET. */
const SAMPLE_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
const SAMPLE_SECRET = 'your-256-bit-secret';
const SIGNATURE_PLACEHOLDER = 'The base64url signature appears here';
const NOT_VERIFIED =
  'Signature not verified — enter the secret to check an HS256/384/512 signature. Nothing is sent anywhere.';

const root = $<HTMLElement>('[data-tool="jwt-decoder"]');
const input = $<HTMLTextAreaElement>('[data-input]', root);
const secret = $<HTMLInputElement>('[data-secret]', root);
const inputStats = $('[data-input-stats]', root);
const headerOut = $<HTMLTextAreaElement>('[data-header]', root);
const payloadOut = $<HTMLTextAreaElement>('[data-payload]', root);
const signatureOut = $('[data-signature]', root);
const signatureBadge = $('[data-signature-badge]', root);
const status = $('[data-status]', root);
const claims = $('[data-claims]', root);
const claimsBody = $<HTMLTableSectionElement>('[data-claims-body]', root);
const expiryBadge = $('[data-expiry-badge]', root);

const encoder = new TextEncoder();
/** Incremented on every run so a slow verification cannot overwrite a newer result. */
let runId = 0;

function setBadge(el: HTMLElement, text: string, tone?: 'success' | 'warning'): void {
  el.textContent = text;
  el.classList.remove('badge--success', 'badge--warning');
  if (tone) el.classList.add(`badge--${tone}`);
  el.hidden = text === '';
}

function cell(tag: 'th' | 'td', mono = false): HTMLTableCellElement {
  const el = document.createElement(tag);
  if (tag === 'th') el.scope = 'row';
  if (mono) el.classList.add('tool-jwt-decoder__mono');
  return el;
}

function renderClaims(rows: ClaimRow[]): void {
  claimsBody.replaceChildren();
  if (rows.length === 0) {
    claims.hidden = true;
    return;
  }
  for (const row of rows) {
    const tr = document.createElement('tr');
    const name = cell('th', true);
    name.textContent = row.name;

    const value = cell('td', true);
    value.textContent = row.value;
    if (row.date) {
      const date = document.createElement('span');
      date.classList.add('tool-jwt-decoder__date');
      date.textContent = `${row.date.replace('.000Z', 'Z')} · ${row.relative ?? ''}`;
      value.append(date);
    }

    const meaning = cell('td');
    meaning.textContent = row.meaning;
    if (row.status && row.status !== 'ok') {
      const badge = document.createElement('span');
      badge.classList.add('badge', 'badge--warning');
      badge.textContent = row.status === 'expired' ? 'Expired' : 'Not yet valid';
      meaning.append(' ', badge);
    }

    tr.append(name, value, meaning);
    claimsBody.append(tr);
  }
  claims.hidden = false;
}

function describeTiming(decoded: DecodedJwt): string {
  const now = Date.now();
  const timing = getTiming(decoded.payload, now);
  const exp = numericDateMs(decoded.payload.exp);
  if (timing.expired && exp !== undefined) {
    setBadge(expiryBadge, 'Expired', 'warning');
    return `Token expired ${formatRelative(exp, now)}.`;
  }
  if (timing.notYetValid) {
    setBadge(expiryBadge, 'Not yet valid', 'warning');
    return 'Token is not valid yet (nbf is in the future).';
  }
  if (exp !== undefined) {
    setBadge(expiryBadge, `Expires ${formatRelative(exp, now)}`, 'success');
    return `Token expires ${formatRelative(exp, now)}.`;
  }
  setBadge(expiryBadge, 'No expiry', undefined);
  return 'Token has no exp claim, so it never expires.';
}

function reset(): void {
  headerOut.value = '';
  payloadOut.value = '';
  signatureOut.textContent = SIGNATURE_PLACEHOLDER;
  setBadge(signatureBadge, '');
  setBadge(expiryBadge, '');
  renderClaims([]);
}

async function verify(
  id: number,
  token: string,
  decoded: DecodedJwt,
  prefix: string,
): Promise<void> {
  const alg = decoded.header.alg;
  if (secret.value === '') {
    setBadge(signatureBadge, 'Not verified');
    setStatus(status, `${prefix} ${NOT_VERIFIED}`);
    return;
  }
  if (!isHmacAlg(alg)) {
    try {
      await verifyHmac(token, secret.value); // throws with a specific explanation
    } catch (err) {
      setBadge(signatureBadge, alg === 'none' ? 'Unsigned' : 'Cannot verify', 'warning');
      setStatus(status, `${prefix} ${(err as Error).message}`, 'error');
    }
    return;
  }
  try {
    const ok = await verifyHmac(token, secret.value);
    if (id !== runId) return;
    if (ok) {
      setBadge(signatureBadge, 'Verified', 'success');
      setStatus(status, `${prefix} Signature verified with ${alg} — checked locally.`, 'success');
    } else {
      setBadge(signatureBadge, 'Invalid signature', 'warning');
      setStatus(
        status,
        `${prefix} Signature does not match this secret — the token was altered or signed with a different key.`,
        'error',
      );
    }
  } catch (err) {
    if (id !== runId) return;
    setBadge(signatureBadge, 'Cannot verify', 'warning');
    setStatus(status, err instanceof Error ? err.message : 'Could not verify.', 'error');
  }
}

function run(): void {
  const id = ++runId;
  const text = input.value;
  inputStats.textContent =
    text.length === 0
      ? ''
      : `${text.length.toLocaleString()} chars · ${formatBytes(encoder.encode(text).length)}`;

  if (text.trim() === '') {
    reset();
    setStatus(status, '');
    return;
  }

  let decoded: DecodedJwt;
  try {
    decoded = decodeJwt(text);
  } catch (err) {
    reset();
    const message = err instanceof JwtError ? err.message : 'Could not decode the token.';
    setStatus(status, message, 'error');
    return;
  }

  headerOut.value = decoded.headerJson;
  payloadOut.value = decoded.payloadJson;
  signatureOut.textContent =
    decoded.signature === '' ? '(empty — the token is unsigned)' : decoded.signature;
  renderClaims(describeClaims(decoded.payload));
  const prefix = describeTiming(decoded);
  void verify(id, text, decoded, prefix);
}

const runDebounced = debounce(run, 60);

// --- events -----------------------------------------------------------------

input.addEventListener('input', runDebounced);
secret.addEventListener('input', runDebounced);

root.addEventListener('click', async (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
  if (!button) return;

  switch (button.dataset.action) {
    case 'sample':
      input.value = SAMPLE_TOKEN;
      secret.value = SAMPLE_SECRET;
      run();
      input.focus();
      break;

    case 'clear':
      input.value = '';
      secret.value = '';
      run();
      input.focus();
      break;

    case 'copy': {
      const source = button.dataset.copy === 'header' ? headerOut : payloadOut;
      if (!source.value) return;
      const ok = await copyText(source.value);
      if (ok) flashButton(button);
      else
        setStatus(
          status,
          'Clipboard access was blocked — select the text and copy manually.',
          'error',
        );
      break;
    }
  }
});

run();
