// TEME -> J2000 (EME2000) frame conversion. Pure: no I/O, no DOM.
//
// Why: SGP4 (satellite.js) gives positions in TEME, a frame tied to the date of each instant.
// NASA's ISS trajectory file (OEM) is in EME2000, the J2000 mean-equator frame. The two differ by
// precession (about 0.37 degree of drift since 2000, about 44 km at the station's distance),
// nutation (up to about 17 arcseconds, about half a km) and the equation of the equinoxes.
//
// Formulas, all named, none typed from memory:
//  - TEME -> true of date: Vallado, Crawford, Hujsak and Kelso 2006, "Revisiting Spacetrack Report #3",
//    AIAA 2006-6753 (Rev 3, celestrak.org), Appendix C, eq. (C-1): r_TOD = ROT3(-EqEquinox1982_geo) r_TEME,
//    with the geometric equation of the equinoxes = dpsi * cos(mean obliquity); and eq. (C-3):
//    r_J2000 = [P][N][ROT3(-EqEquinox1982_geo)] r_TEME ("of date" option).
//  - Precession [P], IAU 1976 (Lieske 1979): angles from ERFA eraPrec76 (prec76.c), matrix order
//    R3(-z) R2(theta) R3(-zeta) from ERFA eraPmat76 (pmat76.c).
//  - Nutation [N], IAU 1980, all 106 terms (./nut80-table.ts, copied by script from ERFA nut80.c),
//    fundamental arguments from ERFA eraNut80; matrix Rx(-(eps+deps)) Rz(-dpsi) Rx(eps) from ERFA
//    eraNumat (numat.c); mean obliquity from ERFA eraObl80 (obl80.c).
//  - Rotation matrices use ERFA's convention (eraRx/eraRy/eraRz, the same as Vallado's ROT1/2/3):
//    rotating the axes, not the vector.
// Left out on purpose: the small daily corrections to nutation published by the IERS (ddpsi, ddeps,
// about 0.05 arcsecond, about 2 m at the station) and the IAU 1994 "kinematic" terms of the equation
// of the equinoxes (under 0.003 arcsecond, under 0.1 m). Velocity is turned by the same matrix; the
// matrix's own rate of change (precession is about 50 arcseconds a year) adds well under 1 mm/s.
import { NUT80 } from './nut80-table';

export type Vec3 = { x: number; y: number; z: number };
export type Mat3 = [[number, number, number], [number, number, number], [number, number, number]];

const DAS2R = Math.PI / (180 * 3600); // arcseconds to radians
const D2PI = 2 * Math.PI;
const DJ00 = 2451545.0; // J2000.0 as a Julian Date
const DJC = 36525.0; // days per Julian century
/**
 * TT minus UTC in seconds: TAI-UTC is 37 s since 2017-01-01 (IERS Bulletin C), plus 32.184 s.
 * For the 2000 test example the true value was 64.184 s; 5 s of time error moves precession by about
 * 0.00001 arcsecond, far below anything measured here.
 */
export const TT_MINUS_UTC_S = 69.184;

/** Julian Date (TT) of a UTC instant. */
export function julianDateTT(date: Date): number {
  return date.getTime() / 86_400_000 + 2440587.5 + TT_MINUS_UTC_S / 86400;
}

const anpm = (a: number) => {
  // ERFA eraAnpm: normalise into -pi..+pi
  let w = a % D2PI;
  if (Math.abs(w) >= Math.PI) w -= Math.sign(a) * D2PI;
  return w;
};

