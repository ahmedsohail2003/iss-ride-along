// C1: our orbit math against NASA's own ISS trajectory (OEM), and the TEME -> J2000 conversion it needs.
// Fixture pair (saved by `node scripts/snapshot.mjs --only oem`): tests/fixtures/ISS.OEM_J2K_EPH.txt
// (NASA's file, untrimmed) and tests/fixtures/oem-tle.txt (the orbit numbers built into the page then).
import { readFileSync } from 'node:fs';
import * as Astronomy from 'astronomy-engine';
import { describe, expect, test } from 'vitest';
import { satrecFromTle } from '../src/orbit/orbit';
import { parseOem } from '../src/orbit/oem';
import { gapsBetween, median } from '../src/orbit/oemCompare';
import { apply, distance, j2000ToTeme, temeToJ2000, temeToJ2000Matrix, transpose, type Mat3, type Vec3 } from '../src/orbit/frames';
import * as sat from '../src/orbit/satellite-lite';
import { sgp4 } from '../node_modules/satellite.js/dist/propagation.js';

const fx = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const oemText = fx('ISS.OEM_J2K_EPH.txt');
const satrec = satrecFromTle(fx('oem-tle.txt'));
const oem = parseOem(oemText);

describe('C1 (c) the OEM parser', () => {
  test('returns REF_FRAME, CREATION_DATE and the row count from the saved NASA file', () => {
    expect(oem.REF_FRAME).toBe('EME2000');
    expect(oem.TIME_SYSTEM).toBe('UTC');
    expect(oem.CREATION_DATE).toBe('2026-11-13T15:58:19.167');
    expect(oem.ORIGINATOR).toBe('NASA/JSC/FOD/TOPO');
    // Row count recounted here independently of the parser: lines that start with a date-time.
    const dataLines = oemText.split(/\r?\n/).filter((l) => /^\d{4}-\d{2}-\d{2}T/.test(l)).length;
    expect(oem.rowCount).toBe(dataLines);
    expect(oem.rowCount).toBe(5403);
    expect(oem.rows[0]).toMatchObject({ t: Date.parse('2026-11-13T12:00:00.000Z'), x: -2485.84080528045 });
  });

  test('throws on the same file edited to REF_FRAME = ICRF, and on a non-UTC time system', () => {
    const icrf = oemText.replace(/REF_FRAME\s*=\s*EME2000/, 'REF_FRAME            = ICRF');
    expect(icrf).not.toBe(oemText);
    expect(() => parseOem(icrf)).toThrow(/REF_FRAME is ICRF/);
    const tai = oemText.replace(/TIME_SYSTEM\s*=\s*UTC/, 'TIME_SYSTEM          = TAI');
    expect(() => parseOem(tai)).toThrow(/TIME_SYSTEM is TAI/);
  });
});

describe('C1 (a, b) our SGP4 + conversion against NASA, at the file\'s own row times', () => {
  const near = gapsBetween(satrec, oem.rows, -12, 12, true);
  const raw = gapsBetween(satrec, oem.rows, -12, 12, false);

  test('(a) gap under 2 km at every row within 12 h of the orbit numbers\' epoch', () => {
    // 24 h of 4-minute rows = 360 (the epoch, 04:10:44 UTC, is not on a row time, so no row sits on an end).
    expect(near.length).toBe(360);
    const worst = Math.max(...near.map((g) => g.gapKm));
    console.log(`C1 (a): ${near.length} rows within 12 h of the epoch, max gap ${worst.toFixed(3)} km, median ${median(near.map((g) => g.gapKm)).toFixed(3)} km`);
    for (const g of near) expect(g.gapKm).toBeLessThan(2);
  });

  test('(b) with the conversion switched off the gap is larger at every one of those rows, median over 20 km', () => {
    expect(raw.length).toBe(near.length);
    raw.forEach((g, i) => {
      expect(g.t).toBe(near[i].t);
      expect(g.gapKm).toBeGreaterThan(near[i].gapKm);
    });
    const m = median(raw.map((g) => g.gapKm));
    console.log(`C1 (b): no-conversion gap min ${Math.min(...raw.map((g) => g.gapKm)).toFixed(2)}, median ${m.toFixed(2)}, max ${Math.max(...raw.map((g) => g.gapKm)).toFixed(2)} km`);
    expect(m).toBeGreaterThan(20);
  });
});

