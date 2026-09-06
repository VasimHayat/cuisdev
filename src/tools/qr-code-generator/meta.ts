import type { ToolMeta } from '@/tools/_types';

export const meta: ToolMeta = {
  slug: 'qr-code-generator',
  name: 'QR Code Generator',
  shortName: 'QR Code',
  seoTitle: 'QR Code Generator — Free, No Sign-up',
  tagline:
    'Create QR codes for URLs, Wi-Fi, email, phone, SMS and contacts. Download as PNG or SVG.',
  description:
    'Free QR code generator for URLs, text, Wi-Fi, email, phone, SMS and vCards. Pick size, colours and error correction, download PNG or SVG. Runs in your browser.',
  category: 'generators',
  icon: 'qr-code',
  keywords: [
    'qr code generator',
    'free qr code generator',
    'qr code maker',
    'wifi qr code generator',
    'vcard qr code',
    'qr code svg',
    'qr code png',
    'url to qr code',
    'sms qr code',
    'email qr code',
    'custom color qr code',
    'qr code online',
  ],
  intro: [
    'A QR code is a two-dimensional barcode that any phone camera can scan to open a link, join a Wi-Fi network, start an email or save a contact. This QR code generator turns text, URLs and six common payload types into a scannable code the moment you type, with no account, watermark, expiry or tracking redirect — the code stores your content directly.',
    'Choose a content type and the form adapts: Wi-Fi codes use the WIFI: format that iOS and Android understand (with correct escaping of special characters in the password), email codes build a mailto: link with subject and body, phone and SMS codes use tel: and smsto:, and contacts are exported as a vCard 3.0. Set the size from 128 to 1024 pixels, the error-correction level (L, M, Q or H), the quiet-zone margin and the foreground and background colours, then download a crisp PNG for documents or an infinitely scalable SVG for print.',
    'Everything is generated locally with an open-source QR encoder running in your browser. Nothing you enter — not your Wi-Fi password, not your contact details — is uploaded, stored or logged, and the page keeps working offline once loaded.',
  ],
  howTo: [
    'Pick a Content type: Text or URL, Wi-Fi network, Email, Phone number, SMS message or Contact (vCard).',
    'Fill in the fields. The QR code updates as you type and the stats show the version and module count.',
    'Adjust Size, Error correction, Margin and the Foreground and Background colours to taste.',
    'Switch between PNG and SVG output, then click Download PNG or Download SVG — or Copy to put the image on your clipboard.',
  ],
  example: {
    input: 'Wi-Fi network · SSID "Cuisdev Guest" · WPA · password "welcome-2026"',
    output: 'WIFI:T:WPA;S:Cuisdev Guest;P:welcome-2026;H:false;;',
    note: 'The encoded text follows the WIFI: convention understood by iOS and Android. Special characters such as ; , : and " are escaped with a backslash.',
  },
  faq: [
    {
      question: 'Do these QR codes expire or stop working?',
      answer:
        'No. The code stores your content directly — there is no shortened link or redirect through our servers — so it works for as long as the destination exists. Static QR codes cannot be edited after printing, though: if the URL changes you need a new code.',
    },
    {
      question: 'Which error-correction level should I use?',
      answer:
        'Level M (15% recovery) is the usual default and works for most screens and prints. Use Q or H when the code may be damaged, partly covered by a logo or printed small on rough material; use L when you need to fit as much data as possible. Higher levels add modules, so the same content produces a denser code.',
    },
    {
      question: 'How much text fits in a QR code?',
      answer:
        'A version-40 code holds up to 2,953 bytes at level L, 2,331 at M, 1,663 at Q and 1,273 at H. Shorter content produces a smaller, easier-to-scan code, so keep URLs short. The tool shows the byte count and QR version for whatever you enter and tells you when the content is too long.',
    },
    {
      question: 'How do I make a Wi-Fi QR code?',
      answer:
        'Choose Wi-Fi network, enter the network name (SSID) and password and pick the security type — WPA covers WPA2 and WPA3. The generated text uses the <code>WIFI:T:WPA;S:name;P:password;;</code> format, which the built-in camera apps on iOS 11+ and Android 10+ recognise and offer to join.',
    },
    {
      question: 'Should I download PNG or SVG?',
      answer:
        'PNG is a fixed-size bitmap that pastes into documents, slides and chat apps anywhere. SVG is vector, so it stays perfectly sharp at any size — use it for print, signage and design tools such as Figma or Illustrator. Both contain exactly the same code.',
    },
    {
      question: 'Is my Wi-Fi password or contact data sent anywhere?',
      answer:
        'No. The code is built entirely inside your browser by a JavaScript QR encoder; the page makes no network requests with your data. You can disconnect from the internet after loading the page and everything keeps working.',
    },
  ],
  related: ['lorem-ipsum-generator', 'base64'],
  status: 'stable',
  added: '2026-09-06',
};
