// M4 fix r2: the stale-build guard. smoke.mjs compares the hash a built page carries with the hash of
// the source now; these tests pin the two halves (hashing the source, reading the hash back).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { builtHash, sourceHash, SOURCE_HASH_META } from '../scripts/source-hash.mjs';

const dirs: string[] = [];
function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'srchash-'));
  dirs.push(root);
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(join(root, rel, '..'), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  return root;
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('source hash', () => {
  it('changes when one source line changes and ignores CRLF vs LF', () => {
    const a = sourceHash(project({ 'index.html': '<p>x</p>\n', 'src/nasa/eonet.ts': "const u = 'status=open&limit=50';\n" }));
    const b = sourceHash(project({ 'index.html': '<p>x</p>\n', 'src/nasa/eonet.ts': "const u = 'status=open&days=30';\n" }));
    const aCrlf = sourceHash(project({ 'index.html': '<p>x</p>\r\n', 'src/nasa/eonet.ts': "const u = 'status=open&limit=50';\r\n" }));
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(b).not.toBe(a);
    expect(aCrlf).toBe(a);
  });

  it('reads the hash back from a built page, and null from a page built before the guard', () => {
    expect(builtHash(`<head><meta name="${SOURCE_HASH_META}" content="cf6fd929500c010b"></head>`)).toBe('cf6fd929500c010b');
    expect(builtHash('<head><title>ISS Ride-Along</title></head>')).toBeNull();
  });
});
