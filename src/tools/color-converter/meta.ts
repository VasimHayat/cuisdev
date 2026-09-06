import type { ToolMeta } from '@/tools/_types';

export const meta: ToolMeta = {
  slug: 'color-converter',
  name: 'Color Converter',
  shortName: 'Color',
  seoTitle: 'Color Converter — HEX, RGB, HSL, OKLCH',
  tagline: 'Convert any CSS color between HEX, RGB, HSL, HWB, LAB, LCH, OKLCH and CMYK.',
  description:
    'Free online color converter for HEX, RGB, HSL, HWB, LAB, LCH, OKLAB, OKLCH and CMYK, with a WCAG contrast checker. Runs entirely in your browser.',
  category: 'web',
  icon: 'palette',
  keywords: [
    'color converter',
    'hex to rgb',
    'rgb to hex',
    'hex to hsl',
    'rgb to cmyk',
    'oklch converter',
    'css color converter',
    'color contrast checker',
    'wcag contrast ratio',
    'color shades and tints',
  ],
  intro: [
    'Paste any CSS color — a hex value, rgb(), hsl(), hwb(), lab(), lch(), oklab(), oklch() or a named color like tomato — and this converter shows the same color in every other notation at once. Each row has its own Copy button, so moving a brand color from a design file into CSS, a Tailwind config, a print spec or a native app takes one click.',
    'It also does the parts of color work that usually need a second tool: a live preview swatch that respects alpha, the nearest CSS named color by CIEDE2000 perceptual distance, a five-step lighter and five-step darker OKLCH scale for building a palette, and a WCAG contrast checker that grades text against a background for AA and AAA at both normal and large sizes.',
    'There is no upload and no API call. Parsing and conversion run in your browser with culori, so the colors you are working on never leave your machine — you can use it on unreleased brand work with the network disconnected.',
  ],
  howTo: [
    'Type or paste a color into the CSS color box, or pick one with the Picker swatch.',
    'Read the converted values in the Formats table and click Copy on the row you need.',
    'Use the Shades & tints row to copy a lighter or darker step of the same color.',
    'Set Text color and Background color in the contrast checker to see the WCAG ratio and AA/AAA results.',
  ],
  example: {
    input: '#3b82f6',
    output: 'rgb(59, 130, 246) · hsl(217.22, 91.22%, 59.8%) · oklch(0.6231 0.188 259.81)',
    note: 'The nearest CSS named color to #3b82f6 is dodgerblue, and CMYK works out at cmyk(76%, 47.2%, 0%, 3.5%).',
  },
  faq: [
    {
      question: 'How do I convert HEX to RGB?',
      answer:
        'Paste the hex value — with or without the leading <code>#</code> — into the CSS color box. The RGB row shows the same color as <code>rgb(59, 130, 246)</code>, and the RGBA row adds the alpha channel. Three-, four-, six- and eight-digit hex values are all accepted.',
    },
    {
      question: 'What is OKLCH and why would I use it instead of HSL?',
      answer:
        'OKLCH is a perceptually uniform color space now supported in every major browser. Unlike HSL, changing only its lightness keeps the perceived hue and saturation stable, which is why the shades and tints on this page are generated in OKLCH — the steps look evenly spaced instead of washing out.',
    },
    {
      question: 'Is the CMYK value print-accurate?',
      answer:
        'It is the standard naive conversion from sRGB, the same one browsers, CSS tooling and most design apps show. Real print output depends on an ICC profile for the specific paper and press, so treat CMYK here as a starting point and always confirm with your printer’s profile.',
    },
    {
      question: 'What contrast ratio do I need to pass WCAG?',
      answer:
        'WCAG 2.2 asks for at least <strong>4.5:1</strong> for normal text and <strong>3:1</strong> for large text (18pt, or 14pt bold) at level AA. Level AAA raises those to 7:1 and 4.5:1. The checker grades all four at once and rounds the ratio down, so it never overstates your contrast.',
    },
    {
      question: 'Why does my oklch() or lab() color come back clamped?',
      answer:
        'Those spaces can describe colors outside the sRGB gamut that no hex value can represent. When that happens the tool says the color is outside sRGB and the HEX, RGB and CMYK rows show the closest sRGB color instead — the LAB, LCH and OKLCH rows keep the exact original values.',
    },
    {
      question: 'Is my color data sent anywhere?',
      answer:
        'No. Every conversion happens in your browser; nothing is uploaded, logged or stored. The page keeps working with the network disconnected once it has loaded.',
    },
  ],
  related: ['number-base-converter'],
  status: 'stable',
  added: '2026-09-07',
};
