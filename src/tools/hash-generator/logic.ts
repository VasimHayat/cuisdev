/**
 * Hash Generator — pure functions, no DOM.
 *
 * Wraps hash-wasm so text or a stream of byte chunks can be hashed with MD5,
 * SHA-1, SHA-2, SHA-3 and CRC32 (optionally as HMAC for the SHA family),
 * formats digests as hex or Base64 and compares them against an expected value.
 */
import {
  type IHasher,
  createCRC32,
  createHMAC,
  createMD5,
  createSHA1,
  createSHA3,
  createSHA256,
  createSHA384,
  createSHA512,
} from 'hash-wasm';

export class HashError extends Error {
  override name = 'HashError';
}

export type AlgorithmId =
  'md5' | 'sha1' | 'sha256' | 'sha384' | 'sha512' | 'sha3-256' | 'sha3-512' | 'crc32';

export interface Algorithm {
  id: AlgorithmId;
  label: string;
  /** Digest size in bits. */
  bits: number;
  /** Whether HMAC is offered for this algorithm (the SHA family). */
  hmac: boolean;
  create: () => Promise<IHasher>;
}

export const ALGORITHMS: readonly Algorithm[] = [
  { id: 'md5', label: 'MD5', bits: 128, hmac: false, create: createMD5 },
  { id: 'sha1', label: 'SHA-1', bits: 160, hmac: true, create: createSHA1 },
  { id: 'sha256', label: 'SHA-256', bits: 256, hmac: true, create: createSHA256 },
  { id: 'sha384', label: 'SHA-384', bits: 384, hmac: true, create: createSHA384 },
  { id: 'sha512', label: 'SHA-512', bits: 512, hmac: true, create: createSHA512 },
  { id: 'sha3-256', label: 'SHA3-256', bits: 256, hmac: true, create: () => createSHA3(256) },
  { id: 'sha3-512', label: 'SHA3-512', bits: 512, hmac: true, create: () => createSHA3(512) },
  { id: 'crc32', label: 'CRC32', bits: 32, hmac: false, create: () => createCRC32() },
];

export const ALGORITHM_IDS: readonly AlgorithmId[] = ALGORITHMS.map((a) => a.id);

export function getAlgorithm(id: string): Algorithm {
  const algo = ALGORITHMS.find((a) => a.id === id);
  if (!algo) {
    throw new HashError(`Unknown algorithm "${id}" — choose one of ${ALGORITHM_IDS.join(', ')}.`);
  }
  return algo;
}

export interface HashOptions {
  /** HMAC secret. When set, non-HMAC algorithms (MD5, CRC32) are skipped. */
  hmacKey?: string | undefined;
  /** Restrict to these algorithms (defaults to all). */
  algorithms?: readonly AlgorithmId[];
}

/** Hex digests keyed by algorithm; `null` when HMAC was requested but is unsupported. */
export type DigestTable = Record<AlgorithmId, string | null>;

/** Default chunk size for streaming files: 4 MiB keeps the UI responsive. */
export const CHUNK_SIZE = 4 * 1024 * 1024;

const encoder = new TextEncoder();

/**
 * Create an initialised hasher for `algo`, wrapped in HMAC when a key is given.
 * Returns null when the algorithm does not support HMAC and a key was supplied.
 */
export async function createHasher(algo: Algorithm, hmacKey?: string): Promise<IHasher | null> {
  if (hmacKey !== undefined && hmacKey !== '') {
    if (!algo.hmac) return null;
    const hasher = await createHMAC(algo.create(), encoder.encode(hmacKey));
    hasher.init();
    return hasher;
  }
  const hasher = await algo.create();
  hasher.init();
  return hasher;
}

function selected(options: HashOptions): Algorithm[] {
  const ids = options.algorithms ?? ALGORITHM_IDS;
  return ids.map(getAlgorithm);
}

/**
 * Hash a stream of byte chunks with every selected algorithm at once, so a
 * large file is read from disk exactly once. `onProgress` receives the number
 * of bytes consumed so far.
 */
export async function digestChunks(
  chunks: AsyncIterable<Uint8Array> | Iterable<Uint8Array>,
  options: HashOptions = {},
  onProgress?: (bytesDone: number) => void,
): Promise<DigestTable> {
  const algos = selected(options);
  const hashers = await Promise.all(algos.map((a) => createHasher(a, options.hmacKey)));
  let done = 0;
  for await (const chunk of chunks) {
    for (const h of hashers) h?.update(chunk);
    done += chunk.length;
    onProgress?.(done);
  }
  const table = {} as DigestTable;
  algos.forEach((a, i) => {
    const h = hashers[i];
    table[a.id] = h ? h.digest('hex') : null;
  });
  return table;
}

/** Hash a UTF-8 string with every selected algorithm. */
export function digestText(text: string, options: HashOptions = {}): Promise<DigestTable> {
  return digestBytes(encoder.encode(text), options);
}

