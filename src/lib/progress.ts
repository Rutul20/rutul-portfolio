'use client';

import { useSyncExternalStore } from 'react';
import { stops } from '@/content/content';

/**
 * Tour progress: 0 = first stop, stops.length - 1 = last stop, fractions = travelling between stops.
 * One tiny external store shared by the 3D city, the still pictures, the sky and the map legend.
 */
type Listener = () => void;

let progress = 0;
const listeners = new Set<Listener>();

export const LAST_STOP = stops.length - 1;

export const progressStore = {
  get: () => progress,
  /** `force` notifies listeners even when the value is unchanged (used by the render script). */
  set(next: number, force = false) {
    const clamped = Math.min(LAST_STOP, Math.max(0, next));
    if (!force && Math.abs(clamped - progress) < 1e-5) return;
    progress = clamped;
    listeners.forEach((l) => l());
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/**
 * The landing intro: 0 = looking at the toy globe, 1 = landed on the city. It plays while the hero
 * section scrolls past (tour progress stays at the first stop meanwhile). At SWAP, under full cloud
 * cover, the scene switches from the globe to the city.
 */
export const SWAP = 0.82;
let intro = 0;
const introListeners = new Set<Listener>();
export const introStore = {
  get: () => intro,
  set(next: number, force = false) {
    const clamped = Math.min(1, Math.max(0, next));
    if (!force && Math.abs(clamped - intro) < 1e-4) return;
    intro = clamped;
    introListeners.forEach((l) => l());
  },
  subscribe(listener: Listener) {
    introListeners.add(listener);
    return () => {
      introListeners.delete(listener);
    };
  },
};

/** 'globe' before the cloud swap, 'city' after it. Re-renders only when that flips. */
export function useIntroPhase() {
  return useSyncExternalStore(
    introStore.subscribe,
    () => (intro < SWAP ? 'globe' : 'city'),
    () => 'globe' as const,
  );
}

/** Cloud cover over the screen for a given intro value (0 = clear, 1 = fully covered). */
export function cloudCover(v: number) {
  const ss = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  // thickens 0.50→0.78, fully covers 0.78→0.84 (the swap happens at 0.82), clears slowly 0.84→1
  return ss(0.5, 0.78, v) * (1 - ss(0.84, 1, v));
}

export function measureIntro(hero: HTMLElement | null) {
  if (!hero) return 1;
  const range = Math.max(1, hero.offsetHeight - window.innerHeight);
  return Math.min(1, Math.max(0, window.scrollY / range));
}

export function useActiveStop() {
  return useSyncExternalStore(
    progressStore.subscribe,
    () => Math.round(progress),
    () => 0,
  );
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Splits a progress value into the stop we're leaving, the next one, and an eased 0–1 between them. */
export function segment(p: number) {
  const from = Math.min(LAST_STOP, Math.floor(p));
  const to = Math.min(LAST_STOP, from + 1);
  return { from, to, t: smooth(p - from) };
}

/** How dark it is: dusk at the first stop, night at the last. */
export const nightAt = (p: number) => 0.12 + 0.88 * (p / LAST_STOP);

/**
 * Maps the scroll position to tour progress. The camera holds still while a stop's card is
 * being read (the section fills the viewport centre) and travels while one card hands over
 * to the next.
 */
export function measureProgress(sections: HTMLElement[]) {
  const vh = window.innerHeight;
  const y = window.scrollY + vh / 2;
  const spans = sections.map((s) => {
    const top = s.getBoundingClientRect().top + window.scrollY;
    const start = top + vh / 2;
    const end = Math.max(start, top + s.offsetHeight - vh / 2);
    return { start, end };
  });
  if (!spans.length || y <= spans[0].start) return 0;
  for (let i = 0; i < spans.length; i++) {
    const { start, end } = spans[i];
    if (y >= start && y <= end) return i;
    const next = spans[i + 1];
    if (next && y > end && y < next.start) return i + (y - end) / (next.start - end);
  }
  return spans.length - 1;
}
