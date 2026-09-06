import type { ToolMeta } from '@/tools/_types';

export const meta: ToolMeta = {
  slug: 'number-base-converter',
  name: 'Number Base Converter',
  shortName: 'Number Bases',
  seoTitle: 'Number Base Converter — Binary, Hex, Dec',
  tagline: 'Convert between binary, octal, decimal, hex and any base from 2 to 36.',
  description:
    'Free online number base converter for binary, octal, decimal, hex and any base from 2 to 36, with two’s complement and exact BigInt maths, in your browser.',
  category: 'web',
  icon: 'calculator',
  keywords: [
    'number base converter',
    'binary to decimal',
    'decimal to binary',
    'hex to decimal',
    'decimal to hex',
    'binary to hex',
    'base 36 converter',
    'twos complement calculator',
    'number to words',
  ],
  intro: [
    'Four editable fields — binary, octal, decimal and hexadecimal — stay in sync: type in any one of them and the rest update as you go. A fifth field takes any base from 2 to 36, so base 32 identifiers and base 36 short codes are covered too.',
    'Every conversion runs on BigInt, so values stay exact well past 2^53 where ordinary JavaScript numbers start rounding — a full 64-bit register converts without losing a digit. Input is forgiving: 0b, 0o and 0x prefixes, underscore or space separators and negative signs are all accepted, and an invalid digit gets a message that names the digit and the base. Alongside the conversions you get the bit length, the two’s complement pattern at 8, 16, 32 or 64 bits, and the number spelled out in English.',
    'Nothing leaves your machine: the arithmetic happens in your browser, so register dumps, hashes and IDs from private systems stay local.',
  ],
  howTo: [
    'Type a number into whichever field matches the base you have — the other fields follow instantly.',
    'Pick a Custom base between 2 and 36 to convert into any other base.',
    'Turn on Uppercase letters or Group digits to match the formatting you need.',
    'Choose a two’s complement width to see the 8-, 16-, 32- or 64-bit pattern, then Copy any row.',
  ],
  example: {
    input: '3735928559',
    output: 'binary 11011110101011011011111011101111 · octal 33653337357 · hex deadbeef',
    note: 'With 32-bit two’s complement selected, -1 becomes 11111111111111111111111111111111 (ffffffff).',
  },
  faq: [
    {
      question: 'How do I convert binary to decimal?',
      answer:
        'Type or paste the binary digits into the Binary field — with or without a <code>0b</code> prefix and with underscores or spaces if you like — and read the answer in the Decimal field. Every other base updates at the same time.',
    },
    {
      question: 'Does it handle numbers bigger than 2^53?',
      answer:
        'Yes. All arithmetic uses JavaScript’s <code>BigInt</code>, so digits are never lost to floating-point rounding. A 64-bit value such as <code>ffffffffffffffff</code> converts exactly to 18446744073709551615.',
    },
    {
      question: 'What is two’s complement?',
      answer:
        'It is how CPUs store signed integers: the top bit means “negative”, and −1 is all ones. Choose a width and the tool shows the exact bit pattern in binary and hex — <code>-1</code> at 8 bits is <code>11111111</code> (<code>ff</code>). If the value is too large for the width, it says so instead of silently truncating.',
    },
    {
      question: 'Which prefixes and separators can I paste?',
      answer:
        'A leading <code>0b</code>, <code>0o</code> or <code>0x</code> is stripped when it matches the field’s base, and underscores and spaces are ignored everywhere. That means source-code literals such as <code>0xDE_AD_BE_EF</code> paste straight in.',
    },
    {
      question: 'Why is base 36 the maximum?',
      answer:
        'Base 36 uses the ten digits plus the 26 letters of the Latin alphabet, which is as far as the standard digit set goes. Anything higher would need symbols with no agreed meaning, so 2–36 is the range every language’s parser supports.',
    },
    {
      question: 'Is my data uploaded anywhere?',
      answer:
        'No. The conversions happen entirely in your browser; nothing is sent to a server, logged or stored.',
    },
  ],
  related: ['color-converter'],
  status: 'stable',
  added: '2026-09-07',
};
