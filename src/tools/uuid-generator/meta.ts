import type { ToolMeta } from '@/tools/_types';

export const meta: ToolMeta = {
  slug: 'uuid-generator',
  name: 'UUID Generator',
  shortName: 'UUID',
  seoTitle: 'UUID Generator Online — v4, v7, Bulk & Free',
  tagline:
    'Generate random v4 or time-ordered v7 UUIDs in bulk, then copy them in the format you need.',
  description:
    'Free online UUID generator for random v4 and time-sortable v7 UUIDs. Make up to 1,000 at once as a list, JSON or TypeScript array, all in your browser.',
  category: 'generators',
  icon: 'fingerprint',
  keywords: [
    'uuid generator',
    'uuid v4 generator',
    'uuid v7 generator',
    'guid generator',
    'bulk uuid generator',
    'random uuid',
    'generate uuid online',
    'uuid to timestamp',
    'uuid parser',
    'nil uuid',
    'uuid json array',
  ],
  intro: [
    'A UUID (universally unique identifier, also called a GUID) is a 128-bit value written as 32 hex digits in five hyphenated groups, such as 550e8400-e29b-41d4-a716-446655440000. Because the space is so large, UUIDs can be created anywhere — in a browser, a phone or a database — without coordination and still be unique in practice. They are the default primary key in many databases, the ID format for API resources, and the way apps tag sessions, uploads and events.',
    'This generator makes version 4 UUIDs (122 random bits, the most common kind) and version 7 UUIDs from RFC 9562, which start with a 48-bit Unix timestamp so they sort by creation time and index well in databases. You can produce up to 1,000 at a time, switch to upper case, remove hyphens, add quotes, and output them one per line, comma-separated, as a JSON array or as a ready-to-paste TypeScript array. The nil (all-zero) and max (all-one) UUIDs are one click away, and the inspector tells you the version, variant and — for v1, v6 and v7 — the embedded date of any UUID you paste.',
    'Every UUID is generated on your device with the Web Crypto API (crypto.randomUUID and crypto.getRandomValues). Nothing is sent to a server, logged or stored, so the values are yours alone the moment they appear.',
  ],
  howTo: [
    'Pick a version: v4 for random IDs, v7 for time-ordered IDs, or nil / max for the special values.',
    'Set how many you need (1–1000) and tick Uppercase, Remove hyphens or Wrap in quotes if your code expects that.',
    'Choose an output layout — one per line, comma-separated, JSON array or TypeScript array — and click Generate.',
    'Click Copy all or Download .txt to take the results with you.',
    'To inspect an existing UUID, paste it into the Parse / inspect box to see its version, variant and timestamp.',
  ],
  example: {
    input: 'Version: v7 · Count: 3 · Format: JSON array',
    output:
      '[\n  "0191f6e3-2c1a-7d4b-9f2e-8a3b1c5d7e90",\n  "0191f6e3-2c1a-7d4b-9f2e-8a3b1c5d7e91",\n  "0191f6e3-2c1a-7d4b-9f2e-8a3b1c5d7e92"\n]',
    note: 'v7 UUIDs generated in the same millisecond share their first 12 hex digits (the timestamp) and increase monotonically, so they sort in creation order.',
  },
  faq: [
    {
      question: 'What is the difference between UUID v4 and UUID v7?',
      answer:
        'A <strong>v4</strong> UUID is 122 bits of randomness — unpredictable and unordered. A <strong>v7</strong> UUID (RFC 9562, 2024) starts with a 48-bit millisecond Unix timestamp followed by 74 random bits, so newer IDs sort after older ones. Use v7 for database primary keys, where ordered inserts keep B-tree indexes compact; use v4 when you do not want IDs to reveal creation time.',
    },
    {
      question: 'Are UUIDs really unique? Can two collide?',
      answer:
        'The chance of a v4 collision is astronomically small: you would need to generate about 2.7 quintillion UUIDs to reach a 50% chance of a single duplicate. For practical purposes they are unique, as long as they come from a cryptographic random source — this tool uses <code>crypto.randomUUID()</code> and <code>crypto.getRandomValues()</code>, never <code>Math.random()</code>.',
    },
    {
      question: 'Is a GUID the same as a UUID?',
      answer:
        'Yes. GUID (globally unique identifier) is Microsoft&#39;s name for the same 128-bit format. .NET and SQL Server display them with braces, e.g. <code>{550e8400-…}</code>, and the inspector here accepts that form as well as the <code>urn:uuid:</code> prefix and UUIDs without hyphens.',
    },
    {
      question: 'What are the nil and max UUIDs for?',
      answer:
        'The nil UUID <code>00000000-0000-0000-0000-000000000000</code> is a placeholder meaning "no value", useful as a default or sentinel. The max UUID <code>ffffffff-ffff-ffff-ffff-ffffffffffff</code> was added in RFC 9562 as the opposite bound, for example as an upper limit in range queries.',
    },
    {
      question: 'Can I get the timestamp out of a UUID?',
      answer:
        'Only for time-based versions. Paste a <strong>v7</strong>, <strong>v1</strong> or <strong>v6</strong> UUID into the Parse / inspect box and the tool decodes the embedded clock to a date. v4 UUIDs are entirely random and contain no timestamp; v3 and v5 are hashes of a name.',
    },
    {
      question: 'Are the UUIDs generated here sent to or stored on a server?',
      answer:
        'No. Generation happens inside your browser using the Web Crypto API, and the page makes no network requests with your data. You can load the page, go offline and keep generating.',
    },
  ],
  related: ['password-generator', 'hash-generator'],
  status: 'stable',
  added: '2026-09-06',
};
