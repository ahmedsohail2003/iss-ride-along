// G1: the 3D globe, drawn with three.js (MIT) on a WebGL2 context the page made itself (src/globe/view.ts).
// What is drawn, and where each number comes from (all fed in by src/main.ts):
//   the Earth      NASA's cloud-free Blue Marble (GIBS BlueMarble_ShadedRelief_Bathymetry), saved once into the page
//   the station    stateAt (SGP4): latitude, longitude and height, the call that fills #lat, #lon, #alt
//   two orbits     orbitPoints: stateAt every 30 s, one period back and one forward (the flat map's two lines)
//   night side     subsolarPoint: the shader darkens where the surface faces away from the Sun
//   crew's view    footprintRadiusKm: a circle of angle km / 6371.0088 round the point under the station
//   chosen pass    G2: passPoints (stateAt rise to set, the flat map's pink arc) at the station's height,
//                  a marker on the planned place, and a turn to the point under the pass's highest moment
//   the stars      G3: the Sky tab's 1,627 catalogue stars on a far sphere, turned by -gstime (src/globe/stars.ts)
//   the story      G3: setStory(scene) eases the camera to where src/globe/story.ts sceneAt says; setFull makes
//                  the canvas fill the window behind #story (src/globe/storyUi.ts)
// When it draws: every frame while dragged, a key is held or the camera is still easing; otherwise once a
// second (the station moves about 7.7 km a second); never while the tab is hidden or the flat page is shown.
// For headless checks it carries data-* values on #globe and a small window.__iss3d (see PLAN.md 4e).
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Texture,
  Vector3,
  WebGLRenderer,
} from 'three';
import { footprintRadiusKm } from '../nasa/footprint';
import { EARTH_RADIUS_KM } from '../orbit/orbit';
import { cameraFor, circleOnSphere, latLonToVec3, raySphere, vec3ToLatLon, type OrbitPoint, type Vec3 } from './geo';
import type { GlobeHandle } from './view';
import { STARS_ON, starBuffers, starsTurnRad } from './stars';
import { sceneAt, type Layers, type SceneId } from './story';

/** The station marker's one flat colour, used by nothing else in the scene (0 and 255 survive sRGB). */
export const STATION_RGB: [number, number, number] = [255, 0, 255];
export const PIXEL_RATIO_MAX = 1.5;
const FOV_DEG = 40;
const DIST_MIN = 1.25;
const DIST_MAX = 8;
const DIST_START = 3.2;
const NIGHT_LEVEL = 0.15;

const vertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
void main() {
  vUv = uv;
  vN = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
// The day/night shading: full light where the surface faces the Sun, NIGHT_LEVEL on the far side, and a
// soft edge from -0.10 to 0.10 of the dot product with the Sun's direction (about 6 degrees either side).
const fragment = /* glsl */ `
uniform sampler2D uMap;
uniform float uHasMap;
uniform float uWhite;
uniform float uNight;
uniform vec3 uSun;
varying vec2 vUv;
varying vec3 vN;
void main() {
  vec3 img = mix(vec3(0.06, 0.1, 0.22), texture2D(uMap, vUv).rgb, uHasMap);
  vec3 base = mix(img, vec3(1.0), uWhite);
  float day = smoothstep(-0.10, 0.10, dot(normalize(vN), uSun));
  float k = mix(1.0, mix(${NIGHT_LEVEL.toFixed(2)}, 1.0, day), uNight);
  gl_FragColor = vec4(base * k, 1.0);
}`;

export interface Globe extends GlobeHandle {
  setStation(latDeg: number, lonDeg: number, altKm: number): void;
  setTrack(past: OrbitPoint[], next: OrbitPoint[]): void;
  setSun(latDeg: number, lonDeg: number): void;
  setNight(on: boolean): void;
  /** G2: the chosen pass (rise to set), the planned place, and the point under the pass's highest moment. */
  setPass(points: OrbitPoint[], city: { lat: number; lon: number }, peak: { lat: number; lon: number }, turn: boolean): void;
  /** G3: the story scene on screen (the camera eases to sceneAt(id)), or null to go back to the reader's view. */
  setStory(id: SceneId | null): void;
  /** G3: the canvas fills the window (behind #story) instead of the map's slot. */
  setFull(on: boolean): void;
}

export function createGlobe(opts: {
  host: HTMLElement;
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  renderer: string;
  imageUrl: string;
  /** measured instead of the host while the host is hidden (the device check draws before the globe is shown) */
  sizeFrom?: HTMLElement;
}): Globe {
  const { host, canvas, gl } = opts;
  const off = new AbortController();
  const signal = off.signal;
  const renderer = new WebGLRenderer({ canvas, context: gl, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PIXEL_RATIO_MAX));
  renderer.setClearColor(new Color(0x03050c), 1);
  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV_DEG, 1, 0.01, 100);

  // ---- the Earth
  const texture = new Texture();
  const earthMat = new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      uMap: { value: texture },
      uHasMap: { value: 0 },
      uWhite: { value: 0 },
      uNight: { value: 1 },
      uSun: { value: new Vector3(1, 0, 0) },
    },
  });
  const earth = new Mesh(new SphereGeometry(1, 96, 48), earthMat);
  scene.add(earth);
  const img = new Image();
  img.onload = () => {
    texture.image = img;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    texture.needsUpdate = true;
    earthMat.uniforms.uHasMap.value = 1;
    host.dataset.image = 'loaded';
    dirty = true;
  };
  img.onerror = () => (host.dataset.image = 'failed');
  img.src = opts.imageUrl;

  // ---- lines and the station
  const lineOf = (color: number, loop = false) => {
    const g = new BufferGeometry();
    const m = new LineBasicMaterial({ color });
    const l = loop ? new LineLoop(g, m) : new Line(g, m);
    scene.add(l);
    return l;
  };
  const pastLine = lineOf(0xffd166);
  const nextLine = lineOf(0x7fdbff);
  const viewCircle = lineOf(0x7fdbff, true);
  const stationGeom = new BufferGeometry();
  stationGeom.setAttribute('position', new Float32BufferAttribute([0, 0, 0], 3));
  const station = new Points(
    stationGeom,
    new PointsMaterial({ color: new Color(STATION_RGB[0] / 255, STATION_RGB[1] / 255, STATION_RGB[2] / 255), size: 11, sizeAttenuation: false }),
  );
  station.renderOrder = 10;
  scene.add(station);
  // G2: the chosen pass in the flat map's pink, as a line and a row of dots (WebGL lines are 1 px wide), and
  // the planned place as a white dot on the ground.
  const PASS = 0xff5fa2;
  const passLine = lineOf(PASS);
  const passDots = new Points(new BufferGeometry(), new PointsMaterial({ color: PASS, size: 4, sizeAttenuation: false }));
  scene.add(passDots);
  passLine.visible = passDots.visible = false; // nothing to draw until a plan is shown
  const cityGeom = new BufferGeometry();
  const city = new Points(cityGeom, new PointsMaterial({ color: 0xffffff, size: 9, sizeAttenuation: false }));
  city.visible = false;
  scene.add(city);
  const overlays = [pastLine, nextLine, viewCircle, station, passLine, passDots, city];

  // ---- G3: the stars, one Points object (one draw call) on a far sphere, in a group turned by -gstime
  const starGroup = new Group();
  const sb = starBuffers();
  const starGeom = new BufferGeometry();
  starGeom.setAttribute('position', new Float32BufferAttribute(sb.positions, 3));
  starGeom.setAttribute('aColor', new Float32BufferAttribute(sb.colors, 3));
  starGeom.setAttribute('aSize', new Float32BufferAttribute(sb.sizes, 1));
  const starMat = new ShaderMaterial({
    uniforms: { uScale: { value: renderer.getPixelRatio() } },
    vertexShader: /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
uniform float uScale;
varying vec3 vC;
void main() {
  vC = aColor;
  gl_PointSize = aSize * uScale;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: /* glsl */ `
varying vec3 vC;
void main() {
  float r = length(gl_PointCoord - vec2(0.5));
  if (r > 0.5) discard;
  gl_FragColor = vec4(vC * (1.0 - smoothstep(0.25, 0.5, r)), 1.0);
}`,
    depthWrite: false,
  });
  const stars = new Points(starGeom, starMat);
  stars.frustumCulled = false;
  stars.renderOrder = -1; // drawn first; the Earth and the lines draw over them
  starGroup.add(stars);
  starGroup.visible = STARS_ON;
  scene.add(starGroup);

  const setLine = (l: Line, pts: Vec3[]) => {
    l.geometry.setAttribute('position', new Float32BufferAttribute(pts.flat(), 3));
    l.geometry.computeBoundingSphere();
  };

  // ---- camera: the point at the middle of the view, and how far away
  const cur = { lat: 20, lon: -40, dist: DIST_START };
  const target = { ...cur };
  let stationAt = { lat: 0, lon: 0, alt: 0 };
  let sunAt = { lat: 0, lon: 0 };
  let trackPoints = 0;
  let active = false;
  let shownOnce = false;
  let dirty = true;
  let dragging = false;
  const held = new Set<string>();
  let frames = 0;
  let lastDraw = 0;
  const gaps: number[] = [];
  let disposed = false;
  /** G2: the eased turn to the chosen pass (about 0.3 s, drawn every frame until it settles). */
  const TURN_MS = 300;
  let turn: { from: { lat: number; lon: number }; to: { lat: number; lon: number }; t0: number } | null = null;
  const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  const clampLat = (v: number) => Math.max(-85, Math.min(85, v));
  const wrapLon = (v: number) => ((((v + 180) % 360) + 360) % 360) - 180;

  function placeCamera() {
    const p = cameraFor(cur.lat, cur.lon, cur.dist);
    camera.position.set(p[0], p[1], p[2]);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
  }

  let full = false;
  function resize() {
    const w = Math.max(1, full ? window.innerWidth : host.clientWidth || opts.sizeFrom?.clientWidth || 0);
    const h = Math.max(1, full ? window.innerHeight : host.clientHeight || opts.sizeFrom?.clientHeight || 0);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the whole Earth in view on a tall (phone) slot too
    camera.fov = w >= h ? FOV_DEG : (2 * Math.atan(Math.tan((FOV_DEG * Math.PI) / 360) / camera.aspect) * 180) / Math.PI;
    camera.updateProjectionMatrix();
    dirty = true;
  }
  const ro = new ResizeObserver(() => resize());
  ro.observe(host);
  window.addEventListener('resize', () => full && resize(), { signal });
  resize();

  /** G3: cur += (target - cur) * (1 - e^(-6 dt)), dt in seconds since the last eased frame; true while moving. */
  let lastEase = 0;
  function easing(ts: number): boolean {
    const dt = lastEase ? Math.min(0.1, Math.max(0, (ts - lastEase) / 1000)) : 1 / 60;
    const f = 1 - Math.exp(-6 * dt);
    let moving = false;
    for (const k of ['lat', 'lon', 'dist'] as const) {
      let d = target[k] - cur[k];
      if (k === 'lon') d = wrapLon(d);
      if (Math.abs(d) > 1e-4) {
        cur[k] += d * f;
        moving = true;
      } else cur[k] = target[k];
    }
    cur.lon = wrapLon(cur.lon);
    lastEase = moving ? ts : 0;
    return moving;
  }

  function render() {
    placeCamera();
    starGroup.rotation.y = starsTurnRad(new Date());
    renderer.render(scene, camera);
  }

  function draw(ts: number) {
    render();
    if (lastDraw) gaps.push(ts - lastDraw);
    if (gaps.length > 240) gaps.shift();
    lastDraw = ts;
    frames++;
    const ds = host.dataset;
    ds.frames = String(frames);
    ds.stationLat = stationAt.lat.toFixed(4);
    ds.stationLon = stationAt.lon.toFixed(4);
    ds.subsolarLat = sunAt.lat.toFixed(4);
    ds.subsolarLon = sunAt.lon.toFixed(4);
    ds.trackPoints = String(trackPoints);
    ds.drawCalls = String(renderer.info.render.calls);
    dirty = false;
  }

  /** Advance the turn to the pass; true while it is still moving. */
  function turning(): boolean {
    if (!turn) return false;
    const k = Math.min(1, Math.max(0, (performance.now() - turn.t0) / TURN_MS));
    const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; // ease in and out
    cur.lat = target.lat = turn.from.lat + (turn.to.lat - turn.from.lat) * e;
    cur.lon = target.lon = wrapLon(turn.from.lon + wrapLon(turn.to.lon - turn.from.lon) * e);
    if (k >= 1) turn = null;
    return true;
  }

  function loop(ts: number) {
    if (disposed) return;
    requestAnimationFrame(loop);
    if (!active || document.hidden) return;
    const moving = turning() || easing(ts);
    if (dragging || held.size > 0 || moving || dirty || ts - lastDraw >= 1000) draw(ts);
  }
  requestAnimationFrame(loop);

  // ---- drag, wheel, keys
  let last: { x: number; y: number } | null = null;
  const degPerPx = () => (0.3 * (cur.dist - 1)) / 2.2;
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    turn = null;
    last = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture?.(e.pointerId);
    host.focus({ preventScroll: true });
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging || !last) return;
    const k = degPerPx();
    cur.lon = target.lon = wrapLon(cur.lon - (e.clientX - last.x) * k);
    cur.lat = target.lat = clampLat(cur.lat + (e.clientY - last.y) * k);
    last = { x: e.clientX, y: e.clientY };
  });
  const endDrag = () => {
    dragging = false;
    last = null;
    dirty = true;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      target.dist = Math.max(DIST_MIN, Math.min(DIST_MAX, target.dist * Math.exp(e.deltaY * 0.001)));
    },
    { passive: false },
  );
  host.addEventListener(
    'keydown',
    (e) => {
    const step = 10;
    if (e.key === 'ArrowLeft') target.lon = wrapLon(target.lon - step);
    else if (e.key === 'ArrowRight') target.lon = wrapLon(target.lon + step);
    else if (e.key === 'ArrowUp') target.lat = clampLat(target.lat + step);
    else if (e.key === 'ArrowDown') target.lat = clampLat(target.lat - step);
    else if (e.key === '+' || e.key === '=') target.dist = Math.max(DIST_MIN, target.dist / 1.25);
    else if (e.key === '-' || e.key === '_') target.dist = Math.min(DIST_MAX, target.dist * 1.25);
    else return;
      turn = null;
      e.preventDefault();
      held.add(e.key);
    },
    { signal },
  );
  host.addEventListener('keyup', (e) => held.delete(e.key), { signal });
  host.addEventListener('blur', () => held.clear(), { signal });

  // ---- what the headless checks read
  function centre() {
    placeCamera();
    camera.updateMatrixWorld();
    const dir = new Vector3();
    camera.getWorldDirection(dir);
    const hit = raySphere([camera.position.x, camera.position.y, camera.position.z], [dir.x, dir.y, dir.z]);
    if (!hit) return null;
    const ll = vec3ToLatLon(hit);
    return { lat: ll.latDeg, lon: ll.lonDeg };
  }
  function turnTo(lat: number, lon: number) {
    turn = null;
    cur.lat = target.lat = clampLat(lat);
    cur.lon = target.lon = wrapLon(lon);
    draw(performance.now());
    return centre();
  }
  function readMiddle(): [number, number, number] {
    const px = new Uint8Array(4);
    gl.readPixels(Math.floor(gl.drawingBufferWidth / 2), Math.floor(gl.drawingBufferHeight / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return [px[0], px[1], px[2]];
  }
  /** Turn to (lat, lon) and read the middle pixel of a frame drawn with only the Earth (same task). */
  function special(lat: number, lon: number, white: boolean, night: boolean): [number, number, number] {
    const u = earthMat.uniforms;
    const keep = { white: u.uWhite.value, night: u.uNight.value };
    cur.lat = target.lat = clampLat(lat);
    cur.lon = target.lon = wrapLon(lon);
    u.uWhite.value = white ? 1 : 0;
    u.uNight.value = night ? 1 : 0;
    const shown = overlays.map((o) => o.visible);
    overlays.forEach((o) => (o.visible = false));
    render();
    const rgb = readMiddle();
    overlays.forEach((o, i) => (o.visible = shown[i]));
    u.uWhite.value = keep.white;
    u.uNight.value = keep.night;
    dirty = true;
    return rgb;
  }
  const api3d = {
    turnTo,
    centre,
    sample: (lat: number, lon: number) => special(lat, lon, false, false),
    shade: (lat: number, lon: number) => {
      const [r, g, b] = special(lat, lon, true, true);
      return (r + g + b) / 3;
    },
    frameMs: () => [...gaps],
    /** G2: the chosen pass as given to the globe (every point), and where the turn ends */
    pass: () => ({ points: passAt.map((p) => ({ t: p.t.toISOString(), lat: p.latDeg, lon: p.lonDeg, alt: p.altKm })), peak: peakAt, city: cityAt }),
    STATION_RGB,
  };
  (window as unknown as { __iss3d: typeof api3d }).__iss3d = api3d;
  host.dataset.renderer = opts.renderer;
  host.dataset.passPoints = '0';
  let passAt: OrbitPoint[] = [];
  let peakAt: { lat: number; lon: number } | null = null;
  let cityAt: { lat: number; lon: number } | null = null;
  host.dataset.stars = String(STARS_ON ? sb.count : 0);
  host.dataset.scene = '';

  // ---- G3: the story's scenes. While one is on screen the camera follows sceneAt (re-aimed whenever the
  // station, the Sun or the orbit is updated, so "now" stays over the moving station) with the layers it names.
  let story: SceneId | null = null;
  let beforeStory: { lat: number; lon: number; dist: number } | null = null;
  let ahead: { lat: number; lon: number } | null = null;
  let nightBox = true;
  function applyLayers(l: Layers | null) {
    const on = l ?? { tracks: true, view: true, pass: true, stars: true, night: null };
    pastLine.visible = nextLine.visible = on.tracks;
    viewCircle.visible = on.view;
    passLine.visible = passDots.visible = city.visible = on.pass && passAt.length > 0;
    starGroup.visible = STARS_ON && on.stars;
    earthMat.uniforms.uNight.value = on.night === true || nightBox ? 1 : 0;
  }
  function aimStory() {
    if (!story) return;
    const cam = sceneAt(story, { station: stationAt, sun: sunAt, ahead });
    turn = null;
    target.lat = clampLat(cam.lat);
    target.lon = wrapLon(cam.lon);
    target.dist = cam.dist;
    applyLayers(cam.layers);
    if (reducedMotion()) Object.assign(cur, target);
    dirty = true;
  }

  return {
    setActive(on) {
      active = on;
      // R2: the first time this globe is shown it faces the station (a press from the flat page, the device
      // check's switch or ?view=3d alike); later shows keep wherever the reader left it.
      if (on && !shownOnce) {
        shownOnce = true;
        if (!story) {
          turn = null;
          cur.lat = target.lat = clampLat(stationAt.lat);
          cur.lon = target.lon = wrapLon(stationAt.lon);
        }
      }
      if (on) {
        resize();
        dirty = true;
      }
    },
    drawAndRead() {
      draw(performance.now());
      readMiddle();
    },
    dispose() {
      disposed = true;
      active = false;
      off.abort();
      ro.disconnect();
      earth.geometry.dispose();
      earthMat.dispose();
      texture.dispose();
      overlays.forEach((o) => {
        o.geometry.dispose();
        (o.material as LineBasicMaterial).dispose();
      });
      starGeom.dispose();
      starMat.dispose();
      renderer.dispose();
      delete (window as unknown as { __iss3d?: unknown }).__iss3d;
    },
    setStation(lat, lon, alt) {
      stationAt = { lat, lon, alt };
      const p = latLonToVec3(lat, lon, alt);
      stationGeom.setAttribute('position', new Float32BufferAttribute(p, 3));
      stationGeom.computeBoundingSphere();
      // the crew's view: a circle of angle (arc length / mean radius), drawn just above the ground
      setLine(viewCircle, circleOnSphere(lat, lon, footprintRadiusKm(alt) / EARTH_RADIUS_KM, 96, 8).slice(0, -1));
      // draw on the next frame, so the marker and data-station-* change with #lat/#lon (the caller's 1 s tick)
      // instead of up to 1 s later on the globe's own once-a-second redraw
      dirty = true;
      aimStory();
    },
    setTrack(past, next) {
      setLine(pastLine, past.map((p) => latLonToVec3(p.latDeg, p.lonDeg, p.altKm)));
      setLine(nextLine, next.map((p) => latLonToVec3(p.latDeg, p.lonDeg, p.altKm)));
      trackPoints = past.length + next.length;
      // G3: a point about 10 minutes along the next orbit (30 s steps) gives the orbit's plane for the story
      const a = next.length > 1 ? next[Math.min(20, next.length - 1)] : null;
      ahead = a ? { lat: a.latDeg, lon: a.lonDeg } : null;
      dirty = true;
      aimStory();
    },
    setSun(lat, lon) {
      sunAt = { lat, lon };
      const v = latLonToVec3(lat, lon);
      earthMat.uniforms.uSun.value.set(v[0], v[1], v[2]);
      dirty = true;
      aimStory();
    },
    setNight(on) {
      nightBox = on;
      earthMat.uniforms.uNight.value = on ? 1 : 0;
      dirty = true;
      aimStory();
    },
    setStory(id) {
      if (id === story) return;
      if (id && !story) beforeStory = { lat: target.lat, lon: target.lon, dist: target.dist };
      story = id;
      host.dataset.scene = id ?? '';
      if (id) aimStory();
      else {
        if (beforeStory) Object.assign(target, beforeStory);
        beforeStory = null;
        applyLayers(null);
        dirty = true;
      }
    },
    setFull(on) {
      if (on === full) return;
      full = on;
      resize();
    },
    setPass(points, place, peak, doTurn) {
      passAt = points;
      peakAt = { ...peak };
      cityAt = { ...place };
      const pts = points.map((p) => latLonToVec3(p.latDeg, p.lonDeg, p.altKm));
      setLine(passLine, pts);
      passDots.geometry.setAttribute('position', new Float32BufferAttribute(pts.flat(), 3));
      passDots.geometry.computeBoundingSphere();
      cityGeom.setAttribute('position', new Float32BufferAttribute(latLonToVec3(place.lat, place.lon, 2), 3));
      cityGeom.computeBoundingSphere();
      city.visible = passLine.visible = passDots.visible = points.length > 0;
      host.dataset.cityLat = place.lat.toFixed(4);
      host.dataset.cityLon = place.lon.toFixed(4);
      host.dataset.passPoints = String(points.length);
      dirty = true;
      if (story) aimStory(); // a story scene keeps the camera (and its layers) until the reader scrolls back up
      if (!doTurn || story) return;
      const to = { lat: clampLat(peak.lat), lon: wrapLon(peak.lon) };
      if (reducedMotion() || !active) {
        turn = null;
        cur.lat = target.lat = to.lat;
        cur.lon = target.lon = to.lon;
      } else turn = { from: { lat: cur.lat, lon: cur.lon }, to, t0: performance.now() };
    },
  };
}
