import * as THREE from 'three';

/** The city's palette: warm dusk pastels, sandstone and clay. */
export const C = {
  paving: '#e9d2b8',
  earth: '#7a5446',
  grass: '#9cb77f',
  grassDark: '#86a56d',
  water: '#9fb0d6',
  cream: '#f4e6d2',
  sand: '#e9cba3',
  white: '#f8f2ea',
  terracotta: '#d47f58',
  clay: '#b85e47',
  teal: '#78b2aa',
  tealDeep: '#3f8079',
  lavender: '#a596cf',
  plum: '#7b4b6f',
  brick: '#bd6b50',
  stone: '#e2bf93',
  stoneDeep: '#c99a6a',
  dome: '#f1dcbb',
  dark: '#4a3f55',
  tank: '#3c3a44',
  wood: '#93705a',
  gravel: '#c3aa96',
  postRed: '#c8483b',
  signYellow: '#f2c230',
  glow: '#ffd27a',
  glassDark: '#544a6c',
  portal: '#b7a8ff',
} as const;

const cache = new Map<string, THREE.MeshLambertMaterial>();
/** Shared flat-coloured Lambert material per colour (cheap, toy-like). */
export function mat(color: string) {
  let m = cache.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color });
    cache.set(color, m);
  }
  return m;
}

const basicCache = new Map<string, THREE.MeshBasicMaterial>();
/** Unlit material for things that glow (window light, lamps, the portal ring). */
export function glow(color: string) {
  let m = basicCache.get(color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color });
    basicCache.set(color, m);
  }
  return m;
}

/** Unit shapes with their base at y = 0, scaled per use, so the whole city shares a few geometries. */
export const geo = {
  box: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 18).translate(0, 0.5, 0),
  pyramid: new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0),
  gable: (() => {
    const s = new THREE.Shape();
    s.moveTo(-0.5, 0);
    s.lineTo(0.5, 0);
    s.lineTo(0, 1);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5);
  })(),
  onion: new THREE.LatheGeometry(
    [
      [0, 0], [0.5, 0], [0.58, 0.18], [0.6, 0.38], [0.52, 0.6], [0.34, 0.82], [0.16, 0.98], [0.06, 1.1], [0, 1.22],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    20,
  ),
  sphere: new THREE.IcosahedronGeometry(1, 1),
  canopy: new THREE.IcosahedronGeometry(1, 0),
  plane: new THREE.PlaneGeometry(1, 1),
  torus: new THREE.TorusGeometry(0.45, 0.06, 10, 40),
};

/** Small deterministic random generator, so live 3D and the pre-rendered pictures always match. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
