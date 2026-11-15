// G1: which view the page shows, the 3D globe or the flat page, and the switch between them.
//
// The choice is one pure function, chooseView, so the tests can run every case in Node. In order:
//   1. a press after the page has loaded always wins (#view-3d, #view-flat, and the two actions that need
//      the flat map: "Play" and ticking the daily photo); the press is saved in sessionStorage;
//   2. at load, the address flag ?view=flat|3d|auto (3d skips the device check, for headless runs and demos);
//   3. the saved choice;
//   4. DEFAULT_VIEW ('auto' since G2's checks passed: the device check below picks the view).
// 'auto' runs a short device check first (the flat page is already drawn, so the screen is never blank):
// flat when reduced motion is on, there is no WebGL2, the browser refuses a context without a "major
// performance caveat", the renderer is a software one, or 30 frames drawn back to back take a median of
// more than 33 ms each (or do not finish in 2 s). On any flat outcome the check's context is released.
// R2: the check decides only on frames it actually saw. It starts only while the page is visible; a burst
// that ends with fewer than MIN_GAPS frame gaps (a page the browser is not drawing: a covered window, a
// hidden pane) is "no decision" ('no-frames'), never "slow": the flat map with no note, and the check runs
// once more at the next change to visible or the first pointerdown or keydown, one re-run at most.
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
  | 'no-frames'
  | 'lost';

/** What the page opens on when nothing else says. */
export const DEFAULT_VIEW: Choice = 'auto';
export const VIEW_STORAGE_KEY = 'iss-ride-along-view';
/** A frame gap above this (ms) means the device is too slow for the globe (30 frames a second). */
export const SLOW_MS = 33;
export const BURST_FRAMES = 30;
export const BURST_TIMEOUT_MS = 2000;
/**
 * R2: a burst that timed out is "slow" only if it saw at least this many frame gaps (a third of the burst):
 * 10 or more frames in 2 s that still did not reach 30 average over 65 ms a frame, which is slow. Fewer than
 * 10 frames in 2 s means the browser was hardly drawing the page at all, which says nothing about the device.
 */
export const MIN_GAPS = 10;

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
  if (p.timedOut) return (p.gaps?.length ?? 0) >= MIN_GAPS ? { view: 'flat', why: 'slow' } : { view: 'flat', why: 'no-frames' };
  const speed = speedDecision(p.gaps);
  if (speed === null) return { view: 'probe', why: 'auto' };
  return speed === 'slow' ? { view: 'flat', why: 'slow' } : { view: '3d', why: 'auto' };
}

export type Decided = { view: View; why: Why };
/** R2: the view after a finished burst. A burst that ended without enough gaps to decide is 'no-frames'. */
export function afterBurst(i: ViewInput & { probe: ProbeResult }): Decided {
  const d = chooseView(i);
  return d.view === 'probe' ? { view: 'flat', why: 'no-frames' } : d;
}

/** What the device check needs from the page (the tests hand in a stand-in). */
export interface CheckEnv {
  /** document.visibilityState === 'visible' */
  visible(): boolean;
  /** call fn once at the next change of the page to visible; returns a function that cancels it */
  onVisible(fn: () => void): () => void;
  /** call fn once at the first pointerdown or keydown; returns a function that cancels it */
  onInput(fn: () => void): () => void;
  /** one burst of frames (makes the check's context and globe) */
  burst(): Promise<ProbeResult>;
}

/**
 * R2: run the device check. No burst starts until the page is visible. After each burst `report` gets the
 * decision. A 'no-frames' decision gets one more burst at the next change to visible or the first pointerdown
 * or keydown (whichever comes first), unless `wanted()` is false by then (a press decided the view); a second
 * 'no-frames' stays flat and nothing runs again. Resolves with the number of bursts run.
 */
export async function runDeviceCheck(o: {
  env: CheckEnv;
  decide: (p: ProbeResult) => Decided;
  report: (d: Decided, p: ProbeResult, run: number) => void;
  wanted: () => boolean;
}): Promise<number> {
  const { env } = o;
  const whenVisible = () => (env.visible() ? Promise.resolve() : new Promise<void>((r) => void env.onVisible(r)));
  let runs = 0;
  const once = async () => {
    await whenVisible();
    if (runs > 0 && !o.wanted()) return null;
    runs++;
    const p = await env.burst();
    const d = o.decide(p);
    o.report(d, p, runs);
    return d;
  };
  const first = await once();
  if (!first || first.why !== 'no-frames' || !o.wanted()) return runs;
  await new Promise<void>((resolve) => {
    const cancels: (() => void)[] = [];
    const go = () => {
      cancels.forEach((c) => c());
      resolve();
    };
    cancels.push(env.onVisible(go), env.onInput(go));
  });
  if (o.wanted()) await once();
  return runs;
}

/** The note under the switch for a view and its reason (none for 'no-frames': it is not about the device). */
export const noteFor = (view: View, why: Why): string | undefined => (view === 'flat' ? NOTE[why] : undefined);

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
  /** true once a press (or an action that needs the flat map) has chosen the view: it wins over the check */
  let pressed = false;

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
    const text = noteFor(view, why);
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
    // (R2: the wait until the page is visible is in runDeviceCheck, before any context is made.)
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
    const d = chooseView(base);
    if (d.view !== 'probe') {
      if (!pressed) {
        if (d.view === '3d') start3d(d.why);
        else show('flat', d.why);
      }
      return;
    }
    const env: CheckEnv = {
      visible: () => document.visibilityState === 'visible',
      onVisible(fn) {
        const h = () => {
          if (document.visibilityState !== 'visible') return;
          document.removeEventListener('visibilitychange', h);
          fn();
        };
        document.addEventListener('visibilitychange', h);
        return () => document.removeEventListener('visibilitychange', h);
      },
      onInput(fn) {
        const h = () => {
          window.removeEventListener('pointerdown', h, true);
          window.removeEventListener('keydown', h, true);
          fn();
        };
        window.addEventListener('pointerdown', h, true);
        window.addEventListener('keydown', h, true);
        return () => {
          window.removeEventListener('pointerdown', h, true);
          window.removeEventListener('keydown', h, true);
        };
      },
      burst: probe,
    };
    await runDeviceCheck({
      env,
      decide: (p) => afterBurst({ ...base, probe: p }),
      wanted: () => !pressed,
      report: (r, p, run) => {
        document.body.dataset.viewProbe = JSON.stringify({ renderer: p.renderer, frames: p.gaps?.length ?? 0, timedOut: p.timedOut, run });
        // A press during the burst wins: keep the check's globe only if the press showed it.
        if (pressed) {
          if (current !== '3d') dropProbeGlobe();
          return;
        }
        if (r.view === '3d') start3d(r.why);
        else {
          dropProbeGlobe();
          show('flat', r.why);
        }
      },
    });
  }

  /** A press always wins and is saved for this tab. */
  function press(view: View) {
    pressed = true;
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
