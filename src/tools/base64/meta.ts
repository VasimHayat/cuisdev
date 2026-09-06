import type { ToolMeta } from '@/tools/_types';

export const meta: ToolMeta = {
  slug: 'base64',
  name: 'Base64 Encoder / Decoder',
  shortName: 'Base64',
  seoTitle: 'Base64 Encode & Decode Online — Free',
  tagline:
    'Encode text or files to Base64 and decode Base64 back to text, instantly and privately.',
  description:
    'Free online Base64 encoder and decoder. Convert text or files to Base64 and back, with URL-safe and MIME line-wrap options. Runs 100% in your browser.',
  category: 'encoding',
  icon: 'binary',
  keywords: [
    'base64 encode',
    'base64 decode',
    'base64 encoder',
    'base64 decoder',
    'base64 converter',
    'base64 to text',
    'text to base64',
    'file to base64',
    'url safe base64',
    'base64 online',
  ],
  intro: [
    'Base64 is a way of representing binary data using only 64 printable ASCII characters (A–Z, a–z, 0–9, + and /). It is used wherever raw bytes have to travel through systems that only understand text: email attachments, data URLs in HTML and CSS, JSON payloads, HTTP Basic authentication headers and JWT tokens.',
    'This tool encodes any text — including emoji and non-Latin scripts, which are handled as UTF-8 — or any file into Base64, and decodes Base64 back into text or a downloadable file. It also understands the URL-safe alphabet used in JWTs and query strings, tolerates missing padding and line breaks, and can wrap output at 76 characters for MIME.',
    'Everything happens inside your browser using the Web APIs your browser already ships. Nothing is uploaded, logged or stored.',
  ],
  howTo: [
    'Choose Encode to turn text or a file into Base64, or Decode to turn Base64 back into text.',
    'Paste or type into the input box, or drop a file anywhere on the tool. The output updates as you type.',
    'Optionally tick URL-safe to use the - and _ alphabet without padding, or Wrap at 76 to add MIME line breaks.',
    'Click Copy to copy the result, Download to save it as a file, or Swap to feed the output back in as input.',
  ],
  example: {
    input: 'Hello, World!',
    output: 'SGVsbG8sIFdvcmxkIQ==',
    note: 'Every 3 bytes of input become 4 Base64 characters, so encoded data is about 33% larger. The trailing "=" characters are padding.',
  },
  faq: [
    {
      question: 'Is Base64 encryption?',
      answer:
        'No. Base64 is an <strong>encoding</strong>, not encryption — anyone can decode it instantly, and it provides no secrecy. Use it to make binary data safe for text-only channels, never to hide sensitive information.',
    },
    {
      question: 'Why does my Base64 output end with = or ==?',
      answer:
        'Base64 processes input in groups of 3 bytes and emits 4 characters per group. When the input length is not a multiple of 3, the final group is padded with one or two <code>=</code> characters. Many decoders (including this one) accept input with the padding removed.',
    },
    {
      question: 'What is URL-safe Base64?',
      answer:
        'Standard Base64 uses <code>+</code> and <code>/</code>, which have special meanings in URLs. URL-safe Base64 (RFC 4648 §5) replaces them with <code>-</code> and <code>_</code> and usually omits padding. It is what JWTs, OAuth state parameters and many APIs use.',
    },
    {
      question: 'Can I Base64-encode an image or other binary file?',
      answer:
        'Yes. Switch to Encode and drop a file onto the tool, or use the Upload button. The output is the raw Base64 string; prefix it with <code>data:&lt;mime-type&gt;;base64,</code> to use it as a data URL in HTML or CSS.',
    },
    {
      question: 'Why do I get an error when decoding?',
      answer:
        'The input contains characters outside the Base64 alphabet, has a length that cannot be valid, or decodes to bytes that are not UTF-8 text. The error message tells you which. For binary results, use Download instead of reading the output as text.',
    },
    {
      question: 'Is my data uploaded anywhere?',
      answer:
        'No. Encoding and decoding run in your browser with the built-in <code>btoa</code>/<code>atob</code> and <code>TextEncoder</code> APIs. You can disconnect from the internet after the page loads and the tool keeps working.',
    },
  ],
  status: 'stable',
  added: '2026-09-06',
};
