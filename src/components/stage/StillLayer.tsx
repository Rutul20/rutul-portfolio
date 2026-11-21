'use client';

import { useEffect, useRef, useState } from 'react';
import { stops } from '@/content/content';
import { introStore, progressStore, SWAP, useActiveStop, useIntroPhase } from '@/lib/progress';
import globeFrames from './globe-frames.json';

/**
 * The city as pre-rendered pictures (made by `npm run renders` from the live scene).
 * Used on phones, on devices without WebGL, and on desktop while the 3D chunk loads.
 *
 * Landing: four globe pictures, from the whole globe to close over Gujarat. Each one zooms and slides
 * towards the Vadodara pin until it looks like the next picture, which then fades in over it, so the
 * dive reads as one continuous zoom. Then the CSS clouds, then the city.
 * Tour: neighbouring stop pictures cross-fade and drift slightly as you scroll (2.5D).
 * Only the first picture loads at first; the rest start loading once the visitor scrolls.
 */
type Meta = { pin: [number, number]; alt: number };
const FRAMES = globeFrames.frames;
const META = globeFrames as unknown as Record<'landscape' | 'portrait', Record<string, Meta | undefined>>;
const IMG_ASPECT = { landscape: 1600 / 1000, portrait: 540 / 960 };

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smooth = (t: number) => {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
};

/** Where a point of the picture (0–1 coordinates) lands on screen, given object-fit: cover. */
function onScreen([px, py]: [number, number], imgAspect: number) {
  const W = window.innerWidth, H = window.innerHeight;
  if (W / H < imgAspect) {
    const w = H * imgAspect;
    return [(W - w) / 2 + px * w, py * H];
  }
  const h = W / imgAspect;
  return [px * W, (H - h) / 2 + py * h];
}

export default function StillLayer() {
  const active = useActiveStop();
  const phase = useIntroPhase();
  const refs = useRef<Map<string, HTMLElement>>(new Map());
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (scrolled) return;
    const on = () => setScrolled(true);
    window.addEventListener('scroll', on, { once: true, passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [scrolled]);

  const pics =
    phase === 'globe'
      ? FRAMES.filter((g, i) => i === 0 || scrolled).map((g) => ({ key: g.name, name: g.name }))
      : stops.flatMap((s, i) => (i === active || (scrolled && Math.abs(i - active) <= 1) ? [{ key: s.id, name: String(i) }] : []));

  useEffect(() => {
    const paint = () => {
      const v = introStore.get();
      const p = progressStore.get();
      const orient = window.innerWidth / window.innerHeight <= 0.8 ? 'portrait' : 'landscape';
      const meta = META[orient];

      // the globe frame we're zooming from, and how far towards the next one
      let k = FRAMES.length - 1;
      while (k > 0 && v < FRAMES[k].intro) k--;
      const next = FRAMES[k + 1];
      const f = next ? clamp01((v - FRAMES[k].intro) / (next.intro - FRAMES[k].intro)) : clamp01((v - FRAMES[k].intro) / (SWAP - FRAMES[k].intro));

      refs.current.forEach((el, key) => {
        let opacity = 0;
        let transform = 'none';
        let origin = '50% 50%';
        const gi = FRAMES.findIndex((g) => g.name === key);
        if (gi >= 0) {
          const m = meta[key];
          const pin = m ? onScreen(m.pin, IMG_ASPECT[orient]) : [window.innerWidth / 2, window.innerHeight / 2];
          origin = `${pin[0].toFixed(1)}px ${pin[1].toFixed(1)}px`;
          if (gi === k) {
            // zoom this frame towards the pin until it matches the next frame
            const nm = next ? meta[next.name] : undefined;
            const zoom = next ? (m && nm ? m.alt / nm.alt : 2) : 1.35;
            const to = nm ? onScreen(nm.pin, IMG_ASPECT[orient]) : pin;
            const e = smooth(f);
            const s = Math.pow(zoom, e);
            transform = `translate(${((to[0] - pin[0]) * e).toFixed(1)}px, ${((to[1] - pin[1]) * e).toFixed(1)}px) scale(${s.toFixed(4)})`;
            opacity = 1;
          } else if (gi === k + 1) {
            // the next frame fades in over the end of the zoom
            opacity = smooth((f - 0.6) / 0.4);
          }
        } else {
          const i = stops.findIndex((s) => s.id === key);
          const d = p - i;
          const vis = Math.max(0, 1 - Math.abs(d));
          opacity = vis * vis * (3 - 2 * vis);
          // after the swap the city starts slightly zoomed out and settles as the clouds clear
          const land = i === 0 ? 1 - smooth((v - SWAP) / (1 - SWAP)) : 0;
          transform = `translate3d(0, ${(-d * 3).toFixed(2)}vh, 0) scale(${(1 - land * 0.18).toFixed(3)})`;
        }
        el.style.opacity = opacity.toFixed(3);
        el.style.transform = transform;
        el.style.transformOrigin = origin;
      });
    };
    paint();
    const a = progressStore.subscribe(paint);
    const b = introStore.subscribe(paint);
    window.addEventListener('resize', paint);
    return () => {
      a();
      b();
      window.removeEventListener('resize', paint);
    };
  }, [active, phase, scrolled]);

  return (
    <div className={`stills ${scrolled ? 'is-moving' : ''}`}>
      {pics.map((pic) => (
        <picture
          key={pic.key}
          ref={(el) => {
            if (el) refs.current.set(pic.key, el);
            else refs.current.delete(pic.key);
          }}
          className="still"
          style={{ opacity: pic.key === 'g0' || (phase === 'city' && pic.name === String(active)) ? 1 : 0 }}
        >
          <source
            media="(max-aspect-ratio: 4/5)"
            srcSet={`/renders/portrait-${pic.name}-540.webp 540w, /renders/portrait-${pic.name}-810.webp 810w`}
            sizes="100vw"
          />
          <img
            src={`/renders/landscape-${pic.name}-1600.webp`}
            srcSet={`/renders/landscape-${pic.name}-960.webp 960w, /renders/landscape-${pic.name}-1600.webp 1600w`}
            sizes="100vw"
            alt=""
            decoding="async"
            fetchPriority={pic.key === 'g0' ? 'high' : 'auto'}
          />
        </picture>
      ))}
    </div>
  );
}
