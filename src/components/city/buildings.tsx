'use client';

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { C, geo, glow, mat } from './kit';
import { PLACES, outward, panes } from './layout';
import { Block, Cyl, Dome, Gable, Pyramid, Windows, useTextTexture } from './parts';
import { clientWork, stops } from '@/content/content';

/** Scrolls the page to a stop's section; the camera follows the scroll. */
export function goToStop(index: number) {
  const el = document.getElementById(stops[index].id);
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // lay every stop out first so the jump lands exactly (see AnchorFix)
  document.documentElement.classList.add('stops-laid-out');
  requestAnimationFrame(() =>
    requestAnimationFrame(() => el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })),
  );
}

/** A building that belongs to a stop: lifts slightly on hover, and clicking it jumps to that stop. */
function StopGroup({ index, x, z, ry, children }: { index: number; x: number; z: number; ry?: number; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  const { invalidate, gl } = useThree((s) => ({ invalidate: s.invalidate, gl: s.gl }));
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const next = THREE.MathUtils.damp(g.scale.x, hover ? 1.06 : 1, 12, dt);
    if (Math.abs(next - g.scale.x) > 1e-4) {
      g.scale.setScalar(next);
      invalidate();
    }
  });
  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHover(true);
    gl.domElement.style.cursor = 'pointer';
    gl.domElement.title = `${stops[index].label}: ${stops[index].place}`;
    invalidate();
  };
  const out = () => {
    setHover(false);
    gl.domElement.style.cursor = '';
    gl.domElement.title = '';
    invalidate();
  };
  return (
    <group
      ref={ref}
      position={[x, 0, z]}
      rotation-y={ry ?? outward(x, z)}
      onPointerOver={over}
      onPointerOut={out}
      onClick={(e) => {
        e.stopPropagation();
        goToStop(index);
      }}
    >
      {children}
    </group>
  );
}

const Tank = ({ x, y, z }: { x: number; y: number; z: number }) => (
  <Cyl p={[x, y, z]} r={0.2} h={0.32} c={C.tank} />
);

/** Stop 1: home. A small house with a pyramid roof and a tree by the door. */
function House() {
  const w = useMemo(
    () => [
      ...panes(2, 1.8, ['front'], { cols: 2, rows: 1, y0: 0.85, y1: 0.85, inset: 0.45 }),
      ...panes(2, 1.8, ['left', 'right'], { cols: 1, rows: 1, y0: 0.85, y1: 0.85 }),
    ],
    [],
  );
  return (
    <StopGroup index={1} {...PLACES.house}>
      <Block s={[2.4, 0.12, 2.2]} c={C.sand} />
      <Block p={[0, 0.12, 0]} s={[2, 1.45, 1.8]} c={C.cream} />
      <Pyramid p={[0, 1.57, 0]} s={[2.35, 1.0, 2.15]} c={C.terracotta} />
      <Block p={[0, 0.12, 0.9]} s={[0.42, 0.75, 0.04]} c={C.plum} />
      <Windows items={w} seed={11} />
      <Cyl p={[1.6, 0, 0.6]} r={0.07} h={0.6} c={C.wood} />
      <mesh geometry={geo.canopy} material={mat(C.grassDark)} position={[1.6, 0.95, 0.6]} scale={0.55} castShadow />
      <Cyl p={[-1.25, 0, 1.25]} r={0.03} h={0.85} c={C.dark} shadow={false} />
      <mesh geometry={geo.sphere} material={glow(C.glow)} position={[-1.25, 0.92, 1.25]} scale={0.08} />
    </StopGroup>
  );
}

