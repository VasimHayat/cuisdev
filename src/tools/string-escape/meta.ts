import type { ToolMeta } from '@/tools/_types';

export const meta: ToolMeta = {
  slug: 'string-escape',
  name: 'String Escape / Unescape',
  shortName: 'String Escape',
  seoTitle: 'String Escape & Unescape Online — JSON, JS, SQL',
  tagline:
    'Escape or unescape text for JSON, JavaScript, HTML, XML, CSV, shell, regex and SQL — privately.',
  description:
    'Free online string escape and unescape tool for JSON, JavaScript, HTML attributes, XML, CSV, POSIX shell, regular expressions and SQL. Runs in your browser.',
  category: 'encoding',
  icon: 'type',
  keywords: [
    'string escape',
    'string unescape',
    'escape string online',
    'json escape',
    'json unescape',
    'javascript escape string',
    'escape quotes',
    'escape regex',
    'regex escape online',
    'sql escape single quote',
    'shell escape',
    'csv escape quotes',
    'unescape string',
  ],
  intro: [
    'Every language has characters that mean something special inside a string literal: a double quote ends a JSON string, a backslash starts an escape in JavaScript, an apostrophe closes a shell argument or an SQL literal, and a dot matches anything in a regular expression. Escaping replaces those characters with a sequence the parser treats as plain text — and getting it wrong is behind a surprising share of syntax errors, broken builds and injection bugs.',
    'This tool escapes and unescapes text for eight common targets. JSON follows RFC 8259 exactly as JSON.stringify would; JavaScript covers single, double and template-literal quotes plus \\x, \\u and \\u{…} sequences, octal escapes and line continuations when unescaping; HTML attribute and XML produce the right entities for each; CSV applies RFC 4180 quoting; Shell wraps text in POSIX single quotes and can also read back double-quoted and backslash-escaped words. Regular expression and SQL escaping are one-way by nature and are offered as escape only. Unescaping reports the exact offset of a bad escape sequence instead of silently guessing, and the output updates as you type.',
    'Text you paste — connection strings, API keys, customer names — never leaves your browser. There is no server component: every transformation is a small piece of JavaScript running on your machine.',
  ],
  howTo: [
    'Choose Escape to make text safe for a string literal, or Unescape to turn an escaped literal back into plain text.',
    'Pick the Target: JSON, JavaScript, HTML attribute, XML, CSV, Shell, Regular expression or SQL. The hint under the selector explains what changes.',
    'Paste or type into the input box. The output updates live; unescape errors show the offset of the first bad sequence.',
    'Click Copy to copy the result, or Swap to send the output back into the input and reverse the direction.',
  ],
  example: {
    input: 'She said "it\'s C:\\temp"\n— done',
    output: 'She said \\"it\'s C:\\\\temp\\"\\n— done',
    note: 'JSON target: double quotes and backslashes are escaped, the line break becomes \\n, and the apostrophe and em dash need no escaping.',
  },
  faq: [
    {
      question: 'How do I escape a string for JSON?',
      answer:
        'Replace <code>"</code> with <code>\\"</code>, <code>\\</code> with <code>\\\\</code>, and control characters with <code>\\n</code>, <code>\\t</code>, <code>\\r</code>, <code>\\b</code>, <code>\\f</code> or <code>\\u00XX</code>. Nothing else needs escaping — accented letters, emoji and even <code>/</code> are valid as-is. Choose the JSON target and Escape to do exactly this; the output goes between the quotes of a JSON string.',
    },
    {
      question: 'What is the difference between JSON and JavaScript escaping?',
      answer:
        'JSON has a strict, small set of escapes and only recognises double-quoted strings. JavaScript string literals also accept single quotes and backticks, so those must be escaped too, and it adds <code>\\x41</code>, <code>\\u{1F600}</code>, <code>\\v</code>, <code>\\0</code>, legacy octal escapes and backslash-newline line continuations. The JavaScript target escapes all three quote styles and the line terminators U+2028 and U+2029, which are legal in JSON but historically broke JavaScript.',
    },
    {
      question: 'How do I escape special characters in a regular expression?',
      answer:
        'Put a backslash before each of <code>. * + ? ^ $ { } ( ) | [ ] \\</code> and, if you are writing a <code>/…/</code> literal, before <code>/</code>. The Regular expression target does this so the text matches itself literally — for example <code>1.5</code> becomes <code>1\\.5</code>. The hyphen is left alone because escaping it outside a character class is an error in Unicode-mode patterns.',
    },
    {
      question: 'How do I escape a single quote in SQL?',
      answer:
        "Standard SQL doubles it: <code>O'Reilly</code> becomes <code>O''Reilly</code>, so the literal reads <code>'O''Reilly'</code>. This works in PostgreSQL, SQLite, SQL Server, Oracle and MySQL. It is fine for fixing a hand-written query, but for anything built from user input use parameterised queries (prepared statements) instead — escaping alone is not a reliable defence against SQL injection.",
    },
    {
      question: 'How do I safely quote an argument for bash or sh?',
      answer:
        "Wrap it in single quotes; inside them nothing is special — not <code>$</code>, backticks or backslashes. The only character that cannot appear is the single quote itself, which is written as <code>'\\''</code> (close the quotes, add an escaped quote, reopen). The Shell target does this for you and produces output that works in sh, bash, zsh and dash.",
    },
    {
      question: 'Why can I not unescape a regex or SQL string?',
      answer:
        "Both are one-way in practice. A regex pattern mixes intentional metacharacters with escaped literals, so removing backslashes would change its meaning, and SQL dialects disagree on whether <code>\\'</code> or <code>''</code> is an escape. Rather than guess, this tool offers escape only for those two targets; the Unescape option is disabled with a note when you select them.",
    },
  ],
  related: ['html-entity-encoder', 'url-encoder', 'base64'],
  status: 'stable',
  added: '2026-09-06',
};
