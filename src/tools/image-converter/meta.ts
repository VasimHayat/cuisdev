import type { ToolMeta } from '@/tools/_types';

export const meta: ToolMeta = {
  slug: 'image-converter',
  name: 'Image Format Converter',
  shortName: 'Convert Image',
  seoTitle: 'Image Converter — PNG, JPEG, WebP, AVIF',
  tagline: 'Convert images between PNG, JPEG, WebP and AVIF without uploading a single byte.',
  description:
    'Free online image converter. Change PNG, JPEG, WebP, AVIF, GIF, BMP, ICO and SVG files into the format you need, in batches, entirely in your browser.',
  category: 'images',
  icon: 'refresh-cw',
  keywords: [
    'image converter',
    'png to jpg',
    'jpg to png',
    'webp converter',
    'convert to webp',
    'avif converter',
    'svg to png',
    'heic alternative converter',
    'batch image conversion',
    'change image format online',
  ],
  intro: [
    'Different jobs need different image formats: PNG for screenshots and transparency, JPEG for photographs and old software, WebP and AVIF for fast web pages. This converter reads PNG, JPEG, WebP, AVIF, GIF, BMP, ICO and SVG files and re-encodes them into whichever of those formats your browser can write.',
    'Vector and animated inputs are rasterised through a canvas, so an SVG becomes a real bitmap and a GIF becomes its first frame. When you convert something with transparency to JPEG — which has no alpha channel — you choose the colour the transparent pixels are flattened onto, instead of getting the black background most converters leave behind. Lossy targets get a quality slider, and AVIF only appears in the list when your browser can actually encode it.',
    'Conversion runs on the canvas APIs in your own browser. Files are never uploaded, so confidential mock-ups, screenshots and personal photos stay on your machine.',
  ],
  howTo: [
    'Drop your images onto the drop zone, or click Choose images.',
    'Pick the format you want under Convert to.',
    'For JPEG, WebP or AVIF, set the Quality slider; for JPEG also pick the Background colour used behind transparent pixels.',
    'Download each converted file, or use Download all to save the whole batch.',
  ],
  example: {
    input: 'logo.png — 248 KB, 512 × 512, transparent background',
    output: 'logo.webp — 31 KB, 512 × 512 (transparency preserved)',
    note: 'Converting the same logo to JPEG would flatten the transparent pixels onto the background colour you choose.',
  },
  faq: [
    {
      question: 'How do I convert PNG to JPG without a black background?',
      answer:
        'Transparent PNG pixels have no colour, and JPEG cannot store transparency, so a converter has to fill them in — many default to black. Set the <strong>Background colour</strong> option here (white by default) and the transparent areas are painted with that colour before the JPEG is written.',
    },
    {
      question: 'Which format should I use on a website?',
      answer:
        'WebP is the safe modern default: every current browser supports it and it is roughly 25–35% smaller than JPEG at the same quality. AVIF compresses even better but encodes slowly and is not writable in every browser. Keep PNG for screenshots, flat graphics and anything that needs transparency.',
    },
    {
      question: 'Why is AVIF missing from the format list?',
      answer:
        'The tool tests whether your browser can encode AVIF on a canvas and only offers formats it can genuinely produce. Chrome and Edge on desktop can; several other browsers can only display AVIF, not write it, so the option is hidden rather than silently giving you a PNG.',
    },
    {
      question: 'Can I convert an SVG to PNG here?',
      answer:
        'Yes. SVGs are drawn onto a canvas at their intrinsic size and encoded as a bitmap. An SVG with no width and height falls back to 512 × 512. Note that the result is no longer scalable — convert at the largest size you need.',
    },
    {
      question: 'What happens to animated GIFs?',
      answer:
        'Only the first frame is converted. A canvas holds a single still image, so animation cannot be preserved in PNG or JPEG; keep the original GIF if you need the animation.',
    },
    {
      question: 'Are my files sent to a server?',
      answer:
        'No. Every file is decoded and re-encoded inside your browser tab with <code>createImageBitmap</code> and <code>canvas.toBlob</code>. Nothing is uploaded, logged or retained.',
    },
  ],
  related: ['image-compressor', 'image-resizer', 'image-to-base64'],
  status: 'stable',
  added: '2026-09-07',
};
