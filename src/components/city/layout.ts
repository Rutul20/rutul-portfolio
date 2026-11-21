import { stops } from '@/content/content';

export type V3 = [number, number, number];

/** The diorama base and the oval toy-train track (x = a·cosθ, z = b·sinθ). */
export const PLINTH = { w: 32, d: 27, h: 1.4, r: 2.4 };
export const TRACK = { a: 9.6, b: 7.4 };

/** Where things stand on the plinth (x, z). The front of the plinth is +z. */
export const PLACES = {
  station: { x: 0, z: 9.6 },
  house: { x: -10.8, z: 8.6 },
  office: { x: -13.4, z: -0.8 },
  post: { x: -9.2, z: -10.4 },
  palace: { x: 2.4, z: -10.6 },
  market: { x: 10.2, z: -10.2 },
  shop: { x: 14.2, z: -10.9 },
  school: { x: 13.6, z: -5.0 },
  clinic: { x: 13.6, z: -0.9 },
  garage: { x: 13.4, z: 4.4 },
  college: { x: 9.8, z: 9.8 },
} as const;

/** Rotation that turns a building's front (+z) away from the centre of the city. */
export const outward = (x: number, z: number) => Math.atan2(x, z);

/** What the camera looks at for each stop, in tour order (matches `stops` in content.ts). */
const clientSpots = [PLACES.market, PLACES.school, PLACES.clinic, PLACES.shop];
const clientCentre = {
  x: clientSpots.reduce((a, p) => a + p.x, 0) / clientSpots.length,
  z: clientSpots.reduce((a, p) => a + p.z, 0) / clientSpots.length,
};

/**
 * az (degrees) overrides the default "look in from outside" direction for a stop.
 * frameX: on wide screens, how far right of centre the target sits (share of the width, negative = right).
 * tallBack: extra step back on tall (phone) screens, where the city only has the top half.
 */
type Shot = { target: V3; dist: number; height: number; az?: number; frameX?: number; tallBack?: number };
const FRAME_X = -0.16;
const SHOTS: Shot[] = [
  { target: [0, -0.5, -0.5], dist: 56, height: 34, az: 0, frameX: -0.12, tallBack: 1.25 }, // the whole city, just landed
  { target: [PLACES.house.x, 1.0, PLACES.house.z], dist: 16, height: 9 },
  { target: [PLACES.office.x, 3.4, PLACES.office.z - 0.8], dist: 28, height: 15, az: -58 }, // down the street: small → tall
  { target: [PLACES.post.x, 1.2, PLACES.post.z], dist: 17, height: 9 },
  { target: [clientCentre.x, 1.0, clientCentre.z], dist: 27, height: 13.5 },
  { target: [PLACES.garage.x, 1.1, PLACES.garage.z], dist: 16, height: 8.5 },
  { target: [PLACES.college.x, 1.6, PLACES.college.z], dist: 18, height: 9.5 },
  { target: [PLACES.station.x + 2.0, 0.8, PLACES.station.z], dist: 19, height: 9.5, az: 4 },
];

if (SHOTS.length !== stops.length) {
  throw new Error('city/layout.ts: one camera shot is needed per stop in content.ts');
}

/** Camera azimuth per stop, unwrapped so the tour always circles the city the same way. */
const AZIMUTH = (() => {
  const out: number[] = [((SHOTS[0].az ?? 0) * Math.PI) / 180];
  for (let i = 1; i < SHOTS.length; i++) {
    const s = SHOTS[i];
    let a = s.az !== undefined ? (s.az * Math.PI) / 180 : Math.atan2(s.target[0], s.target[2]);
    while (a > out[i - 1]) a -= Math.PI * 2;
    out.push(a);
  }
  return out;
})();

/** Train position on the track (θ, radians) per stop, unwrapped so it always runs forwards. */
const TRAIN_THETA = (() => {
  const out: number[] = [Math.PI / 2]; // waiting at the station, front centre
  for (let i = 1; i < SHOTS.length; i++) {
    const [x, , z] = SHOTS[i].target;
    let t = i === SHOTS.length - 1 ? Math.PI / 2 : Math.atan2(z / TRACK.b, x / TRACK.a);
    while (t <= out[i - 1]) t += Math.PI * 2;
    out.push(t);
  }
  return out;
})();

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Camera for a point on the tour: `from`/`to` stop indices and eased t between them. */
export function cameraAt(from: number, to: number, t: number) {
  const A = SHOTS[from], B = SHOTS[to];
  const az = lerp(AZIMUTH[from], AZIMUTH[to], t);
  const dist = lerp(A.dist, B.dist, t);
  const height = lerp(A.height, B.height, t);
  const target: V3 = [0, 1, 2].map((k) => lerp(A.target[k], B.target[k], t)) as V3;
  const position: V3 = [target[0] + Math.sin(az) * dist, target[1] + height, target[2] + Math.cos(az) * dist];
  const tallBack = lerp(A.tallBack ?? 1, B.tallBack ?? 1, t);
  return { position, target, dist, tallBack };
}

export const frameXAt = (from: number, to: number, t: number) =>
  lerp(SHOTS[from].frameX ?? FRAME_X, SHOTS[to].frameX ?? FRAME_X, t);

export const trainThetaAt =(from: number, to: number, t: number) => lerp(TRAIN_THETA[from], TRAIN_THETA[to], t);

export const trackPoint = (theta: number, a = TRACK.a, b = TRACK.b) => ({ x: a * Math.cos(theta), z: b * Math.sin(theta) });
/** Rotation that points a model's +x along the direction of travel at θ. */
export const trackHeading = (theta: number) => Math.atan2(-(TRACK.b * Math.cos(theta)), -TRACK.a * Math.sin(theta));
export const trackSpeed = (theta: number) => Math.hypot(TRACK.a * Math.sin(theta), TRACK.b * Math.cos(theta));

/** Window panes on a box's faces. Box: width w (x), depth d (z), base at y = 0. */
export type Pane = { p: V3; ry: number; w: number; h: number };
export function panes(
  w: number,
  d: number,
  faces: ('front' | 'back' | 'left' | 'right')[],
  opts: { cols: number; rows: number; y0: number; y1: number; pw?: number; ph?: number; colsSide?: number; inset?: number },
): Pane[] {
  const { cols, rows, y0, y1, pw = 0.26, ph = 0.34, colsSide = cols, inset = 0.32 } = opts;
  const out: Pane[] = [];
  const ys = Array.from({ length: rows }, (_, r) => (rows === 1 ? (y0 + y1) / 2 : y0 + ((y1 - y0) * r) / (rows - 1)));
  const spread = (len: number, n: number) =>
    Array.from({ length: n }, (_, c) => (n === 1 ? 0 : -len / 2 + inset + ((len - 2 * inset) * c) / (n - 1)));
  for (const f of faces) {
    const along = f === 'front' || f === 'back' ? spread(w, cols) : spread(d, colsSide);
    for (const y of ys)
      for (const u of along) {
        if (f === 'front') out.push({ p: [u, y, d / 2 + 0.012], ry: 0, w: pw, h: ph });
        if (f === 'back') out.push({ p: [-u, y, -d / 2 - 0.012], ry: Math.PI, w: pw, h: ph });
        if (f === 'right') out.push({ p: [w / 2 + 0.012, y, -u], ry: Math.PI / 2, w: pw, h: ph });
        if (f === 'left') out.push({ p: [-w / 2 - 0.012, y, u], ry: -Math.PI / 2, w: pw, h: ph });
      }
  }
  return out;
}
