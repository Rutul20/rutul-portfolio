'use client';

import { useEffect, useRef, useState } from 'react';
import { stops } from '@/content/content';
import { useActiveStop } from '@/lib/progress';

/**
 * The tour map. On large screens: a rail of the eight stops at the right edge.
 * On smaller screens: a "Map" button in the header that opens the same list.
 */
export default function MapLegend({ variant }: { variant: 'rail' | 'button' }) {
  const active = useActiveStop();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const firstLink = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;
    firstLink.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const list = (compact: boolean) => (
    <ol className={compact ? 'flex flex-col gap-0.5' : 'grid gap-1'}>
      {stops.map((s, i) => (
        <li key={s.id}>
          <a
            ref={!compact && i === 0 ? firstLink : undefined}
            href={`#${s.id}`}
            aria-current={i === active ? 'location' : undefined}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-2.5 rounded-full px-2.5 ${compact ? 'py-1 text-[0.8rem]' : 'py-1.5 text-sm'} hover:bg-subtle ${
              i === active ? 'font-bold text-ink' : 'text-ink-soft'
            }`}
          >
            <span className="legend-dot" aria-hidden="true" />
            <span>
              {compact ? null : <span className="mr-1.5 tabular-nums text-ink-soft">{i + 1}.</span>}
              {s.label}
            </span>
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    variant === 'rail' ? (
      // large screens: always-visible rail at the right edge
      <nav aria-label="Tour stops" className="legend-rail glass-solid hidden rounded-[0.8rem] p-2 xl:block">
        {list(true)}
      </nav>
    ) : (
      // smaller screens: Map button + panel in the header
      <div className="relative xl:hidden">
        <button
          ref={button}
          type="button"
          aria-expanded={open}
          aria-controls="tour-map"
          onClick={() => setOpen((o) => !o)}
          className="whitespace-nowrap rounded-full px-2 py-2 text-sm font-bold hover:bg-subtle sm:px-3"
        >
          Map
        </button>
        {open && (
          <nav
            id="tour-map"
            aria-label="Tour stops"
            className="glass-solid fixed inset-x-3 top-[4.4rem] z-40 rounded-[0.8rem] p-2 md:absolute md:inset-x-auto md:right-0 md:top-full md:mt-3 md:w-64"
          >
            {list(false)}
          </nav>
        )}
      </div>
    )
  );
}
