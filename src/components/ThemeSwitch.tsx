'use client';

import { useEffect, useRef, useState } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';
const OPTIONS: { value: ThemePref; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];
const BG = { light: '#efebe4', dark: '#161514' };
export const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

/**
 * Runs inline in <head> before the first paint (see app/layout.tsx), so the page never flashes the
 * wrong theme. Keep it tiny and dependency-free; it mirrors applyTheme() below.
 */
export const THEME_BOOT_SCRIPT = `(function(){var r=document.documentElement;try{var p=localStorage.getItem('theme');if(p!=='light'&&p!=='dark')p='system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);r.dataset.theme=d?'dark':'light';r.dataset.themePref=p;var ms=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<ms.length;i++)ms[i].setAttribute('content',d?'#161514':'#efebe4');}catch(e){r.dataset.theme='light';r.dataset.themePref='system';}})();`;

export function applyTheme(pref: ThemePref) {
  const root = document.documentElement;
  const dark = pref === 'dark' || (pref === 'system' && darkQuery().matches);
  root.dataset.theme = dark ? 'dark' : 'light';
  root.dataset.themePref = pref;
  // Next.js may render more than one theme-color tag (e.g. after client navigation): update them all
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? BG.dark : BG.light));
  try {
    localStorage.setItem('theme', pref);
  } catch {
    /* private mode: the choice just isn't remembered */
  }
}

function Icon({ pref }: { pref: ThemePref }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (pref === 'light')
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  if (pref === 'dark')
    return (
      <svg {...common}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    );
  return (
    <svg {...common}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

/** Header control: a button showing the current choice, opening Light / Dark / System. */
export default function ThemeSwitch() {
  const [pref, setPref] = useState<ThemePref>('system');
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // pick up what the boot script already applied (ThemeSync keeps it in step afterwards)
  useEffect(() => {
    const p = document.documentElement.dataset.themePref as ThemePref | undefined;
    if (p === 'light' || p === 'dark' || p === 'system') setPref(p);
  }, []);

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLInputElement>('input:checked')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!panel.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  const choose = (p: ThemePref) => {
    setPref(p);
    applyTheme(p);
  };
  const current = OPTIONS.find((o) => o.value === pref)!;

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (open && !e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls="theme-options"
        aria-label={`Theme: ${current.label}`}
        title={`Theme: ${current.label}`}
        onClick={() => setOpen((o) => !o)}
        className="grid size-9 place-items-center rounded-full hover:bg-subtle"
      >
        <Icon pref={pref} />
      </button>
      {open && (
        // centred under the button, so it never runs off either edge of a phone screen
        <div ref={panel} id="theme-options" className="glass-solid absolute left-1/2 top-full z-40 mt-3 w-44 -translate-x-1/2 rounded-[0.8rem] p-1.5">
          <fieldset>
            <legend className="px-2.5 pb-1 pt-1 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-ink-soft">Theme</legend>
            {OPTIONS.map((o) => (
              <label
                key={o.value}
                className={`flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-subtle has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-accent ${
                  pref === o.value ? 'font-bold' : ''
                }`}
              >
                <input
                  type="radio"
                  name="theme"
                  value={o.value}
                  checked={pref === o.value}
                  onChange={() => choose(o.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      setOpen(false);
                      button.current?.focus();
                    }
                  }}
                  className="sr-only"
                />
                <Icon pref={o.value} />
                <span>{o.label}</span>
                {pref === o.value && (
                  <span aria-hidden="true" className="ml-auto size-2 rounded-full bg-accent" />
                )}
              </label>
            ))}
          </fieldset>
        </div>
      )}
    </div>
  );
}
