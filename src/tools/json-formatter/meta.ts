import type { ToolMeta } from '@/tools/_types';

export const meta: ToolMeta = {
  slug: 'json-formatter',
  name: 'JSON Formatter & Validator',
  shortName: 'JSON Formatter',
  seoTitle: 'JSON Formatter & Validator Online — Free',
  tagline:
    'Format, validate, minify and explore JSON with exact error locations and a collapsible tree view.',
  description:
    'Free online JSON formatter and validator. Beautify or minify JSON, sort keys, fix common syntax mistakes and browse a tree view. Runs 100% in your browser.',
  category: 'json',
  icon: 'braces',
  keywords: [
    'json formatter',
    'json validator',
    'json beautifier',
    'json pretty print',
    'json minifier',
    'json viewer',
    'json tree view',
    'format json online',
    'validate json',
    'json lint',
    'fix json',
    'json editor online',
  ],
  intro: [
    'JSON (JavaScript Object Notation) is the lingua franca of APIs, configuration files and data exchange. It is easy for machines to parse but unforgiving of human mistakes: one trailing comma or a single-quoted string and the whole document is rejected. This formatter validates your JSON as you type, pinpoints the exact line and column of any error, and explains the likely cause.',
    'Once the JSON is valid you can pretty-print it with 2 spaces, 4 spaces or tabs, sort object keys alphabetically at every level, minify it for transport, or switch to a tree view to fold and unfold nested objects and arrays. If you paste JavaScript-style data — comments, trailing commas, unquoted keys or single quotes — the "Fix common mistakes" button converts it to strict JSON in one click.',
    'Like every Cuisdev tool, this one runs entirely in your browser. Paste API responses with tokens or customer data without worrying: nothing is uploaded, and the tool keeps working offline once the page has loaded.',
  ],
  howTo: [
    'Paste or type JSON into the input editor, or drop a .json file onto the tool. The output updates instantly.',
    'Read the status line: it shows the size, key count and depth for valid JSON, or the line, column and a hint for invalid JSON.',
    'Choose an indent (2 spaces, 4 spaces or tabs), tick Sort keys if you want a canonical order, or press Minify for the smallest output.',
    'Switch the output between Code and Tree to browse nested data, then Copy or Download the result.',
    'If the input is not strict JSON, press Fix common mistakes to strip comments, quote keys and remove trailing commas.',
  ],
  example: {
    input: '{"name":"Ada","langs":["en","fr"],"active":true,"score":9.5}',
    output:
      '{\n  "name": "Ada",\n  "langs": [\n    "en",\n    "fr"\n  ],\n  "active": true,\n  "score": 9.5\n}',
    note: 'Formatting never changes the data — only whitespace (and key order when Sort keys is on).',
  },
  faq: [
    {
      question: 'How do I find the error in my JSON?',
      answer:
        'Paste it here. The status line reports the exact line and column, the editor underlines the position, and a hint explains the most common cause — for example a trailing comma before <code>}</code>, single quotes instead of double quotes, or a comment, none of which JSON allows.',
    },
    {
      question: 'What is the difference between formatting and validating JSON?',
      answer:
        'Validating checks that the text follows the JSON grammar. Formatting (also called beautifying or pretty-printing) re-indents valid JSON so it is readable. This tool does both at once: it validates on every keystroke and formats whenever the input is valid.',
    },
    {
      question: 'Does formatting change my data?',
      answer:
        'No. Formatting only changes whitespace. The one exception is the optional <strong>Sort keys</strong> switch, which reorders object keys alphabetically — the values are untouched, and key order is not significant in JSON anyway.',
    },
    {
      question: 'Can I convert JavaScript objects or JSON5 to JSON?',
      answer:
        'Mostly, yes. <strong>Fix common mistakes</strong> strips <code>//</code> and <code>/* */</code> comments, removes trailing commas, converts single-quoted strings, quotes bare keys and replaces <code>NaN</code>, <code>Infinity</code> and <code>undefined</code> with <code>null</code>. It does not evaluate code, so expressions or functions are not supported.',
    },
    {
      question: 'Why does a large number lose precision?',
      answer:
        'JavaScript stores numbers as 64-bit floats, so integers above 2<sup>53</sup> (about 9 quadrillion) can be rounded when parsed. If your JSON carries such IDs, keep them as strings in the source system. The tool will show the rounded value rather than silently changing your text elsewhere.',
    },
    {
      question: 'Is it safe to paste JSON containing secrets or personal data?',
      answer:
        'Yes. Parsing and formatting happen in your browser with the built-in <code>JSON.parse</code> and <code>JSON.stringify</code> functions. Nothing is sent to a server; you can disconnect from the network and the tool keeps working.',
    },
  ],
  related: [
    'json-to-yaml',
    'json-schema-validator',
    'jsonpath-tester',
    'json-to-csv',
    'json-to-xml',
  ],
  status: 'stable',
  added: '2026-09-06',
};