describe('C1 (d) round trip', () => {
  test('TEME -> J2000 -> TEME returns the input within 1 mm (5 dates, 3 positions)', () => {
    const dates = ['2000-06-30T18:50:19Z', '2004-04-06T07:51:28.386Z', '2026-11-14T04:10:44Z', '2026-11-15T18:15:00Z', '2030-01-01T00:00:00Z'];
    const vs: Vec3[] = [
      { x: 6778, y: 0, z: 0 },
      { x: -2485.8, y: 6125.1, z: -1612.8 },
      { x: 1000, y: -4000, z: 5200 },
    ];
    for (const d of dates)
      for (const v of vs) {
        const back = j2000ToTeme(temeToJ2000(v, new Date(d)), new Date(d));
        expect(distance(back, v) * 1e6).toBeLessThan(1); // km -> mm
      }
  });
});

// ---- (e) checked against something outside our own code.
// Source: Vallado, Crawford, Hujsak and Kelso 2006, "Revisiting Spacetrack Report #3", AIAA 2006-6753,
// Rev 3 PDF from https://celestrak.org/publications/AIAA/2006-6753/AIAA-2006-6753-Rev3.pdf (opened
// 2026-11-14 6:44 PM EST). Appendix C. Values copied from the PDF's text (pdftotext), not typed from memory.
// The paper's 2004-04-06 07:51:28.386 UTC example prints only ITRF and TEME vectors (p. 32), so the
// J2000 check uses the paper's other Appendix C example, which prints both: TLE 00005 at 3 days past
// its epoch, "day = 182.784 950 62" of 2000, rTEME and vTEME from SGP4 (p. 32), the matrix
// [P][N][ROT3(-EqEquinox1982_geo)] (eq. C-2, p. 33) and the "of date" J2000 vector (eq. C-3, p. 33).
const PAPER = {
  tle: [
    '1 00005U 58002B   00179.78495062  .00000023  00000-0  28098-4 0  4753',
    '2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.82419157413667',
  ],
  minutesAfterEpoch: 3 * 1440,
  // day 182.784 950 62 of 2000 (2000 is a leap year; day 1 = Jan 1)
  at: new Date(Date.UTC(2000, 0, 1) + (182.78495062 - 1) * 86_400_000),
  rTEME: { x: -9060.47373569, y: 4658.70952502, z: 813.68673153 },
  vTEME: { x: -2.232832783, y: -4.11045349, z: -3.157345433 },
  matrixC2: [
    [1.0, -0.000111, -0.0000185],
    [0.000111, 1.0, 0.000022],
    [0.0000185, -0.000022, 1.0],
  ],
  rJ2000: { x: -9059.9415541, y: 4659.697199, z: 813.9569402 },
  vJ2000: { x: -2.233347413, y: -4.110136158, z: -3.15739456 },
};

