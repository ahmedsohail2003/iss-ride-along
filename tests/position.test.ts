// M1 acceptance: our SGP4 position, altitude and orbital speed against the 10 wheretheiss.at
// samples saved in src/data/ (propagated from the same element set that tracker used).
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { satrecFromTle } from '../src/orbit/orbit';
import { compareWithReference, type ReferenceSample } from '../src/orbit/compare';

const fixture = JSON.parse(readFileSync(new URL('../src/data/wheretheiss-samples.json', import.meta.url), 'utf8')) as {
  tle: { line1: string; line2: string };
  samples: ReferenceSample[];
};
const satrec = satrecFromTle(`${fixture.tle.line1}\n${fixture.tle.line2}`);
const rows = fixture.samples.map((s) => compareWithReference(satrec, s)!);

describe('position against the 10-sample wheretheiss.at fixture', () => {
  test('there are 10 samples and every one propagates', () => {
    expect(fixture.samples).toHaveLength(10);
    expect(rows.every((r) => r !== null)).toBe(true);
  });

  test('position within 2 km, altitude within 0.1 km, speed within 1 km/h on every sample', () => {
    const maxErr = Math.max(...rows.map((r) => r.errorKm));
    const maxAlt = Math.max(...rows.map((r) => Math.abs(r.dAltKm)));
    const maxSpd = Math.max(...rows.map((r) => Math.abs(r.dSpeedKmH)));
    console.log(
      `position max ${maxErr.toFixed(4)} km, |altitude diff| max ${maxAlt.toFixed(4)} km, ` +
        `|speed diff| max ${maxSpd.toFixed(4)} km/h over ${rows.length} samples`,
    );
    for (const r of rows) {
      expect(r.errorKm).toBeLessThan(2);
      expect(Math.abs(r.dAltKm)).toBeLessThan(0.1);
      expect(Math.abs(r.dSpeedKmH)).toBeLessThan(1);
    }
  });
});