function ident(): Mat3 {
  return [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
}
function mul(a: Mat3, b: Mat3): Mat3 {
  const m = ident();
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) m[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
  return m;
}
export function transpose(a: Mat3): Mat3 {
  return [
    [a[0][0], a[1][0], a[2][0]],
    [a[0][1], a[1][1], a[2][1]],
    [a[0][2], a[1][2], a[2][2]],
  ];
}
export function apply(m: Mat3, v: Vec3): Vec3 {
  return {
    x: m[0][0] * v.x + m[0][1] * v.y + m[0][2] * v.z,
    y: m[1][0] * v.x + m[1][1] * v.y + m[1][2] * v.z,
    z: m[2][0] * v.x + m[2][1] * v.y + m[2][2] * v.z,
  };
}
// ERFA rotation matrices (rotate the axes by phi; same as Vallado ROT1, ROT2, ROT3).
function rx(phi: number): Mat3 {
  const c = Math.cos(phi), s = Math.sin(phi);
  return [
    [1, 0, 0],
    [0, c, s],
    [0, -s, c],
  ];
}
function ry(phi: number): Mat3 {
  const c = Math.cos(phi), s = Math.sin(phi);
  return [
    [c, 0, -s],
    [0, 1, 0],
    [s, 0, c],
  ];
}
function rz(phi: number): Mat3 {
  const c = Math.cos(phi), s = Math.sin(phi);
  return [
    [c, s, 0],
    [-s, c, 0],
    [0, 0, 1],
  ];
}

/** IAU 1976 precession matrix, J2000 mean equator -> mean equator of date: V(date) = P V(J2000). ERFA eraPmat76. */
export function precessionMatrix(jdTT: number): Mat3 {
  // eraPrec76 with the start date at J2000.0 (t0 = 0): the t0 terms vanish.
  const t = (jdTT - DJ00) / DJC;
  const tas2r = t * DAS2R;
  const w = 2306.2181;
  const zeta = (w + (0.30188 + 0.017998 * t) * t) * tas2r;
  const z = (w + (1.09468 + 0.018203 * t) * t) * tas2r;
  const theta = (2004.3109 + (-0.42665 - 0.041833 * t) * t) * tas2r;
  // eraPmat76: R = Rz(-z) * Ry(theta) * Rz(-zeta) (ERFA applies each rotation on the left in turn)
  return mul(rz(-z), mul(ry(theta), rz(-zeta)));
}

/** Mean obliquity of the ecliptic, IAU 1980 (radians). ERFA eraObl80. */
export function meanObliquity(jdTT: number): number {
  const t = (jdTT - DJ00) / DJC;
  return DAS2R * (84381.448 + (-46.815 + (-0.00059 + 0.001813 * t) * t) * t);
}

/**
 * IAU 1980 nutation in longitude and obliquity (radians), from `terms` of the 106-term series
 * (default all 106; fewer only to show in the tests what a short series misses). ERFA eraNut80.
 */
export function nutation80(jdTT: number, terms = NUT80.length): { dpsi: number; deps: number } {
  const t = (jdTT - DJ00) / DJC;
  const frac = (x: number) => x % 1.0; // C fmod(x, 1.0)
  const el = anpm((485866.733 + (715922.633 + (31.31 + 0.064 * t) * t) * t) * DAS2R + frac(1325.0 * t) * D2PI);
  const elp = anpm((1287099.804 + (1292581.224 + (-0.577 - 0.012 * t) * t) * t) * DAS2R + frac(99.0 * t) * D2PI);
  const f = anpm((335778.877 + (295263.137 + (-13.257 + 0.011 * t) * t) * t) * DAS2R + frac(1342.0 * t) * D2PI);
  const d = anpm((1072261.307 + (1105601.328 + (-6.891 + 0.019 * t) * t) * t) * DAS2R + frac(1236.0 * t) * D2PI);
  const om = anpm((450160.28 + (-482890.539 + (7.455 + 0.008 * t) * t) * t) * DAS2R + frac(-5.0 * t) * D2PI);
  let dp = 0;
  let de = 0;
  // Sum the terms ending with the biggest, as ERFA does.
  for (let j = Math.min(terms, NUT80.length) - 1; j >= 0; j--) {
    const [nl, nlp, nf, nd, nom, sp, spt, ce, cet] = NUT80[j];
    const arg = nl * el + nlp * elp + nf * f + nd * d + nom * om;
    const s = sp + spt * t;
    const c = ce + cet * t;
    if (s !== 0) dp += s * Math.sin(arg);
    if (c !== 0) de += c * Math.cos(arg);
  }
  const U2R = DAS2R / 1e4; // 0.1 mas to radians
  return { dpsi: dp * U2R, deps: de * U2R };
}

/** Nutation matrix, mean of date -> true of date: V(true) = N V(mean). ERFA eraNumat. */
export function nutationMatrix(epsMean: number, dpsi: number, deps: number): Mat3 {
  return mul(rx(-(epsMean + deps)), mul(rz(-dpsi), rx(epsMean)));
}

/**
 * The matrix M with r_J2000 = M r_TEME at `date` (Vallado et al. 2006, eq. C-3, "of date"):
 * M = P^T N^T ROT3(-eqe), eqe = dpsi cos(eps_mean). `terms` is the nutation term count (default 106).
 */
export function temeToJ2000Matrix(date: Date, terms = NUT80.length): Mat3 {
  const jd = julianDateTT(date);
  const eps = meanObliquity(jd);
  const { dpsi, deps } = nutation80(jd, terms);
  const eqe = dpsi * Math.cos(eps);
  const P = precessionMatrix(jd);
  const N = nutationMatrix(eps, dpsi, deps);
  return mul(transpose(P), mul(transpose(N), rz(-eqe)));
}

export function temeToJ2000(r: Vec3, date: Date, terms?: number): Vec3 {
  return apply(temeToJ2000Matrix(date, terms), r);
}

export function j2000ToTeme(r: Vec3, date: Date, terms?: number): Vec3 {
  return apply(transpose(temeToJ2000Matrix(date, terms)), r);
}

export function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
