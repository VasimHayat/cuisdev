import type { ToolMeta } from '@/tools/_types';

export const meta: ToolMeta = {
  slug: 'hash-generator',
  name: 'Hash Generator',
  shortName: 'Hash',
  seoTitle: 'Hash Generator — SHA-256, MD5, SHA-1 Online',
  tagline:
    'Compute MD5, SHA-1, SHA-2, SHA-3 and CRC32 hashes of text or files, with optional HMAC.',
  description:
    'Free online hash generator: SHA-256, SHA-512, SHA-1, MD5, SHA-3 and CRC32 for text or files, plus HMAC and checksum comparison. Nothing leaves your browser.',
  category: 'generators',
  icon: 'hash',
  keywords: [
    'hash generator',
    'sha256 generator',
    'sha256 hash online',
    'md5 hash generator',
    'sha1 hash',
    'sha512 hash',
    'sha3 hash',
    'crc32 calculator',
    'hmac generator',
    'file checksum',
    'verify sha256 checksum',
    'hash calculator',
  ],
  intro: [
    'A cryptographic hash turns any input — a password, a JSON document, a 2 GB installer — into a fixed-length fingerprint. Change a single bit and the digest changes completely, which is why hashes are used to verify downloads, detect tampering, deduplicate files, sign API requests and store passwords. SHA-256 is the modern default; SHA-1 and MD5 are still needed to check older checksums; SHA-3 offers a different construction; and CRC32 is a fast non-cryptographic checksum used by ZIP, PNG and Ethernet.',
    'This tool computes all eight digests at once — MD5, SHA-1, SHA-256, SHA-384, SHA-512, SHA3-256, SHA3-512 and CRC32 — as you type, or for any file you drop onto it. Files are read in chunks and fed to every algorithm in a single pass, so multi-gigabyte files work without loading them into memory, with a live progress readout. Tick HMAC and enter a secret to get keyed digests for the SHA family, switch between lower-case, upper-case and Base64 output, copy any row with one click, and paste an expected checksum into the Compare box to get an instant Match / No match verdict.',
    'Hashing runs entirely in your browser using hash-wasm, a WebAssembly implementation of the standard algorithms. Your text, files and HMAC secrets are never uploaded, so you can safely check private documents and keys.',
  ],
  howTo: [
    'Type or paste text into the input box, or drop a file anywhere on the tool (or use the File button).',
    'Read the digests in the table — they update as you type. Tick Uppercase or Base64 to change the output format.',
    'To compute an HMAC, tick HMAC and enter your secret key; the SHA rows switch to keyed digests.',
    'Click Copy next to any algorithm to copy that digest.',
    'To verify a checksum, paste the expected value into Compare — the tool reports Match and which algorithm it matched, or No match.',
  ],
  example: {
    input: 'The quick brown fox jumps over the lazy dog',
    output:
      'MD5      9e107d9d372bb6826bd81d3542a419d6\nSHA-1    2fd4e1c67a2d28fced849ee1bb76e7391b93eb12\nSHA-256  d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592\nCRC32    414fa339',
    note: 'Hashes are computed over the UTF-8 bytes of the text. A trailing newline or Windows line endings produce a different digest, which is the most common reason a checksum "does not match".',
  },
  faq: [
    {
      question: 'Which hash algorithm should I use?',
      answer:
        'For new work use <strong>SHA-256</strong> (or SHA-512 on 64-bit servers where it is often faster). MD5 and SHA-1 are broken for collision resistance and should only be used to verify checksums that were published in those formats. SHA-3 is a sound alternative with a different internal design. CRC32 is not cryptographic at all — it detects accidental corruption, not deliberate tampering.',
    },
    {
      question: 'How do I verify a downloaded file against its SHA-256 checksum?',
      answer:
        'Drop the downloaded file onto this tool, then paste the checksum from the vendor&#39;s website into the Compare box. If it says <strong>Match</strong>, the file is byte-for-byte what was published. Large files are hashed in chunks with a progress indicator; nothing is uploaded.',
    },
    {
      question: 'What is an HMAC and how is it different from a plain hash?',
      answer:
        'An HMAC (hash-based message authentication code, RFC 2104) mixes a secret key into the hash so that only someone who knows the key can produce or verify the digest. APIs such as AWS Signature v4, Stripe and GitHub webhooks use HMAC-SHA256 to sign requests. Tick HMAC, enter the key and the SHA rows become keyed digests; MD5 and CRC32 are not offered in HMAC mode.',
    },
    {
      question: 'Why is my hash different from the one my program produced?',
      answer:
        'Almost always because the bytes differ. Common culprits: a trailing newline added by <code>echo</code> (use <code>printf</code> or <code>echo -n</code>), Windows <code>\\r\\n</code> line endings, a UTF-8 byte-order mark, or a different text encoding. This tool hashes the exact UTF-8 bytes of what you typed, with no hidden newline.',
    },
    {
      question: 'Can a hash be reversed to get the original text?',
      answer:
        'No — hashes are one-way functions. However, short or common inputs (like passwords) can be guessed by hashing candidates and comparing, which is why passwords must be stored with a slow, salted algorithm such as bcrypt, scrypt or Argon2 rather than a plain SHA-256.',
    },
    {
      question: 'Is it safe to hash confidential files or secret keys here?',
      answer:
        'Yes. All computation happens in your browser with WebAssembly; the page makes no network requests with your data, and the site&#39;s Content Security Policy blocks connections to other origins. You can load the page, go offline and hash as many files as you like.',
    },
  ],
  related: ['base64', 'uuid-generator', 'password-generator'],
  status: 'stable',
  added: '2026-09-06',
};
