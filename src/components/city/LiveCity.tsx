'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { cameraAt, frameXAt } from './layout';
import { Buildings } from './buildings';
import { Lamps, Palace, Park, Plinth, Track, Train, Trees } from './scenery';
import { Globe, GLOBE_R, globeCamera, PIN_DIR } from './Globe';
import { introStore, nightAt, progressStore, segment, SWAP } from '@/lib/progress';

/** landscape: city right of the cards · portrait: city above the cards · center: share image */
// how much further back the camera stands in portrait: fixed to the portrait pictures' shape (540×960)
const TALL_PORTRAIT = Math.pow(1.25 / (540 / 960), 0.78);
export type Orient = 'landscape' | 'portrait' | 'center';

declare global {
  interface Window {
    __renderReady?: number;
    __renderMeta?: { pin: [number, number]; alt: number };
  }
}

function CameraRig({ orient, snap, renderMode }: { orient: Orient; snap: boolean; renderMode: boolean }) {
  const { camera, size, invalidate } = useThree();
  const pos = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());
  const goalPos = useRef(new THREE.Vector3());
  const goalLook = useRef(new THREE.Vector3());
  const frame = useRef({ x: 0, y: 0, goalX: 0, goalY: 0, w: 0, h: 0 });
  const first = useRef(true);
  const settleFrames = useRef(0);

  const cam = camera as THREE.PerspectiveCamera;

  const applyOffset = () => {
    const f = frame.current;
    cam.setViewOffset(size.width, size.height, f.x * size.width, f.y * size.height, size.width, size.height);
    cam.updateProjectionMatrix();
    f.w = size.width;
    f.h = size.height;
  };

  useLayoutEffect(() => {
    applyOffset();
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height]);

  const mode = useRef<'globe' | 'city' | null>(null);

  useEffect(() => {
    const aim = () => {
      // Framing depends only on the orientation, never on the exact window shape, so the live 3D
      // always matches the pre-rendered pictures it replaces (those are cropped to fit, the same way).
      const tall = orient === 'portrait' ? TALL_PORTRAIT : 1;
      const v = introStore.get();
      const nextMode = v < SWAP ? 'globe' : 'city';
      // jump (don't glide) when the scene swaps under the clouds
      if (mode.current !== nextMode) first.current = true;
      mode.current = nextMode;

      if (nextMode === 'globe') {
        // the dive: whole toy globe → just above India (reduced motion: no zoom, the clouds just cut)
        const t = snap ? 0 : v / (SWAP - 0.02);
        const g = globeCamera(t, tall);
        goalPos.current.copy(g.position);
        goalLook.current.copy(g.target);
        const e = Math.min(1, Math.max(0, t));
        frame.current.goalX = orient === 'landscape' ? THREE.MathUtils.lerp(-0.2, -0.04, e) : 0;
        frame.current.goalY = orient === 'portrait' ? THREE.MathUtils.lerp(0.25, 0.08, e) : 0;
      } else {
        const p = progressStore.get();
        const { from, to, t } = snap ? { from: Math.round(p), to: Math.round(p), t: 0 } : segment(p);
        const c = cameraAt(from, to, t);
        frame.current.goalX = orient === 'landscape' ? frameXAt(from, to, t) : 0;
        frame.current.goalY = orient === 'portrait' ? 0.25 : orient === 'landscape' ? 0.02 : 0;
        // tall screens stand further back to fit the same buildings
        const back = orient === 'portrait' ? tall * c.tallBack : 1;
        // landing: the camera starts higher above the city and settles as the clouds clear
        const land = snap ? 1 : Math.min(1, (v - SWAP) / (1 - SWAP));
        const descend = 1 + 0.9 * (1 - land * land * (3 - 2 * land));
        const dir = new THREE.Vector3(c.position[0] - c.target[0], c.position[1] - c.target[1], c.position[2] - c.target[2]);
        goalLook.current.set(...c.target);
        goalPos.current.copy(goalLook.current).addScaledVector(dir, back * descend);
      }
      settleFrames.current = 0;
      invalidate();
    };
    aim();
    const a = progressStore.subscribe(aim);
    const b = introStore.subscribe(aim);
    return () => {
      a();
      b();
    };
  }, [snap, orient, size.width, size.height, invalidate]);

  useFrame((_, dt) => {
    const f = frame.current;
    if (first.current || snap || renderMode) {
      pos.current.copy(goalPos.current);
      look.current.copy(goalLook.current);
      f.x = f.goalX;
      f.y = f.goalY;
      first.current = false;
    } else {
      const k = 1 - Math.exp(-6 * Math.min(dt, 0.1));
      pos.current.lerp(goalPos.current, k);
      look.current.lerp(goalLook.current, k);
      f.x += (f.goalX - f.x) * k;
      f.y += (f.goalY - f.y) * k;
    }
    applyOffset();
    cam.position.copy(pos.current);
    cam.lookAt(look.current);
    const moving =
      pos.current.distanceToSquared(goalPos.current) > 1e-5 ||
      look.current.distanceToSquared(goalLook.current) > 1e-5 ||
      Math.abs(f.goalX - f.x) > 1e-4;
    if (moving) invalidate();
    else if (renderMode) {
      // a few settled frames so shadows and instanced colours are all up to date before the screenshot
      settleFrames.current++;
      if (settleFrames.current < 4) invalidate();
      else {
        // for the render script: where the Vadodara pin is on screen and how high the camera is above it
        const pin = PIN_DIR.clone().multiplyScalar(GLOBE_R);
        const alt = cam.position.distanceTo(pin);
        const ndc = pin.project(cam);
        window.__renderMeta = { pin: [(ndc.x + 1) / 2, (1 - ndc.y) / 2], alt };
        window.__renderReady = progressStore.get();
      }
    }
  });
  return null;
}

