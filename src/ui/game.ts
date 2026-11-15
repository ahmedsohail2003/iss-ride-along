// The game on the page (M6): 3 rounds of "tap where the station will be in 10 minutes". The rules
// and the score are in src/game/game.ts; this file draws them on the main map. A round: an orange dot
// shows where the station is on the game clock, the player taps the map, the clock fast-forwards
// 10 minutes (the station runs along its path to the answer), and the bar shows how many km off the tap
// was. After 3 rounds the total goes on a leaderboard kept in this browser only (localStorage).
import * as L from 'leaflet';
import type { SatRec } from 'satellite.js';
import {
  addToBoard,
  AHEAD_MIN,
  BOARD_STORAGE_KEY,
  fmtKm,
  parseBoard,
  positionAt,
  revealPath,
  ROUNDS,
  roundTimes,
  scoreGuess,
  type BoardEntry,
  type LatLon,
} from '../game/game';

export const gameHtml = `
<section class="card game" aria-labelledby="game-h">
  <h2 id="game-h">Game: where will it be in ${AHEAD_MIN} minutes?</h2>
  <p>An orange dot marks the station. Tap the map where you think it will be ${AHEAD_MIN} minutes later; the clock then
    fast-forwards and you see how many km off you were. ${ROUNDS} rounds; each one starts where the last answer was.
    Lowest total wins. Hint: it follows the dashed line, and one lap of the Earth takes about an hour and a half.</p>
  <button type="button" id="game-start">Play ${ROUNDS} rounds</button>
  <ol id="game-rounds" class="game-rounds"></ol>
  <p id="game-total" class="game-total" aria-live="polite"></p>
  <h3 class="game-board-h">Best scores on this device</h3>
  <p class="small">Lower is better. Kept only in this browser (nothing is sent anywhere); a different device has its own list.</p>
  <ol id="game-board" class="game-board"></ol>
  <p id="game-board-empty" class="small">No games finished on this device yet.</p>
</section>`;

/** The bar over the map while a game runs (placed inside the map's wrapper). */
export const gameBarHtml = `<div id="game-bar" class="game-bar" hidden aria-live="polite"><span id="game-msg"></span> <button type="button" id="game-next" hidden>Next round</button> <button type="button" id="game-stop" class="linkish">Stop</button></div>`;

type State = 'idle' | 'guessing' | 'revealing' | 'scored' | 'done';

function readBoard(): BoardEntry[] {
  try {
    return parseBoard(localStorage.getItem(BOARD_STORAGE_KEY));
  } catch {
    return [];
  }
}

function saveBoard(board: BoardEntry[]) {
  try {
    localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(board));
  } catch {
    // Storage full or blocked (a private window): the game still plays; the board is just not kept.
  }
}

/** Local clock time on this device, "9:31 PM" (plain space before AM/PM). */
const clock = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/[  ]/g, ' ');
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }).replace(/[  ]/g, ' ');

