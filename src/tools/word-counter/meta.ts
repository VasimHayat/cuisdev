import type { ToolMeta } from '@/tools/_types';

export const meta: ToolMeta = {
  slug: 'word-counter',
  name: 'Word & Character Counter',
  shortName: 'Word Counter',
  seoTitle: 'Word & Character Counter — Free Online',
  tagline: 'Live word, character, sentence and reading-time counts for any text you paste.',
  description:
    'Free online word and character counter. Live counts of words, characters, sentences, paragraphs, reading time and top words — all in your browser.',
  category: 'text',
  icon: 'letter-text',
  keywords: [
    'word counter',
    'character counter',
    'count words online',
    'character count tool',
    'words to minutes',
    'reading time calculator',
    'sentence counter',
    'paragraph counter',
    'word frequency counter',
    'twitter character counter',
  ],
  intro: [
    'Word and character counts decide whether an essay fits the brief, a meta description fits Google, or a post fits a 280-character limit. This counter updates every number as you type: characters with and without spaces, words, unique words, sentences, paragraphs, lines, average word length, the longest word and the size of the text in UTF-8 bytes.',
    'It also answers the questions a plain counter cannot. Reading time is calculated at a speed you choose (200 words per minute by default, 250 for fast readers), speaking time at 130 words per minute for scripts and presentations, and the Top words table shows the ten words you lean on most — with common words such as "the" and "of" filtered out unless you want them. A character-limit row tells you at a glance how much room is left in a Twitter/X post, an SMS, a meta description or a title tag.',
    'Counting uses the browser built-in Intl.Segmenter where available, so text in languages that do not separate words with spaces is counted properly, with a regular-expression fallback everywhere else. Your text never leaves the page — no upload, no storage, no logging.',
  ],
  howTo: [
    'Type or paste your text into the "Text to count" box.',
    'Watch the statistics update live — words, characters, sentences, paragraphs and more.',
    'Set "Reading speed (wpm)" to the pace you want the reading time calculated at.',
    'Untick "Ignore common words" to include words like "the" in the Top words table.',
    'Click Copy stats to put the whole report on your clipboard.',
  ],
  example: {
    input: 'The quick brown fox jumps over the lazy dog.',
    output: 'Words: 9 · Characters: 44 · Sentences: 1 · Reading time (200 wpm): 3 sec',
    note: 'Every statistic recalculates on each keystroke, so there is no button to press.',
  },
  faq: [
    {
      question: 'How is a word counted?',
      answer:
        'A word is a run of letters or digits, so contractions like <code>don’t</code> and hyphenated words like <code>state-of-the-art</code> count as one word each. Where the browser provides <code>Intl.Segmenter</code>, that is used instead, which also handles Chinese, Japanese and Thai text that is not separated by spaces.',
    },
    {
      question: 'How long does it take to read 1,000 words?',
      answer:
        'About 5 minutes at the default 200 words per minute, or 4 minutes at 250 wpm. Reading speed varies with difficulty and familiarity, so change the "Reading speed (wpm)" box to the pace that matches your audience — the reading time updates immediately.',
    },
    {
      question: 'What is the difference between characters with and without spaces?',
      answer:
        'Characters counts every character you can see, including spaces, tabs and line breaks. Characters (no spaces) leaves all whitespace out. Publishers and universities usually mean the with-spaces number; some assignment briefs mean the other one, so both are shown.',
    },
    {
      question: 'Does the character count match Twitter/X or a meta description limit?',
      answer:
        'The limits row compares your character count against Twitter/X (280), SMS (160), meta description (160) and title tag (60) and shows how many characters are left, or how many you are over. Note that X counts links as a fixed length and some emoji as two, so treat its number as a close guide rather than an exact match.',
    },
    {
      question: 'How are sentences and paragraphs counted?',
      answer:
        'A sentence ends at <code>.</code>, <code>!</code>, <code>?</code> or a line break; a paragraph is a block of text separated by a blank line. Abbreviations such as "Dr." can therefore end a sentence early in browsers without <code>Intl.Segmenter</code> — the counts are meant as a good working estimate.',
    },
    {
      question: 'Is my text uploaded anywhere?',
      answer:
        'No. All counting happens in your browser in JavaScript. Nothing is sent to a server, stored or logged, so the tool is safe for drafts, client work and anything confidential.',
    },
  ],
  related: ['case-converter', 'text-diff'],
  status: 'stable',
  added: '2026-09-07',
};
