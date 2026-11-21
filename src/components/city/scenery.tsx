'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { C, geo, glow, mat, rng } from './kit';
import { PLACES, PLINTH, TRACK, panes, trackHeading, trackPoint, trackSpeed, trainThetaAt } from './layout';
import { Block, Cyl, Dome, Windows } from './parts';
import { nightAt, progressStore, segment } from '@/lib/progress';

function roundedRect(w: number, d: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** The diorama base: paved top, earthy sides. */
export function Plinth() {
  const g = useMemo(() => {
    const geom = new THREE.ExtrudeGeometry(roundedRect(PLINTH.w, PLINTH.d, PLINTH.r), {
      depth: PLINTH.h,
      bevelEnabled: false,
      curveSegments: 10,
    });
    geom.rotateX(-Math.PI / 2);
    return geom;
  }, []);
  return (
    <group>
      <mesh geometry={g} material={[mat(C.paving), mat(C.earth)]} position={[0, -PLINTH.h, 0]} receiveShadow />
      {/* a darker band at the foot, like a model's base board */}
      <mesh geometry={g} material={[mat(C.dark), mat(C.dark)]} position={[0, -PLINTH.h - 0.25, 0]} scale={[1.01, 0.18, 1.01]} />
    </group>
  );
}

/** Central park (a nod to Sayaji Baug), with a pond and seeded trees. */
export function Park() {
  return (
    <group>
      <mesh geometry={geo.cyl} material={mat(C.grass)} scale={[6.6, 0.06, 4.7]} receiveShadow />
      <mesh geometry={geo.cyl} material={mat(C.water)} position={[-2.1, 0.02, 0.9]} scale={[1.7, 0.06, 1.0]} receiveShadow />
      <Block p={[-2.1, 0.06, 2.0]} s={[0.9, 0.08, 0.3]} c={C.wood} />
    </group>
  );
}

/** Trees: one instanced draw call for canopies, one for trunks. */
export function Trees() {
  const canopies = useRef<THREE.InstancedMesh>(null);
  const trunks = useRef<THREE.InstancedMesh>(null);
  const spots = useMemo(() => {
    const r = rng(7);
    const out: { x: number; z: number; s: number; c: number }[] = [];
    // park trees, keeping clear of the pond
    let guard = 0;
    while (out.length < 18 && guard++ < 500) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r());
      const x = Math.cos(a) * 5.8 * d, z = Math.sin(a) * 4.0 * d;
      if (Math.hypot((x + 2.1) / 2.2, (z - 0.9) / 1.5) < 1) continue;
      if (out.some((t) => Math.hypot(t.x - x, t.z - z) < 1.1)) continue;
      out.push({ x, z, s: 0.55 + r() * 0.35, c: Math.floor(r() * 3) });
    }
    // edge trees between buildings
    const edge: [number, number][] = [
      [-6.5, 11.6], [-4.6, 12.2], [5.2, 11.8], [6.7, 12.3], [14.4, 8.2], [-14.6, 6.4], [-14.8, -8.6],
      [-5.0, -12.2], [-3.4, -12.6], [15.0, 1.8], [-12.4, -11.6],
    ];
    edge.forEach(([x, z]) => out.push({ x, z, s: 0.6 + r() * 0.35, c: Math.floor(r() * 3) }));
    return out;
  }, []);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const greens = [C.grass, C.grassDark, '#a9c08a'].map((c) => new THREE.Color(c));
    spots.forEach((t, i) => {
      m.makeScale(t.s, t.s * 1.15, t.s).setPosition(t.x, 0.7 + t.s * 0.9, t.z);
      canopies.current!.setMatrixAt(i, m);
      canopies.current!.setColorAt(i, greens[t.c]);
      m.makeScale(0.08, 0.8 + t.s * 0.6, 0.08).setPosition(t.x, 0, t.z);
      trunks.current!.setMatrixAt(i, m);
    });
    canopies.current!.instanceMatrix.needsUpdate = true;
    trunks.current!.instanceMatrix.needsUpdate = true;
  }, [spots]);

  return (
    <>
      <instancedMesh ref={canopies} args={[geo.canopy, mat('#ffffff'), spots.length]} castShadow receiveShadow />
      <instancedMesh ref={trunks} args={[geo.cyl, mat(C.wood), spots.length]} castShadow />
    </>
  );
}

