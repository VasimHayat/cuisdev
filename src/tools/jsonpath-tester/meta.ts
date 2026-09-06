import type { ToolMeta } from '@/tools/_types';

export const meta: ToolMeta = {
  slug: 'jsonpath-tester',
  name: 'JSONPath Tester',
  shortName: 'JSONPath',
  seoTitle: 'JSONPath Tester & Evaluator Online — Free',
  tagline:
    'Test JSONPath expressions against your JSON and see the matching values, paths or pointers live.',
  description:
    'Free online JSONPath tester. Evaluate JSONPath queries against JSON data and get matching values, paths or JSON Pointers as you type. Runs 100% in your browser.',
  category: 'json',
  icon: 'filter',
  keywords: [
    'jsonpath tester',
    'jsonpath evaluator',
    'jsonpath online',
    'json path finder',
    'test jsonpath expression',
    'jsonpath query',
    'jsonpath filter expression',
    'jsonpath syntax',
    'json query tool',
    'jsonpath examples',
  ],
  intro: [
    'JSONPath is a query language for JSON, the equivalent of XPath for XML. An expression such as $.store.book[?(@.price < 10)].title walks into a document, filters array items and returns the pieces you care about. It is used in Kubernetes kubectl output formatting, Postman and Insomnia tests, AWS Step Functions, Argo Workflows, Grafana, Ansible and countless ETL scripts — and it is notoriously fiddly to get right without a live playground.',
    "This tester evaluates your expression on every keystroke using jsonpath-plus, the widely used JavaScript implementation, so you can iterate until the result is exactly what you expect. Switch the result type between Values (the matched data), Paths (the normalised location of each match, like $['store']['book'][0]['title']) and Pointers (RFC 6901 JSON Pointers, like /store/book/0/title). The match count is shown under the result, syntax problems such as an unclosed bracket or a malformed filter are explained in plain language, and JSON parse errors are underlined in the input. The FAQ below doubles as a syntax cheat-sheet.",
    'Your JSON never leaves the page. Parsing and querying happen in your browser with no server round-trip, so you can safely paste production API responses, logs or exports.',
  ],
  howTo: [
    'Paste your JSON document into the JSON input editor, or click Sample to load the classic bookstore example.',
    'Type a query in the JSONPath expression field — start with $ for the root, for example $.store.book[*].author. The result updates as you type.',
    'Switch the result type between Values, Paths and Pointers to see the matched values, their normalised JSONPath locations or RFC 6901 JSON Pointers.',
    'Check the match count under the result, then click Copy to copy the result array or Download to save it as a .json file.',
  ],
  example: {
    input: `$.store.book[?(@.price < 10)].title

applied to the bookstore sample, whose four books cost
8.95, 12.99, 8.99 and 22.99`,
    output: `[
  "Sayings of the Century",
  "Moby Dick"
]`,
    note: 'The filter [?(@.price < 10)] keeps only books whose price is below 10; .title then selects one property from each match. The result is always a JSON array, even for a single match.',
  },
  faq: [
    {
      question: 'What is JSONPath?',
      answer:
        'JSONPath is a query language for selecting parts of a JSON document, proposed by Stefan Gössner in 2007 and standardised in 2024 as RFC 9535. An expression starts at the root (<code>$</code>) and chains selectors — property names, array indexes, wildcards, slices and filters — to describe which values to return. Unlike a JSON Pointer, which addresses exactly one location, a JSONPath can match many values at once.',
    },
    {
      question: 'JSONPath syntax cheat-sheet: what do $, @, .., * and [?()] mean?',
      answer:
        "<code>$</code> is the root object, <code>@</code> is the current item inside a filter. <code>.name</code> or <code>['name']</code> selects a child property; <code>..name</code> is recursive descent (find <code>name</code> at any depth); <code>*</code> matches every child (<code>$.store.*</code>, <code>$.book[*]</code>). Array selectors: <code>[0]</code> index, <code>[-1]</code> last item, <code>[0,2]</code> union, <code>[1:3]</code> slice from 1 up to (not including) 3, <code>[-2:]</code> last two. Filters: <code>[?(@.price &lt; 10)]</code> keeps items where the expression is true, <code>[?(@.isbn)]</code> keeps items that have a property. jsonpath-plus additionally offers <code>^</code> (grandparent), <code>~</code> (property name of a match) and type selectors such as <code>@string()</code>, <code>@number()</code> and <code>@array()</code>.",
    },
    {
      question: 'How do I filter by a value in JSONPath?',
      answer:
        'Use a filter selector: <code>$.items[?(@.status == "active")]</code> keeps array items whose <code>status</code> is <code>active</code>; <code>$.items[?(@.price &gt;= 10 &amp;&amp; @.price &lt; 50)]</code> combines conditions with <code>&amp;&amp;</code> and <code>||</code>. Inside the parentheses <code>@</code> refers to the item being tested. To return a single field from each match, append it after the filter: <code>$.items[?(@.status == "active")].id</code>.',
    },
    {
      question: 'What is the difference between values, paths and pointers?',
      answer:
        "<strong>Values</strong> are the matched pieces of data themselves. <strong>Paths</strong> are the normalised JSONPath of each match, such as <code>$['store']['book'][0]['title']</code>, which is handy for understanding what a wildcard or recursive query actually hit. <strong>Pointers</strong> are the same locations as RFC 6901 JSON Pointers (<code>/store/book/0/title</code>), the format used by JSON Patch, JSON Schema error paths and many APIs.",
    },
    {
      question: 'Why does my JSONPath return no results?',
      answer:
        'Usually one of four things: a property name is misspelt or has different casing; you used <code>.</code> on an array when you needed <code>[*]</code> or an index (<code>$.books.title</code> should be <code>$.books[*].title</code>); a filter compares a number with a quoted string (<code>@.price == "10"</code> is not <code>@.price == 10</code>); or the value lives deeper than expected, in which case <code>$..title</code> will show you where it is. An empty result is not an error — the expression was valid but matched nothing.',
    },
    {
      question: 'Which JSONPath implementation is used, and does it match RFC 9535?',
      answer:
        'The tool uses <a href="https://github.com/JSONPath-Plus/JSONPath" rel="noopener">jsonpath-plus</a> in its safe evaluation mode, which follows the original Gössner syntax and adds a few extensions. It agrees with RFC 9535 for the common cases — child, descendant, wildcard, index, slice and comparison filters — but the RFC uses <code>?</code> without parentheses and defines some edge cases differently, so double-check exotic expressions against the library your production code uses.',
    },
    {
      question: 'Is my JSON uploaded anywhere?',
      answer:
        'No. The document is parsed and queried in your browser with JavaScript; the page makes no network requests with your data and the site’s Content Security Policy blocks connections to other origins. You can go offline after the page loads and keep working.',
    },
  ],
  related: ['json-schema-validator', 'base64'],
  status: 'stable',
  added: '2026-09-06',
};
