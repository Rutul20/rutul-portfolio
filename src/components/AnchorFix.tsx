'use client';

import { useEffect } from 'react';

/**
 * Stops below the fold use `content-visibility: auto`, so until they've been laid out their height is
 * a placeholder and a jump to "#epost" would land in the wrong place. On the first in-page jump we lay
 * every stop out once (cheap, one time), then scroll, and move focus to the stop's heading.
 */
export default function AnchorFix() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
      const id = a?.getAttribute('href')?.slice(1);
      const target = id ? document.getElementById(id) : null;
      if (!a || !target) return;
      e.preventDefault();
      const root = document.documentElement;
      const go = () => {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        history.pushState(null, '', `#${id}`);
        const heading = target.querySelector<HTMLElement>('h1, h2');
        (heading ?? target).focus({ preventScroll: true });
      };
      if (root.classList.contains('stops-laid-out')) return go();
      root.classList.add('stops-laid-out');
      requestAnimationFrame(() => requestAnimationFrame(go));
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  return null;
}
