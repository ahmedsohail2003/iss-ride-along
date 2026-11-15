// C3's live region (the plain sentence above the map) and its once-a-minute timer, moved out of main.ts
// for X3 so a test can run the real timer: the sentence is set once at load and then only every 60 s
// (not on every per-second tick and not when fresh orbit numbers arrive), so a screen reader hears it
// at most once a minute. After each write `onText` gets exactly the text now in the region; X3's voice
// speaks it when the speaker toggle is on.
import type { SatRec } from 'satellite.js';
import { whereNow } from './sentence';

export interface RegionLike {
  textContent: string | null;
  dataset: Record<string, string | undefined>;
}

export const WHERE_EVERY_MS = 60_000;

export function startWhereRegion(o: { el: RegionLike; getSatrec: () => SatRec; onText?: (text: string) => void }): { render(now: Date): void; stop(): void } {
  function render(now: Date) {
    const w = whereNow(o.getSatrec(), now);
    if (!w) return;
    o.el.textContent = w.text;
    o.el.dataset.city = w.city.name;
    o.el.dataset.km = w.km.toFixed(1);
    o.el.dataset.direction = w.direction;
    o.onText?.(o.el.textContent);
  }
  render(new Date());
  const timer = setInterval(() => render(new Date()), WHERE_EVERY_MS);
  return { render, stop: () => clearInterval(timer) };
}
