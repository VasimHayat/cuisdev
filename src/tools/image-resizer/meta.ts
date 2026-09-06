import type { ToolMeta } from '@/tools/_types';

export const meta: ToolMeta = {
  slug: 'image-resizer',
  name: 'Image Resizer & Cropper',
  shortName: 'Resize Image',
  seoTitle: 'Image Resizer & Cropper Online — Free',
  tagline: 'Resize by pixels, percentage or preset and crop to any aspect ratio, in your browser.',
  description:
    'Free online image resizer and cropper. Resize by exact pixels, percentage or presets, crop to 1:1, 4:3, 16:9 or 3:2, with a live preview and no uploads.',
  category: 'images',
  icon: 'scaling',
  keywords: [
    'image resizer',
    'resize image online',
    'crop image online',
    'image cropper',
    'resize image to exact pixels',
    'resize by percentage',
    'resize image for instagram',
    'make favicon from image',
    'batch image resize',
    'change image dimensions',
  ],
  intro: [
    'Resizing sounds simple until you need an exact pixel size, a locked aspect ratio and a crop that is not off-centre. This tool does all three: scale by exact width and height, by a percentage of the original, or straight to a preset such as 1920 × 1080, 1080 × 1080 or a 32 × 32 favicon, and crop to a fixed shape before the scaling happens.',
    'Crop shapes (1:1, 4:3, 16:9, 3:2) are applied centred, and the live preview draws the crop box over your image so you can see exactly what will be kept. If you need something precise, switch the crop to Custom and type the x, y, width and height in source pixels — values that run past the edge are trimmed instead of producing a broken image. Drop in a whole folder and every file is processed with the same settings.',
    'Everything is done with the canvas APIs in your browser. Your photos are never uploaded to a server, which matters when you are resizing screenshots of internal tools or pictures of your family.',
  ],
  howTo: [
    'Drop your images onto the drop zone, or click Choose images.',
    'Pick a Resize mode: Exact size, Percentage or Preset, then fill in the boxes that mode uses.',
    'Choose a Crop shape — presets are centred automatically, or pick Custom and type x, y, width and height.',
    'Set the Output format and Quality, check the preview, then Download each file or Download all.',
  ],
  example: {
    input: 'team-photo.jpg — 4000 × 3000, 5.2 MB',
    output: 'team-photo-1080x1080.jpg — 1080 × 1080, 214 KB',
    note: 'A 1:1 crop takes the middle 3000 × 3000 pixels first, then the result is scaled to 1080 × 1080.',
  },
  faq: [
    {
      question: 'How do I resize an image without stretching it?',
      answer:
        'Keep <strong>Lock aspect ratio</strong> ticked in Exact size mode: typing a width fills in the matching height automatically. If you need a shape the original does not have — a square from a landscape photo, for example — crop first with a crop shape, then resize. Cropping removes pixels; unlocking the ratio distorts them.',
    },
    {
      question: 'Does enlarging an image make it sharper?',
      answer:
        'No. Scaling above 100% interpolates between existing pixels, so the result is bigger but softer — there is no extra detail to recover. Enlarge only when a specific pixel size is required, and keep the factor small.',
    },
    {
      question: 'How do I make a favicon?',
      answer:
        'Choose the 1:1 crop shape so the icon is square, pick the 32 × 32 or 16 × 16 preset and set the output format to PNG. Modern browsers accept a PNG favicon; you only need a real <code>.ico</code> file for very old versions of Internet Explorer.',
    },
    {
      question: 'What order are the crop and the resize applied in?',
      answer:
        'Crop first, resize second. The crop is taken from the original pixels, and whatever is left is then scaled to the target size. That is why a 1:1 crop plus a 1080 × 1080 preset gives an undistorted square.',
    },
    {
      question: 'Can I resize several images at once?',
      answer:
        'Yes. Add as many files as you like and they are processed one at a time with the same settings. Crop shapes are recentred on each image, so a batch of mixed portrait and landscape photos all come out correctly framed.',
    },
    {
      question: 'Are my images uploaded?',
      answer:
        'No. Decoding, cropping, scaling and encoding all happen in your browser tab using <code>createImageBitmap</code> and <code>canvas.toBlob</code>. Nothing is transmitted or stored.',
    },
  ],
  related: ['image-compressor', 'image-converter', 'image-to-base64'],
  status: 'stable',
  added: '2026-09-07',
};
