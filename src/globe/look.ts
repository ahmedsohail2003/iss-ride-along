// G2: the 3D view's look (black page, white headline with a grey second line, a pill badge, thin borders,
// numbers in a fixed-width face), written new at this event. Every colour of the look is here; src/main.ts
// copies them into CSS custom properties (--g-*) and src/style.css uses only those under
// body[data-view="3d"], so tests/globe.test.ts can check each text colour on its panel colour (WCAG 2.x
// contrast, at least 4.5 to 1). Panels are fully opaque, so the contrast is the one on screen.
export const LOOK = {
  page: '#000000',
  panel: '#0c0c0e',
  raised: '#17171a',
  line: '#2e2e33',
  text: '#f4f4f5',
  muted: '#a1a1aa',
  accent: '#7fdbff',
  onLight: '#000000',
  good: '#3ecf8e',
  warn: '#ffd166',
  bad: '#ff6b6b',
  pass: '#ff5fa2',
} as const;
export type LookKey = keyof typeof LOOK;

/** Every text colour of the look and the panel colour it is drawn on. */
export const TEXT_ON: [text: LookKey, on: LookKey, where: string][] = [
  ['text', 'page', 'headline, page text'],
  ['muted', 'page', 'the grey second line under the headline'],
  ['text', 'panel', 'card and panel text'],
  ['muted', 'panel', 'small and grey text in cards'],
  ['accent', 'panel', 'links and link-buttons in cards'],
  ['accent', 'page', 'links and link-buttons on the page'],
  ['text', 'raised', 'tabs, inputs, warnings, the age line'],
  ['muted', 'raised', 'grey text on tabs and warnings'],
  ['onLight', 'text', 'buttons, the open tab, the pressed view button, the badge'],
  ['good', 'panel', 'green numbers (km from the reference, NASA gap)'],
  ['warn', 'panel', 'amber notes (fixed plan, orbit lines)'],
  ['bad', 'panel', 'red notes (a failed step)'],
];

const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
/** WCAG relative luminance of a #rrggbb colour. */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}
/** WCAG contrast ratio between two #rrggbb colours (1 to 21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Put the look's colours on the page as --g-<name> custom properties (unused by the flat page). */
export function applyLook(root: HTMLElement) {
  for (const [k, v] of Object.entries(LOOK)) root.style.setProperty(`--g-${k}`, v);
}
