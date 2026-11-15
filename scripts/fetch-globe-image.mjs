// G1 step 4: save the 3D globe's Earth image once, so the page works offline and from file://.
// It is NASA's cloud-free Blue Marble, the same GIBS layer the flat map already uses and credits
// (BlueMarble_ShadedRelief_Bathymetry), asked for as one equirectangular picture of the whole world:
// GIBS WMS 1.3.0, EPSG:4326 (lat,lon axis order, so BBOX=-90,-180,90,180), 2048x1024 JPEG. The left
// edge is longitude -180 and the top latitude +90, which is how a sphere's texture coordinates run.
//
//   node scripts/fetch-globe-image.mjs            -> src/data/globe/bluemarble-2048.jpg + bluemarble-2048.json
//   node scripts/fetch-globe-image.mjs --size 1024 (the smaller copy named in PLAN.md's size budget)
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const width = Number(args[args.indexOf('--size') + 1] || 2048) === 1024 && args.includes('--size') ? 1024 : 2048;
const height = width / 2;
const layer = 'BlueMarble_ShadedRelief_Bathymetry';
const url =
  'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap' +
  `&LAYERS=${layer}&STYLES=&CRS=EPSG:4326&BBOX=-90,-180,90,180&WIDTH=${width}&HEIGHT=${height}&FORMAT=image/jpeg`;

const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
const type = res.headers.get('content-type') ?? '';
const buf = Buffer.from(await res.arrayBuffer());
// A WMS error comes back as XML with status 200, so the bytes must really be a JPEG (FF D8 FF).
if (!res.ok || !type.startsWith('image/jpeg') || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) {
  console.log(`FETCH FAIL: HTTP ${res.status}, ${type}, ${buf.length} bytes`);
  process.exit(1);
}
const dir = resolve('src/data/globe');
mkdirSync(dir, { recursive: true });
const name = `bluemarble-${width}`;
writeFileSync(resolve(dir, `${name}.jpg`), buf);
const meta = {
  layer,
  url,
  retrievedAt: new Date().toISOString(),
  width,
  height,
  bytes: buf.length,
  sha256: createHash('sha256').update(buf).digest('hex'),
  contentType: type,
  credit: 'NASA EOSDIS Global Imagery Browse Services (GIBS), Blue Marble Shaded Relief and Bathymetry',
};
writeFileSync(resolve(dir, `${name}.json`), JSON.stringify(meta, null, 2) + '\n');
console.log(`saved src/data/globe/${name}.jpg: HTTP ${res.status}, ${buf.length} bytes, sha256 ${meta.sha256}`);
