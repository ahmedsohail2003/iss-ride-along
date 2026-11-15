// G6: RoBuff's type and interface on our page, written new at this event (modelled on the look of Ahmed's earlier
// RoBuff page from his screenshots; nothing opened or copied from it). Three parts, each behind one constant:
//   HERO_ON  - #hero-copy at the top of the left column in the 3D view: a pill with a small dot and a two-tone
//              headline (the Devpost tagline's own claim). Hidden on the flat page and in print (src/style.css).
//   LOOK2_ON - the card look in the 3D view (body.look2; the rules are the G6 block of src/style.css): rounder
//              cards, a white main button with an arrow, outline buttons and pills, segmented switches, mono
//              values, and a small tag pill at the top of three cards (decorative, aria-hidden).
//   The header's own mark (a ring with a dot, not RoBuff's mark) and the "Code" link to the repo are in both
//   views, so header.top keeps the same top and height in both (G2's check).
// The fonts (Geist, Geist Mono; SIL Open Font License 1.1, from npm, Latin files only) are in src/fonts.css.
export const HERO_ON = true;
export const LOOK2_ON = true;

export const HERO_PILL = 'Hack the Nest 2026 · Low Earth orbit';
export const HERO_LINES = ['Plan the one pass', 'worth going outside for.'] as const;
export const REPO_URL = 'https://github.com/ahmedsohail2003/iss-ride-along';
/** The tag pill on each card: [selector of the card, its text]. */
export const CARD_TAGS: [selector: string, text: string][] = [
  ['section.planner[aria-labelledby="planner-h"]', 'PLANNER'],
  ['section.next-box', 'NEXT PASS'],
  ['section.acc-card', 'CHECKED AGAINST NASA'],
];

/** Our own mark: a ring with a dot (inline SVG, decorative). */
export const markSvg =
  '<svg class="mark" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">' +
  '<circle cx="10" cy="10" r="7.6" fill="none" stroke="currentColor" stroke-width="2"/>' +
  '<circle cx="10" cy="10" r="2.6" fill="currentColor"/></svg>';

export const codeLinkHtml = `<a id="code-link" class="code-link no-print" href="${REPO_URL}" target="_blank" rel="noopener" aria-label="Code on GitHub (opens in a new tab)">Code</a>`;

export const heroHtml = HERO_ON
  ? `<div id="hero-copy" class="hero-copy">
        <p class="hero-pill"><span class="hero-dot" aria-hidden="true"></span>${HERO_PILL}</p>
        <p class="hero-title"><span class="hero-l1">${HERO_LINES[0]}</span> <span class="hero-l2">${HERO_LINES[1]}</span></p>
      </div>`
  : '';

/** The tag pill's markup (decorative: hidden from screen readers, never focused). */
export function tagHtml(text: string): string {
  return `<span class="g6-tag" aria-hidden="true">${text}</span>`;
}

/** Turn the card look on (body.look2) and put the tag pills at the top of their cards. */
export function initLook2(doc: Document = document): void {
  if (!LOOK2_ON) return;
  doc.body.classList.add('look2');
  for (const [sel, text] of CARD_TAGS) doc.querySelector(sel)?.insertAdjacentHTML('afterbegin', tagHtml(text));
}
