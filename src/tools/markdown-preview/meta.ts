import type { ToolMeta } from '@/tools/_types';

export const meta: ToolMeta = {
  slug: 'markdown-preview',
  name: 'Markdown Preview & Editor',
  shortName: 'Markdown',
  seoTitle: 'Markdown Preview & Editor — Live, Free',
  tagline: 'Write Markdown on the left, see the rendered result on the right, export HTML or .md.',
  description:
    'Free online Markdown editor with live preview. GitHub Flavored Markdown, sanitised HTML output and one-click export — all rendered inside your browser.',
  category: 'text',
  icon: 'file-text',
  keywords: [
    'markdown preview',
    'markdown editor online',
    'markdown to html',
    'live markdown preview',
    'github flavored markdown',
    'markdown viewer',
    'readme preview',
    'markdown table preview',
    'markdown html converter',
    'online markdown editor free',
  ],
  intro: [
    'Markdown is the plain-text format behind README files, issue trackers, static site generators and most developer documentation. This editor renders it as you type: Markdown on the left, the finished page on the right, with the exact HTML one click away.',
    'It supports GitHub Flavored Markdown — tables, task lists, strikethrough and automatic links — and a Line breaks option for the "one newline is a <br>" style that chat apps and many wikis use. The rendered HTML is passed through DOMPurify before it reaches the page, so scripts, inline event handlers, javascript: URLs and style attributes are removed; links are given rel="noopener noreferrer" and open in a new tab. You can copy the sanitised HTML, download it as a standalone styled .html file, or save your Markdown back as .md.',
    'Nothing is uploaded. The renderer and the sanitiser both run in your browser, so drafts, release notes and internal documentation stay on your machine.',
  ],
  howTo: [
    'Type or paste Markdown into the left-hand editor — the preview updates as you type.',
    'Toggle GitHub Flavored Markdown for tables, task lists and strikethrough, or Line breaks to turn every newline into a line break.',
    'Switch Show to HTML source to read the sanitised HTML behind the preview.',
    'Use Copy HTML, .html to download a standalone styled page, or .md to save the Markdown itself.',
  ],
  example: {
    input:
      '## Checklist\n\n- [x] Write the document\n- [ ] Ship it\n\n| Element | Markdown |\n| ------- | -------- |\n| Bold    | `**b**`  |',
    output:
      '<h2>Checklist</h2>\n<ul>\n<li><input checked disabled type="checkbox"> Write the document</li>\n<li><input disabled type="checkbox"> Ship it</li>\n</ul>\n<table>…</table>',
    note: 'Task lists and tables need GitHub Flavored Markdown, which is on by default. Turn it off to render strict CommonMark instead.',
  },
  faq: [
    {
      question: 'Which Markdown flavour does the preview use?',
      answer:
        'CommonMark via the <code>marked</code> parser, with the GitHub Flavored Markdown extensions switched on by default: tables, task lists, strikethrough and autolinked URLs. Untick <strong>GitHub Flavored Markdown</strong> to render strict CommonMark, which is what some static site generators and older renderers expect.',
    },
    {
      question: 'What does the Line breaks option change?',
      answer:
        'In standard Markdown a single newline is just a space — you need two trailing spaces or a blank line to break a line. With <strong>Line breaks</strong> ticked, every newline becomes a <code>&lt;br&gt;</code>, which matches how GitHub comments, Slack and most wikis behave.',
    },
    {
      question: 'Is raw HTML inside my Markdown rendered?',
      answer:
        'Yes, but only after it is sanitised. Markdown allows inline HTML, so the output is passed through DOMPurify: <code>&lt;script&gt;</code>, <code>&lt;iframe&gt;</code>, event-handler attributes such as <code>onerror</code>, <code>style</code> attributes and <code>javascript:</code> URLs are stripped. Ordinary formatting tags, images and links survive, and links get <code>rel="noopener noreferrer"</code>.',
    },
    {
      question: 'Can I export the result?',
      answer:
        'Three ways: <strong>Copy HTML</strong> puts the sanitised markup on your clipboard, <strong>.html</strong> downloads a standalone page with a small built-in stylesheet that opens correctly in any browser, and <strong>.md</strong> saves the Markdown source itself. Files are named after the document’s first heading.',
    },
    {
      question: 'Why does my table or task list not render?',
      answer:
        'Both are GitHub Flavored Markdown extensions, so make sure that option is ticked. A table also needs the separator row (<code>| --- | --- |</code>) directly under the header, and a task list item must start with <code>- [ ]</code> or <code>- [x]</code>, including the space inside the brackets.',
    },
    {
      question: 'Is my document uploaded anywhere?',
      answer:
        'No. Parsing, sanitising and rendering all happen in this tab, and the downloads are generated in the browser. You can go offline after the page loads and keep working.',
    },
  ],
  related: ['regex-tester'],
  status: 'stable',
  added: '2026-09-07',
};
