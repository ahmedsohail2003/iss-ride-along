// G5 acceptance: the dotted Earth shares the globe's frame, its land test reads the picture the right way, and the
// labels on the globe are built from the readout strings unchanged.
import { describe, expect, test } from 'vitest';
import { buildDots, dotPosition, fibonacciLatLon, isLand, pixelFor, DOTS_N, LAND_RGB, SEA_RGB } from '../src/globe/dots';
import { latLonToVec3 } from '../src/globe/geo';
import { hudBox, HUD_OFFSET, passLabel, stationLabel } from '../src/globe/hud';

describe('G5 the dotted Earth (src/globe/dots.ts)', () => {
  test('(a) the Fibonacci points are unit length and N is the number asked for', () => {
    for (const n of [1, 7, 1000, DOTS_N]) {
      const pts = fibonacciLatLon(n);
      expect(pts.length).toBe(n);
      let worst = 0;
      for (const p of pts) worst = Math.max(worst, Math.abs(Math.hypot(...dotPosition(p.lat, p.lon)) - 1));
      expect(worst).toBeLessThan(1e-12);
    }
    // spread evenly: as many points in the north as in the south, and in the east as in the west
    const pts = fibonacciLatLon(DOTS_N);
    const north = pts.filter((p) => p.lat > 0).length;
    const east = pts.filter((p) => p.lon > 0).length;
    console.log(`G5 Fibonacci ${DOTS_N}: ${north} north, ${east} east`);
    expect(Math.abs(north - DOTS_N / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(east - DOTS_N / 2)).toBeLessThan(DOTS_N * 0.01);
  });

  test("(b) the point made for a latitude and longitude equals geo.ts's own vector (one frame for both styles)", () => {
    const places = [
      [0, 0],
      [23, 45],
      [-25, 135],
      [23, -45],
      [25, 135],
      [89.9, -179.9],
      [-60, 170],
    ];
    for (const [la, lo] of places) {
      const a = dotPosition(la, lo);
      const b = latLonToVec3(la, lo);
      for (let k = 0; k < 3; k++) expect(a[k]).toBeCloseTo(b[k], 12);
      const r = dotPosition(la, lo, 1.003);
      for (let k = 0; k < 3; k++) expect(r[k]).toBeCloseTo(b[k] * 1.003, 12);
    }
    // and the picture is read where the photo's texture is: column 0 at -180, row 0 at the North Pole
    expect(pixelFor(90, -180, 1024, 512)).toEqual({ x: 0, y: 0 });
    expect(pixelFor(0, 0, 1024, 512)).toEqual({ x: 512, y: 256 });
    expect(pixelFor(-90, 180, 1024, 512)).toEqual({ x: 1023, y: 511 });
    expect(pixelFor(23, 45, 360, 180)).toEqual({ x: 225, y: 67 });
  });

  test('(c) the land test on a small made-up picture marks its land pixels and not its sea pixels', () => {
    // 8 x 4 picture: the left half land (desert, forest, ice, dark rock), the right half sea (deep, shallow, coast)
    const land = [
      [200, 170, 120],
      [60, 90, 40],
      [240, 240, 250],
      [70, 60, 55],
    ];
    const sea = [
      [10, 30, 80],
      [60, 120, 170],
      [20, 60, 120],
      [5, 15, 50],
    ];
    const w = 8;
    const h = 4;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const c = x < 4 ? land[(x + y) % 4] : sea[(x + y) % 4];
        data.set([...c, 255], (y * w + x) * 4);
      }
    for (const c of land) expect(isLand(c[0], c[1], c[2]), String(c)).toBe(true);
    for (const c of sea) expect(isLand(c[0], c[1], c[2]), String(c)).toBe(false);
    // built over that picture: every point in the west (lon < 0, the land half) is a land dot, none in the east
    const d = buildDots({ width: w, height: h, data }, 2000, 1);
    let westLand = 0;
    let westAll = 0;
    let eastLand = 0;
    for (let i = 0; i < d.count; i++) {
      const p = [d.positions[3 * i], d.positions[3 * i + 1], d.positions[3 * i + 2]];
      const lon = Math.atan2(-p[2], p[0]);
      const isL = d.colors[3 * i] === Math.fround(LAND_RGB[0]);
      if (lon < 0) {
        westAll++;
        if (isL) westLand++;
      } else if (isL) eastLand++;
      if (!isL) expect(d.colors[3 * i]).toBe(Math.fround(SEA_RGB[0]));
    }
    console.log(`G5 made-up picture: ${d.count} dots of 2000 points, ${d.land} land; west ${westLand}/${westAll} land, east ${eastLand} land`);
    expect(westAll).toBeGreaterThan(900);
    expect(westLand).toBe(westAll);
    expect(eastLand).toBe(0);
    expect(d.land).toBe(westLand);
    // sea is sparser: every second sea point is kept
    expect(d.count - d.land).toBe(Math.ceil((2000 - d.land) / 2));
  });
});

describe('G5 the labels on the globe (src/globe/hud.ts)', () => {
  test('(d) the label text is built from the readout strings it is given, unchanged', () => {
    const [a, b] = stationLabel('418.6', '27,594');
    expect(a).toBe('ISS · now');
    expect(b).toBe('418.6 km up · 27,594 km/h');
    expect(b).toContain('418.6');
    expect(b).toContain('27,594');
    // whatever the readout says, it is carried as is (a dash before the first tick, odd spacing)
    expect(stationLabel('-', '-')[1]).toBe('- km up · - km/h');
    const [t, w] = passLabel('Ypsilanti', 'Sun 15 Nov', '18:42');
    expect(t).toBe('Ypsilanti');
    expect(w).toBe('Sun 15 Nov · 18:42');
  });

  test('a label never covers the middle 9x9 of the globe, wherever its point is, and sits next to it', () => {
    let worst = 0;
    let checked = 0;
    for (const [W, H] of [
      [920, 445],
      [356, 388],
    ])
      for (let x = 0; x <= W; x += 4)
        for (let y = 0; y <= H; y += 4) {
          const w = 182;
          const h = 37;
          const b = hudBox({ x, y }, w, h, W, H);
          const cx = Math.floor(W / 2);
          const cy = Math.floor(H / 2);
          const coversX = b.left <= cx + 4 && b.left + w >= cx - 4;
          const coversY = b.top <= cy + 4 && b.top + h >= cy - 4;
          expect(coversX && coversY, `point ${x},${y} in ${W}x${H}`).toBe(false);
          // inside the box
          expect(b.left).toBeGreaterThanOrEqual(2);
          expect(b.top).toBeGreaterThanOrEqual(2);
          // when nothing is clamped, the near corner is HUD_OFFSET from the point on both axes
          const dx = Math.max(b.left - x, 0, x - (b.left + w));
          const dy = Math.max(b.top - y, 0, y - (b.top + h));
          if (x > w + 30 && x < W - w - 30 && y > h + 30 && y < H - h - 30) {
            expect(dx).toBeCloseTo(HUD_OFFSET, 9);
            expect(dy).toBeCloseTo(HUD_OFFSET, 9);
          }
          worst = Math.max(worst, Math.hypot(dx, dy));
          checked++;
        }
    console.log(`G5 label placement: ${checked} points checked, never over the middle 9x9; farthest box ${worst.toFixed(1)} px from its point`);
  });
});