/** Stop 2: office street. Three offices growing taller over time: intern → developer → lead. */
function OfficeStreet() {
  const specs = [
    { x: 3.7, w: 1.6, h: 2.0, d: 1.6, c: C.teal, cols: 2, rows: 2 }, // Odysseus, 2019–20
    { x: 0.2, w: 2.0, h: 3.4, d: 1.8, c: C.lavender, cols: 3, rows: 4 }, // OpenEyes, 2020–21
    { x: -3.6, w: 2.4, h: 5.6, d: 2.2, c: C.cream, cols: 3, rows: 7 }, // AV Devs, 2021–
  ];
  const wins = useMemo(
    () =>
      specs.map((b) =>
        panes(b.w, b.d, ['front', 'left', 'right', 'back'], {
          cols: b.cols,
          rows: b.rows,
          y0: 0.6,
          y1: b.h - 0.55,
          colsSide: 2,
        }).map((pn) => ({ ...pn, p: [pn.p[0] + b.x, pn.p[1], pn.p[2]] as [number, number, number] })),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  return (
    <StopGroup index={2} {...PLACES.office}>
      <Block p={[0, 0, 0.2]} s={[9.6, 0.1, 3.0]} c={C.sand} />
      {specs.map((b, i) => (
        <group key={i}>
          <Block p={[b.x, 0, 0]} s={[b.w, b.h, b.d]} c={b.c} />
          <Block p={[b.x, b.h, 0]} s={[b.w + 0.12, 0.12, b.d + 0.12]} c={i === 2 ? C.terracotta : C.stoneDeep} />
          <Tank x={b.x - b.w / 4} y={b.h + 0.12} z={-b.d / 5} />
          {i > 0 && <Tank x={b.x + b.w / 4} y={b.h + 0.12} z={-b.d / 5} />}
          <Block p={[b.x, 0, b.d / 2]} s={[0.5, 0.7, 0.05]} c={C.dark} />
          <Windows items={wins[i]} seed={20 + i} />
        </group>
      ))}
    </StopGroup>
  );
}

/** Stop 3: the post office (ePost). Generic, no branding: a portico and a red pillar box. */
function PostOffice() {
  const w = useMemo(
    () => [
      ...panes(3.6, 2.4, ['front'], { cols: 4, rows: 1, y0: 1.05, y1: 1.05, inset: 0.45 }),
      ...panes(3.6, 2.4, ['left', 'right', 'back'], { cols: 4, rows: 1, y0: 1.05, y1: 1.05, colsSide: 2 }),
    ],
    [],
  );
  const cols = [-1.2, -0.4, 0.4, 1.2];
  return (
    <StopGroup index={3} {...PLACES.post}>
      <Block s={[4.2, 0.22, 3.6]} c={C.stone} />
      <Block p={[0, 0.22, 0]} s={[3.6, 2.0, 2.4]} c={C.cream} />
      <Block p={[0, 2.22, 0]} s={[3.8, 0.16, 2.6]} c={C.clay} />
      {cols.map((x) => (
        <Cyl key={x} p={[x, 0.22, 1.55]} r={0.11} h={1.85} c={C.white} />
      ))}
      <Block p={[0, 2.07, 1.55]} s={[3.1, 0.15, 0.5]} c={C.white} />
      <Gable p={[0, 2.22, 1.5]} s={[3.1, 0.55, 0.5]} c={C.white} />
      <Block p={[0, 0.22, 1.21]} s={[0.6, 1.05, 0.04]} c={C.plum} />
      <Windows items={w} seed={31} />
      {/* pillar box */}
      <Cyl p={[1.75, 0, 2.15]} r={0.17} h={0.62} c={C.postRed} />
      <mesh geometry={geo.sphere} material={mat(C.postRed)} position={[1.75, 0.62, 2.15]} scale={[0.17, 0.12, 0.17]} castShadow />
      <Block p={[1.75, 0.46, 2.32]} s={[0.16, 0.03, 0.02]} c={C.dark} shadow={false} />
    </StopGroup>
  );
}

function Market() {
  const stalls = [-1.25, 0, 1.25];
  const awnings = [C.terracotta, C.teal, C.lavender];
  const w = useMemo(() => panes(3.8, 0.8, ['front'], { cols: 5, rows: 1, y0: 0.8, y1: 0.8 }).map((p) => ({ ...p, p: [p.p[0], p.p[1], p.p[2] - 0.9] as [number, number, number] })), []);
  return (
    <group>
      <Block s={[4.2, 0.08, 2.8]} c={C.sand} />
      <Block p={[0, 0, -0.9]} s={[3.8, 1.25, 0.8]} c={C.cream} />
      <Windows items={w} seed={41} />
      {stalls.map((x, i) => (
        <group key={x} position={[x, 0, 0.45]}>
          <Block s={[1.0, 0.45, 0.55]} c={C.wood} />
          {[-0.45, 0.45].map((px) => (
            <Cyl key={px} p={[px, 0, 0.25]} r={0.03} h={1.05} c={C.dark} />
          ))}
          {[0, 1, 2, 3].map((k) => (
            <Block
              key={k}
              p={[-0.375 + k * 0.25, 1.0, 0.05]}
              s={[0.25, 0.05, 0.95]}
              rx={0.28}
              c={k % 2 ? C.cream : awnings[i]}
            />
          ))}
          <Block p={[0.15, 0.45, 0.05]} s={[0.22, 0.14, 0.22]} c={i === 1 ? C.terracotta : C.signYellow} />
          <Block p={[-0.2, 0.45, -0.05]} s={[0.2, 0.12, 0.2]} c={C.grass} />
        </group>
      ))}
    </group>
  );
}

function School() {
  const w = useMemo(
    () => panes(3.6, 1.8, ['front', 'back'], { cols: 6, rows: 2, y0: 0.6, y1: 1.5 }),
    [],
  );
  return (
    <group>
      <Block s={[4.2, 0.08, 2.8]} c={C.grassDark} />
      <Block p={[0, 0.08, 0]} s={[3.6, 2.0, 1.8]} c={C.sand} />
      <Gable p={[0, 2.08, 0]} s={[1.9, 0.6, 3.75]} ry={Math.PI / 2} c={C.clay} />
      <Block p={[0, 0.08, 0.45]} s={[0.8, 2.75, 0.9]} c={C.cream} />
      <Pyramid p={[0, 2.83, 0.45]} s={[1.0, 0.5, 1.0]} c={C.clay} />
      <mesh geometry={geo.cyl} material={mat(C.white)} position={[0, 2.35, 0.91]} rotation-x={Math.PI / 2} scale={[0.22, 0.03, 0.22]} />
      <Block p={[0, 0.08, 0.9]} s={[0.45, 0.8, 0.04]} c={C.plum} />
      <Windows items={w} seed={42} />
      <Cyl p={[1.85, 0.08, 1.2]} r={0.025} h={1.9} c={C.dark} shadow={false} />
    </group>
  );
}

function Clinic() {
  const w = useMemo(
    () => [
      ...panes(2.4, 2.0, ['front'], { cols: 2, rows: 2, y0: 0.6, y1: 1.5, inset: 0.4 }),
      ...panes(2.4, 2.0, ['left', 'right', 'back'], { cols: 3, rows: 2, y0: 0.6, y1: 1.5, colsSide: 2 }),
    ],
    [],
  );
  return (
    <group>
      <Block s={[3.0, 0.08, 2.8]} c={C.sand} />
      <Block p={[0, 0.08, 0]} s={[2.4, 2.0, 2.0]} c={C.white} />
      <Block p={[0, 1.95, 0]} s={[2.5, 0.16, 2.1]} c={C.teal} />
      <Block p={[0, 0.08, 1.0]} s={[0.55, 0.85, 0.04]} c={C.tealDeep} />
      {/* a teal plus sign: deliberately not a red cross */}
      <Block p={[0, 1.3, 1.03]} s={[0.46, 0.14, 0.04]} c={C.tealDeep} shadow={false} />
      <Block p={[0, 1.14, 1.03]} s={[0.14, 0.46, 0.04]} c={C.tealDeep} shadow={false} />
      <Windows items={w} seed={43} />
    </group>
  );
}

/** A small brew shop (Pinter): glowing shop window, striped awning, kegs and crates. No branding. */
function Shop() {
  const w = useMemo(() => panes(2.4, 1.8, ['left', 'right', 'back'], { cols: 2, rows: 1, y0: 1.15, y1: 1.15, colsSide: 2 }), []);
  return (
    <group>
      <Block s={[3.0, 0.08, 2.8]} c={C.paving} />
      <Block p={[0, 0.08, 0]} s={[2.4, 1.75, 1.8]} c={C.teal} />
      <Gable p={[0, 1.83, 0]} s={[1.95, 0.6, 2.55]} ry={Math.PI / 2} c={C.dark} />
      {/* shop window and door */}
      <Block p={[-0.35, 0.35, 0.9]} s={[1.2, 0.8, 0.04]} c={C.glassDark} shadow={false} />
      <mesh geometry={geo.plane} material={glow(C.glow)} position={[-0.35, 0.75, 0.925]} scale={[1.08, 0.7, 1]} />
      <Block p={[0.75, 0.08, 0.9]} s={[0.42, 0.9, 0.04]} c={C.plum} />
      {/* striped awning */}
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <Block key={k} p={[-1.0 + k * 0.4, 1.2, 1.12]} s={[0.4, 0.05, 0.55]} rx={0.32} c={k % 2 ? C.cream : C.terracotta} />
      ))}
      {/* round hanging sign */}
      <Block p={[1.32, 1.4, 0.95]} s={[0.3, 0.03, 0.03]} c={C.dark} shadow={false} />
      <mesh geometry={geo.cyl} material={mat(C.signYellow)} position={[1.42, 1.18, 0.95]} rotation-x={Math.PI / 2} scale={[0.18, 0.04, 0.18]} castShadow />
      {/* kegs and crates */}
      {[-1.05, -0.65].map((x) => (
        <Cyl key={x} p={[x, 0.08, 1.45]} r={0.17} h={0.42} c={C.wood} />
      ))}
      <Block p={[0.25, 0.08, 1.5]} s={[0.4, 0.28, 0.32]} c={C.sand} />
      <Block p={[0.3, 0.36, 1.5]} s={[0.32, 0.22, 0.28]} c={C.wood} />
      <Windows items={w} seed={44} />
    </group>
  );
}

