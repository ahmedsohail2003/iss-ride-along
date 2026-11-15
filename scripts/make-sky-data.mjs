// X5: builds the star and constellation data the sky panel draws, from d3-celestial (Olaf Frohn,
// BSD 3-Clause), pinned to one commit so the copy can be rebuilt byte for byte.
//
//   node scripts/make-sky-data.mjs
//
// Fetches 5 files from raw.githubusercontent.com and writes, in src/data/sky/:
//   stars.json   [raDeg, decDeg, mag, hip, bv, name?] for every star of magnitude 5.0 or brighter
//   lines.json   { id: [[[raDeg, decDeg], ...], ...] } the constellation stick figures
//   names.json   [id, IAU name, raDeg, decDeg, rank] where each constellation's name is drawn
//   meta.json    source URLs, commit, retrieval time, SHA-256 of each upstream file, counts, licence
// Positions are J2000 (d3-celestial converted them; its readme says so). d3-celestial stores right
// ascension as a map longitude from -180 to 180; this script turns it back into 0 to 360 degrees.
// Neither file is NASA data: stars from XHIP (Anderson and Francis 2012, VizieR V/137D), lines from
// the IAU constellation charts with changes by Olaf Frohn.
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const COMMIT = '7e720a3de062059d4c5400a379146a601d9010e0'; // d3-celestial master on 2026-11-14 (committed 2022-07-05)
const BASE = `https://raw.githubusercontent.com/ofrohn/d3-celestial/${COMMIT}/`;
const FILES = ['data/stars.6.json', 'data/starnames.json', 'data/constellations.lines.json', 'data/constellations.json', 'LICENSE'];
const MAG_LIMIT = 5.0;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'src', 'data', 'sky');
const ra = (lon) => +(lon < 0 ? lon + 360 : lon).toFixed(4);
const r4 = (x) => +x.toFixed(4);

const got = {};
const upstream = {};
for (const f of FILES) {
  const res = await fetch(BASE + f);
  if (!res.ok) throw new Error(`${f}: HTTP ${res.status}`);
  const text = await res.text();
  got[f] = text;
  upstream[f] = { url: BASE + f, bytes: Buffer.byteLength(text), sha256: createHash('sha256').update(text).digest('hex') };
}
const retrievedAt = new Date().toISOString();

const names = JSON.parse(got['data/starnames.json']);
const stars = JSON.parse(got['data/stars.6.json'])
  .features.filter((s) => s.properties.mag <= MAG_LIMIT)
  .map((s) => {
    const [lon, lat] = s.geometry.coordinates;
    const row = [ra(lon), r4(lat), s.properties.mag, s.id, s.properties.bv === '' ? null : +(+s.properties.bv).toFixed(2)];
    const name = names[String(s.id)]?.name;
    if (name) row.push(name);
    return row;
  })
  .sort((a, b) => a[2] - b[2]);

const lines = {};
for (const c of JSON.parse(got['data/constellations.lines.json']).features) {
  // Serpens comes as two features with one id (its head and tail): keep both.
  lines[c.id] = (lines[c.id] ?? []).concat(c.geometry.coordinates.map((seg) => seg.map(([lon, lat]) => [ra(lon), r4(lat)])));
}
const consts = JSON.parse(got['data/constellations.json']).features.map((c) => {
  const [lon, lat] = c.geometry.coordinates;
  return [c.id, c.properties.name, ra(lon), r4(lat), +c.properties.rank]; // the IAU (Latin) name
});

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'stars.json'), JSON.stringify(stars));
writeFileSync(join(outDir, 'lines.json'), JSON.stringify(lines));
writeFileSync(join(outDir, 'names.json'), JSON.stringify(consts));
const meta = {
  generatedBy: 'scripts/make-sky-data.mjs',
  source: 'd3-celestial by Olaf Frohn, https://github.com/ofrohn/d3-celestial',
  commit: COMMIT,
  retrievedAt,
  license: 'BSD 3-Clause (copyright (c) 2015, Olaf Frohn); full text in docs/THIRD_PARTY_NOTICES.md',
  starsFrom: 'XHIP: An Extended Hipparcos Compilation, Anderson E., Francis C. (2012), VizieR V/137D, as converted by d3-celestial (J2000)',
  linesFrom: 'IAU constellation charts, with line changes by Olaf Frohn (d3-celestial)',
  notNasa: 'Neither the star catalogue nor the constellation lines are NASA data.',
  magLimit: MAG_LIMIT,
  counts: { stars: stars.length, starsInFile: JSON.parse(got['data/stars.6.json']).features.length, named: stars.filter((s) => s.length > 5).length, constellations: Object.keys(lines).length, labels: consts.length },
  upstream,
};
writeFileSync(join(outDir, 'meta.json'), JSON.stringify(meta, null, 1) + '\n');
console.log(`sky data: ${meta.counts.stars} stars of magnitude ${MAG_LIMIT} or brighter (of ${meta.counts.starsInFile}), ${meta.counts.named} named, ${meta.counts.constellations} constellation figures, retrieved ${retrievedAt}`);
