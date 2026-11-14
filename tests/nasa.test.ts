// NASA layers (M4): EONET parsing, the GIBS day choice, and the curated photo credits.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { EONET_URL, eonetRawCount, parseEonet } from '../src/nasa/eonet';
import { gibsProbeUrl, gibsTemplate, pickGibsDay, utcDay, type ProbeResult } from '../src/nasa/gibs';
import { NASA_ONLY_CREDIT, photoCreditLine, type CuratedPhoto } from '../src/nasa/photos';
import { CREDIT_GIBS, CREDIT_NOT_NASA } from '../src/nasa/credits';

const root = fileURLToPath(new URL('..', import.meta.url));
const readJson = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const eonetRaw = readJson('src/data/eonet-open.json');
const photos: CuratedPhoto[] = readJson('src/data/photos.json');
const meta = readJson('src/data/snapshot-meta.json');

describe('EONET parser', () => {
  const events = parseEonet(eonetRaw);

  test('returns at least 1 event from the saved snapshot', () => {
    console.log(`EONET snapshot: ${eonetRaw.events.length} raw events -> ${events.length} parsed`);
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  test('the page counts a whole set: no count limit, and the snapshot is the same request as the live one', () => {
    // M4 fix r1: limit=50 cut the open list to 50, so the on-screen total and "none in view" were wrong.
    expect(EONET_URL).not.toMatch(/[?&]limit=/);
    expect(EONET_URL).toMatch(/[?&]status=open(&|$)/);
    expect(meta.files['eonet-open.json'].source).toBe(EONET_URL);
    expect(eonetRawCount(eonetRaw)).toBe(meta.files['eonet-open.json'].eventCount);
  });

  test('reads GeoJSON [lon, lat] into lat and lon in the right order (every event, newest point)', () => {
    for (const e of events) {
      const raw = eonetRaw.events.find((r: { id: string }) => r.id === e.id);
      const newest = [...raw.geometry].sort((a: { date: string }, b: { date: string }) => Date.parse(b.date) - Date.parse(a.date))[0];
      expect(newest.type).toBe('Point');
      expect(e.lon).toBe(newest.coordinates[0]);
      expect(e.lat).toBe(newest.coordinates[1]);
    }
  });

  test('US wildfires (source IRWIN) land in the US: longitude west of -60, latitude 15 to 72', () => {
    const us = events.filter((e) => e.sources.includes('IRWIN'));
    expect(us.length).toBeGreaterThan(0);
    for (const e of us) {
      expect(e.lon).toBeLessThan(-60);
      expect(e.lat).toBeGreaterThan(15);
      expect(e.lat).toBeLessThan(72);
    }
  });

  test('hand-made reply: Ypsilanti point, polygon centre, newest point wins, bad entries skipped', () => {
    const out = parseEonet({
      events: [
        { id: 'A', title: 'Point', categories: [{ title: 'Wildfires' }], sources: [{ id: 'IRWIN' }], geometry: [{ date: '2026-11-01T00:00:00Z', type: 'Point', coordinates: [-83.61, 42.24], magnitudeValue: 519, magnitudeUnit: 'acres' }] },
        { id: 'B', title: 'Storm', categories: [{ title: 'Severe Storms' }], geometry: [
          { date: '2026-11-01T00:00:00Z', type: 'Point', coordinates: [130, 10] },
          { date: '2026-11-03T00:00:00Z', type: 'Point', coordinates: [135, 15] },
        ] },
        { id: 'C', title: 'Box', categories: [{ title: 'Sea and Lake Ice' }], geometry: [{ date: '2026-11-02T00:00:00Z', type: 'Polygon', coordinates: [[[10, 60], [20, 60], [20, 70], [10, 70]]] }] },
        { id: 'D', title: 'Bad', geometry: [{ date: '2026-11-02T00:00:00Z', type: 'Point', coordinates: [42, 200] }] },
        { title: 'no id', geometry: [] },
      ],
    });
    expect(out.map((e) => e.id)).toEqual(['A', 'B', 'C']);
    expect([out[0].lat, out[0].lon]).toEqual([42.24, -83.61]);
    expect(out[0].magnitude).toBe('519 acres');
    expect(out[0].sources).toEqual(['IRWIN']);
    expect([out[1].lat, out[1].lon, out[1].date]).toEqual([15, 135, '2026-11-03T00:00:00Z']);
    expect([out[2].lat, out[2].lon]).toEqual([65, 15]);
    expect(parseEonet(null)).toEqual([]);
    expect(parseEonet({ nope: 1 })).toEqual([]);
  });
});

describe('GIBS daily image', () => {
  const now = new Date('2026-11-14T20:00:00Z');
  const answer = (map: Record<string, ProbeResult>) => async (day: string) =>
    map[day] ?? ({ reachable: true, ok: false, layerTimeActual: null } as ProbeResult);

  test('URL template is {z}/{y}/{x} on the Level9 true-colour layer, with the day in the path', () => {
    expect(gibsTemplate('2026-11-13')).toBe(
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2026-11-13/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
    );
    expect(gibsProbeUrl('2026-11-13').endsWith('/2026-11-13/GoogleMapsCompatible_Level9/0/0/0.jpg')).toBe(true);
    expect([utcDay(now, 1), utcDay(now, 2)]).toEqual(['2026-11-13', '2026-11-12']);
  });

  test('yesterday when GIBS confirms it', async () => {
    const c = await pickGibsDay(now, answer({ '2026-11-13': { reachable: true, ok: true, layerTimeActual: '2026-11-13T00:00:00Z' } }));
    expect(c).toEqual({ day: '2026-11-13', how: 'confirmed' });
  });

  test('two days ago when yesterday is not served as yesterday', async () => {
    const c = await pickGibsDay(
      now,
      answer({
        '2026-11-13': { reachable: true, ok: true, layerTimeActual: '2026-11-12T00:00:00Z' },
        '2026-11-12': { reachable: true, ok: true, layerTimeActual: '2026-11-12T00:00:00Z' },
      }),
    );
    expect(c).toEqual({ day: '2026-11-12', how: 'confirmed' });
  });

  test('two days ago, marked assumed, when the header cannot be read', async () => {
    const c = await pickGibsDay(now, answer({ '2026-11-13': { reachable: true, ok: true, layerTimeActual: null } }));
    expect(c).toEqual({ day: '2026-11-12', how: 'assumed' });
  });

  test('no layer at all when GIBS cannot be reached', async () => {
    const c = await pickGibsDay(now, async () => ({ reachable: false }));
    expect(c).toEqual({ day: null, how: 'unreachable' });
  });
});

describe('curated NASA photos', () => {
  const THIRD_PARTY = /\b(ESA|JAXA|CSA|Roscosmos|Axiom|SpaceX|Getty|AP Photo|Reuters)\b|copyright|©/i;

  test('8 to 12 photos, each with a place, a valid lat/lon, a NASA ID and a thumbnail built into the page', () => {
    expect(photos.length).toBeGreaterThanOrEqual(8);
    expect(photos.length).toBeLessThanOrEqual(12);
    for (const p of photos) {
      expect(p.nasa_id).toMatch(/^iss\d{3}e\d+$/);
      expect(p.place.length).toBeGreaterThan(0);
      expect(Math.abs(p.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(p.lon)).toBeLessThanOrEqual(180);
      expect(existsSync(join(root, 'src/data/photos', `${p.nasa_id}.jpg`))).toBe(true);
      expect(meta.files[`photos/${p.nasa_id}.jpg`]?.source).toContain(p.nasa_id);
    }
  });

  test('the NASA-only rule rejects the third-party credits seen in the library searches', () => {
    for (const bad of ['ESA/Sophie Adenot', 'CSA/Joshua Kutryk', 'JAXA/Kimiya Yui', 'NASA/ESA', '', 'Copyright 2026']) {
      expect(NASA_ONLY_CREDIT.test(bad), bad).toBe(false);
    }
    for (const ok of ['NASA', 'NASA/Chris Williams', 'NASA/Jessica Meir']) expect(NASA_ONLY_CREDIT.test(ok), ok).toBe(true);
  });

  test("every photo's credit is NASA only, with no third-party or copyright note anywhere in its record", () => {
    for (const p of photos) {
      expect(p.credit, p.nasa_id).toMatch(NASA_ONLY_CREDIT);
      for (const field of [p.credit, p.photographer, p.secondary_creator, p.title, p.description]) {
        expect(THIRD_PARTY.test(field ?? ''), `${p.nasa_id}: ${field}`).toBe(false);
      }
      const line = photoCreditLine(p);
      expect(line.startsWith(`Photo: NASA, Image and Video Library, ${p.nasa_id}`)).toBe(true);
      expect(THIRD_PARTY.test(line)).toBe(false);
    }
  });

  test('no NASA insignia: every image built into the page is a Blue Marble tile or a curated photo', () => {
    const curated = new Set(photos.map((p) => `src/data/photos/${p.nasa_id}.jpg`));
    const images: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(jpe?g|png|gif|svg|webp|ico|avif)$/i.test(name)) images.push(relative(root, full).replace(/\\/g, '/'));
      }
    };
    walk(join(root, 'src'));
    if (existsSync(join(root, 'public'))) walk(join(root, 'public'));
    for (const img of images) {
      expect(/insignia|meatball|logo|worm/i.test(img), img).toBe(false);
      const allowed = img === 'src/data/bluemarble-z0.jpg' || /^src\/data\/bluemarble\/\d-\d-\d\.jpg$/.test(img) || curated.has(img);
      expect(allowed, img).toBe(true);
    }
    expect(images.filter((i) => i.startsWith('src/data/photos/'))).toHaveLength(photos.length);
    for (const p of photos) {
      const words = [p.title, ...(p.keywords ?? [])].join(' ');
      expect(/insignia|meatball|logo|emblem/i.test(words), p.nasa_id).toBe(false);
    }
    expect(readFileSync(join(root, 'index.html'), 'utf8')).not.toMatch(/rel=["']?icon/i);
  });

  test('credits panel carries the GIBS acknowledgement and the not-affiliated line', () => {
    expect(CREDIT_GIBS).toContain("NASA's Global Imagery Browse Services (GIBS)");
    expect(CREDIT_NOT_NASA).toContain('Not affiliated with or endorsed by NASA');
  });
});
