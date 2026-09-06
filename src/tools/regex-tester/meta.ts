import type { ToolMeta } from '@/tools/_types';

export const meta: ToolMeta = {
  slug: 'regex-tester',
  name: 'Regex Tester',
  shortName: 'Regex',
  seoTitle: 'Regex Tester Online — Test & Debug Regex',
  tagline:
    'Test JavaScript regular expressions live: highlighted matches, capture groups and replace.',
  description:
    'Free online regex tester. Highlight matches live, inspect capture groups, try replacements and catch bad patterns safely — all inside your browser.',
  category: 'text',
  icon: 'regex',
  keywords: [
    'regex tester',
    'regex tester online',
    'regular expression tester',
    'javascript regex tester',
    'regex match highlighter',
    'regex capture groups',
    'named capture groups',
    'regex replace tool',
    'regex debugger',
    'test regex online',
    'regex cheat sheet',
  ],
  intro: [
    'A regular expression is a compact pattern for finding, validating or rewriting text. Writing one is easy; being sure it does what you meant is not. This regex tester runs your pattern against a sample of real text as you type and shows every match highlighted in place, so you can see exactly what it caught and — just as importantly — what it missed.',
    'It uses the JavaScript regex engine, so the results match what your code will do in Node.js, Deno, Bun or a browser. All seven flags are switchable (g, i, m, s, u, v and y), every match is listed with its start and end offset, numbered and named capture groups are broken out per match, and the replace box expands $1, $<name> and $& exactly the way String.replace does. Syntax errors surface the engine’s own message instead of a generic "invalid pattern", and matching runs in a Web Worker with a two-second budget so a catastrophically backtracking pattern like (a+)+$ reports the problem instead of freezing the tab.',
    'Your pattern and your test text never leave the page. There is no server round-trip, no logging and no analytics on what you paste — which matters when the text you are testing against is a log file, a customer record or a production config.',
  ],
  howTo: [
    'Type or paste your pattern into the Regular expression box — no surrounding slashes needed.',
    'Tick the flags you want: g for every match, i to ignore case, m for multiline anchors, s to let the dot match newlines.',
    'Paste the text to test into the Test string box, or press Sample to load a worked example with named groups.',
    'Read the results: matches are highlighted in place, and the table below lists each match with its position and capture groups.',
    'Optionally type a Replacement using $1, $<name> or $&, then use Copy matches or Copy result to take the output with you.',
  ],
  example: {
    input:
      '(?<user>[\\w.+-]+)@(?<domain>[\\w-]+\\.[\\w.-]{2,})   flags: g\nContact ada@example.com or grace.hopper@navy.mil',
    output:
      '2 matches\n1  ada@example.com        8–23    user=ada        domain=example.com\n2  grace.hopper@navy.mil  27–48   user=grace.hopper  domain=navy.mil',
    note: 'With the replacement "$<user> [at] $<domain>" the same pattern rewrites both addresses to "ada [at] example.com" and "grace.hopper [at] navy.mil".',
  },
  faq: [
    {
      question: 'Which regex flavour does this tester use?',
      answer:
        'The JavaScript (ECMAScript) engine built into your browser, the same one Node.js and Deno use. Patterns that work here work in <code>String.match</code>, <code>replace</code> and <code>RegExp</code> without changes. PCRE-only features such as atomic groups, possessive quantifiers and recursion are not part of ECMAScript and will report a syntax error.',
    },
    {
      question: 'How do I use named capture groups?',
      answer:
        'Write <code>(?&lt;name&gt;…)</code> in the pattern. Each match in the results table lists the group under its name rather than a number, and in the Replacement box you reference it as <code>$&lt;name&gt;</code>. Numbered groups still work alongside named ones and are referenced as <code>$1</code>, <code>$2</code> and so on.',
    },
    {
      question: 'Why does my pattern only find the first match?',
      answer:
        'Without the <code>g</code> (global) flag a regular expression stops at the first match — that is the JavaScript default, and the replace box will rewrite only that one occurrence too. Tick <code>g</code> to walk the whole string. The <code>y</code> (sticky) flag also iterates, but only while matches are consecutive from the last index.',
    },
    {
      question: 'What does "Pattern took too long" mean?',
      answer:
        'Some patterns take exponential time on inputs that nearly match — the classic example is <code>(a+)+$</code> against a long run of "a" characters. This is called catastrophic backtracking and it is a real denial-of-service risk in production. Matching here runs in a Web Worker with a two-second limit, so the tool can stop it and tell you rather than hang. Fix it by un-nesting quantifiers, making them lazy, or anchoring the pattern.',
    },
    {
      question: 'What is the difference between the u and v flags?',
      answer:
        'Both enable Unicode mode, which makes <code>\\p{…}</code> property escapes and full code-point handling work. <code>v</code> is the newer mode: it adds set notation such as <code>[\\p{Letter}--[a-z]]</code> and stricter escaping rules. They are mutually exclusive — the tester tells you so instead of letting the engine throw a cryptic error.',
    },
    {
      question: 'Is my pattern or test text sent anywhere?',
      answer:
        'No. The pattern is compiled and run by your own browser, and the results are rendered from text nodes on the page. Nothing is uploaded, stored or logged, so it is safe to paste log lines, tokens or customer data while you debug.',
    },
  ],
  related: ['markdown-preview'],
  status: 'stable',
  added: '2026-09-07',
};
