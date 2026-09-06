import type { ToolMeta } from '@/tools/_types';

export const meta: ToolMeta = {
  slug: 'case-converter',
  name: 'Case Converter',
  shortName: 'Case Converter',
  seoTitle: 'Case Converter Online — Free Text Tool',
  tagline: 'Convert text to UPPER, lower, Title, camelCase, snake_case, kebab-case and more.',
  description:
    'Free online case converter. Turn any text into UPPER CASE, lower case, Title Case, camelCase, snake_case, kebab-case and more at once. Runs in your browser.',
  category: 'text',
  icon: 'case-sensitive',
  keywords: [
    'case converter',
    'text case converter',
    'uppercase to lowercase',
    'title case converter',
    'camelcase converter',
    'snake case converter',
    'kebab case converter',
    'sentence case converter',
    'capitalize text online',
    'change text case',
  ],
  intro: [
    'Renaming a variable, writing a headline or fixing a paragraph typed with Caps Lock on all need the same thing: the same words in a different case. This converter shows thirteen conversions of your text at once — UPPER CASE, lower case, Title Case, Sentence case, camelCase, PascalCase, snake_case, SCREAMING_SNAKE_CASE, kebab-case, dot.case, Train-Case, aLtErNaTiNg and iNVERSE — each with its own Copy button.',
    'The word splitter is the part that usually goes wrong elsewhere. This one understands camelCase and PascalCase boundaries, keeps acronyms intact (XMLHttpRequest becomes xml http request, not x m l http request), handles digits, punctuation and non-English letters, and title-casing leaves small words like "of", "the" and "for" lower-case unless they start or end the title. Paste a list and each line is converted on its own, so you get one identifier per line.',
    'Nothing you paste is uploaded. The conversions run in your browser as you type, which also means the tool keeps working offline once the page has loaded.',
  ],
  howTo: [
    'Type or paste your text into the "Text to convert" box.',
    'Read the converted text in the list beside it — every case updates as you type.',
    'Click the Copy button on a row to copy that one case, or Copy all for every case at once.',
    'Use Sample to see an example, and Clear to start again.',
  ],
  example: {
    input: 'XMLHttpRequest returns JSON',
    output:
      'camelCase        xmlHttpRequestReturnsJson\nsnake_case       xml_http_request_returns_json\nkebab-case       xml-http-request-returns-json',
    note: 'The identifier cases split the acronym correctly instead of turning it into single letters.',
  },
  faq: [
    {
      question: 'How do I convert text to camelCase or snake_case?',
      answer:
        'Paste the words into the input box — the camelCase and snake_case rows update immediately, then click the Copy button on that row. Separators, punctuation and existing capitalisation are all handled, so <code>user ID</code>, <code>user-id</code> and <code>UserID</code> all become <code>userId</code>.',
    },
    {
      question: 'What is the difference between Title Case and Sentence case?',
      answer:
        'Title Case capitalises every significant word ("The Lord of the Rings") and leaves small words such as <em>a, an, the, of, in, on, at, to, for, and, but, or</em> lower-case unless they are the first or last word. Sentence case capitalises only the first word of each sentence and of each line ("The lord of the rings").',
    },
    {
      question: 'Can I convert a whole list at once?',
      answer:
        'Yes. The identifier cases (camelCase, PascalCase, snake_case, SCREAMING_SNAKE_CASE, kebab-case, dot.case and Train-Case) convert each line separately, so a list of field names in means a list of identifiers out. The prose cases treat the text as a whole.',
    },
    {
      question: 'How does it handle acronyms like XMLHttpRequest?',
      answer:
        'A run of capitals followed by a capitalised word is treated as one acronym, so <code>XMLHttpRequest</code> splits into <code>XML</code>, <code>Http</code> and <code>Request</code>. Note that Title Case lower-cases the rest of an acronym, turning <code>NASA</code> into <code>Nasa</code> — use UPPER CASE when you need it kept.',
    },
    {
      question: 'Does it work with accented and non-Latin text?',
      answer:
        'Yes. Conversions use locale-aware upper- and lower-casing, so <code>Grüße</code> becomes <code>GRÜSSE</code>, and letters from scripts without capitals (Japanese, Arabic, Hebrew) are treated as words rather than dropped.',
    },
    {
      question: 'Is my text sent to a server?',
      answer:
        'No. Every conversion runs in JavaScript in your browser. Nothing is uploaded, stored or logged, and the tool keeps working with the network disconnected.',
    },
  ],
  related: ['text-diff', 'word-counter'],
  status: 'stable',
  added: '2026-09-07',
};
