import type { ToolMeta } from '@/tools/_types';

export const meta: ToolMeta = {
  slug: 'url-encoder',
  name: 'URL Encoder / Decoder',
  shortName: 'URL Encode',
  seoTitle: 'URL Encoder & Decoder Online — Free',
  tagline:
    'Percent-encode text for URLs, decode encoded URLs and see every query parameter — privately.',
  description:
    'Free online URL encoder and decoder. Percent-encode query strings and paths, decode double-encoded URLs and inspect query parameters. Runs 100% in your browser.',
  category: 'encoding',
  icon: 'link',
  keywords: [
    'url encoder',
    'url decoder',
    'url encode',
    'url decode',
    'percent encoding',
    'encodeuricomponent online',
    'urlencode online',
    'decode url online',
    'query string decoder',
    'url parser',
    'x-www-form-urlencoded',
  ],
  intro: [
    'URL encoding (percent-encoding, RFC 3986) replaces characters that are not allowed in a URL with a % sign followed by two hex digits: a space becomes %20, an ampersand %26 and é becomes %C3%A9. Without it, a value such as "Tom & Jerry" would break a query string in two, and non-ASCII text could not travel in a link at all.',
    'This tool offers the three flavours you actually meet in practice. Component mode (encodeURIComponent) is right for a single query value or path segment. Full URL mode (encodeURI) keeps the delimiters :, /, ?, & and = intact so a whole URL stays clickable. Form mode produces application/x-www-form-urlencoded output, where spaces become + — what browsers send when submitting a form. Decoding accepts all three, points at the exact offset of a malformed % sequence, and can keep decoding until the text stops changing, which untangles URLs that were encoded two or three times by redirect chains. Paste an absolute URL and you also get a breakdown table: protocol, host, port, path, every query parameter decoded, and the fragment.',
    'Nothing you paste leaves your browser. Encoding and decoding use the JavaScript your browser already ships, so tracking links, callback URLs and tokens stay on your machine.',
  ],
  howTo: [
    'Choose Encode to percent-encode text, or Decode to turn an encoded URL back into readable text.',
    'Pick a mode: Component for a single value, Full URL for a whole address, Form for application/x-www-form-urlencoded data.',
    'Paste or type into the input box. The output updates as you type, and any absolute URL is broken down into its parts below.',
    'When decoding a double-encoded link, tick Decode until stable to unwrap every layer.',
    'Click Copy to copy the result or Swap to feed the output back in as input.',
  ],
  example: {
    input: 'https://example.com/search?q=café au lait&lang=fr',
    output: 'https://example.com/search?q=caf%C3%A9%20au%20lait&lang=fr',
    note: 'Full URL mode: the space and é are escaped, while :, /, ? and & keep their meaning. Component mode would also escape those delimiters.',
  },
  faq: [
    {
      question: 'What is the difference between encodeURI and encodeURIComponent?',
      answer:
        "<code>encodeURIComponent</code> escapes every character except letters, digits and <code>- _ . ! ~ * ' ( )</code>, so it is safe for a single value inside a query string. <code>encodeURI</code> additionally leaves the URL delimiters <code>; / ? : @ &amp; = + $ , #</code> untouched so that a complete URL remains a valid URL. Use Component for values and Full URL for whole addresses.",
    },
    {
      question: 'Why is a space sometimes + and sometimes %20?',
      answer:
        'Both are correct in different places. <code>%20</code> is the RFC 3986 percent-encoding used in paths and by <code>encodeURIComponent</code>. <code>+</code> is specific to <code>application/x-www-form-urlencoded</code>, the format HTML forms submit and most query-string parsers accept. Form mode produces <code>+</code>; when decoding form data the tool turns <code>+</code> back into a space.',
    },
    {
      question: 'How do I decode a URL that has been encoded twice?',
      answer:
        'Redirect and tracking chains often encode an already-encoded URL, so you see <code>%2520</code> instead of <code>%20</code>. Switch to Decode and tick <strong>Decode until stable</strong>: the tool repeats the decode step until the text stops changing and tells you how many layers it removed.',
    },
    {
      question: 'What does "Malformed percent-escape" mean?',
      answer:
        'A <code>%</code> in the input is not followed by two hexadecimal digits, for example <code>100%</code> or <code>%2G</code>. The error reports the exact character offset. If the percent sign is meant literally, encode it as <code>%25</code>; if the URL was truncated, restore the missing characters.',
    },
    {
      question: 'Does URL encoding handle emoji and non-Latin characters?',
      answer:
        'Yes. Text is first converted to UTF-8 bytes and each byte is percent-encoded, so é becomes <code>%C3%A9</code> and 👋 becomes <code>%F0%9F%91%8B</code>. Decoding reverses this and reports an error if the bytes are not valid UTF-8, which usually means the URL was produced with a legacy charset.',
    },
    {
      question: 'Is my URL sent to a server?',
      answer:
        'No. Encoding, decoding and URL parsing run entirely in your browser using the built-in <code>encodeURIComponent</code> and <code>URL</code> APIs. Nothing is logged or transmitted, so it is safe to paste links that contain tokens or session identifiers.',
    },
  ],
  related: ['base64', 'html-entity-encoder', 'string-escape'],
  status: 'stable',
  added: '2026-09-06',
};
