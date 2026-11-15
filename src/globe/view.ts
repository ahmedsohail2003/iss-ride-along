// G1: which view the page shows, the 3D globe or the flat page, and the switch between them.
//
// The choice is one pure function, chooseView, so the tests can run every case in Node. In order:
//   1. a press after the page has loaded always wins (#view-3d, #view-flat, and the two actions that need
//      the flat map: "Play" and ticking the daily photo); the press is saved in sessionStorage;
//   2. at load, the address flag ?view=flat|3d|auto (3d skips the device check, for headless runs and demos);
//   3. the saved choice;
//   4. DEFAULT_VIEW ('flat' until G2's checks pass).
// 'auto' runs a short device check first (the flat page is already drawn, so the screen is never blank):
// flat when reduced motion is on, there is no WebGL2, the browser refuses a context without a "major
// performance caveat", the renderer is a software one, or 30 frames drawn back to back take a median of
// more than 33 ms each (or do not finish in 2 s). On any flat outcome the check's context is released.
export type View = '3d' | 'flat';
export type Choice = View | 'auto';
export type Why =
  | 'press'
  | 'flag'
  | 'saved'
  | 'default'
  | 'auto'
  | 'reduced-motion'
  | 'no-webgl'
  | 'caveat'
  | 'software'
  | 'slow'
  | 'lost';

/** What the page opens on when nothing else says. */
export const DEFAULT_VIEW: Choice = 'flat';
export const VIEW_STORAGE_KEY = 'iss-ride-along-view';
/** A frame gap above this (ms) means the device is too slow for the globe (30 frames a second). */
export const SLOW_MS = 33;
export const BURST_FRAMES = 30;
export const BURST_TIMEOUT_MS = 2000;

export interface ProbeResult {
  webgl2: boolean;
  /** true when a context with failIfMajorPerformanceCaveat was refused but a plain one was not */
  caveat: boolean;
  renderer: string;
  /** the gaps (ms) between the burst's frame timestamps; null if the burst was not run */
  gaps: number[] | null;
  timedOut: boolean;
}

export interface ViewInput {
  press?: View | null;
  flag?: string | null;
  saved?: string | null;
  def: Choice;
  reducedMotion: boolean;
  /** the device check's results so far (for a 3D choice only `webgl2` is used) */
  probe?: ProbeResult | null;
}

export type ViewDecision = { view: View; why: Why } | { view: 'probe'; why: 'auto' };

const SOFTWARE = /swiftshader|llvmpipe|softpipe|microsoft basic render/i;
export const isSoftwareRenderer = (name: string) => SOFTWARE.test(name);

/** 'slow' or 'fast' from a finished burst of BURST_FRAMES gaps; null while fewer have been measured. */
export function speedDecision(gaps: number[] | null | undefined): 'slow' | 'fast' | null {
  if (!gaps || gaps.length < BURST_FRAMES) return null;
  const s = [...gaps].sort((a, b) => a - b);
  const mid = s.length / 2;
  const median = s.length % 2 ? s[Math.floor(mid)] : (s[mid - 1] + s[mid]) / 2;
  return median > SLOW_MS ? 'slow' : 'fast';
}

const asView = (v: string | null | undefined): View | null => (v === '3d' || v === 'flat' ? v : null);
const asChoice = (v: string | null | undefined): Choice | null => (v === 'auto' ? 'auto' : asView(v));

