import type { ToolMeta } from '@/tools/_types';

export const meta: ToolMeta = {
  slug: 'password-generator',
  name: 'Password Generator',
  shortName: 'Password',
  seoTitle: 'Password Generator — Strong, Random & Free',
  tagline:
    'Create strong random passwords or memorable passphrases with a real entropy meter, offline.',
  description:
    'Free strong password generator: random characters or memorable passphrases, custom symbols and a real entropy meter. Made in your browser, never stored.',
  category: 'generators',
  icon: 'lock',
  keywords: [
    'password generator',
    'strong password generator',
    'random password generator',
    'secure password generator',
    'passphrase generator',
    'random passphrase',
    'password entropy',
    'password strength checker',
    'generate password online',
    'password with symbols',
    'memorable password',
  ],
  intro: [
    'A strong password is one an attacker cannot guess before you notice, and the only reliable way to get one is to let a random number generator pick it. This password generator does exactly that, in two flavours: random-character passwords of 8 to 128 characters drawn from lower-case, upper-case, digit and symbol sets you choose, and passphrases of 3 to 10 common English words such as maple-river-stone-lamp, which are far easier to type and remember at the same strength.',
    'Every option changes the output instantly. Exclude ambiguous characters (0, O, 1, l, I, |) when a password must be read aloud or typed from paper, supply your own symbol set to satisfy a site that only allows a few, and require at least one character from each selected class for policies that demand it. Passphrases can be capitalised, joined with a hyphen, dot, space, underscore or any separator you type, and finished with a two-digit number. The strength meter is computed from the actual search space (pool size to the power of the length, or word-list size to the power of the word count) and shows the result in bits, not a vague colour.',
    'Randomness comes from crypto.getRandomValues, the same cryptographically secure source browsers use for TLS, and values are chosen by rejection sampling so no character is favoured. Passwords are created on your device and shown only to you; nothing is stored, logged or sent anywhere, and the page keeps working with the network switched off.',
  ],
  howTo: [
    'Choose Random characters for a classic password or Passphrase for a memorable word-based one.',
    'Set the length (or number of words) and tick the character classes or passphrase options you need.',
    'Read the strength meter — aim for at least 64 bits for accounts that matter, more for encryption keys.',
    'Click Generate for a fresh value, Generate 10 for a list to choose from, then Copy to put it on the clipboard.',
  ],
  example: {
    input: 'Mode: Random characters · Length: 20 · Lowercase, uppercase, digits and symbols',
    output:
      'Nq7#vZ2pL!e9Xr$Ht4Wm\n\nMode: Passphrase · 4 words · capitalised · hyphen · number\nMaple-River-Stone-Lamp-42',
    note: 'The 20-character password has about 129 bits of entropy (89 possible characters per position). The 4-word passphrase has about 39 bits (300 words per slot, plus 6.6 bits for the number) — add words rather than symbols to make it stronger.',
  },
  faq: [
    {
      question: 'How long should a password be?',
      answer:
        'Length matters more than complexity. With all four character classes enabled, 12 characters give about 78 bits of entropy and 16 characters about 104 bits, which is beyond brute force even for an attacker who has stolen the hashed database. For encryption passphrases and password-manager master passwords, use 20+ random characters or 6+ dictionary words.',
    },
    {
      question: 'What does the entropy figure mean?',
      answer:
        'Entropy measures how many equally likely values the generator could have produced, expressed as a power of two. A password with 64 bits of entropy is one of 2<sup>64</sup> (about 18 quintillion) possibilities, so an attacker guessing a billion per second would need roughly 300 years on average. This tool computes entropy from the generation parameters — the real search space — not by inspecting the finished password, which would over-estimate strength.',
    },
    {
      question: 'Is a passphrase really as strong as a random password?',
      answer:
        'Each word from this 300-word list contributes about 8.2 bits, so a 4-word passphrase (about 33 bits) is weaker than a 12-character random password and suits low-value logins or Wi-Fi keys. At 6 words you reach about 49 bits and at 8 words about 66 bits — comparable to a 10-character random password — while remaining something you can actually type. Strength comes from the number of words, not from the words being obscure.',
    },
    {
      question: 'Is it safe to generate passwords in a browser?',
      answer:
        'Yes, provided the generator uses the browser&#39;s cryptographic random source and does not send results anywhere. This tool uses <code>crypto.getRandomValues()</code> — never <code>Math.random()</code> — and runs entirely on your device. The site&#39;s Content Security Policy blocks connections to other origins, so the password cannot leave the page even by accident. Store it in a password manager rather than a note.',
    },
    {
      question: 'Why exclude ambiguous characters?',
      answer:
        'In many fonts the digit 0 and letter O, or 1, l, I and | look identical, which is a problem when a password is read out over the phone, printed on a card or typed from a screen. Ticking Exclude ambiguous removes those six characters from the pool at a cost of under half a bit of entropy per character.',
    },
    {
      question: 'Can I make a password that satisfies a site&#39;s rules?',
      answer:
        'Usually. Keep Include every selected type ticked to guarantee at least one lower-case letter, upper-case letter, digit and symbol, and type the site&#39;s allowed punctuation into Custom symbols if it rejects some characters. Set the length to the maximum the site accepts — longer is always better.',
    },
  ],
  related: ['uuid-generator', 'hash-generator', 'base64'],
  status: 'stable',
  added: '2026-09-06',
};