/** Stop 4: client work. One building per client project, in the order listed in content.ts. */
function ClientQuarter() {
  const slots = [PLACES.market, PLACES.school, PLACES.clinic, PLACES.shop];
  const models = { market: Market, school: School, clinic: Clinic, shop: Shop };
  return (
    <>
      {clientWork.slice(0, slots.length).map((project, i) => {
        const Model = models[project.building ?? 'market'];
        return (
          <StopGroup key={project.name} index={4} {...slots[i]}>
            <Model />
          </StopGroup>
        );
      })}
    </>
  );
}

/** Stop 5: the workshop (side projects + skills). Lights on inside, a little portal ring, a price tag. */
function Workshop() {
  const w = useMemo(() => panes(3.0, 2.4, ['left', 'right', 'back'], { cols: 3, rows: 1, y0: 1.2, y1: 1.2, colsSide: 2 }), []);
  return (
    <StopGroup index={5} {...PLACES.garage}>
      <Block s={[3.8, 0.08, 3.6]} c={C.gravel} />
      <Block p={[0, 0.08, 0]} s={[3.0, 2.0, 2.4]} c={C.lavender} />
      <Gable p={[0, 2.08, 0]} s={[3.2, 0.7, 2.6]} c={C.dark} />
      <Block p={[0, 0.08, 1.19]} s={[1.9, 1.35, 0.04]} c={C.glassDark} shadow={false} />
      {/* warm workshop light through the open door */}
      <mesh geometry={geo.plane} material={glow(C.glow)} position={[0, 0.72, 1.225]} scale={[1.7, 1.15, 1]} />
      <Block p={[0, 0.08, 1.24]} s={[1.2, 0.5, 0.05]} c={C.wood} shadow={false} />
      <Block p={[0, 1.43, 1.22]} s={[2.0, 0.14, 0.06]} c={C.stoneDeep} />
      <Windows items={w} seed={51} />
      {/* NEXORA nod */}
      <mesh geometry={geo.torus} material={glow(C.portal)} position={[1.85, 0.6, 1.5]} rotation-y={0.5} />
      <Block p={[1.85, 0.08, 1.5]} s={[0.5, 0.06, 0.2]} c={C.dark} />
      {/* Sasta nod: a price tag on the roof */}
      <group position={[-0.7, 2.25, 0.6]} rotation={[0, 0, 0.35]}>
        <Block s={[0.8, 0.46, 0.06]} c={C.signYellow} />
        <Cyl p={[-0.28, 0.23, 0.0]} r={0.06} h={0.07} c={C.dark} rx={Math.PI / 2} shadow={false} />
      </group>
      <Block p={[-1.15, 0.08, 1.6]} s={[0.5, 0.35, 0.4]} c={C.wood} />
    </StopGroup>
  );
}

