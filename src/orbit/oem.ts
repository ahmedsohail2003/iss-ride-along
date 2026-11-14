// Parser for NASA's ISS trajectory file: a CCSDS Orbit Ephemeris Message (OEM) in plain text.
// Pure: no I/O. The file is published by NASA Johnson Space Center's flight operations trajectory
// team (ORIGINATOR = NASA/JSC/FOD/TOPO): the station's predicted position and velocity about every
// 4 minutes for 15 days. It is a prediction from NASA's own orbit model, not a measurement.
// We refuse any file whose frame is not EME2000 (J2000) or whose time system is not UTC, because the
// comparison in oemCompare.ts converts our positions into exactly that frame at those times.

export interface OemRow {
  /** Row time, ms since 1970 UTC (the file's own row time; we never interpolate between rows). */
  t: number;
  /** Position, km, EME2000. */
  x: number;
  y: number;
  z: number;
  /** Velocity, km/s, EME2000. */
  vx: number;
  vy: number;
  vz: number;
}

export interface Oem {
  CREATION_DATE: string;
  ORIGINATOR: string;
  OBJECT_NAME: string;
  REF_FRAME: string;
  TIME_SYSTEM: string;
  CENTER_NAME: string;
  rows: OemRow[];
  rowCount: number;
}

/** OEM times have no zone letter; the file's TIME_SYSTEM (checked = UTC) says what they are. */
export function oemTimeMs(s: string): number {
  const ms = Date.parse(`${s.trim()}Z`);
  if (!Number.isFinite(ms)) throw new Error(`OEM: bad time "${s}"`);
  return ms;
}

const DATA_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?\s/;

export function parseOem(text: string): Oem {
  const head: Record<string, string> = {};
  const rows: OemRow[] = [];
  let inCovariance = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('COMMENT')) continue;
    if (line === 'COVARIANCE_START') inCovariance = true;
    if (inCovariance) {
      if (line === 'COVARIANCE_STOP') inCovariance = false;
      continue;
    }
    if (DATA_RE.test(line)) {
      const p = line.split(/\s+/);
      if (p.length < 7) throw new Error(`OEM: data line with ${p.length} fields: "${line.slice(0, 60)}"`);
      const n = p.slice(1, 7).map(Number);
      if (n.some((v) => !Number.isFinite(v))) throw new Error(`OEM: non-numeric data line "${line.slice(0, 60)}"`);
      rows.push({ t: oemTimeMs(p[0]), x: n[0], y: n[1], z: n[2], vx: n[3], vy: n[4], vz: n[5] });
      continue;
    }
    const m = /^([A-Z_]+)\s*=\s*(.*)$/.exec(line);
    // The first value of each key wins (a second segment's metadata must match it; checked below).
    if (m) {
      const [, k, v] = m;
      if (k in head && ['REF_FRAME', 'TIME_SYSTEM', 'CENTER_NAME'].includes(k) && head[k] !== v.trim())
        throw new Error(`OEM: segments disagree on ${k} (${head[k]} vs ${v.trim()})`);
      if (!(k in head)) head[k] = v.trim();
    }
  }
  for (const k of ['CREATION_DATE', 'ORIGINATOR', 'REF_FRAME', 'TIME_SYSTEM'])
    if (!head[k]) throw new Error(`OEM: header has no ${k}`);
  if (head.REF_FRAME !== 'EME2000') throw new Error(`OEM: REF_FRAME is ${head.REF_FRAME}, expected EME2000 (J2000); refusing the file`);
  if (head.TIME_SYSTEM !== 'UTC') throw new Error(`OEM: TIME_SYSTEM is ${head.TIME_SYSTEM}, expected UTC; refusing the file`);
  if (head.CENTER_NAME && head.CENTER_NAME.toUpperCase() !== 'EARTH') throw new Error(`OEM: CENTER_NAME is ${head.CENTER_NAME}, expected Earth`);
  if (rows.length === 0) throw new Error('OEM: no data rows');
  for (let i = 1; i < rows.length; i++)
    if (rows[i].t <= rows[i - 1].t) throw new Error(`OEM: row ${i + 1} is not later than row ${i}`);
  return {
    CREATION_DATE: head.CREATION_DATE,
    ORIGINATOR: head.ORIGINATOR,
    OBJECT_NAME: head.OBJECT_NAME ?? '',
    REF_FRAME: head.REF_FRAME,
    TIME_SYSTEM: head.TIME_SYSTEM,
    CENTER_NAME: head.CENTER_NAME ?? '',
    rows,
    rowCount: rows.length,
  };
}