/** The toy-train track: gravel bed, two rails and sleepers. */
export function Track() {
  const { bed, rails } = useMemo(() => {
    const ring = new THREE.Shape();
    ring.absellipse(0, 0, TRACK.a + 0.6, TRACK.b + 0.6, 0, Math.PI * 2, false, 0);
    const hole = new THREE.Path();
    hole.absellipse(0, 0, TRACK.a - 0.6, TRACK.b - 0.6, 0, Math.PI * 2, true, 0);
    ring.holes.push(hole);
    const bedGeo = new THREE.ExtrudeGeometry(ring, { depth: 0.06, bevelEnabled: false, curveSegments: 64 }).rotateX(-Math.PI / 2);
    const rail = (off: number) => {
      const pts = Array.from({ length: 160 }, (_, i) => {
        const t = (i / 160) * Math.PI * 2;
        return new THREE.Vector3((TRACK.a + off) * Math.cos(t), 0.13, (TRACK.b + off) * Math.sin(t));
      });
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 240, 0.04, 6, true);
    };
    return { bed: bedGeo, rails: [rail(-0.28), rail(0.28)] };
  }, []);

  const sleepers = useRef<THREE.InstancedMesh>(null);
  const count = 84;
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const s = new THREE.Vector3(0.16, 0.05, 0.8);
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2;
      const { x, z } = trackPoint(t);
      q.setFromEuler(e.set(0, trackHeading(t), 0));
      m.compose(v.set(x, 0.06, z), q, s);
      sleepers.current!.setMatrixAt(i, m);
    }
    sleepers.current!.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <group>
      <mesh geometry={bed} material={mat(C.gravel)} receiveShadow />
      <instancedMesh ref={sleepers} args={[geo.box, mat(C.wood), count]} receiveShadow />
      {rails.map((g, i) => (
        <mesh key={i} geometry={g} material={mat(C.dark)} />
      ))}
    </group>
  );
}

/** Street lamps around the track. Bulbs brighten as night falls. */
export function Lamps() {
  const posts = useRef<THREE.InstancedMesh>(null);
  const bulbs = useRef<THREE.InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const bulbMat = useMemo(() => new THREE.MeshBasicMaterial({ color: C.glow }), []);
  const count = 12;
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2 + 0.2;
      const { x, z } = trackPoint(t, TRACK.a + 1.25, TRACK.b + 1.25);
      m.makeScale(0.035, 1.15, 0.035).setPosition(x, 0, z);
      posts.current!.setMatrixAt(i, m);
      m.makeScale(0.1, 0.1, 0.1).setPosition(x, 1.2, z);
      bulbs.current!.setMatrixAt(i, m);
    }
    posts.current!.instanceMatrix.needsUpdate = true;
    bulbs.current!.instanceMatrix.needsUpdate = true;
    const dim = new THREE.Color('#8a7a8f');
    const lit = new THREE.Color(C.glow);
    const paint = () => {
      const n = THREE.MathUtils.smoothstep(nightAt(progressStore.get()), 0.15, 0.6);
      bulbMat.color.lerpColors(dim, lit, n);
      invalidate();
    };
    paint();
    return progressStore.subscribe(paint);
  }, [bulbMat, invalidate]);
  return (
    <>
      <instancedMesh ref={posts} args={[geo.cyl, mat(C.dark), count]} castShadow />
      <instancedMesh ref={bulbs} args={[geo.sphere, bulbMat, count]} />
    </>
  );
}

/** A stylised nod to Laxmi Vilas Palace: long sandstone facade, central clock tower, onion domes. */
export function Palace() {
  const w = useMemo(
    () => [
      ...panes(9.4, 2.2, ['front', 'back'], { cols: 14, rows: 2, y0: 0.85, y1: 1.75, pw: 0.24, ph: 0.42 }).map((p) => ({
        ...p,
        p: [p.p[0], p.p[1] + 0.3, p.p[2]] as [number, number, number],
      })),
      ...panes(6.8, 1.7, ['front', 'back'], { cols: 9, rows: 1, y0: 0.5, y1: 0.5, pw: 0.22, ph: 0.36 }).map((p) => ({
        ...p,
        p: [p.p[0], p.p[1] + 2.45, p.p[2]] as [number, number, number],
      })),
      ...panes(1.4, 1.4, ['front', 'back', 'left', 'right'], { cols: 1, rows: 3, y0: 1.6, y1: 3.4, colsSide: 1 }).map((p) => ({
        ...p,
        p: [p.p[0], p.p[1] + 2.3, p.p[2]] as [number, number, number],
      })),
    ],
    [],
  );
  const chhatri = (x: number) => (
    <group key={x} position={[x, 2.45, 0.55]}>
      {[[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]].map(([a, b], i) => (
        <Cyl key={i} p={[a, 0, b]} r={0.04} h={0.55} c={C.stone} />
      ))}
      <Block p={[0, 0.55, 0]} s={[0.6, 0.07, 0.6]} c={C.stoneDeep} />
      <Dome p={[0, 0.62, 0]} size={0.42} />
    </group>
  );
  return (
    <group position={[PLACES.palace.x, 0, PLACES.palace.z]}>
      <Block s={[10.6, 0.3, 3.2]} c={C.stoneDeep} />
      <Block p={[0, 0.3, 0]} s={[9.4, 2.0, 2.2]} c={C.stone} />
      <Block p={[0, 2.3, 0]} s={[9.6, 0.15, 2.4]} c={C.stoneDeep} />
      <Block p={[0, 2.45, 0]} s={[6.8, 1.0, 1.7]} c={C.stone} />
      <Block p={[0, 3.45, 0]} s={[7.0, 0.12, 1.9]} c={C.stoneDeep} />
      {/* porch */}
      <Block p={[0, 0.3, 1.45]} s={[2.2, 1.55, 0.7]} c={C.stone} />
      <Block p={[0, 1.85, 1.45]} s={[2.35, 0.12, 0.8]} c={C.stoneDeep} />
      {[-0.65, 0, 0.65].map((x) => (
        <Block key={x} p={[x, 0.3, 1.81]} s={[0.4, 1.0, 0.02]} c={C.glassDark} shadow={false} />
      ))}
      {/* clock tower with an open belvedere */}
      <Block p={[0, 2.3, 0]} s={[1.4, 4.2, 1.4]} c={C.stone} />
      <Block p={[0, 6.5, 0]} s={[1.6, 0.14, 1.6]} c={C.stoneDeep} />
      {[[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]].map(([a, b], i) => (
        <Cyl key={i} p={[a, 6.64, b]} r={0.07} h={0.8} c={C.stone} />
      ))}
      <Block p={[0, 7.44, 0]} s={[1.6, 0.12, 1.6]} c={C.stoneDeep} />
      <Dome p={[0, 7.56, 0]} size={1.0} />
      <mesh geometry={geo.cyl} material={mat(C.white)} position={[0, 5.3, 0.71]} rotation-x={Math.PI / 2} scale={[0.36, 0.03, 0.36]} />
      <mesh geometry={geo.cyl} material={mat(C.white)} position={[0, 5.3, -0.71]} rotation-x={-Math.PI / 2} scale={[0.36, 0.03, 0.36]} />
      {/* drums and domes */}
      {[-2.5, 2.5].map((x) => (
        <group key={x}>
          <Cyl p={[x, 3.57, 0]} r={0.5} h={0.4} c={C.stone} />
          <Dome p={[x, 3.97, 0]} size={0.85} />
        </group>
      ))}
      {[-4.3, 4.3].map((x) => chhatri(x))}
      <Windows items={w} seed={81} />
    </group>
  );
}

