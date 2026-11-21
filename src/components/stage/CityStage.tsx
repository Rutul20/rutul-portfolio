'use client';

import dynamic from 'next/dynamic';
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cloudCover, introStore, measureIntro, measureProgress, progressStore } from '@/lib/progress';
import StillLayer from './StillLayer';
import type { Orient } from '../city/LiveCity';

// The 3D city is its own chunk. Phones and the first paint never download it.
const LiveCity = dynamic(() => import('../city/LiveCity'), { ssr: false });

type Mode = 'still' | 'live';

/**
 * Cloud banks for the landing (pure CSS gradients, no images). x/y = centre in % of the screen,
 * w/h = size in %, depth = how fast it rushes past (near clouds grow and fly outward faster).
 */
const CLOUDS = [
  { x: 18, y: 26, w: 62, h: 40, depth: 0.8 },
  { x: 82, y: 18, w: 70, h: 46, depth: 1.0 },
  { x: 14, y: 76, w: 74, h: 48, depth: 1.1 },
  { x: 80, y: 82, w: 80, h: 50, depth: 0.9 },
  { x: 50, y: 48, w: 70, h: 44, depth: 1.4 },
  { x: 36, y: 56, w: 46, h: 30, depth: 1.7 },
  { x: 64, y: 40, w: 50, h: 32, depth: 1.6 },
];

declare global {
  interface Window {
    __setProgress?: (p: number) => void;
    __setIntro?: (v: number) => void;
  }
}

/**
 * Real check: creates a WebGL2 context. Only run where we're about to load 3D anyway (desktop),
 * because on machines without a GPU creating a context can block the page for seconds.
 */
function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}
/** Cheap check for the "Enter the 3D city" button: the browser knows WebGL2 at all. */
const mightHaveWebGL = () => typeof window.WebGL2RenderingContext !== 'undefined';

