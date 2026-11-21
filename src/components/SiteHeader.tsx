import Link from 'next/link';
import { profile } from '@/content/content';
import MapLegend from './MapLegend';
import ThemeSwitch from './ThemeSwitch';

export default function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-30 px-3 pt-3 md:px-6 md:pt-5">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2 focus:font-bold"
      >
        Skip to content
      </a>
      <div className="flex items-center justify-between gap-2">
        <a
          href="#city"
          className="glass-solid flex items-center gap-2.5 rounded-full p-1.5 sm:pr-4"
        >
          <span aria-hidden="true" className="brand-badge grid size-9 place-items-center rounded-full font-display text-[0.95rem]">
            {profile.initials}
          </span>
          <span className="sr-only font-bold sm:not-sr-only">{profile.name}</span>
          <span className="sr-only">, back to the start</span>
        </a>
        <nav aria-label="Site" className="glass-solid flex items-center gap-0.5 rounded-full p-1.5 sm:gap-1.5">
          <MapLegend variant="button" />
          <ThemeSwitch />
          <Link href="/resume/" prefetch={false} className="whitespace-nowrap rounded-full px-2 py-2 text-sm font-bold hover:bg-subtle sm:px-3 md:px-4">
            Résumé<span className="hidden sm:inline"> view</span>
          </Link>
          <a href="#contact" className="btn btn-primary whitespace-nowrap !px-3 !py-2 text-sm sm:!px-4">
            Contact
          </a>
        </nav>
      </div>
      <MapLegend variant="rail" />
    </header>
  );
}
