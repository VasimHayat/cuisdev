import type { ToolMeta } from '@/tools/_types';

export const meta: ToolMeta = {
  slug: 'code-formatter',
  name: 'Code Formatter & Minifier',
  shortName: 'Code Formatter',
  seoTitle: 'Code Formatter & Minifier — Free',
  tagline:
    'Beautify or minify HTML, CSS, SCSS, JavaScript, TypeScript and JSON — entirely in your browser.',
  description:
    'Free online code formatter and minifier for HTML, CSS, SCSS, JavaScript, TypeScript and JSON. Prettier and terser run in your browser — nothing is uploaded.',
  category: 'web',
  icon: 'code',
  keywords: [
    'code formatter',
    'code beautifier',
    'code minifier',
    'javascript formatter',
    'javascript minifier',
    'css minifier',
    'html minifier',
    'typescript formatter',
    'scss formatter',
    'prettier online',
    'beautify javascript online',
    'minify css online',
  ],
  intro: [
    'Badly indented code is hard to review and minified code is impossible to read. This tool does both jobs in one place: paste HTML, CSS, SCSS, JavaScript, TypeScript or JSON, pick Beautify to pretty-print it or Minify to squeeze it down, and the result appears as you type.',
    'Beautifying uses Prettier, the same formatter most editors run on save, so the output matches what your project would produce: choose 2 spaces, 4 spaces or tabs, a print width of 80, 100 or 120 columns, single or double quotes, and whether to keep semicolons and trailing commas. Minifying uses terser for JavaScript, csso for CSS, and a careful whitespace pass for HTML that leaves the contents of pre, textarea, script and style untouched. Syntax errors are reported with the exact line and column and underlined in the editor.',
    'Everything runs in your browser. Prettier and the minifiers are downloaded on demand the first time you use them and then keep working offline; your code is never sent to a server, so it is safe to paste proprietary source or configuration that contains keys.',
  ],
  howTo: [
    'Choose the language — HTML, CSS, SCSS, JavaScript, TypeScript or JSON.',
    'Pick Beautify to pretty-print the code or Minify to shrink it.',
    'Paste your code into the Code input pane, or press Sample to load an example.',
    'Adjust Indent, Print width, Single quotes, Semicolons and Trailing commas to match your project style.',
    'Press Copy to take the result, or Download to save it with the right file extension.',
  ],
  example: {
    input: 'const a={b:1,c:[1,2]}',
    output: 'const a = { b: 1, c: [1, 2] };',
    note: 'Beautified as JavaScript with a 2-space indent, double quotes and semicolons.',
  },
  faq: [
    {
      question: 'Which formatter does this tool use?',
      answer:
        'Beautifying uses Prettier 3 running in your browser with the official parsers for HTML, PostCSS (CSS and SCSS), Babel (JavaScript and JSON) and TypeScript. The output is the same as running <code>prettier</code> on the command line with the same options.',
    },
    {
      question: 'How is the code minified?',
      answer:
        'JavaScript is minified with terser, which renames local variables and removes dead code. CSS is minified with csso, which also merges duplicate rules. HTML minification strips comments and whitespace-only gaps between tags. JSON is re-serialised with <code>JSON.stringify</code>.',
    },
    {
      question: 'Why can I not minify TypeScript or SCSS?',
      answer:
        'Neither runs in a browser as-is: TypeScript has to be compiled to JavaScript and SCSS has to be compiled to CSS before a minifier can safely touch it. Compile first, then paste the JavaScript or CSS output here. The Minify option is disabled for those two languages rather than producing something misleading.',
    },
    {
      question: 'Does minifying HTML break my page?',
      answer:
        'It should not. Whitespace inside <code>pre</code>, <code>textarea</code>, <code>script</code> and <code>style</code> is copied byte for byte, conditional comments are kept, and a single space is preserved wherever text sits next to a tag. What gets removed are the whitespace-only gaps between tags that your editor adds as indentation.',
    },
    {
      question: 'Where do the error line and column come from?',
      answer:
        'From the parser itself. Prettier and terser report the position of the first syntax error; the tool repeats it in the status line and underlines it in the input editor, so you can jump straight to the problem instead of hunting for it.',
    },
    {
      question: 'Is my code uploaded anywhere?',
      answer:
        'No. Prettier, terser and csso are downloaded once as static files and then run locally on your machine. Your code never leaves the tab, and the tool keeps working with the network disconnected.',
    },
  ],
  related: ['sql-formatter'],
  status: 'stable',
  added: '2026-09-07',
};
