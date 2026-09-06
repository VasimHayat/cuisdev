import type { ToolMeta } from '@/tools/_types';

export const meta: ToolMeta = {
  slug: 'html-entity-encoder',
  name: 'HTML Entity Encoder / Decoder',
  shortName: 'HTML Entities',
  seoTitle: 'HTML Entity Encoder & Decoder — Free Online',
  tagline:
    'Escape text for HTML or decode &amp;, &#169; and &copy; back to characters — in your browser.',
  description:
    'Free online HTML entity encoder and decoder. Escape < > & and quotes, convert text to named, decimal or hex entities and decode them back — in your browser.',
  category: 'encoding',
  icon: 'code',
  keywords: [
    'html entity encoder',
    'html entity decoder',
    'html encode',
    'html decode',
    'html escape',
    'html unescape',
    'html entities converter',
    'escape html characters',
    'decode html entities online',
    'named entities list',
    'html special characters',
  ],
  intro: [
    'HTML entities let you write characters that would otherwise be interpreted as markup — a literal < becomes &lt;, an ampersand becomes &amp; — and characters that are awkward to type, such as &copy; for © or &mdash; for a dash. Escaping user-supplied text before putting it into a page is also the first line of defence against cross-site scripting (XSS).',
    'This encoder offers four levels. Essential only escapes the five characters that matter for safety (& < > " \'). Non-ASCII + essential additionally converts accented letters, symbols and emoji, preferring a readable named entity such as &eacute; when one exists and falling back to a numeric reference. All numeric and All hex encode every character as &#NNN; or &#xHH; — handy for obfuscating an email address or testing a parser. The decoder understands named, decimal and hex references, the full HTML 4 table plus common HTML5 names, entities written without a semicolon the way browsers accept them, and the Windows-1252 quirk behind &#150; and &#151;.',
    'Everything runs locally: the entity table ships with the page and no text is sent to a server. Paste templates, scraped HTML or customer content without a second thought.',
  ],
  howTo: [
    'Choose Encode to escape text for HTML, or Decode to turn entities back into characters.',
    'When encoding, pick a level: Essential only, Non-ASCII + essential, All numeric or All hex.',
    'Paste or type into the input box. The output updates live as you type.',
    'Click Copy to copy the result, or Swap to send the output back into the input.',
  ],
  example: {
    input: '<a href="?a=1&b=2">Tom & Jerry’s café</a>',
    output: '&lt;a href=&quot;?a=1&amp;b=2&quot;&gt;Tom &amp; Jerry&rsquo;s caf&eacute;&lt;/a&gt;',
    note: 'Non-ASCII + essential mode: markup characters are escaped and the curly apostrophe and é become named entities.',
  },
  faq: [
    {
      question: 'Which characters must be escaped in HTML?',
      answer:
        'In text content only <code>&lt;</code> and <code>&amp;</code> are strictly required, but inside attribute values you also need <code>&quot;</code> (and <code>&#39;</code> for single-quoted attributes). Escaping all five — <code>&amp; &lt; &gt; " \'</code> — everywhere is the standard, safe choice and is what Essential only does.',
    },
    {
      question: 'What is the difference between &#169;, &#xA9; and &copy;?',
      answer:
        'They are three spellings of the same character, ©. <code>&#169;</code> is a decimal numeric reference, <code>&#xA9;</code> is hexadecimal and <code>&copy;</code> is a named entity. Browsers treat them identically; named entities are easier to read, numeric ones work for every Unicode character, including those without a name.',
    },
    {
      question: 'Does HTML entity encoding prevent XSS?',
      answer:
        'Escaping <code>&amp; &lt; &gt; " \'</code> stops user input from breaking out of text content or a quoted attribute, which blocks the most common injection. It is not sufficient inside <code>&lt;script&gt;</code>, event handlers, URLs or CSS — those contexts need their own escaping (see the <a href="/tools/string-escape/">String Escape</a> tool for JavaScript and the <a href="/tools/url-encoder/">URL Encoder</a> for links).',
    },
    {
      question: 'Why does &nbsp; show up in my text?',
      answer:
        '<code>&amp;nbsp;</code> is a non-breaking space (U+00A0). Word processors and rich-text editors insert it to keep words together or to preserve double spaces. Decoding it yields a real non-breaking space character, which looks like a space but is not matched by a plain space in search.',
    },
    {
      question: 'Do entities need a trailing semicolon?',
      answer:
        'Technically yes. In practice browsers accept a handful of legacy entities without one (<code>&amp;copy</code>, <code>&amp;amp</code>, <code>&amp;nbsp</code> and the other Latin-1 names), so this decoder does too. Newer names such as <code>&amp;hellip</code> are only recognised with the semicolon, matching browser behaviour.',
    },
    {
      question: 'Is my HTML sent anywhere?',
      answer:
        'No. The entity table and both encoder and decoder are plain JavaScript that runs in your browser. Nothing is uploaded, logged or stored, and the page keeps working offline once loaded.',
    },
  ],
  related: ['string-escape', 'url-encoder', 'base64'],
  status: 'stable',
  added: '2026-09-06',
};
