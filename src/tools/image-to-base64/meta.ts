import type { ToolMeta } from '@/tools/_types';

export const meta: ToolMeta = {
  slug: 'image-to-base64',
  name: 'Image to Base64',
  shortName: 'Image → Base64',
  seoTitle: 'Image to Base64 Converter — Free Online',
  tagline: 'Turn an image into a Base64 data URL, HTML, CSS or Markdown snippet — and back again.',
  description:
    'Free image to Base64 converter. Get a data URL plus ready-made HTML, CSS and Markdown snippets, or decode a Base64 string back to a file. Runs in your browser.',
  category: 'images',
  icon: 'file-image',
  keywords: [
    'image to base64',
    'base64 image',
    'png to base64',
    'jpg to base64',
    'base64 to image',
    'data url generator',
    'base64 image decoder',
    'inline image css',
    'svg to data uri',
    'convert image to data url',
  ],
  intro: [
    'A Base64 data URL puts the image itself inside your HTML, CSS, JSON or Markdown, so the page needs one fewer network request. That is genuinely useful for small icons, email signatures, single-file demos and anything that has to work offline.',
    'Drop in one image or a whole batch and you get five ready-to-paste forms of each: the raw Base64 string, the full data URL, an HTML <code>&lt;img&gt;</code> tag with alt text derived from the file name, a CSS <code>background-image</code> declaration and Markdown image syntax. Every snippet has its own Copy button, and the tool warns you when a data URL passes about 100 KB, where inlining starts to cost more than it saves.',
    'The reverse direction works too: paste a data URL or a bare Base64 string and the tool identifies the format from the bytes themselves — not from what the string claims — previews the image and lets you download it as a proper file. Nothing is uploaded either way.',
  ],
  howTo: [
    'Keep the Encode tab selected and drop your images on the drop zone, or click Choose images.',
    'Pick a file in the list to load its snippets, then use Copy next to Base64, Data URL, HTML, CSS or Markdown.',
    'Use Download to save a file’s data URL as a .txt, or Download all for the whole batch.',
    'To go the other way, switch to Decode, paste a data URL or Base64 string, then check the preview and click Download image.',
  ],
  example: {
    input: 'icon.png — 87 bytes, 8 × 8',
    output: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76L…',
    note: 'Base64 always costs about 33% more bytes than the binary it replaces, which is why it only pays off for small images.',
  },
  faq: [
    {
      question: 'When should I inline an image as Base64?',
      answer:
        'For small assets — icons, sprites, tiny logos, an image in an email template or a single-file HTML demo. Inlining removes a request but adds roughly 33% to the byte count, and inlined data cannot be cached separately from the page. Above about 100 KB a normal <code>&lt;img src&gt;</code> is almost always faster.',
    },
    {
      question: 'How do I use a Base64 image in CSS?',
      answer:
        "Copy the CSS snippet, which gives you <code>background-image: url('data:image/png;base64,…');</code>. Paste it into any rule. Because the data URL contains no quotes or spaces, it is safe inside single quotes exactly as generated.",
    },
    {
      question: 'Does converting to Base64 compress the image?',
      answer:
        'No, the opposite. Base64 represents 3 bytes of binary with 4 text characters, so the result is about 33% larger than the original file. Compress or resize the image first if size matters.',
    },
    {
      question: 'How do I convert Base64 back into an image file?',
      answer:
        'Switch to the Decode tab and paste either a full <code>data:</code> URL or just the Base64 characters. The format is detected from the file signature in the decoded bytes, so it is correct even when the data URL says something wrong, and the Download image button saves it with the right extension.',
    },
    {
      question: 'Why does my Base64 string fail to decode?',
      answer:
        'Usually the string was truncated when it was copied, or it picked up characters that are not in the Base64 alphabet. The error message names the offending character and its position. Line breaks and missing <code>=</code> padding are fine — those are handled automatically.',
    },
    {
      question: 'Is my image uploaded anywhere?',
      answer:
        'No. Encoding and decoding happen in your browser with a Base64 implementation that ships in the page. Nothing is transmitted, so it is safe for screenshots and private photos.',
    },
  ],
  related: ['image-compressor', 'image-converter', 'image-resizer', 'base64'],
  status: 'stable',
  added: '2026-09-07',
};