export function initGame(opts: { map: L.Map; getSatrec: () => SatRec; onStart?: () => void }) {
  const { map } = opts;
  const $ = (id: string) => document.getElementById(id)!;
  const bar = $('game-bar');
  const msg = $('game-msg');
  const nextBtn = $('game-next') as HTMLButtonElement;
  const startBtn = $('game-start') as HTMLButtonElement;
  const layer = L.layerGroup().addTo(map);
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  let state: State = 'idle';
  let t0 = new Date();
  let round = 0;
  let scores: number[] = [];
  let satrec: SatRec = opts.getSatrec();
  let timer: number | undefined;

  const setState = (s: State) => {
    state = s;
    document.body.dataset.game = s;
    map.getContainer().classList.toggle('game-guessing', s === 'guessing');
  };

  function renderBoard(highlight = 0) {
    const board = readBoard();
    $('game-board').innerHTML = board
      .map(
        (e, i) =>
          `<li${i + 1 === highlight ? ' class="mine"' : ''}><strong>${fmtKm(e.totalKm)}</strong> <span class="small">(${e.roundsKm.map(fmtKm).join(' + ')}; ${when(e.at)})</span></li>`,
      )
      .join('');
    $('game-board-empty').hidden = board.length > 0;
  }

  function startRound() {
    round++;
    layer.clearLayers();
    const { start, target } = roundTimes(t0, round);
    const from = positionAt(satrec, start);
    if (!from) return stop('The orbit model could not compute this moment; the game stopped.');
    L.circleMarker([from.latDeg, from.lonDeg], { radius: 9, color: '#ff9f1c', fillColor: '#ff9f1c', fillOpacity: 0.9, className: 'game-from', interactive: false }).addTo(layer);
    bar.dataset.start = start.toISOString();
    bar.dataset.target = target.toISOString();
    for (const k of ['guessLat', 'guessLon', 'answerLat', 'answerLon', 'km']) delete bar.dataset[k];
    nextBtn.hidden = true;
    msg.textContent = `Round ${round} of ${ROUNDS}: the orange dot is the station at ${clock(start)}. Tap where it will be at ${clock(target)}, ${AHEAD_MIN} minutes later.`;
    setState('guessing');
  }

  function reveal(guess: LatLon) {
    setState('revealing');
    const { start, target } = roundTimes(t0, round);
    const answer = positionAt(satrec, target);
    if (!answer) return stop('The orbit model could not compute this moment; the game stopped.');
    bar.dataset.guessLat = guess.latDeg.toFixed(4);
    bar.dataset.guessLon = guess.lonDeg.toFixed(4);
    L.circleMarker([guess.latDeg, guess.lonDeg], { radius: 7, color: '#ffffff', fillColor: '#ffffff', fillOpacity: 0.85, className: 'game-guess', interactive: false }).addTo(layer);
    const path = revealPath(satrec, start, target, 30);
    const trail = L.polyline([], { color: '#ff9f1c', weight: 4, opacity: 0.95, className: 'game-trail', interactive: false }).addTo(layer);
    const runner = L.circleMarker([path[0].latDeg, path[0].lonDeg], { radius: 8, color: '#ff9f1c', fillColor: '#ff9f1c', fillOpacity: 1, interactive: false }).addTo(layer);
    // Split the trail where it crosses longitude 180, so no line is drawn across the whole map.
    const segs: L.LatLngExpression[][] = [[]];
    let i = 0;
    const finish = () => {
      window.clearInterval(timer);
      timer = undefined;
      runner.remove();
      const km = scoreGuess(guess, answer);
      scores.push(km);
      bar.dataset.answerLat = answer.latDeg.toFixed(4);
      bar.dataset.answerLon = answer.lonDeg.toFixed(4);
      bar.dataset.km = km.toFixed(1);
      L.circleMarker([answer.latDeg, answer.lonDeg], { radius: 9, color: '#ff9f1c', fillColor: '#ffd166', fillOpacity: 1, className: 'game-answer', interactive: false })
        .bindTooltip(`ISS at ${clock(target)}`, { permanent: true, direction: 'top', className: 'game-tip' })
        .addTo(layer);
      if (Math.abs(guess.lonDeg - answer.lonDeg) <= 180)
        L.polyline([[guess.latDeg, guess.lonDeg], [answer.latDeg, answer.lonDeg]], { color: '#ffffff', weight: 2, dashArray: '4 6', interactive: false, className: 'game-miss' }).addTo(layer);
      const li = document.createElement('li');
      li.textContent = `Round ${round}: ${fmtKm(km)} off`;
      $('game-rounds').append(li);
      if (round < ROUNDS) {
        msg.innerHTML = `<strong id="game-score">${fmtKm(km)} off</strong> in round ${round} of ${ROUNDS}.`;
        nextBtn.hidden = false;
        setState('scored');
        nextBtn.focus({ preventScroll: true });
      } else finishGame(km);
    };
    const stepOnce = () => {
      const p = path[i];
      const prev = path[i - 1];
      if (prev && Math.abs(p.lonDeg - prev.lonDeg) > 180) segs.push([]);
      segs[segs.length - 1].push([p.latDeg, p.lonDeg]);
      trail.setLatLngs(segs);
      runner.setLatLng([p.latDeg, p.lonDeg]);
      const mins = (AHEAD_MIN * i) / (path.length - 1);
      msg.textContent = `Fast-forward: +${Math.floor(mins)}:${String(Math.round((mins % 1) * 60)).padStart(2, '0')}`;
      i++;
      if (i >= path.length) finish();
    };
    if (reduceMotion) {
      while (i < path.length - 1) stepOnce();
      stepOnce();
    } else timer = window.setInterval(stepOnce, 50);
  }

  function finishGame(lastKm: number) {
    const total = scores.reduce((a, b) => a + b, 0);
    const { board, place } = addToBoard(readBoard(), { totalKm: total, roundsKm: [...scores], at: new Date().toISOString() });
    saveBoard(board);
    renderBoard(place);
    const placeText = place ? ` That is number ${place} on this device's board.` : '';
    msg.innerHTML = `<strong id="game-score">${fmtKm(lastKm)} off</strong> in round ${ROUNDS}. Total: <strong id="game-total-km">${fmtKm(total)}</strong>.${placeText}`;
    $('game-total').textContent = `Total: ${fmtKm(total)} over ${ROUNDS} rounds.${placeText}`;
    bar.dataset.total = total.toFixed(1);
    startBtn.textContent = 'Play again';
    setState('done');
  }

  function stop(text?: string) {
    window.clearInterval(timer);
    timer = undefined;
    layer.clearLayers();
    bar.hidden = true;
    if (text) $('game-total').textContent = text;
    setState('idle');
  }

  function start() {
    window.clearInterval(timer);
    satrec = opts.getSatrec();
    t0 = new Date();
    round = 0;
    scores = [];
    $('game-rounds').innerHTML = '';
    $('game-total').textContent = '';
    delete bar.dataset.total;
    bar.hidden = false;
    opts.onStart?.();
    // The whole band the station flies over, so every answer is on screen.
    map.fitBounds([
      [-62, -180],
      [72, 180],
    ]);
    map.getContainer().scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
    startRound();
  }

  map.on('click', (e: L.LeafletMouseEvent) => {
    if (state !== 'guessing') return;
    const p = e.latlng.wrap();
    reveal({ latDeg: p.lat, lonDeg: p.lng });
  });
  startBtn.addEventListener('click', start);
  nextBtn.addEventListener('click', () => {
    if (state === 'scored') startRound();
  });
  $('game-stop').addEventListener('click', () => stop());
  renderBoard();
  setState('idle');
}
