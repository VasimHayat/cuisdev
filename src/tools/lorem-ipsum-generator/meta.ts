import type { ToolMeta } from '@/tools/_types';

export const meta: ToolMeta = {
  slug: 'lorem-ipsum-generator',
  name: 'Lorem Ipsum Generator',
  shortName: 'Lorem Ipsum',
  seoTitle: 'Lorem Ipsum Generator — Free Placeholder Text',
  tagline:
    'Generate paragraphs, sentences or words of placeholder text as plain text, HTML, Markdown or JSON.',
  description:
    'Free lorem ipsum generator. Create placeholder text by paragraphs, sentences or words and copy it as plain text, HTML, Markdown or JSON — all in your browser.',
  category: 'generators',
  icon: 'file-text',
  keywords: [
    'lorem ipsum generator',
    'lorem ipsum',
    'placeholder text generator',
    'dummy text generator',
    'lorem ipsum paragraphs',
    'lorem ipsum html',
    'lorem ipsum json',
    'filler text',
    'random text generator',
    'lorem ipsum words',
    'lipsum',
  ],
  intro: [
    'Lorem ipsum is the scrambled Latin that designers and developers have used as filler since the 1500s. It looks like real prose — normal word lengths, sentence rhythm, punctuation — without saying anything, so people judge a layout instead of reading the copy. This lorem ipsum generator produces as much or as little of it as you need: 1 to 100 paragraphs, sentences or words.',
    'Choose the output format that drops straight into your work. Plain text for design tools and documents, HTML <p> tags for templates and CMS fixtures, Markdown for docs and READMEs, or a JSON array of strings for seeding databases, mock APIs and unit tests. Sentences are 6–14 words with natural commas and paragraphs are 4–8 sentences, drawn from a vocabulary of about 200 classic words, so the text never looks repetitive. Tick the option to open with the familiar "Lorem ipsum dolor sit amet…" or leave it off for fully random filler.',
    'Generation happens entirely in your browser with a tiny seeded random number generator — there is no server call, no account and nothing is logged. Regenerate as many times as you like and download the result with the right file extension for the format you chose.',
  ],
  howTo: [
    'Choose whether to generate paragraphs, sentences or words, and set the count (1–100).',
    'Pick a format: plain text, HTML <p> tags, Markdown or a JSON array. The text updates instantly.',
    'Untick "Start with Lorem ipsum dolor sit amet…" if you want fully random filler.',
    'Click Regenerate for a fresh variation, then Copy or Download the result.',
  ],
  example: {
    input: '2 sentences · Plain text · Start with "Lorem ipsum…"',
    output:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Erat suscipit netus aute hac qui mauris tempus facilisis cupidatat tristique.',
    note: 'The first sentence is the classic opening; everything after it is generated from the lorem ipsum vocabulary.',
  },
  faq: [
    {
      question: 'What does lorem ipsum mean?',
      answer:
        'Nothing coherent. It is a scrambled excerpt from Cicero\'s <em>De finibus bonorum et malorum</em> (45 BC) with words cut, swapped and altered, so it is not readable Latin. The opening "Lorem ipsum dolor sit amet" comes from a fragment of "dolorem ipsum" — "pain itself".',
    },
    {
      question: 'Why use lorem ipsum instead of real text?',
      answer:
        'Placeholder text lets reviewers focus on layout, typography and spacing instead of the wording. Because it has a realistic distribution of word and sentence lengths, it previews how real copy will flow through a design without the distraction of meaningful content or the risk of shipping draft copy.',
    },
    {
      question: 'Can I generate lorem ipsum as HTML paragraphs?',
      answer:
        'Yes. Choose the HTML format and each paragraph is wrapped in a <code>&lt;p&gt;</code> tag, one per line, ready to paste into a template or CMS. Sentences and words are wrapped in a single <code>&lt;p&gt;</code>.',
    },
    {
      question: 'What is the JSON format for?',
      answer:
        'It outputs a JSON array of strings — one per paragraph, sentence or word — for seeding databases, mock API responses, fixtures and unit tests. Download it as a <code>.json</code> file or copy it straight into your code.',
    },
    {
      question: 'How many paragraphs can I generate at once?',
      answer:
        'Up to 100 paragraphs, sentences or words per run. That is roughly 7,000 words of paragraphs, which is more than enough for a long article layout. If you need more, generate again and append — every run is a fresh variation.',
    },
    {
      question: 'Is the text random every time?',
      answer:
        'Yes. Each click of Regenerate uses a new random seed, so sentence lengths, word choice and comma placement change. Changing the unit, count or format keeps the current seed so you can compare formats of the same text. The optional classic opening sentence is always the same.',
    },
  ],
  related: ['qr-code-generator', 'base64'],
  status: 'stable',
  added: '2026-09-06',
};
