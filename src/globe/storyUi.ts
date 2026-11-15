// G3: the scroll story under the tool, in the 3D view only (CSS hides #story on the flat page). Six short scenes;
// while the section is on screen the globe's canvas fills the window behind the text (body.story-on) and the
// scene crossing the middle of the window picks where the camera goes (src/globe/story.ts sceneAt). An
// IntersectionObserver does all the picking, so nothing runs on each scroll event. The numbers in the scenes
// are plain text copied from the engine's values each second (not live regions: nothing is announced).
import { footprintRadiusKm } from '../nasa/footprint';
import { SCENE_IDS, type SceneId } from './story';
import { siderealDeg, STARS } from './stars';
import type { Globe } from './globe';

const n = (id: string) => `<span id="story-${id}">-</span>`;
const SCENES: Record<SceneId, [string, string]> = {
  now: ['Right now, over the station', `It is ${n('alt')} km up and moving at ${n('speed')} km/h (orbital speed); the camera follows it.`],
  orbit: ['One lap of the Earth', `Seen face on, one lap takes ${n('period')} minutes: the yellow line is the last lap, the blue line the next.`],
  daynight: ['Where day meets night', `The Sun is straight above ${n('sun')} now; the dark half of the Earth is where it has set.`],
  view: ['What the crew can see', `Everything within ${n('radius')} km of the point under the station is above its horizon: the circle round it.`],
  sky: ['The stars behind it', `${STARS.length.toLocaleString('en-US')} catalogue stars, turned by sidereal time; straight above the station now: right ascension ${n('ra')}°, declination ${n('dec')}°.`],
  real: [
    'Computed here, fetched from NASA, or a saved picture',
    "The station, its orbits, the night side and the stars are computed in your browser; the Earth is NASA's Blue Marble saved into this page, and the flat map and the tabs fetch NASA's live layers. A drawing of computed positions, not a live camera.",
  ],
};

export const storyHtml = `
  <section id="story" class="story" aria-label="The globe, scene by scene">
${SCENE_IDS.map((id) => `    <article id="scene-${id}" class="scene" data-scene="${id}"><div class="scene-card"><h2>${SCENES[id][0]}</h2><p>${SCENES[id][1]}</p></div></article>`).join('\n')}
  </section>`;

const hemi = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(1)}° ${v >= 0 ? pos : neg}`;

export function initStory(opts: { getGlobe: () => Globe | null; isOn3d: () => boolean }) {
  const root = document.getElementById('story');
  if (!root) return { update: () => {}, sync: () => {} };
  const scenes = [...root.querySelectorAll<HTMLElement>('.scene')];
  let on = false;
  let current: SceneId | null = null;

  /** The scene whose box crosses the middle of the window (the last one picked stays while none does). */
  function pick() {
    const mid = window.innerHeight / 2;
    for (const s of scenes) {
      const r = s.getBoundingClientRect();
      if (r.top <= mid && r.bottom >= mid) {
        current = s.dataset.scene as SceneId;
        return;
      }
    }
  }
  function sync() {
    const g = opts.getGlobe();
    const show = on && opts.isOn3d();
    document.body.classList.toggle('story-on', show);
    if (!g) return;
    g.setFull(show);
    g.setStory(show ? current : null);
  }
  new IntersectionObserver((entries) => {
    for (const e of entries) if (e.target === root) on = e.isIntersecting;
    pick();
    sync();
  }).observe(root);
  // a band across the middle of the window: a scene entering or leaving it may change the pick
  const band = new IntersectionObserver(
    () => {
      pick();
      sync();
    },
    { rootMargin: '-45% 0px -45% 0px' },
  );
  scenes.forEach((s) => band.observe(s));

  const set = (id: string, text: string) => {
    const e = document.getElementById(`story-${id}`);
    if (e && e.textContent !== text) e.textContent = text;
  };
  return {
    /** Called each second with the same values (and the same text) as #alt and #speed. */
    update(v: { now: Date; lat: number; lon: number; altText: string; altKm: number; speedText: string; periodMin: number; sun: { lat: number; lon: number } }) {
      set('alt', v.altText);
      set('speed', v.speedText);
      set('period', v.periodMin.toFixed(1));
      set('sun', `${hemi(v.sun.lat, 'N', 'S')}, ${hemi(v.sun.lon, 'E', 'W')}`);
      set('radius', Math.round(footprintRadiusKm(v.altKm)).toLocaleString('en-US'));
      set('ra', ((((siderealDeg(v.now) + v.lon) % 360) + 360) % 360).toFixed(1));
      set('dec', v.lat.toFixed(1));
    },
    sync,
  };
}
