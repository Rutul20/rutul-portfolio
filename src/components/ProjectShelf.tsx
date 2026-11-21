'use client';

import { useEffect, useRef, useState } from 'react';
import type { Project } from '@/content/content';

/**
 * The project shelf: every side project as a compact card (2 columns on wider screens, a swipe row on
 * phones). "Details" opens the full write-up, screenshots and links in a modal dialog.
 */
export default function ProjectShelf({ projects }: { projects: Project[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const p = openIndex === null ? null : projects[openIndex];

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (p && !d.open) {
      d.showModal();
      document.documentElement.classList.add('dialog-open');
    }
  }, [p]);

  const close = () => dialog.current?.close();
  const onClosed = () => {
    document.documentElement.classList.remove('dialog-open');
    setOpenIndex(null);
    opener.current?.focus();
  };

  return (
    <>
      <p className="mt-4 text-xs font-semibold text-ink-soft sm:hidden" aria-hidden="true">
        {projects.length} projects · swipe for more →
      </p>
      <ul className="shelf" aria-label="Side projects">
        {projects.map((proj, i) => (
          <li key={proj.name} className="shelf-card">
            <Tile p={proj} />
            <div className="flex min-w-0 flex-1 flex-col">
              <h3 className="font-extrabold leading-tight">{proj.name}</h3>
              <p className="text-xs text-ink-soft">
                {proj.kind}
                {proj.period ? ` · ${proj.period}` : ''}
              </p>
              <p className="mt-1 line-clamp-2 text-[0.85rem] leading-snug">{proj.summary}</p>
              <p className="mt-1 truncate text-[0.72rem] font-semibold text-teal">{proj.stack.slice(0, 3).join(' · ')}</p>
              <button
                type="button"
                className="mt-auto self-start pt-1.5 text-sm font-bold text-accent underline decoration-[1.5px] underline-offset-[3px] hover:decoration-2"
                aria-haspopup="dialog"
                onClick={(e) => {
                  opener.current = e.currentTarget;
                  setOpenIndex(i);
                }}
              >
                Details<span className="sr-only">: {proj.name}</span>
              </button>
            </div>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        className="project-dialog"
        aria-labelledby="project-dialog-title"
        onClose={onClosed}
        onClick={(e) => {
          if (e.target === dialog.current) close(); // click on the backdrop
        }}
      >
        {p && (
          <div className="p-5 md:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="project-dialog-title" className="font-display text-3xl leading-tight">
                  {p.name}
                </h3>
                <p className="mt-0.5 text-sm font-semibold text-ink-soft">
                  {p.kind}
                  {p.period ? ` · ${p.period}` : ''}
                </p>
              </div>
              <button type="button" onClick={close} className="btn btn-ghost !px-3 !py-2 text-sm" aria-label="Close details">
                Close
              </button>
            </div>
            <p className="mt-3 text-[1.02rem] leading-relaxed">{p.summary}</p>
            {p.shots && p.shots.length > 0 && (
              <div className={`mt-4 grid gap-2 ${p.shots.length > 1 ? 'sm:grid-cols-2' : ''}`}>
                {p.shots.map((s) => (
                  <img
                    key={s.src}
                    src={s.src}
                    alt={s.alt}
                    width={1280}
                    height={800}
                    decoding="async"
                    className="aspect-[16/10] w-full rounded-xl border border-line object-cover"
                  />
                ))}
              </div>
            )}
            {p.points && (
              <ul className="mt-4 space-y-1.5 text-[0.95rem] leading-relaxed text-ink-soft">
                {p.points.map((pt) => (
                  <li key={pt} className="relative pl-4 before:absolute before:left-0 before:top-[0.6em] before:size-1.5 before:rounded-full before:bg-accent/70">
                    {pt}
                  </li>
                ))}
              </ul>
            )}
            <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={`${p.name} technologies`}>
              {p.stack.map((t) => (
                <li key={t} className="chip">
                  {t}
                </li>
              ))}
            </ul>
            {(p.link || p.demoUrl) && (
              <div className="mt-5 flex flex-wrap gap-2.5">
                {p.demoUrl && (
                  <a href={p.demoUrl} className="btn btn-primary" target="_blank" rel="noopener noreferrer">
                    Try the live demo <span aria-hidden="true">↗</span>
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                )}
                {p.link && (
                  <a href={p.link.href} className="btn btn-ghost" target="_blank" rel="noopener noreferrer">
                    Visit {p.link.label} <span aria-hidden="true">↗</span>
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}

/** Screenshot thumbnail, or a coloured monogram tile for projects without screenshots. */
function Tile({ p }: { p: Project }) {
  const shot = p.shots?.[0];
  if (shot) {
    return (
      <img
        src={shot.src}
        alt=""
        loading="lazy"
        decoding="async"
        width={96}
        height={96}
        className="size-[4.75rem] flex-none rounded-xl border border-line object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="shelf-tile grid size-[4.75rem] flex-none place-items-center rounded-xl font-display text-[1.9rem] text-white"
      style={{ backgroundColor: p.tint ?? '#594d6d' }}
    >
      {p.name.slice(0, 1)}
    </span>
  );
}
