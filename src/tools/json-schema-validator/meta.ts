import type { ToolMeta } from '@/tools/_types';

export const meta: ToolMeta = {
  slug: 'json-schema-validator',
  name: 'JSON Schema Validator',
  shortName: 'Schema Validator',
  seoTitle: 'JSON Schema Validator Online — Free',
  tagline:
    'Validate JSON against a JSON Schema (draft-07, 2019-09, 2020-12) and click each error to find it.',
  description:
    'Free online JSON Schema validator. Check JSON against draft-07, 2019-09 or 2020-12 schemas and see every error with its path. Runs 100% in your browser.',
  category: 'json',
  icon: 'shield-check',
  // Ajv compiles every schema with `new Function`; see the note in Tool.astro.
  scriptSources: ["'unsafe-eval'"],
  keywords: [
    'json schema validator',
    'validate json against schema',
    'json schema validator online',
    'json schema checker',
    'json schema tester',
    'ajv validator online',
    'json schema draft 2020-12',
    'json schema draft-07',
    'generate json schema from json',
    'json schema lint',
    'validate json schema online',
  ],
  intro: [
    'JSON Schema is the standard way to describe the shape of a JSON document: which properties exist, which are required, what type each value has, and constraints such as string formats, number ranges, enums and array lengths. APIs, configuration files, OpenAPI specifications and CI pipelines all use it to reject bad data early. This validator lets you paste a schema and a JSON document side by side and instantly see whether the document conforms.',
    'Validation is powered by Ajv, the same library most Node.js frameworks use, so results match what your server will do. The tool picks the right dialect from the $schema keyword (draft 2020-12, 2019-09 or draft-07), validates formats such as email, uri, date-time, uuid and ipv4, and reports every violation at once rather than stopping at the first. Each error shows the JSON Pointer path, a plain-English message and the failing keyword — click it to jump to that value in the data. Schema mistakes (an invalid keyword value, an unresolvable $ref, a broken pattern regex) are reported separately from data errors, and if you only have sample data, Generate from data drafts a starter schema for you.',
    'Everything runs inside your browser. Schemas and documents are compiled and checked locally with JavaScript; nothing is uploaded, logged or stored, so it is safe to validate payloads that contain real customer data or secrets.',
  ],
  howTo: [
    'Paste your JSON Schema into the Schema editor on the left. No schema yet? Paste JSON data on the right and click Generate from data to draft one.',
    'Paste the JSON document you want to check into the JSON data editor. Validation runs as you type and JSON syntax errors are underlined in the editor that contains them.',
    'Read the Results panel: a green Valid banner, or one row per error with its path, message and keyword. Click a row to jump to that key in the JSON data.',
    'Click Copy errors as JSON to share the errors in Ajv’s format, Sample to load a worked example, or Clear to start over.',
  ],
  example: {
    input: `Schema:
{ "type": "object",
  "properties": {
    "email": { "type": "string", "format": "email" },
    "age":   { "type": "integer", "minimum": 13 } },
  "required": ["email"] }

Data:
{ "email": "ada.lovelace", "age": 9 }`,
    output: `/email  must match format "email"  (format)
/age    must be >= 13                (minimum)`,
    note: 'Both problems are reported in one pass. The path is a JSON Pointer into the data; the keyword names the schema rule that failed.',
  },
  faq: [
    {
      question: 'What is JSON Schema?',
      answer:
        'JSON Schema is a vocabulary, written in JSON itself, for describing and validating JSON documents. A schema declares the expected <code>type</code> of each value, which object <code>properties</code> are <code>required</code>, string <code>format</code>s and <code>pattern</code>s, numeric limits such as <code>minimum</code> and <code>maximum</code>, allowed <code>enum</code> values and how arrays are shaped. Validators compare a document against those rules and list every place it deviates.',
    },
    {
      question: 'Which JSON Schema drafts does this validator support?',
      answer:
        'Draft-07, draft 2019-09 and draft 2020-12. The dialect is chosen from the <code>$schema</code> keyword; schemas without one are treated as draft-07. Draft-04 and earlier are not supported by Ajv 8 — remove the <code>$schema</code> line and the schema will usually validate fine as draft-07, since the core keywords are unchanged.',
    },
    {
      question: 'Does it check formats like email, date-time and uri?',
      answer:
        'Yes. The validator loads <code>ajv-formats</code>, so <code>email</code>, <code>uri</code>, <code>date</code>, <code>time</code>, <code>date-time</code>, <code>uuid</code>, <code>ipv4</code>, <code>ipv6</code>, <code>hostname</code>, <code>regex</code> and the other standard formats are enforced. Unknown format names are ignored rather than treated as errors, matching Ajv with <code>strict: false</code>.',
    },
    {
      question: 'What does “must have required property” mean?',
      answer:
        'The object at the reported path is missing a key that the schema lists in its <code>required</code> array. The error path points at the object, not the missing key, because the key does not exist in the data; the missing property name is in the error’s <code>params.missingProperty</code>, which you can see with Copy errors as JSON.',
    },
    {
      question: 'Can I generate a JSON Schema from a JSON example?',
      answer:
        'Yes. Paste the JSON into the data editor and click <strong>Generate from data</strong>. The tool infers a draft 2020-12 schema: primitive types (<code>integer</code> vs <code>number</code>), nested objects with every key marked <code>required</code>, and arrays typed from their first element. Treat it as a starting point — relax <code>required</code>, add <code>format</code>s and limits, and it becomes a real contract.',
    },
    {
      question: 'Is my schema or data uploaded anywhere?',
      answer:
        'No. Ajv runs entirely in your browser; the page makes no network requests with your input and the site’s Content Security Policy blocks connections to other origins. You can load the page, go offline and keep validating.',
    },
  ],
  related: ['jsonpath-tester', 'base64'],
  status: 'stable',
  added: '2026-09-06',
};