/** Sun and sky light drift from warm dusk to cool night along the tour. */
function Lights({ shadowSize }: { shadowSize: number }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const duskSun = new THREE.Color('#ffc38c'), nightSun = new THREE.Color('#a79fe6');
    const duskGround = new THREE.Color('#f0b591'), nightGround = new THREE.Color('#5e4b70');
    const apply = () => {
      const n = (nightAt(progressStore.get()) - 0.12) / 0.88;
      if (sun.current) {
        sun.current.color.lerpColors(duskSun, nightSun, n);
        sun.current.intensity = THREE.MathUtils.lerp(2.3, 1.0, n);
      }
      if (hemi.current) {
        hemi.current.groundColor.lerpColors(duskGround, nightGround, n);
        hemi.current.intensity = THREE.MathUtils.lerp(1.55, 0.95, n);
      }
      invalidate();
    };
    apply();
    return progressStore.subscribe(apply);
  }, [invalidate]);
  return (
    <>
      <hemisphereLight ref={hemi} args={['#d9ccff', '#f0b591', 1.55]} />
      <directionalLight
        ref={sun}
        position={[-15, 19, 13]}
        intensity={2.3}
        castShadow
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-camera-left={-21}
        shadow-camera-right={21}
        shadow-camera-top={19}
        shadow-camera-bottom={-19}
        shadow-camera-near={1}
        shadow-camera-far={70}
        shadow-bias={-0.0006}
        shadow-normalBias={0.03}
      />
    </>
  );
}

/** Tells the page the first frame is on screen, and drops resolution if frames are slow. */
function Health({ onReady, setDpr, renderMode }: { onReady: () => void; setDpr: (d: number) => void; renderMode: boolean }) {
  const frames = useRef(0);
  const slow = useRef<number[]>([]);
  const lowered = useRef(false);
  const invalidate = useThree((s) => s.invalidate);
  useFrame((_, dt) => {
    frames.current++;
    // the scene renders on demand, so ask for the first few frames explicitly
    if (frames.current < 3) invalidate();
    if (frames.current === 2) onReady();
    if (renderMode || lowered.current || frames.current < 10) return;
    // only count frames rendered back to back (the scene renders on demand)
    if (dt > 0.2) return;
    slow.current.push(dt);
    if (slow.current.length >= 45) {
      const avg = slow.current.reduce((a, b) => a + b, 0) / slow.current.length;
      slow.current = [];
      if (avg > 1 / 32) {
        lowered.current = true;
        setDpr(1);
      }
    }
  });
  return null;
}

export default function LiveCity({
  orient,
  snap,
  renderMode,
  onReady,
}: {
  orient: Orient;
  snap: boolean;
  renderMode: boolean;
  onReady: () => void;
}) {
  const [dpr, setDpr] = useState(() => {
    const device = window.devicePixelRatio || 1;
    return renderMode ? device : Math.min(1.75, device);
  });
  return (
    <Canvas
      flat
      shadows="percentage"
      dpr={dpr}
      frameloop="demand"
      camera={{ fov: 28, near: 1, far: 260, position: [0, 36, 58] }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      style={{ touchAction: 'pan-y' }}
    >
      <CameraRig orient={orient} snap={snap} renderMode={renderMode} />
      <Lights shadowSize={renderMode ? 4096 : 2048} />
      <Health onReady={onReady} setDpr={setDpr} renderMode={renderMode} />
      <SceneSwitch
        globe={<Globe />}
        city={
          <>
            <Plinth />
            <Park />
            <Trees />
            <Track />
            <Lamps />
            <Palace />
            <Buildings />
            <Train />
          </>
        }
      />
    </Canvas>
  );
}

/** Shows the toy globe before the cloud swap and the city after it; only one is ever drawn. */
function SceneSwitch({ globe, city }: { globe: React.ReactNode; city: React.ReactNode }) {
  const globeRef = useRef<THREE.Group>(null);
  const cityRef = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const warmed = useRef(false);
  const apply = useRef(() => {});
  useLayoutEffect(() => {
    apply.current = () => {
      if (!warmed.current) return;
      const onGlobe = introStore.get() < SWAP;
      if (globeRef.current) globeRef.current.visible = onGlobe;
      if (cityRef.current) cityRef.current.visible = !onGlobe;
      invalidate();
    };
    return introStore.subscribe(() => apply.current());
  }, [invalidate]);
  // Warm-up: the very first frame (still invisible, the canvas fades in later) draws the globe AND
  // the city, so every material and shadow shader is compiled up front. Otherwise the first frame
  // after the cloud swap would stall on slower GPUs.
  useFrame((state) => {
    if (warmed.current) return;
    if (globeRef.current && cityRef.current && !globeRef.current.userData.warming) {
      globeRef.current.userData.warming = true;
      globeRef.current.visible = true;
      cityRef.current.visible = true;
      // compile() ignores the camera's view, so buildings outside the opening globe shot
      // (which the warm-up render alone would skip) get their shaders compiled too
      state.gl.compile(state.scene, state.camera);
      invalidate();
      return;
    }
    warmed.current = true;
    apply.current();
  });
  return (
    <>
      <group ref={globeRef}>{globe}</group>
      <group ref={cityRef}>{city}</group>
    </>
  );
}
