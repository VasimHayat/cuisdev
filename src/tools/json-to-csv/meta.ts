import type { ToolMeta } from '@/tools/_types';

export const meta: ToolMeta = {
  slug: 'json-to-csv',
  name: 'JSON ↔ CSV Converter',
  shortName: 'JSON ↔ CSV',
  seoTitle: 'JSON to CSV Converter Online — Free',
  tagline:
    'Turn a JSON array into a spreadsheet-ready CSV, or parse CSV back into JSON — live and private.',
  description:
    'Free online JSON to CSV converter that also parses CSV into JSON. Flattens nested objects, picks the delimiter, detects numbers. Runs 100% in your browser.',
  category: 'json',
  icon: 'table',
  keywords: [
    'json to csv',
    'csv to json',
    'json to csv converter',
    'csv to json converter',
    'convert json to csv online',
    'json array to csv',
    'csv to json array',
    'json to excel',
    'nested json to csv',
    'tsv to json',
    'json to tsv',
  ],
  intro: [
    'CSV is the lingua franca of spreadsheets and data imports, while JSON is what APIs and applications speak. This converter bridges the two: paste a JSON array of objects to get a CSV file you can open in Excel, Google Sheets or Numbers, or paste CSV exported from a spreadsheet or database to get a JSON array you can load into code.',
    'Going from JSON to CSV, nested objects are flattened into dot-notation columns such as address.city, arrays are kept as JSON strings so nothing is lost, and columns are ordered by first appearance across every row — even when records have different keys. You choose the delimiter (comma, semicolon, tab or pipe), whether to write a header row and whether to quote every field. Going from CSV to JSON, the delimiter is auto-detected, quoted fields with embedded commas, quotes and line breaks are handled per RFC 4180, and Detect numbers and booleans turns "42" and "true" into real JSON values. Ragged rows and duplicate column names are reported rather than silently dropped.',
    'Nothing is uploaded. Both directions are computed by JavaScript in your browser tab, so customer lists, exports and other sensitive data stay on your machine.',
  ],
  howTo: [
    'Choose JSON → CSV or CSV → JSON with the direction switch.',
    'Paste or type into the input editor. The result appears as you type; the row and column counts are shown under the output.',
    'Pick an Output delimiter and toggle Header row or Quote all fields for CSV output; for JSON output toggle First row is header, Detect numbers and booleans or Minified JSON.',
    'Click Copy to copy the result, Download to save a .csv or .json file, or Swap to feed the output back in and convert the other way.',
  ],
  example: {
    input:
      '[\n  { "id": 1, "name": "Ada", "address": { "city": "London" } },\n  { "id": 2, "name": "Linus, Jr.", "address": { "city": "Helsinki" } }\n]',
    output: 'id,name,address.city\n1,Ada,London\n2,"Linus, Jr.",Helsinki',
    note: 'The nested address object becomes an address.city column, and the name containing a comma is quoted so spreadsheets read it as one cell.',
  },
  faq: [
    {
      question: 'What shape does my JSON need to be?',
      answer:
        'An array of objects, one object per row: <code>[{"name": "Ada"}, {"name": "Linus"}]</code>. If your API wraps the array in an envelope such as <code>{"data": [...]}</code>, the error message tells you which key holds the array so you can paste that instead. A single object can be converted by wrapping it in <code>[ ]</code>.',
    },
    {
      question: 'How are nested objects and arrays converted to CSV?',
      answer:
        'Nested objects are flattened into dot-notation columns, so <code>{"address": {"city": "London"}}</code> becomes a column named <code>address.city</code>. Arrays are written as JSON text inside a single quoted cell, because CSV has no way to represent a list in one column. Null values become empty cells.',
    },
    {
      question: 'Can I convert CSV to JSON without a header row?',
      answer:
        'Yes. Untick <strong>First row is header</strong> and every line becomes an array of strings instead of an object, giving you a JSON array of arrays. Add the header back and each row becomes an object keyed by the column names.',
    },
    {
      question: 'Why are numbers in quotes in the JSON output?',
      answer:
        'CSV has no types — everything is text — so by default values are kept as strings to avoid changing your data (for example turning the ZIP code <code>02134</code> into <code>2134</code>). Tick <strong>Detect numbers and booleans</strong> to convert values that look like numbers or <code>true</code>/<code>false</code>.',
    },
    {
      question: 'Which delimiters are supported and how is one detected?',
      answer:
        'Comma, semicolon, tab and pipe. When converting CSV to JSON with the delimiter set to Auto-detect, the parser samples the first rows and picks the character that produces a consistent number of fields. If detection fails you get a note and a comma is assumed; choose the delimiter explicitly to override it. Excel in many European locales exports with semicolons.',
    },
    {
      question: 'Is my data uploaded anywhere?',
      answer:
        'No. Conversion runs in your browser using the open-source <code>papaparse</code> library bundled with the page. You can go offline after the page has loaded and the tool keeps working.',
    },
  ],
  related: ['json-to-yaml', 'json-to-xml'],
  status: 'stable',
  added: '2026-09-06',
};