/** Stop 6: college on the edge of town. Brick, white columns and a clock tower. */
function College() {
  const w = useMemo(() => panes(4.0, 2.2, ['front', 'back', 'left', 'right'], { cols: 6, rows: 2, y0: 0.7, y1: 1.65, colsSide: 2 }), []);
  return (
    <StopGroup index={6} {...PLACES.college}>
      <Block s={[4.8, 0.14, 3.4]} c={C.stone} />
      <Block p={[0, 0.14, 0]} s={[4.0, 2.2, 2.2]} c={C.brick} />
      <Gable p={[0, 2.34, 0]} s={[2.35, 0.7, 4.2]} ry={Math.PI / 2} c={C.clay} />
      {[-0.9, -0.3, 0.3, 0.9].map((x) => (
        <Cyl key={x} p={[x, 0.14, 1.35]} r={0.09} h={1.9} c={C.white} />
      ))}
      <Block p={[0, 2.04, 1.3]} s={[2.3, 0.14, 0.5]} c={C.white} />
      <Block p={[0, 0.14, 0]} s={[1.0, 3.9, 1.0]} c={C.brick} />
      <Block p={[0, 4.04, 0]} s={[1.1, 0.1, 1.1]} c={C.white} />
      <Pyramid p={[0, 4.14, 0]} s={[1.15, 0.85, 1.15]} c={C.clay} />
      <mesh geometry={geo.cyl} material={mat(C.white)} position={[0, 3.35, 0.51]} rotation-x={Math.PI / 2} scale={[0.28, 0.03, 0.28]} />
      <Windows items={w} seed={61} />
    </StopGroup>
  );
}

