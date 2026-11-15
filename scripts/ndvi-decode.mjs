// X6 step 6: turn a NASA GIBS greenness (NDVI) image back into numbers with NASA's own colour key.
// Plain Node (zlib), shared by scripts/fetch-altdata.mjs (which stores the result in altdata.json) and
// tests/altdata.test.ts (which decodes the bundled images again and compares).
//
// Each colour in GIBS's MODIS_L3_NDVI colour key stands for a range of NDVI about 0.01 wide (for example
// rgb 0,24,0 = [0.9801, 0.9901)). So the mean greenness of an image is itself a range: the mean of the
// lower ends to the mean of the upper ends, over every visible pixel. Transparent pixels (no data,
// water, cloud-filled) are skipped.
import { inflateSync } from 'node:zlib';

/** Decode an 8-bit, non-interlaced PNG (greyscale, RGB, palette or RGBA) into RGBA pixels. */
export function decodePng(buf) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!sig.every((b, i) => buf[i] === b)) throw new Error('not a PNG');
  let i = 8;
  let w = 0, h = 0, depth = 0, type = 0, interlace = 0;
  let plte = null, trns = null;
  const idat = [];
  while (i < buf.length) {
    const n = buf.readUInt32BE(i);
    const t = buf.toString('latin1', i + 4, i + 8);
    const d = buf.subarray(i + 8, i + 8 + n);
    i += 12 + n;
    if (t === 'IHDR') {
      w = d.readUInt32BE(0);
      h = d.readUInt32BE(4);
      depth = d[8];
      type = d[9];
      interlace = d[12];
    } else if (t === 'PLTE') plte = d;
    else if (t === 'tRNS') trns = d;
    else if (t === 'IDAT') idat.push(d);
    else if (t === 'IEND') break;
  }
  if (depth !== 8 || interlace !== 0) throw new Error(`unsupported PNG (bit depth ${depth}, interlace ${interlace})`);
  const ch = { 0: 1, 2: 3, 3: 1, 6: 4 }[type];
  if (!ch) throw new Error(`unsupported PNG colour type ${type}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  let prev = new Uint8Array(stride);
  const px = new Uint8Array(w * h * 4);
  for (let r = 0; r < h; r++) {
    const f = raw[r * (stride + 1)];
    const line = new Uint8Array(raw.subarray(r * (stride + 1) + 1, (r + 1) * (stride + 1)));
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? line[x - ch] : 0;
      const b = prev[x];
      const c = x >= ch ? prev[x - ch] : 0;
      if (f === 1) line[x] = (line[x] + a) & 255;
      else if (f === 2) line[x] = (line[x] + b) & 255;
      else if (f === 3) line[x] = (line[x] + ((a + b) >> 1)) & 255;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    prev = line;
    for (let x = 0; x < w; x++) {
      const o = (r * w + x) * 4;
      if (type === 6) px.set(line.subarray(4 * x, 4 * x + 4), o);
      else if (type === 2) px.set([line[3 * x], line[3 * x + 1], line[3 * x + 2], 255], o);
      else if (type === 0) px.set([line[x], line[x], line[x], 255], o);
      else {
        const k = line[x];
        px.set([plte[3 * k], plte[3 * k + 1], plte[3 * k + 2], trns && k < trns.length ? trns[k] : 255], o);
      }
    }
  }
  return { width: w, height: h, type, pixels: px };
}

/** GIBS colour key (ColorMap XML) -> Map "r,g,b" -> [low, high] NDVI, opaque entries only. */
export function parseColourKey(xml) {
  const key = new Map();
  for (const e of xml.match(/<ColorMapEntry[^>]*>/g) ?? []) {
    const a = Object.fromEntries([...e.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
    if (a.transparent === 'true' || !a.rgb || !a.value) continue;
    const v = (a.value.match(/-?\d+\.?\d*(?:e-?\d+)?/g) ?? []).map(Number);
    if (!v.length) continue;
    key.set(a.rgb.split(',').map(Number).join(','), [v[0], v[1] ?? v[0]]);
  }
  return key;
}

/** Mean NDVI under an image, as a range, over every visible pixel whose colour is in the key. */
export function meanGreenness(png, key) {
  let visible = 0, matched = 0, lo = 0, hi = 0;
  const p = png.pixels;
  for (let i = 0; i < p.length; i += 4) {
    if (p[i + 3] === 0) continue;
    visible++;
    const r = key.get(`${p[i]},${p[i + 1]},${p[i + 2]}`);
    if (!r) continue;
    matched++;
    lo += r[0];
    hi += r[1];
  }
  return {
    width: png.width,
    height: png.height,
    visible,
    matched,
    low: matched ? lo / matched : null,
    high: matched ? hi / matched : null,
    mean: matched ? (lo + hi) / (2 * matched) : null,
  };
}