describe('C1 (e) the conversion against outside sources', () => {
  test('our SGP4 (satellite.js) reproduces the paper\'s TEME vector for TLE 00005 at 3 days (input check)', () => {
    // sgp4() by minutes, not propagate() by Date: a Date holds whole milliseconds, and 0.5 ms is 2 m here.
    const rec = sat.twoline2satrec(PAPER.tle[0], PAPER.tle[1]);
    const pv = sgp4(rec, PAPER.minutesAfterEpoch)!;
    const dr = distance(pv.position as Vec3, PAPER.rTEME);
    console.log(`C1 (e) SGP4 vs paper TEME at day 182.78495062: ${(dr * 1000).toFixed(4)} m`);
    expect(dr * 1000).toBeLessThan(1);
  });

  test('matrix matches the paper\'s eq. (C-2) to its printed 7 decimals; J2000 position within 1 m with all 106 nutation terms', () => {
    // The paper's own C-3 vector follows from the TRANSPOSE of the matrix as printed in C-2 (shown here,
    // not assumed): printed x rTEME misses rJ2000 by over 1 km, transpose(printed) x rTEME is within 3 m
    // (the print has 7 decimals). So our matrix is compared with the transpose of the print.
    const printed = PAPER.matrixC2 as unknown as Mat3;
    expect(distance(apply(printed, PAPER.rTEME), PAPER.rJ2000)).toBeGreaterThan(1);
    expect(distance(apply(transpose(printed), PAPER.rTEME), PAPER.rJ2000) * 1000).toBeLessThan(3);
    const M = temeToJ2000Matrix(PAPER.at);
    const Pt = transpose(printed);
    // Element tolerance 1.5e-7: half a unit of the 7th printed decimal (5e-8) plus up to 1e-7 for the IERS
    // daily nutation correction that the paper's example includes and we leave out (frames.ts header).
    // Probe run 6:56 PM Sat: adding dpsi -0.054" and deps -0.006" to our nutation matches the paper's
    // rJ2000 to 5 mm, so the residual below (about 0.8 m) is that correction, not a wrong term.
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) expect(Math.abs(M[i][j] - Pt[i][j])).toBeLessThan(1.5e-7);
    const r = temeToJ2000(PAPER.rTEME, PAPER.at);
    const v = temeToJ2000(PAPER.vTEME, PAPER.at);
    const dm = distance(r, PAPER.rJ2000) * 1000;
    const dv = distance(v, PAPER.vJ2000) * 1e6;
    console.log(`C1 (e) paper eq. C-3: J2000 position off by ${dm.toFixed(4)} m, velocity by ${dv.toFixed(4)} mm/s (106 terms)`);
    expect(dm).toBeLessThan(1);
    expect(dv).toBeLessThan(1);
  });

  test('the check can catch nutation: with no nutation terms the same J2000 vector misses by far more than 1 m', () => {
    const dm = distance(temeToJ2000(PAPER.rTEME, PAPER.at, 0), PAPER.rJ2000) * 1000;
    console.log(`C1 (e) control, 0 nutation terms: off by ${dm.toFixed(1)} m`);
    expect(dm).toBeGreaterThan(100);
  });

  test('agrees within 50 m with astronomy-engine (IAU 2006 precession, IAU 2000B nutation) at 5 times', () => {
    // Independent path, test-only library: r_TOD = ROT3(-ee) r_TEME with ee = its equation of the
    // equinoxes (e_tilt), then its own EQD -> EQJ (true of date -> J2000) rotation.
    const times = ['2026-11-13T12:00:00Z', '2026-11-14T04:10:44Z', '2026-11-15T18:15:00Z', '2026-11-18T00:00:00Z', '2026-11-28T12:00:00Z'];
    const r: Vec3 = { x: -2485.84080528045, y: 6125.10339154221, z: -1612.80041258737 };
    const worst: number[] = [];
    for (const iso of times) {
      const date = new Date(iso);
      const time = Astronomy.MakeTime(date);
      const ee = (Astronomy.e_tilt(time).ee * 15 * Math.PI) / (180 * 3600); // seconds of time -> radians
      const c = Math.cos(ee);
      const s = Math.sin(ee);
      // ROT3(-ee) (rotate axes by -ee): [[c, -s, 0], [s, c, 0], [0, 0, 1]]
      const tod = new Astronomy.Vector(c * r.x - s * r.y, s * r.x + c * r.y, r.z, time);
      const j = Astronomy.RotateVector(Astronomy.Rotation_EQD_EQJ(time), tod);
      const dm = distance(temeToJ2000(r, date), { x: j.x, y: j.y, z: j.z }) * 1000;
      worst.push(dm);
      expect(dm).toBeLessThan(50);
    }
    console.log(`C1 (e) vs astronomy-engine at 5 times: ${worst.map((d) => d.toFixed(2)).join(', ')} m`);
  });
});
