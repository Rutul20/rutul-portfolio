'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { applyTheme, darkQuery, type ThemePref } from './ThemeSwitch';

const currentPref = (): ThemePref => {
  const p = document.documentElement.dataset.themePref;
  return p === 'light' || p === 'dark' ? p : 'system';
};

/**
 * Mounted once in the root layout, so it works on every page (the résumé page has no header):
 * - keeps the browser-chrome colour (theme-color meta) in step with the theme, including after
 *   client-side navigation, where Next.js re-renders that meta from static metadata;
 * - while the choice is "System", follows the device live (e.g. dark mode at sunset).
 */
export default function ThemeSync() {
  const pathname = usePathname();

  useEffect(() => {
    applyTheme(currentPref());
  }, [pathname]);

  useEffect(() => {
    const q = darkQuery();
    const onChange = () => {
      if (currentPref() === 'system') applyTheme('system');
    };
    q.addEventListener('change', onChange);
    return () => q.removeEventListener('change', onChange);
  }, []);

  return null;
}
