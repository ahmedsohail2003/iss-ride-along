// G1: the 3D globe, drawn with three.js (MIT) on a WebGL2 context the page made itself (src/globe/view.ts).
// What is drawn, and where each number comes from (all fed in by src/main.ts):
//   the Earth      NASA's cloud-free Blue Marble (GIBS BlueMarble_ShadedRelief_Bathymetry), saved once into the page
//   the station    stateAt (SGP4): latitude, longitude and height, the call that fills #lat, #lon, #alt
//   two orbits     orbitPoints: stateAt every 30 s, one period back and one forward (the flat map's two lines)
//   night side     subsolarPoint: the shader darkens where the surface faces away from the Sun
//   crew's view    footprintRadiusKm: a circle of angle km / 6371.0088 round the point under the station
// When it draws: every frame while dragged, a key is held or the camera is still easing; otherwise once a
// second (the station moves about 7.7 km a second); never while the tab is hidden or the flat page is shown.
// For headless checks it carries data-* values on #globe and a small window.__iss3d (see PLAN.md 4e).
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
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
  const overlays = [pastLine, nextLine, viewCircle, station];

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
  let dirty = true;
  let dragging = false;
  const held = new Set<string>();
  let frames = 0;
  let lastDraw = 0;
  const gaps: number[] = [];
  let disposed = false;

  const clampLat = (v: number) => Math.max(-85, Math.min(85, v));
  const wrapLon = (v: number) => ((((v + 180) % 360) + 360) % 360) - 180;

  function placeCamera() {
    const p = cameraFor(cur.lat, cur.lon, cur.dist);
    camera.position.set(p[0], p[1], p[2]);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
  }

  function resize() {
    const w = Math.max(1, host.clientWidth || opts.sizeFrom?.clientWidth || 0);
    const h = Math.max(1, host.clientHeight || opts.sizeFrom?.clientHeight || 0);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the whole Earth in view on a tall (phone) slot too
    camera.fov = w >= h ? FOV_DEG : (2 * Math.atan(Math.tan((FOV_DEG * Math.PI) / 360) / camera.aspect) * 180) / Math.PI;
    camera.updateProjectionMatrix();
    dirty = true;
  }
  const ro = new ResizeObserver(() => resize());
  ro.observe(host);
  resize();

  function easing(): boolean {
    let moving = false;
    for (const k of ['lat', 'lon', 'dist'] as const) {
      let d = target[k] - cur[k];
      if (k === 'lon') d = wrapLon(d);
      if (Math.abs(d) > 1e-4) {
        cur[k] += d * 0.25;
        moving = true;
      } else cur[k] = target[k];
    }
    cur.lon = wrapLon(cur.lon);
    return moving;
  }

  function render() {
    placeCamera();
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

  function loop(ts: number) {
    if (disposed) return;
    requestAnimationFrame(loop);
    if (!active || document.hidden) return;
    const moving = easing();
    if (dragging || held.size > 0 || moving || dirty || ts - lastDraw >= 1000) draw(ts);
  }
  requestAnimationFrame(loop);

  // ---- drag, wheel, keys
  let last: { x: number; y: number } | null = null;
  const degPerPx = () => (0.3 * (cur.dist - 1)) / 2.2;
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
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
    overlays.forEach((o) => (o.visible = false));
    render();
    const rgb = readMiddle();
    overlays.forEach((o) => (o.visible = true));
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
    STATION_RGB,
  };
  (window as unknown as { __iss3d: typeof api3d }).__iss3d = api3d;
  host.dataset.renderer = opts.renderer;
  host.dataset.passPoints = '0';
  host.dataset.stars = '0';
  host.dataset.scene = '';

  return {
    setActive(on) {
      active = on;
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
    },
    setTrack(past, next) {
      setLine(pastLine, past.map((p) => latLonToVec3(p.latDeg, p.lonDeg, p.altKm)));
      setLine(nextLine, next.map((p) => latLonToVec3(p.latDeg, p.lonDeg, p.altKm)));
      trackPoints = past.length + next.length;
      dirty = true;
    },
    setSun(lat, lon) {
      sunAt = { lat, lon };
      const v = latLonToVec3(lat, lon);
      earthMat.uniforms.uSun.value.set(v[0], v[1], v[2]);
    },
    setNight(on) {
      earthMat.uniforms.uNight.value = on ? 1 : 0;
      dirty = true;
    },
  };
}