/** Hash an in-memory byte array with every selected algorithm. */
export function digestBytes(bytes: Uint8Array, options: HashOptions = {}): Promise<DigestTable> {
  return digestChunks([bytes], options);
}

/** Hash text or bytes with a single algorithm; convenient for one-off checks. */
export async function hashOne(
  algorithm: AlgorithmId,
  data: string | Uint8Array,
  hmacKey?: string,
): Promise<string> {
  const table = await digestChunks([typeof data === 'string' ? encoder.encode(data) : data], {
    hmacKey,
    algorithms: [algorithm],
  });
  const digest = table[algorithm];
  if (digest === null) {
    throw new HashError(
      `${getAlgorithm(algorithm).label} does not support HMAC — use one of the SHA algorithms.`,
    );
  }
  return digest;
}

/** Split a Blob/File into fixed-size chunks lazily (never holds the whole file in memory). */
export async function* chunkBlob(blob: Blob, chunkSize = CHUNK_SIZE): AsyncGenerator<Uint8Array> {
  if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
    throw new HashError(`Chunk size must be a positive whole number of bytes, got ${chunkSize}.`);
  }
  if (blob.size === 0) {
    yield new Uint8Array(0);
    return;
  }
  for (let offset = 0; offset < blob.size; offset += chunkSize) {
    const slice = blob.slice(offset, Math.min(offset + chunkSize, blob.size));
    yield new Uint8Array(await slice.arrayBuffer());
  }
}

/** Convert a hex digest to Base64. */
export function hexToBase64(hex: string): string {
  const clean = hex.trim();
  if (clean.length % 2 !== 0 || /[^0-9a-fA-F]/.test(clean)) {
    throw new HashError(`"${clean}" is not a valid hex digest.`);
  }
  let binary = '';
  for (let i = 0; i < clean.length; i += 2) {
    binary += String.fromCharCode(parseInt(clean.slice(i, i + 2), 16));
  }
  return btoa(binary);
}

/** Convert Base64 (standard or URL-safe) to lower-case hex; returns null if not Base64. */
export function base64ToHex(b64: string): string | null {
  const s = b64.trim().replace(/-/g, '+').replace(/_/g, '/');
  if (s === '' || !/^[A-Za-z0-9+/]+={0,2}$/.test(s)) return null;
  const padded = s + '='.repeat((4 - (s.length % 4)) % 4);
  try {
    const binary = atob(padded);
    let hex = '';
    for (let i = 0; i < binary.length; i++)
      hex += binary.charCodeAt(i).toString(16).padStart(2, '0');
    return hex;
  } catch {
    return null;
  }
}

export interface FormatOptions {
  uppercase?: boolean;
  base64?: boolean;
}

/** Present a hex digest as the user asked: hex (lower/upper) or Base64. */
export function formatDigest(hex: string, options: FormatOptions = {}): string {
  if (options.base64) return hexToBase64(hex);
  return options.uppercase ? hex.toUpperCase() : hex.toLowerCase();
}

export type CompareResult =
  | { status: 'empty' }
  | { status: 'match'; algorithm: AlgorithmId; label: string }
  | { status: 'no-match' };

/**
 * Compare an expected digest (hex or Base64, any case, surrounding whitespace
 * and a leading "sha256:"-style prefix ignored) against every computed digest.
 */
export function compareDigest(table: Partial<DigestTable>, expected: string): CompareResult {
  const raw = expected.replace(/^\uFEFF/, '').trim();
  if (raw === '') return { status: 'empty' };
  // Try the value as pasted and, if it looks like "sha256: …" or "MD5 = …", without the label.
  const forms = [raw];
  const withoutPrefix = raw.replace(/^[a-z0-9-]+\s*[:=]\s*/i, '');
  if (withoutPrefix !== raw) forms.push(withoutPrefix);
  const candidates = new Set<string>();
  for (const form of forms) {
    const hexLike = form.replace(/[\s:-]/g, '').toLowerCase();
    if (/^[0-9a-f]+$/.test(hexLike)) candidates.add(hexLike);
    const fromB64 = base64ToHex(form);
    if (fromB64) candidates.add(fromB64);
  }

  for (const algo of ALGORITHMS) {
    const digest = table[algo.id];
    if (!digest) continue;
    if (candidates.has(digest.toLowerCase())) {
      return { status: 'match', algorithm: algo.id, label: algo.label };
    }
  }
  return { status: 'no-match' };
}

/** Guess which algorithm produced a digest from its length (hex chars). */
export function guessAlgorithmByLength(digest: string): Algorithm[] {
  const hex = digest.trim().replace(/[\s:-]/g, '');
  if (!/^[0-9a-fA-F]+$/.test(hex)) return [];
  return ALGORITHMS.filter((a) => a.bits / 4 === hex.length);
}