export function chooseView(i: ViewInput): ViewDecision {
  const explicit = (view: View, why: Why): ViewDecision =>
    view === '3d' && i.probe && !i.probe.webgl2 ? { view: 'flat', why: 'no-webgl' } : { view, why };
  if (i.press) return explicit(i.press, 'press');
  const flag = asChoice(i.flag);
  const saved = asView(i.saved);
  const [choice, why]: [Choice, Why] = flag ? [flag, 'flag'] : saved ? [saved, 'saved'] : [i.def, 'default'];
  if (choice !== 'auto') return explicit(choice, why);
  if (i.reducedMotion) return { view: 'flat', why: 'reduced-motion' };
  const p = i.probe;
  if (!p) return { view: 'probe', why: 'auto' };
  if (!p.webgl2) return { view: 'flat', why: 'no-webgl' };
  if (p.caveat) return { view: 'flat', why: 'caveat' };
  if (isSoftwareRenderer(p.renderer)) return { view: 'flat', why: 'software' };
  if (p.timedOut) return { view: 'flat', why: 'slow' };
  const speed = speedDecision(p.gaps);
  if (speed === null) return { view: 'probe', why: 'auto' };
  return speed === 'slow' ? { view: 'flat', why: 'slow' } : { view: '3d', why: 'auto' };
}

/** The one plain line under the switch when the page stays flat for a reason. */
export const NOTE: Partial<Record<Why, string>> = {
  'no-webgl': 'The 3D view needs WebGL 2, which this browser does not offer, so this is the flat map.',
  caveat: 'This device would draw the 3D view slowly (the browser says so), so this is the flat map. Press 3D to try it anyway.',
  software: 'This browser draws 3D in software, which is slow, so this is the flat map. Press 3D to try it anyway.',
  slow: 'The 3D view was too slow on this device (over 33 ms a frame), so this is the flat map. Press 3D to try it anyway.',
  'reduced-motion': 'Your device asks for reduced motion, so this is the flat map. Press 3D to see the globe.',
  lost: 'The 3D view stopped (the browser took its graphics back), so this is the flat map.',
};

// ---------------------------------------------------------------------------------------------------
// The page side: the device check and the switch. Nothing below runs at import time (the tests import
// the pure part above in Node).

/** The smallest set of things the switch needs from the globe. */
export interface GlobeHandle {
  setActive(on: boolean): void;
  /** draw one frame now and read one pixel back (used by the device check's burst) */
  drawAndRead(): void;
  dispose(): void;
}

export interface ViewOptions<G extends GlobeHandle> {
  host: HTMLElement;
  btn3d: HTMLButtonElement;
  btnFlat: HTMLButtonElement;
  note: HTMLElement;
  /** builds the globe on a canvas that already has a WebGL2 context */
  makeGlobe: (canvas: HTMLCanvasElement, gl: WebGL2RenderingContext, renderer: string) => G;
  /** called after the flat map is shown again (Leaflet must measure its container) */
  onFlat: () => void;
  onGlobe?: (g: G) => void;
}

const CONTEXT: WebGLContextAttributes = { antialias: true, alpha: false, depth: true, powerPreference: 'high-performance' };

function rendererName(gl: WebGL2RenderingContext): string {
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
}

function release(gl: WebGL2RenderingContext | null) {
  gl?.getExtension('WEBGL_lose_context')?.loseContext();
}

