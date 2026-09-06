import type { ToolMeta } from '@/tools/_types';

export const meta: ToolMeta = {
  slug: 'json-to-xml',
  name: 'JSON ↔ XML Converter',
  shortName: 'JSON ↔ XML',
  seoTitle: 'JSON to XML Converter Online — Free',
  tagline:
    'Convert JSON to well-formed XML and XML back to JSON, with attributes, live and in your browser.',
  description:
    'Free online JSON to XML converter that also parses XML into JSON. Set the root element, indent and attribute prefix; errors show line and column. 100% private.',
  category: 'json',
  icon: 'code',
  keywords: [
    'json to xml',
    'xml to json',
    'json to xml converter',
    'xml to json converter',
    'convert json to xml online',
    'xml converter',
    'json xml',
    'xml to json online',
    'xml validator',
    'xml attributes to json',
  ],
  intro: [
    'XML is still everywhere — SOAP services, RSS and Atom feeds, Maven and Android build files, sitemaps, invoices — while modern APIs and front-ends speak JSON. This converter translates in both directions: paste JSON to get well-formed, indented XML wrapped in a root element of your choosing, or paste XML to get a JSON object you can work with in JavaScript, Python or any other language.',
    'Attributes are the part most converters get wrong, so they are explicit here. Keys that start with the attribute prefix (@_ by default) become XML attributes and #text holds the text of an element that also has attributes, following the widely used fast-xml-parser convention so a document survives a round trip. Arrays repeat the element, arrays of arrays are wrapped in item, special characters are escaped and the XML declaration is optional. Going the other way, the XML is validated first and syntax errors are underlined with the exact line and column; you can drop attributes, keep every value as a string or let numbers and booleans become real JSON types, and choose pretty or minified output.',
    'Nothing is uploaded. Validation, parsing and building all run in your browser tab, so configuration files and business documents stay on your machine.',
  ],
  howTo: [
    'Choose JSON → XML or XML → JSON with the direction switch.',
    'Paste or type into the input editor. The result appears as you type and any syntax error is underlined with its line and column.',
    'For XML output, set the Root element name, Indent, Attribute prefix and whether to include the XML declaration. For JSON output, toggle Ignore attributes, Parse numbers and booleans or Minified JSON.',
    'Click Copy to copy the result, Download to save a .xml or .json file, or Swap to feed the output back in and convert the other way.',
  ],
  example: {
    input:
      '{\n  "book": {\n    "@_id": "bk101",\n    "title": "Dune",\n    "tags": ["sci-fi", "classic"]\n  }\n}',
    output:
      '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n  <book id="bk101">\n    <title>Dune</title>\n    <tags>sci-fi</tags>\n    <tags>classic</tags>\n  </book>\n</root>',
    note: 'The @_id key became an attribute, and the tags array became two repeated <tags> elements.',
  },
  faq: [
    {
      question: 'How do I make a JSON key an XML attribute?',
      answer:
        'Prefix the key with the attribute prefix, which is <code>@_</code> by default: <code>{"book": {"@_id": "1", "title": "Dune"}}</code> becomes <code>&lt;book id="1"&gt;&lt;title&gt;Dune&lt;/title&gt;&lt;/book&gt;</code>. When an element needs both attributes and text, put the text under the <code>#text</code> key. You can change the prefix or clear it to disable attribute handling.',
    },
    {
      question: 'How are JSON arrays converted to XML?',
      answer:
        'An array repeats its parent element once per item, so <code>{"tag": ["a", "b"]}</code> becomes <code>&lt;tag&gt;a&lt;/tag&gt;&lt;tag&gt;b&lt;/tag&gt;</code>. A top-level array, or an array nested directly inside another array, has no element name of its own, so each entry is wrapped in <code>&lt;item&gt;</code>.',
    },
    {
      question: 'Why does XML to JSON turn a single element into an object instead of an array?',
      answer:
        'XML has no way to say "this is a list", so a lone <code>&lt;book&gt;</code> element is parsed as an object while two or more <code>&lt;book&gt;</code> siblings become an array. This is the behaviour of nearly every XML-to-JSON mapping; if your code expects an array, check the type or normalise it after parsing.',
    },
    {
      question: 'Why is my root element name rejected?',
      answer:
        'XML element names must start with a letter or underscore, may contain letters, digits, hyphens, periods and underscores, cannot contain spaces and cannot start with the letters <code>xml</code> in any case. The same rules apply to your JSON keys — a key such as <code>"first name"</code> cannot become an element, and the error message tells you which key and where.',
    },
    {
      question: 'Does the converter preserve comments, namespaces or the DOCTYPE?',
      answer:
        'Comments, processing instructions and the DOCTYPE are dropped when converting XML to JSON because JSON cannot represent them. Namespaced names like <code>soap:Envelope</code> are kept as ordinary keys containing the colon, and namespace declarations appear as <code>@_xmlns:soap</code> attributes.',
    },
    {
      question: 'Is my data uploaded anywhere?',
      answer:
        'No. Validation, parsing and building run in your browser using the open-source <code>fast-xml-parser</code> library bundled with the page. You can go offline after the page has loaded and the tool keeps working.',
    },
  ],
  related: ['json-to-yaml', 'json-to-csv'],
  status: 'stable',
  added: '2026-09-06',
};
