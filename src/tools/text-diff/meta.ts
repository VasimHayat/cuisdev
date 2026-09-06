import type { ToolMeta } from '@/tools/_types';

export const meta: ToolMeta = {
  slug: 'text-diff',
  name: 'Text Diff Checker',
  shortName: 'Text Diff',
  seoTitle: 'Text Diff Checker Online — Free',
  tagline: 'Compare two texts and see exactly which lines, words or characters changed.',
  description:
    'Free online text diff checker. Compare two blocks of text side by side or inline, highlight added and removed lines, and copy a unified diff. 100% private.',
  category: 'text',
  icon: 'git-compare',
  keywords: [
    'text diff',
    'diff checker',
    'compare two texts',
    'text comparison tool',
    'online diff tool',
    'side by side diff',
    'unified diff',
    'find difference between two files',
    'code diff online',
    'compare text online',
  ],
  intro: [
    'A diff shows what changed between two versions of a text: which lines were added, which were removed and which were edited. Developers use it to review a change before committing it, writers use it to spot edits in a revised draft, and anyone can use it to answer "what is different between these two files?" without reading both line by line.',
    'This checker compares by line, by word or by character. Word and character mode also highlight the exact part of a line that changed, so a one-character typo does not look like a whole rewritten line. You can ignore case and ignore whitespace, switch between a two-column side-by-side view and a unified inline view, swap the two sides, and copy or download the result as a standard unified diff that <code>git apply</code> and <code>patch</code> understand.',
    'Both texts stay in your browser. The comparison runs in JavaScript on your machine — nothing is uploaded, stored or logged, so you can safely diff configuration files, logs or anything else you would not paste into a server-side tool.',
  ],
  howTo: [
    'Paste the old version into Original and the new version into Changed.',
    'Pick how to compare with the "Compare by" menu: Lines, Words or Characters.',
    'Tick Ignore case or Ignore whitespace if formatting-only differences are noise.',
    'Switch between Side by side and Inline to read the result the way you prefer.',
    'Click Copy or Download to save the result as a unified .diff patch.',
  ],
  example: {
    input: 'listen 80;\nproxy_pass http://127.0.0.1:3000;',
    output:
      '-listen 80;\n+listen 443 ssl;\n-proxy_pass http://127.0.0.1:3000;\n+proxy_pass http://127.0.0.1:4000;',
    note: 'Copy produces a unified diff with --- a/original.txt, +++ b/changed.txt and @@ hunk headers.',
  },
  faq: [
    {
      question: 'How do I compare two texts and see the differences?',
      answer:
        'Paste the old version into the Original box and the new version into the Changed box. The differences appear immediately underneath: removed lines are tinted red with a <code>-</code> marker, added lines are tinted green with a <code>+</code> marker, and the stats line counts the additions and deletions.',
    },
    {
      question: 'What is the difference between line, word and character comparison?',
      answer:
        'Lines are always aligned line by line. "Compare by" chooses how a modified line is highlighted inside itself: Lines highlights the whole line, Words highlights only the words that changed, and Characters narrows it down to individual characters — useful for spotting a single changed digit or a typo.',
    },
    {
      question: 'Can I copy the result as a unified diff or patch file?',
      answer:
        'Yes. Copy and Download produce a standard unified diff with <code>--- a/original.txt</code>, <code>+++ b/changed.txt</code> and <code>@@</code> hunk headers with three lines of context — the same format <code>git diff</code> emits, so <code>git apply</code> and <code>patch</code> can consume it.',
    },
    {
      question: 'What do "ignore case" and "ignore whitespace" do?',
      answer:
        'Ignore case treats <code>Value</code> and <code>value</code> as the same line. Ignore whitespace trims each line and collapses runs of spaces and tabs, so re-indenting a file does not show up as a change. Both sides are still displayed exactly as you pasted them.',
    },
    {
      question: 'How large a text can I compare?',
      answer:
        'Line and word comparison accept up to 2,000,000 characters per side; character-by-character comparison is capped at 100,000 characters because it is far more expensive. Very long results are shown 5,000 rows at a time — Copy and Download always contain the complete diff.',
    },
    {
      question: 'Is my text uploaded anywhere?',
      answer:
        'No. The comparison runs entirely in your browser with a JavaScript diff implementation. You can disconnect from the internet after the page loads and the tool keeps working.',
    },
  ],
  related: ['case-converter', 'word-counter'],
  status: 'stable',
  added: '2026-09-07',
};