export function initView<G extends GlobeHandle>(o: ViewOptions<G>) {
  let current: View = 'flat';
  let globe: G | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let decided = false;

  const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const saved = () => {
    try {
      return sessionStorage.getItem(VIEW_STORAGE_KEY);
    } catch {
      return null;
    }
  };
  const save = (v: View) => {
    try {
      sessionStorage.setItem(VIEW_STORAGE_KEY, v);
    } catch {
      // storage blocked (a private window): the press still works for this page
    }
  };

  function show(view: View, why: Why) {
    current = view;
    document.body.dataset.view = view;
    document.body.dataset.viewWhy = why;
    o.btn3d.setAttribute('aria-pressed', String(view === '3d'));
    o.btnFlat.setAttribute('aria-pressed', String(view === 'flat'));
    const text = view === 'flat' ? NOTE[why] : undefined;
    o.note.textContent = text ?? '';
    o.note.hidden = !text;
    globe?.setActive(view === '3d');
    if (view === 'flat') o.onFlat();
  }

  function freshCanvas(): HTMLCanvasElement {
    canvas?.remove();
    const c = document.createElement('canvas');
    c.setAttribute('aria-hidden', 'true');
    o.host.appendChild(c);
    canvas = c;
    return c;
  }

  function adopt(c: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    const g = o.makeGlobe(c, gl, rendererName(gl));
    globe = g;
    c.addEventListener(
      'webglcontextlost',
      () => {
        // Not prevented, so the browser does not hand the context back: the page stays on the flat map.
        if (globe === g) {
          globe = null;
          g.dispose();
        }
        if (current === '3d') show('flat', 'lost');
      },
      { once: true },
    );
    o.onGlobe?.(g);
    return g;
  }

  /** Start (or resume) the globe for an explicit 3D choice; false when WebGL2 is missing. */
  function start3d(why: Why): boolean {
    if (!globe) {
      const c = freshCanvas();
      const gl = c.getContext('webgl2', CONTEXT) as WebGL2RenderingContext | null;
      if (!gl) {
        c.remove();
        canvas = null;
        show('flat', 'no-webgl');
        return false;
      }
      adopt(c, gl);
    }
    show('3d', why);
    return true;
  }

  async function probe(): Promise<ProbeResult> {
    const c = freshCanvas();
    const gl = c.getContext('webgl2', { ...CONTEXT, failIfMajorPerformanceCaveat: true }) as WebGL2RenderingContext | null;
    if (!gl) {
      c.remove();
      canvas = null;
      const plain = document.createElement('canvas').getContext('webgl2') as WebGL2RenderingContext | null;
      const webgl2 = !!plain;
      release(plain);
      return { webgl2, caveat: webgl2, renderer: '', gaps: null, timedOut: false };
    }
    const renderer = rendererName(gl);
    if (isSoftwareRenderer(renderer)) {
      release(gl);
      c.remove();
      canvas = null;
      return { webgl2: true, caveat: false, renderer, gaps: null, timedOut: false };
    }
    const g = adopt(c, gl);
    // A tab opened in the background waits until it is shown (its frames would be throttled).
    if (document.hidden) await new Promise<void>((r) => document.addEventListener('visibilitychange', () => !document.hidden && r()));
    const stamps: number[] = [];
    const timedOut = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(true), BURST_TIMEOUT_MS);
      const step = (ts: number) => {
        g.drawAndRead();
        stamps.push(ts);
        if (stamps.length > BURST_FRAMES) {
          clearTimeout(timer);
          resolve(false);
        } else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    const gaps = stamps.slice(1).map((t, k) => t - stamps[k]);
    return { webgl2: true, caveat: false, renderer, gaps, timedOut };
  }

  function dropProbeGlobe() {
    if (globe) {
      const g = globe;
      globe = null;
      g.dispose();
    }
    if (canvas) {
      const gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
      release(gl);
      canvas.remove();
      canvas = null;
    }
  }

  async function decideAtLoad() {
    const flag = new URLSearchParams(location.search).get('view');
    const base = { flag, saved: saved(), def: DEFAULT_VIEW, reducedMotion: reducedMotion() };
    let d = chooseView(base);
    if (d.view === 'probe') {
      const p = await probe();
      d = chooseView({ ...base, probe: p });
      if (d.view === 'probe') d = { view: 'flat', why: 'slow' };
      document.body.dataset.viewProbe = JSON.stringify({ renderer: p.renderer, frames: p.gaps?.length ?? 0, timedOut: p.timedOut });
      if (d.view === 'flat') dropProbeGlobe();
    }
    if (!decided) {
      if (d.view === '3d') start3d(d.why);
      else show('flat', d.why);
    }
    decided = true;
  }

  /** A press always wins and is saved for this tab. */
  function press(view: View) {
    decided = true;
    save(view);
    if (view === '3d') start3d('press');
    else show('flat', 'press');
  }

  o.btn3d.addEventListener('click', () => press('3d'));
  o.btnFlat.addEventListener('click', () => press('flat'));
  document.body.dataset.view = 'flat';
  void decideAtLoad();

  return {
    press,
    current: () => current,
    globe: () => globe,
  };
}
