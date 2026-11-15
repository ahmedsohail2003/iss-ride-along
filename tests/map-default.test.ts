// P2: a clear map by default. The cloud-free Blue Marble is the default layer (no date on its label);
// the dated daily photo is one switch away and keeps its date and "not a live camera".
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { MAP_LABEL, blueMarbleTemplate, dailyLabel } from '../src/nasa/gibs';
import { CREDIT_GIBS_LAYERS } from '../src/nasa/credits';

const root = fileURLToPath(new URL('..', import.meta.url));
const meta = JSON.parse(readFileSync(join(root, 'src/data/snapshot-meta.json'), 'utf8'));
const DATE = /\d{4}-\d{2}-\d{2}/;

describe('P2 default map: cloud-free Blue Marble', () => {
  test('the GIBS template is the one in GIBS WMTS capabilities (read 2026-11-14 22:00 ET)', () => {
    expect(blueMarbleTemplate()).toBe(
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg',
    );
  });

  test('it is the same layer every built-in tile was saved from (21 tiles, zoom 0-2)', () => {
    const tiles = Object.entries(meta.files as Record<string, { source: string }>).filter(([k]) => /^bluemarble(-z0|\/)/.test(k));
    expect(tiles.length).toBe(21);
    for (const [name, f] of tiles) {
      const [z, y, x] = name === 'bluemarble-z0.jpg' ? ['0', '0', '0'] : name.replace(/^bluemarble\/|\.jpg$/g, '').split('-');
      expect(f.source).toBe(blueMarbleTemplate().replace('{z}', z).replace('{y}', y).replace('{x}', x));
    }
  });

  test('every default-map label names the cloud-free Blue Marble and never a date', () => {
    for (const text of Object.values(MAP_LABEL)) {
      expect(text).toMatch(/NASA Blue Marble, a cloud-free picture of Earth/);
      expect(text).not.toMatch(DATE);
    }
    // the --block check in scripts/smoke.mjs reads this one
    expect(MAP_LABEL.unreachable).toMatch(/Blue Marble.*NASA GIBS could not be reached/);
  });

  test('the daily photo label carries its date, "not a live camera" and the stripes note', () => {
    const t = dailyLabel('2026-11-13', 'confirmed');
    expect(t).toMatch(/daily satellite image, 2026-11-13, not a live camera/);
    expect(t).toContain('Black stripes = gaps between');
    expect(t).not.toContain('two days ago');
    expect(dailyLabel('2026-11-12', 'assumed')).toContain('GIBS did not confirm the date, so the page uses two days ago');
  });

  test('the credits name both layers', () => {
    expect(CREDIT_GIBS_LAYERS).toContain('Blue Marble Shaded Relief and Bathymetry');
    expect(CREDIT_GIBS_LAYERS).toContain('MODIS Terra Corrected Reflectance (True Color)');
  });

  test('the page has the switch, off by default, labelled as the photo with clouds', () => {
    const main = readFileSync(join(root, 'src/main.ts'), 'utf8');
    expect(main).toMatch(/<input type="checkbox" id="daily-toggle" disabled> Daily satellite photo \(with clouds\)/);
    expect(main).not.toMatch(/id="daily-toggle"[^>]*checked/);
  });
});
