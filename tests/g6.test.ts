// G6 acceptance (the unit part): the hero's words are the ones PLAN.md names, the card look's colours are readable
// (every new text and background pair at 4.5 to 1 or better), the fonts are the Latin Geist files from npm built
// into the page, and the Code link points at the repo.
import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { contrast, LOOK, TEXT_ON } from '../src/globe/look';
import { CARD_TAGS, codeLinkHtml, HERO_LINES, HERO_PILL, heroHtml, markSvg, REPO_URL, tagHtml } from '../src/ui/hero';
import { DEFAULT_STYLE } from '../src/globe/dots';

const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
const g6Block = css.slice(css.indexOf('/* G6:'));

describe('G6 RoBuff type and interface', () => {
  test('the headline and pill strings are the ones in PLAN.md', () => {
    expect(HERO_PILL).toBe('Hack the Nest 2026 · Low Earth orbit');
    expect(HERO_LINES).toEqual(['Plan the one pass', 'worth going outside for.']);
    expect(heroHtml).toContain('id="hero-copy"');
    expect(heroHtml).toContain(`<span class="hero-l1">${HERO_LINES[0]}</span>`);
    expect(heroHtml).toContain(`<span class="hero-l2">${HERO_LINES[1]}</span>`);
    expect(heroHtml).toContain(HERO_PILL);
  });

  test('the tag pills and the mark are decorative; the Code link names the repo and opens a new tab safely', () => {
    expect(CARD_TAGS.map(([, t]) => t)).toEqual(['PLANNER', 'NEXT PASS', 'CHECKED AGAINST NASA']);
    expect(tagHtml('PLANNER')).toBe('<span class="g6-tag" aria-hidden="true">PLANNER</span>');
    expect(markSvg).toContain('aria-hidden="true"');
    expect(markSvg).toContain('focusable="false"');
    expect(REPO_URL).toBe('https://github.com/ahmedsohail2003/iss-ride-along');
    expect(codeLinkHtml).toContain(`href="${REPO_URL}"`);
    expect(codeLinkHtml).toContain('rel="noopener"');
    expect(codeLinkHtml).toContain('target="_blank"');
    expect(codeLinkHtml).toMatch(/id="code-link"/);
    expect(codeLinkHtml).toMatch(/aria-label="Code[^"]+"/); // the visible word starts the accessible name
  });

  test('every new text and background pair of the card look has contrast of at least 4.5 to 1', () => {
    const g6 = TEXT_ON.slice(TEXT_ON.findIndex(([, , w]) => /hero headline line one/.test(w)));
    expect(g6.length).toBe(8);
    expect(g6.some(([t, on]) => t === 'text' && on === 'pressed')).toBe(true);
    for (const [t, on, where] of g6) {
      const r = contrast(LOOK[t], LOOK[on]);
      console.log(`G6 contrast ${t} ${LOOK[t]} on ${on} ${LOOK[on]}: ${r.toFixed(2)} (${where})`);
      expect(r, `${t} on ${on}`).toBeGreaterThanOrEqual(4.5);
    }
    // the G6 CSS uses no literal colour and only --g-* names the look defines
    const rules = g6Block.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(rules.length).toBeGreaterThan(1500);
    expect(rules.match(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/gi)).toBeNull();
    const used = new Set([...rules.matchAll(/var\(--g-([a-zA-Z]+)\)/g)].map((m) => m[1]));
    for (const u of used) expect(Object.keys(LOOK), u).toContain(u);
    expect(used.has('pressed')).toBe(true);
  });

  test('the fonts are the Latin Geist and Geist Mono files from npm (OFL 1.1), swapped in, no font host', () => {
    const fonts = readFileSync(new URL('../src/fonts.css', import.meta.url), 'utf8');
    const srcs = [...fonts.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1]);
    expect(srcs).toEqual([
      '../node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2',
      '../node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2',
    ]);
    for (const s of srcs) expect(existsSync(new URL(`../src/${s}`, import.meta.url)), s).toBe(true);
    expect(fonts.match(/font-display: swap/g)?.length).toBe(2);
    expect(fonts).not.toMatch(/https?:\/\//);
    for (const pkg of ['geist', 'geist-mono']) {
      const p = JSON.parse(readFileSync(new URL(`../node_modules/@fontsource-variable/${pkg}/package.json`, import.meta.url), 'utf8'));
      expect(p.license).toBe('OFL-1.1');
    }
    expect(fonts).toMatch(/--font-sans: 'Geist',/);
    expect(fonts).toMatch(/--font-mono: 'Geist Mono',/);
  });

  test('the hero copy is hidden on the flat page and in print; nothing new animates', () => {
    expect(css).toMatch(/\.hero-copy, \.g6-tag \{ display: none; \}/);
    expect(g6Block).toMatch(/@media print \{ \.hero-copy, \.g6-tag, \.code-link \{ display: none !important; \} \}/);
    expect(g6Block).not.toMatch(/animation|transition|@keyframes/);
  });

  test("DEFAULT_STYLE is 'photo' or 'dots'", () => {
    expect(['photo', 'dots']).toContain(DEFAULT_STYLE);
  });
});
