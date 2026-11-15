// G5: small labels on the globe (written new at this event; the idea of short monospace labels with real numbers
// sitting on the object is from the look of Ahmed's earlier RoBuff page, nothing copied). #hud-station sits next to
// the station marker, #hud-pass next to the chosen town. Their numbers are copied from the page's own readouts
// (#alt, #speed, and the pass's day and time as the plan card prints them), never computed again here. They are
// aria-hidden, not focusable and not live regions: the readout panel and the plan card already say all of it.
// Capitals come from CSS (text-transform), so the text itself is the readout strings unchanged.

/** One constant switches the labels off. */
export const HUD_ON = true;

/** The station's label: two lines built from the #alt and #speed texts exactly as given. */
export function stationLabel(altText: string, speedText: string): [string, string] {
  return ['ISS · now', `${altText} km up · ${speedText} km/h`];
}

/** The chosen pass's label: the town, and the night and start time as the plan card prints them. */
export function passLabel(town: string, night: string, start: string): [string, string] {
  return [town, `${night} · ${start}`];
}

export interface HudEl {
  el: HTMLElement;
  lines: [HTMLElement, HTMLElement];
}

/** Make one label inside `host` (a box with a thin leader line from its corner to the point it names). */
export function makeHud(host: HTMLElement, id: string): HudEl {
  const el = document.createElement('div');
  el.id = id;
  el.className = 'hud';
  el.setAttribute('aria-hidden', 'true');
  el.hidden = true;
  const a = document.createElement('span');
  const b = document.createElement('span');
  a.className = 'hud-l1';
  b.className = 'hud-l2';
  el.append(a, b);
  host.appendChild(el);
  return { el, lines: [a, b] };
}

/** Leader length in px: the box's near corner sits this far from the point, on both axes. */
export const HUD_OFFSET = 18;

/**
 * Where a w x h label goes for a point at `at` in a hostW x hostH box: on the side of the point away from the
 * middle of the box (right of it when the point is right of the middle, below it when below), then kept inside
 * the box. The vertical rule alone keeps the label off the middle rows (the label is far shorter than half the
 * box), so a label never covers the middle of the globe, where the picture checks look.
 */
export function hudBox(at: { x: number; y: number }, w: number, h: number, hostW: number, hostH: number): { left: number; top: number; toLeft: boolean; below: boolean } {
  const toLeft = at.x < hostW / 2;
  const below = at.y > hostH / 2;
  const left = toLeft ? at.x - HUD_OFFSET - w : at.x + HUD_OFFSET;
  const top = below ? at.y + HUD_OFFSET : at.y - HUD_OFFSET - h;
  return {
    left: Math.max(2, Math.min(hostW - w - 2, left)),
    top: Math.max(2, Math.min(hostH - h - 2, top)),
    toLeft,
    below,
  };
}

/** Put a label at screen point (x, y) inside its host, or hide it (`at` null: the point is on the far side). */
export function placeHud(h: HudEl, text: [string, string] | null, at: { x: number; y: number } | null, hostW: number, hostH: number) {
  if (!text || !at) {
    h.el.hidden = true;
    return;
  }
  if (h.lines[0].textContent !== text[0]) h.lines[0].textContent = text[0];
  if (h.lines[1].textContent !== text[1]) h.lines[1].textContent = text[1];
  h.el.hidden = false;
  const b = hudBox(at, h.el.offsetWidth || 160, h.el.offsetHeight || 36, hostW, hostH);
  h.el.classList.toggle('hud-left', b.toLeft);
  h.el.classList.toggle('hud-below', b.below);
  h.el.style.left = `${b.left}px`;
  h.el.style.top = `${b.top}px`;
}
