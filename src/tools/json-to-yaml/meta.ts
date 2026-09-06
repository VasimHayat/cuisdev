import type { ToolMeta } from '@/tools/_types';

export const meta: ToolMeta = {
  slug: 'json-to-yaml',
  name: 'JSON ↔ YAML Converter',
  shortName: 'JSON ↔ YAML',
  seoTitle: 'JSON to YAML Converter Online — Free',
  tagline:
    'Convert JSON to YAML and YAML back to JSON as you type, with errors pinpointed by line.',
  description:
    'Free online JSON to YAML converter that also turns YAML into JSON. Live conversion, 2 or 4 space indent, minified output, exact error lines. 100% private.',
  category: 'json',
  icon: 'file-code',
  keywords: [
    'json to yaml',
    'yaml to json',
    'json to yaml converter',
    'yaml to json converter',
    'convert json to yaml online',
    'yaml converter',
    'json yaml',
    'yml to json',
    'kubernetes yaml to json',
    'docker compose json to yaml',
  ],
  intro: [
    'JSON and YAML describe the same kind of data — objects, arrays, strings, numbers, booleans and null — but YAML trades braces and quotes for indentation, which makes it the format of choice for Kubernetes manifests, Docker Compose files, GitHub Actions workflows and most application configuration. This converter translates in both directions: paste JSON to get clean, readable YAML, or paste YAML to get valid JSON you can feed to an API or a script.',
    'Conversion happens live as you type. The output uses the YAML 1.2 core schema, so strings such as "yes", "123" or "null" are quoted when they would otherwise change type, long strings are never folded, and multi-line strings become block scalars. Anchors and aliases are resolved, multi-document YAML (separated by ---) becomes a JSON array, and syntax errors are underlined in the editor with the exact line and column. Choose 2- or 4-space indentation and, for JSON output, pretty or minified formatting.',
    'Your data never leaves the page. Parsing and serialising are done by JavaScript running in your browser; there is no upload, no server-side processing and nothing is logged or stored.',
  ],
  howTo: [
    'Choose JSON → YAML or YAML → JSON with the direction switch.',
    'Paste or type into the input editor — the converted output appears as you type, and any syntax error is underlined with its line and column.',
    'Pick 2 or 4 spaces for Indent; when producing JSON, tick Minified JSON for a single-line result.',
    'Click Copy to copy the result, Download to save a .yaml or .json file, or Swap to feed the output back in and convert the other way.',
  ],
  example: {
    input:
      '{\n  "service": "api",\n  "replicas": 3,\n  "ports": [8080, 9090],\n  "image": { "tag": "2.4" }\n}',
    output: 'service: api\nreplicas: 3\nports:\n  - 8080\n  - 9090\nimage:\n  tag: "2.4"',
    note: 'The tag "2.4" is quoted in the YAML because an unquoted 2.4 would be read back as a number, not a string.',
  },
  faq: [
    {
      question: 'Is YAML a superset of JSON?',
      answer:
        'Mostly. YAML 1.2 was designed so that any JSON document is also valid YAML, which is why you can paste JSON into a YAML file and it parses. The reverse is not true: YAML adds comments, anchors, multi-line strings and multiple documents that JSON has no way to express. This tool resolves anchors and drops comments when converting to JSON.',
    },
    {
      question: 'Why are some strings quoted in the YAML output?',
      answer:
        'YAML infers types from unquoted text. A value like <code>123</code>, <code>true</code>, <code>null</code> or one containing <code>: </code> would be read back as a number, boolean, null or a nested map, so the converter quotes those strings to keep them as strings. Everything else is left unquoted for readability.',
    },
    {
      question: 'Do comments survive the conversion?',
      answer:
        'No. JSON has no comment syntax, so YAML comments are removed when converting to JSON. Going the other way there is nothing to preserve — JSON cannot contain comments in the first place.',
    },
    {
      question: 'Can I convert a Kubernetes or Docker Compose YAML file with several documents?',
      answer:
        'Yes. A YAML stream with documents separated by <code>---</code> is converted to a JSON array containing one element per document. A single document produces a single JSON value.',
    },
    {
      question: 'How are dates and special numbers handled?',
      answer:
        'The converter uses the YAML 1.2 core schema, so <code>2024-01-31</code> stays a string rather than becoming a Date. Values that JSON cannot represent, such as <code>.inf</code> or <code>.nan</code>, become <code>null</code> — the same thing <code>JSON.stringify</code> does.',
    },
    {
      question: 'Is my data uploaded anywhere?',
      answer:
        'No. The conversion runs entirely in your browser using the open-source <code>yaml</code> library bundled with the page. You can go offline after the page has loaded and it keeps working.',
    },
  ],
  related: ['json-to-csv', 'json-to-xml'],
  status: 'stable',
  added: '2026-09-06',
};
