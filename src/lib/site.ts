/** Site-wide constants. Keep every user-visible claim here truthful. */
export const site = {
  name: 'Cuisdev',
  title: 'Cuisdev — Free, Private Developer Tools',
  tagline: 'Fast, private, free developer utilities.',
  description:
    'Free online developer tools that run entirely in your browser. Format JSON, encode Base64, generate UUIDs and hashes, diff text and more. No sign-up, no tracking, nothing leaves your device.',
  url: 'https://www.cuisdev.com',
  locale: 'en_US',
  language: 'en',
  /** Set once the repository is public. `undefined` hides every GitHub link. */
  github: undefined as string | undefined,
  /** Contact for legal pages. */
  contactEmail: 'hello@cuisdev.com',
  themeColor: { light: '#ffffff', dark: '#0b1220' },
  /** Year the current version launched — used in the copyright line. */
  foundedYear: 2026,
} as const;

export const nav = [
  { label: 'Tools', href: '/tools/' },
  { label: 'Guides', href: '/blog/' },
  { label: 'About', href: '/about/' },
] as const;

export const legalNav = [
  { label: 'Privacy', href: '/privacy/' },
  { label: 'Terms', href: '/terms/' },
] as const;