/** The toy train: an engine and three carriages. Its place on the track follows the tour. */
export function Train() {
  const cars = useRef<(THREE.Group | null)[]>([]);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    const place = () => {
      const { from, to, t } = segment(progressStore.get());
      let theta = trainThetaAt(from, to, t);
      cars.current.forEach((g, i) => {
        if (!g) return;
        if (i > 0) theta -= 1.45 / trackSpeed(theta);
        const { x, z } = trackPoint(theta);
        g.position.set(x, 0.12, z);
        g.rotation.y = trackHeading(theta);
      });
      invalidate();
    };
    place();
    return progressStore.subscribe(place);
  }, [invalidate]);

  const wheels = (len: number) =>
    [-len / 3, len / 3].flatMap((x) =>
      [-0.31, 0.31].map((z) => (
        <mesh key={`${x}${z}`} geometry={geo.cyl} material={mat(C.dark)} position={[x, 0.15, z]} rotation-x={Math.PI / 2} scale={[0.14, 0.06, 0.14]} />
      )),
    );
  const carColors = [C.teal, C.cream, C.lavender];

  return (
    <group>
      <group ref={(g) => { cars.current[0] = g; }}>
        <Block p={[0, 0.08, 0]} s={[1.5, 0.18, 0.62]} c={C.dark} />
        <mesh geometry={geo.cyl} material={mat(C.postRed)} position={[-0.25, 0.53, 0]} rotation-z={-Math.PI / 2} scale={[0.27, 0.95, 0.27]} castShadow />
        <mesh geometry={geo.cyl} material={mat(C.dark)} position={[0.7, 0.53, 0]} rotation-z={-Math.PI / 2} scale={[0.2, 0.06, 0.2]} />
        <Cyl p={[0.48, 0.75, 0]} r={0.08} h={0.34} c={C.dark} />
        <Block p={[-0.45, 0.26, 0]} s={[0.55, 0.64, 0.66]} c={C.postRed} />
        <Block p={[-0.45, 0.9, 0]} s={[0.72, 0.07, 0.78]} c={C.dark} />
        <Block p={[-0.45, 0.6, 0]} s={[0.3, 0.2, 0.68]} c={C.glassDark} shadow={false} />
        {wheels(1.4)}
      </group>
      {carColors.map((c, i) => (
        <group key={i} ref={(g) => { cars.current[i + 1] = g; }}>
          <Block p={[0, 0.08, 0]} s={[1.25, 0.12, 0.6]} c={C.dark} />
          <Block p={[0, 0.2, 0]} s={[1.18, 0.48, 0.58]} c={c} />
          <Block p={[0, 0.44, 0]} s={[1.0, 0.15, 0.6]} c={C.glassDark} shadow={false} />
          <Block p={[0, 0.68, 0]} s={[1.3, 0.06, 0.68]} c={C.clay} />
          {wheels(1.2)}
        </group>
      ))}
    </group>
  );
}
