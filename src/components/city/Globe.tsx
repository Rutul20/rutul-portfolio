'use client';

import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { C, geo, glow, mat, rng } from './kit';

/** The toy globe the intro starts from. Coastlines only (texture from Natural Earth), a pin on Vadodara. */
export const GLOBE_R = 5;
const VADODARA = { lat: 22.31, lon: 73.18 };

/** Same mapping as three's SphereGeometry UVs, so the pin sits exactly on the painted map. */
function latLon(lat: number, lon: number, r: number) {
  const phi = ((lon + 180) / 360) * Math.PI * 2;
  const theta = ((90 - lat) / 180) * Math.PI;
  return new THREE.Vector3(-r * Math.cos(phi) * Math.sin(theta), r * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta));
}

/** Turn the globe so Vadodara faces the front of the scene, where the sun is. */
const PIN_LOCAL = latLon(VADODARA.lat, VADODARA.lon, 1);
export const GLOBE_SPIN = -Math.atan2(PIN_LOCAL.x, PIN_LOCAL.z);
/** Unit direction from the globe's centre to Vadodara, in world space. */
export const PIN_DIR = PIN_LOCAL.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), GLOBE_SPIN).normalize();

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * Camera for the dive. t: 0 = whole globe, India turned slightly away; 1 = just above India.
 * `back` pushes the camera out on tall screens so the whole globe fits.
 */
export function globeCamera(t: number, back: number) {
  const e = smooth(Math.min(1, Math.max(0, t)));
  const start = PIN_DIR.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.48).add(new THREE.Vector3(0, 0.2, 0)).normalize();
  const dir = start.lerp(PIN_DIR, e).normalize();
  const dist = lerp(6.2 * GLOBE_R * back, GLOBE_R * (1 + 0.38 * back), Math.pow(e, 1.35));
  const position = dir.multiplyScalar(dist);
  const target = PIN_DIR.clone().multiplyScalar(GLOBE_R * e);
  return { position, target };
}

export function Globe() {
  // a little self-light keeps the pastel map colours true under the warm dusk sun
  const material = useMemo(
    () => new THREE.MeshLambertMaterial({ color: '#8fb3d8', flatShading: true, emissive: '#ffffff', emissiveIntensity: 0 }),
    [],
  );
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    new THREE.TextureLoader().load('/globe/land.webp', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      material.map = tex;
      material.emissiveMap = tex;
      material.emissiveIntensity = 0.42;
      material.color.set('#ffffff');
      material.needsUpdate = true;
      invalidate();
      window.__globeReady = true;
    });
  }, [material, invalidate]);

  const sphere = useMemo(() => new THREE.SphereGeometry(GLOBE_R, 48, 32), []);
  const pin = useMemo(() => {
    const p = latLon(VADODARA.lat, VADODARA.lon, GLOBE_R);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().normalize());
    return { p, q };
  }, []);

  // a few toy clouds drifting just above the surface (static; they move only with the camera)
  const puffs = useMemo(() => {
    const r = rng(5);
    return Array.from({ length: 9 }, () => {
      const lat = -50 + r() * 110;
      const lon = -180 + r() * 360;
      const near = Math.abs(lat - VADODARA.lat) < 12 && Math.abs(lon - VADODARA.lon) < 18;
      return near ? null : { pos: latLon(lat, lon, GLOBE_R * 1.1), s: 0.32 + r() * 0.3, spread: 0.6 + r() * 0.5 };
    }).filter(Boolean) as { pos: THREE.Vector3; s: number; spread: number }[];
  }, []);

  return (
    <group rotation-y={GLOBE_SPIN}>
      <mesh geometry={sphere} material={material} />
      {/* Vadodara pin */}
      <group position={pin.p} quaternion={pin.q}>
        <mesh geometry={geo.cyl} material={mat(C.dark)} scale={[0.018, 0.32, 0.018]} />
        <mesh geometry={geo.sphere} material={glow(C.postRed)} position={[0, 0.34, 0]} scale={0.075} />
        <mesh geometry={geo.torus} material={glow(C.glow)} rotation-x={Math.PI / 2} position={[0, 0.02, 0]} scale={0.2} />
      </group>
      {puffs.map((c, i) => (
        <group key={i} position={c.pos} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), c.pos.clone().normalize())}>
          {[-1, 0, 1].map((k) => (
            <mesh key={k} geometry={geo.canopy} material={mat('#fffaf4')} position={[k * c.s * c.spread, k === 0 ? 0.08 : 0, 0]} scale={c.s * (k === 0 ? 1.15 : 0.85)} />
          ))}
        </group>
      ))}
    </group>
  );
}

declare global {
  interface Window {
    __globeReady?: boolean;
  }
}