/** Stop 7 (and the tour's start): the station, with a yellow Indian-railways-style name board. */
function Station() {
  const sign = useTextTexture('VADODARA', { bg: C.signYellow, fg: '#1d1a22' });
  const w = useMemo(
    () =>
      panes(2.6, 1.2, ['front'], { cols: 3, rows: 1, y0: 0.85, y1: 0.85 }).map((pn) => ({
        ...pn,
        p: [pn.p[0], pn.p[1], pn.p[2] + 0.55] as [number, number, number],
      })),
    [],
  );
  return (
    <StopGroup index={7} {...PLACES.station} ry={0}>
      {/* platform beside the track */}
      <Block p={[0, 0, -1.05]} s={[6.4, 0.32, 1.3]} c={C.stone} />
      {[-2.4, -0.8, 0.8, 2.4].map((x) => (
        <Cyl key={x} p={[x, 0.32, -1.0]} r={0.05} h={1.3} c={C.tealDeep} />
      ))}
      <Block p={[0, 1.62, -1.05]} s={[5.6, 0.1, 1.5]} c={C.tealDeep} />
      {/* station building */}
      <Block p={[0, 0, 0.55]} s={[2.6, 1.5, 1.2]} c={C.cream} />
      <Gable p={[0, 1.5, 0.55]} s={[1.35, 0.5, 2.8]} ry={Math.PI / 2} c={C.terracotta} />
      <Windows items={w} seed={71} />
      {/* name board, facing the front of the city */}
      {[-0.95, 0.95].map((x) => (
        <Cyl key={x} p={[x + 3.7, 0, 0.35]} r={0.04} h={1.05} c={C.dark} />
      ))}
      {/* one board per side, so the name reads correctly from the front and from behind */}
      {[0, Math.PI].map((ry) => (
        <mesh key={ry} position={[3.7, 1.15, 0.36]} rotation-y={ry} castShadow={ry === 0}>
          <planeGeometry args={[2.3, 0.58]} />
          <meshLambertMaterial map={sign} side={THREE.FrontSide} />
        </mesh>
      ))}
    </StopGroup>
  );
}

export function Buildings() {
  return (
    <>
      <House />
      <OfficeStreet />
      <PostOffice />
      <ClientQuarter />
      <Workshop />
      <College />
      <Station />
    </>
  );
}
