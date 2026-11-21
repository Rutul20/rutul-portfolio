'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { geo, mat, glow, rng, C } from './kit';
import type { Pane, V3 } from './layout';
import { nightAt, progressStore } from '@/lib/progress';

type Common = { p?: V3; ry?: number; rx?: number; rz?: number; c: string; shadow?: boolean };

/** A box with its base at p. s = [width, height, depth]. */
export function Block({ p = [0, 0, 0], s, c, ry = 0, rx = 0, rz = 0, shadow = true }: Common & { s: V3 }) {
  return (
    <mesh
      geometry={geo.box}
      material={mat(c)}
      position={p}
      scale={s}
      rotation={[rx, ry, rz]}
      castShadow={shadow}
      receiveShadow
    />
  );
}

/** A vertical cylinder with its base at p. */
export function Cyl({ p = [0, 0, 0], r, h, c, rx = 0, rz = 0, shadow = true }: Common & { r: number; h: number }) {
  return (
    <mesh
      geometry={geo.cyl}
      material={mat(c)}
      position={p}
      scale={[r, h, r]}
      rotation={[rx, 0, rz]}
      castShadow={shadow}
      receiveShadow
    />
  );
}

export function Pyramid({ p = [0, 0, 0], s, c }: Common & { s: V3 }) {
  return <mesh geometry={geo.pyramid} material={mat(c)} position={p} scale={s} castShadow receiveShadow />;
}

/** Gable roof: ridge runs along z unless rotated. s = [span, rise, length]. */
export function Gable({ p = [0, 0, 0], s, c, ry = 0 }: Common & { s: V3 }) {
  return <mesh geometry={geo.gable} material={mat(c)} position={p} scale={s} rotation-y={ry} castShadow receiveShadow />;
}

/** Onion dome with a little spire, the palace's signature shape. */
export function Dome({ p = [0, 0, 0], size, c = C.dome }: { p?: V3; size: number; c?: string }) {
  return (
    <group position={p} scale={size}>
      <mesh geometry={geo.onion} material={mat(c)} castShadow receiveShadow />
      <mesh geometry={geo.cyl} material={mat(C.stoneDeep)} position={[0, 1.18, 0]} scale={[0.035, 0.32, 0.035]} />
    </group>
  );
}

const DARK = new THREE.Color(C.glassDark);
const LIT = new THREE.Color(C.glow);

/**
 * All window panes of one building in a single draw call. Each pane has its own "bedtime":
 * as the tour moves from dusk to night more of them light up.
 */
export function Windows({ items, seed }: { items: Pane[]; seed: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const thresholds = useMemo(() => {
    const r = rng(seed);
    return items.map(() => r());
  }, [items, seed]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const s = new THREE.Vector3();
    items.forEach((w, i) => {
      q.setFromEuler(e.set(0, w.ry, 0));
      m.compose(v.set(...w.p), q, s.set(w.w, w.h, 1));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, DARK);
    });
    mesh.instanceMatrix.needsUpdate = true;

    const col = new THREE.Color();
    let last = -1;
    const paint = () => {
      const night = nightAt(progressStore.get());
      if (Math.abs(night - last) < 0.003) return;
      last = night;
      thresholds.forEach((th, i) => {
        const lit = THREE.MathUtils.clamp((night - th * 0.9) / 0.08, 0, 1);
        mesh.setColorAt(i, col.lerpColors(DARK, LIT, lit));
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      invalidate();
    };
    paint();
    return progressStore.subscribe(paint);
  }, [items, thresholds, invalidate]);

  return <instancedMesh ref={ref} args={[geo.plane, glow('#ffffff'), items.length]} frustumCulled={false} />;
}

/** A sign or board with text painted on a canvas texture. */
export function useTextTexture(text: string, opts: { bg: string; fg: string; w?: number; h?: number; font?: string }) {
  return useMemo(() => {
    const { bg, fg, w = 512, h = 128, font = '800 78px "Arial Black", Arial, sans-serif' } = opts;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext('2d')!;
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = fg;
    g.lineWidth = 10;
    g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = fg;
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 4);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
}
