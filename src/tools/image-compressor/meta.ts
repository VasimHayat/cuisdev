import type { ToolMeta } from '@/tools/_types';

export const meta: ToolMeta = {
  slug: 'image-compressor',
  name: 'Image Compressor',
  shortName: 'Compress Image',
  seoTitle: 'Image Compressor Online — Free & Private',
  tagline: 'Compress JPEG, PNG and WebP images in batches, with a quality slider you control.',
  description:
    'Free online image compressor. Shrink JPEG, PNG and WebP files in batches with a quality slider and optional max dimensions, entirely in your browser.',
  category: 'images',
  icon: 'image-down',
  keywords: [
    'image compressor',
    'compress image online',
    'compress jpeg',
    'compress png',
    'reduce image size',
    'image optimizer',
    'shrink photo size',
    'batch image compression',
    'webp compressor',
    'compress image without losing quality',
  ],
  intro: [
    'Large images are the single biggest cause of slow web pages and bloated email attachments. This compressor re-encodes your photos and screenshots at a quality level you choose, so a 4 MB camera JPEG typically comes back at a few hundred kilobytes with no visible difference at normal viewing sizes.',
    'You can compress a whole folder at once, keep the original format or convert to JPEG, WebP or PNG, and cap the longest edge so oversized photos are scaled down before they are encoded. Every file is listed with its before and after size, its dimensions and the percentage saved. If re-encoding would actually make a file bigger — which happens with already-optimised images and flat graphics — the tool says "Already optimised" and offers you the original untouched.',
    'Compression runs on the canvas APIs built into your browser. Your images are never uploaded, never stored and never seen by anyone else; you can disconnect from the network after the page loads and the tool keeps working.',
  ],
  howTo: [
    'Drop your images onto the drop zone, or click Choose images to pick them from your device.',
    'Set the Quality slider (80 is a good default for photos) and pick an Output format, or leave it on Keep original.',
    'Optionally set Max width or Max height in pixels to scale oversized images down before encoding.',
    'Check the before and after sizes in the results list, then use Download on a single file or Download all.',
  ],
  example: {
    input: 'beach-sunset.jpg — 3.8 MB, 4032 × 3024',
    output: 'beach-sunset-compressed.jpg — 412 KB, 4032 × 3024 (89.4% smaller)',
    note: 'At quality 80 most camera photos lose 80–90% of their file size with no visible difference on screen.',
  },
  faq: [
    {
      question: 'How much can I compress an image without losing quality?',
      answer:
        'Quality 80–85 is the usual sweet spot for photographs: file sizes fall by 70–90% and the difference is invisible at normal viewing sizes. Below about 60 you start to see blocking around edges and in flat areas like skies. JPEG and WebP are lossy, so re-compressing an already compressed file always throws away a little more detail.',
    },
    {
      question: 'Why did my PNG get bigger instead of smaller?',
      answer:
        'PNG is lossless, so the browser cannot discard detail — it can only re-pack the pixels, and its encoder is often less thorough than the one that produced your file. When that happens the tool labels the result <strong>Already optimised</strong> and gives you the original file back. Converting the PNG to WebP or JPEG usually does shrink it dramatically.',
    },
    {
      question: 'Should I use JPEG or WebP?',
      answer:
        'WebP is typically 25–35% smaller than JPEG at the same visual quality and every current browser supports it, so it is the better choice for the web. Keep JPEG when the file has to be opened by older software, printing services or hardware that predates WebP.',
    },
    {
      question: 'Does compressing remove EXIF data like GPS location?',
      answer:
        'Yes. The image is decoded to raw pixels and re-encoded, so EXIF metadata — camera model, timestamps and GPS coordinates — is not carried over. Rotation is the exception: the orientation flag is applied to the pixels before encoding, so the compressed image is the right way up.',
    },
    {
      question: 'Is there a limit on file size or number of images?',
      answer:
        'Each file must be under 50 MB. There is no limit on how many you add, but they are processed one at a time to keep the page responsive, and very large batches are limited by your device memory rather than by the tool.',
    },
    {
      question: 'Are my images uploaded to a server?',
      answer:
        'No. Files are read with <code>createImageBitmap</code>, drawn to a <code>&lt;canvas&gt;</code> and encoded with <code>canvas.toBlob</code> — all inside your browser tab. Nothing is sent anywhere, and nothing is stored after you close the page.',
    },
  ],
  related: ['image-converter', 'image-resizer', 'image-to-base64'],
  status: 'stable',
  added: '2026-09-07',
};