/** If the 3D city fails to start (no usable WebGL after all), fall back to the pictures. */
class LiveGuard extends Component<{ onFail: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Live 3D only where it will run smoothly: a WebGL2-capable, mouse-driven, roomy screen. */
function suitsLive() {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return false;
  if (nav.deviceMemory !== undefined && nav.deviceMemory < 4) return false;
  if (!window.matchMedia('(pointer: fine)').matches) return false;
  return window.innerWidth >= 900;
}

export default function CityStage() {
  const [mode, setMode] = useState<Mode>('still');
  const [liveShown, setLiveShown] = useState(false);
  const [canLive, setCanLive] = useState(false);
  const [orient, setOrient] = useState<Orient>('landscape');
  const [reduced, setReduced] = useState(false);
  const [renderMode, setRenderMode] = useState(false);
  const cloudsRef = useRef<HTMLDivElement>(null);

  // Decide still vs live once, after the page has painted and gone idle.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const render = params.get('render');
    const forced = params.get('mode');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(reduce.matches);
    const onReduce = () => setReduced(reduce.matches);
    reduce.addEventListener('change', onReduce);

    const pickOrient = () =>
      setOrient(
        params.get('frame') === 'center' ? 'center' : window.innerWidth / window.innerHeight < 0.8 ? 'portrait' : 'landscape',
      );
    pickOrient();
    window.addEventListener('resize', pickOrient);

    setCanLive(mightHaveWebGL());
    const stage = (v: 'live' | 'still') => (document.documentElement.dataset.stage = v);

    if (render !== null) {
      document.documentElement.dataset.render = params.get('sky') ? 'sky' : 'bare';
      setRenderMode(true);
      setMode('live');
    } else if (mightHaveWebGL() && (forced === 'live' || (forced !== 'still' && suitsLive()))) {
      stage('live');
      const start = () => {
        const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
        idle(
          () => {
            if (hasWebGL()) setMode('live');
            else {
              setCanLive(false);
              stage('still');
            }
          },
          { timeout: 2500 },
        );
      };
      if (document.readyState === 'complete') start();
      else window.addEventListener('load', start, { once: true });
    } else {
      stage('still');
    }
    return () => {
      reduce.removeEventListener('change', onReduce);
      window.removeEventListener('resize', pickOrient);
    };
  }, []);

  // Scroll → tour progress and landing (the 3D city, the pictures and the clouds subscribe to them).
  useEffect(() => {
    // clouds the camera drops through while landing (cover peaks exactly at the globe→city swap)
    const paintClouds = () => {
      const el = cloudsRef.current;
      if (!el) return;
      const v = introStore.get();
      const cover = cloudCover(v);
      el.style.opacity = cover.toFixed(3);
      el.style.visibility = cover > 0.001 ? 'visible' : 'hidden';
      el.classList.toggle('is-on', cover > 0.001);
      el.style.setProperty('--fill', (cover * cover * cover).toFixed(3));
      if (cover <= 0.001) return;
      // fly-through: banks grow and rush outward from the centre as the camera passes them
      const q = Math.min(1, Math.max(0, (v - 0.45) / 0.55));
      const fly = q * q * (3 - 2 * q);
      el.querySelectorAll<HTMLElement>('.cloud').forEach((cloud, i) => {
        const c = CLOUDS[i];
        const dx = (c.x - 50) * fly * 1.6 * c.depth;
        const dy = (c.y - 50) * fly * 1.6 * c.depth;
        cloud.style.transform = `translate(${dx.toFixed(2)}vw, ${dy.toFixed(2)}vh) scale(${(1 + fly * 2.2 * c.depth).toFixed(3)})`;
      });
    };
    const unsubClouds = introStore.subscribe(paintClouds);
    paintClouds();

    if (renderMode) {
      window.__setProgress = (p: number) => progressStore.set(p, true);
      window.__setIntro = (v: number) => introStore.set(v, true);
      return unsubClouds;
    }

    let sections: HTMLElement[] = [];
    let frame = 0;
    const collect = () => {
      sections = Array.from(document.querySelectorAll<HTMLElement>('[data-stop]'));
    };
    const hero = document.getElementById('city');
    const update = () => {
      frame = 0;
      introStore.set(measureIntro(hero));
      progressStore.set(measureProgress(sections));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    collect();
    update();
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      unsubClouds();
      ro.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
    };
  }, [renderMode]);

  const onReady = useCallback(() => setLiveShown(true), []);

  // Keep the pictures underneath until the live city has finished fading in.
  const [stillsGone, setStillsGone] = useState(false);
  useEffect(() => {
    if (!liveShown) return;
    const t = window.setTimeout(() => setStillsGone(true), 900);
    // Pre-raster the landing clouds once, nearly invisible, while nothing is happening, so their
    // first real appearance mid-dive doesn't stall a frame on a cold GPU.
    const w = window.setTimeout(() => {
      const el = cloudsRef.current;
      if (!el || el.classList.contains('is-on')) return;
      el.style.visibility = 'visible';
      el.style.opacity = '0.001';
      el.classList.add('is-on');
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (introStore.get() > 0.001 && cloudCover(introStore.get()) > 0.001) return; // already in use
          el.style.visibility = 'hidden';
          el.style.opacity = '0';
          el.classList.remove('is-on');
        }),
      );
    }, 1200);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(w);
    };
  }, [liveShown]);

  return (
    <>
      <div className="stage" aria-hidden="true">
        <div className="sky" />
        {!stillsGone && !renderMode && <StillLayer />}
        {mode === 'live' && (
          <div className={`live ${liveShown ? 'is-shown' : ''}`}>
            <LiveGuard
              onFail={() => {
                setMode('still');
                setCanLive(false);
                document.documentElement.dataset.stage = 'still';
              }}
            >
              <LiveCity orient={orient} snap={reduced} renderMode={renderMode} onReady={onReady} />
            </LiveGuard>
            {/* on top of the canvas: keeps the glass-card blur warm (see .glass-warm in globals.css) */}
            <div className="glass-warm" />
          </div>
        )}
        <div ref={cloudsRef} className="clouds">
          <div className="cloud-fill" />
          {CLOUDS.map((c, i) => (
            <span
              key={i}
              className="cloud"
              style={{ left: `${c.x - c.w / 2}%`, top: `${c.y - c.h / 2}%`, width: `${c.w}%`, height: `${c.h}%` }}
            />
          ))}
        </div>
        <div className="tilt tilt-top" />
        <div className="tilt tilt-bottom" />
      </div>
      {mode === 'still' && canLive && !renderMode && (
        <button type="button" className="enter-3d" onClick={() => setMode('live')}>
          <span aria-hidden="true">◈</span> Enter the 3D city
        </button>
      )}
    </>
  );
}
