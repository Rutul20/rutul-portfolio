import type { Metadata, Viewport } from 'next';
import { DM_Serif_Display, Manrope } from 'next/font/google';
import { clientWork, contact, education, experience, profile, site } from '@/content/content';
import { THEME_BOOT_SCRIPT } from '@/components/ThemeSwitch';
import ThemeSync from '@/components/ThemeSync';
import './globals.css';

const display = DM_Serif_Display({ weight: '400', subsets: ['latin'], variable: '--font-dm-serif', display: 'swap' });
const sans = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });

// Set SITE_URL when building for a real domain (e.g. SITE_URL=https://example.com npm run build)
// so share previews get absolute image links.
const siteUrl = process.env.SITE_URL;

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: site.title,
  description: site.description,
  authors: [{ name: profile.name }],
  openGraph: {
    type: 'profile',
    title: site.title,
    description: site.description,
    ...(siteUrl ? { images: [{ url: '/og.jpg', width: 1200, height: 630, alt: 'A miniature city at dusk with a toy train' }] } : {}),
  },
  twitter: { card: siteUrl ? 'summary_large_image' : 'summary', title: site.title, description: site.description },
};

export const viewport: Viewport = {
  themeColor: '#efebe4', // updated to the dark wall colour by ThemeSwitch when dark is active
  width: 'device-width',
  initialScale: 1,
};

const personLd = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: profile.name,
  jobTitle: profile.role,
  email: `mailto:${contact.email}`,
  address: { '@type': 'PostalAddress', addressLocality: 'Vadodara', addressRegion: 'Gujarat', addressCountry: 'IN' },
  worksFor: { '@type': 'Organization', name: experience[0].company },
  alumniOf: { '@type': 'CollegeOrUniversity', name: education[0].school.split(',')[0] },
  knowsAbout: [...profile.stack, 'Design systems', 'Component libraries', 'Three.js', 'Scrum'],
  sameAs: contact.links.map((l) => l.href),
  description: `${profile.summary} Domains: ${clientWork.map((c) => c.name.toLowerCase()).join(', ')}.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // the boot script sets data-theme before React hydrates, hence suppressHydrationWarning
    <html lang="en-IN" data-theme="light" className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        {/* Applies the saved Light / Dark / System choice before the first paint (no theme flash). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <ThemeSync />
        {children}
        {/* Structured data from our own content file; `<` is escaped so text can never close the tag. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personLd).replace(/</g, '\\u003c') }}
        />
      </body>
    </html>
  );
}
