# How to run ISS Ride-Along

## Just look at it (no install)

- Live page: https://ahmedsohail2003.github.io/iss-ride-along/ (GitHub Pages, rebuilt by
  `.github/workflows/pages.yml` on every push to `main`: `npm ci`, `npm test`, the docs check, a secret scan, `npm run build`; it publishes only if all pass).
- Offline: double-click `docs/iss-ride-along-offline.html` (also small enough to send as a Discord
  attachment). It is one self-contained file, so it opens from `file://` with no server and no
  internet; it then runs on the orbit data built into it and says so in the "Orbit data age" label
  ("built into this page"). With the network off it makes no requests at all.

## From the code

Needs Node 22 (built with 22.14.0) and npm. In this folder:

```
npm install        # once; installs the exact versions in package-lock.json
npm test           # 78 unit tests, offline, a few seconds
npm run build      # type check + one self-contained file: dist/index.html
npm run offline    # build, then copy it to docs/iss-ride-along-offline.html (fails at 8 MB or more)
npm run dev        # local dev server with reload; open the address Vite prints
npm run preview    # serve the built dist/ folder
npm run snapshot   # refresh the saved data in src/data/ (needs the network; one request per source)
npm run snapshot -- --only nasa  # refresh only the NASA files (Blue Marble tiles, EONET, photos)
npm run snapshot -- --only weather  # save one real Open-Meteo reply as tests/fixtures/openmeteo-ypsilanti.json
npm run snapshot -- --only news     # save one real Exa search reply as tests/fixtures/exa-station-news.json
npm run snapshot -- --only oem      # NASA's ISS trajectory: src/data/iss-oem.json + the fixture pair in tests/fixtures/
```

## Checks

They use the Chrome already installed on the laptop through playwright-core (no browser download).
`smoke.mjs` and `record-demo.mjs` open `dist/index.html`, so run `npm run build` first.

```
node scripts/smoke.mjs        # headless Chrome on dist/index.html from file://, network mocked
node scripts/smoke.mjs --net --out evidence/m4.png  # real network; also presses "Check against reference"
node scripts/smoke.mjs --offline  # network off, on docs/iss-ride-along-offline.html
node scripts/smoke.mjs --plan     # network mocked; presses Plan my sighting (no key), the trip example, then a keyed run -> evidence/a1.png
node scripts/smoke.mjs --oem      # network mocked; the NASA trajectory panel (gap, row time, age recomputed) -> evidence/c1.png
node scripts/check-agent.mjs --provider openai   # the planner's live check; with no key it prints SKIPPED no key
node scripts/make-offline.mjs # copy dist/index.html to docs/; checks size and no http(s) tags
node scripts/check-live.mjs   # our position for "now" vs wheretheiss.at; prints SKIPPED offline without network
node scripts/check-oem.mjs    # our math vs NASA's trajectory at 0/12/24/36/72 h, and with no conversion; writes src/data/oem-agreement.json
node scripts/record-demo.mjs  # backup demo capture -> docs/demo-backup.mp4 (needs ffmpeg and AC power)
node scripts/check-docs.mjs   # every file and function named in CODE_TOUR.md exists; docs under 120 lines
```

- `smoke.mjs` passes when the latitude is a number, the marker moves within 2.5 s, both orbit lines are
  drawn and there are 0 console or page errors. It also needs the NASA layers: the map's date label,
  at least one event line, a curated photo with its NASA credit and the credits panel; with `--net`
  at least one real NASA GIBS map tile must answer HTTP 200. The mocked mode answers EONET from the
  saved copy and GIBS with the built-in Blue Marble tile.
  With `--offline` it also needs the label to say "built into this page".
  Options: `--url <url>`, `--out <png>`, `--size 390x844`. Screenshots go to `evidence/` (not committed).
- `check-agent.mjs` runs the page's own planner loop against a live AI provider and prints every step, the
  seconds and the model calls; it also checks Open-Meteo, the place search and Exa. The key comes only from
  the environment, loaded by Node itself, for example
  `node --env-file=<your key file> scripts/check-agent.mjs --provider gemini --runs 3 "Ypsilanti, before 8:30 PM, any night this week"`.
  It prints `key found`, never the key, and `--record` saves reply bodies (no headers, no addresses) to `evidence/a1-live-<n>.json`.
- `check-live.mjs` exits 1 if our position is 2 km or more from wheretheiss.at.
- `smoke.mjs` and `record-demo.mjs` wait if the laptop has under 0.8 GB of free memory and then print
  `DEFERRED` instead of failing. `record-demo.mjs` also prints `DEFERRED` on battery (`--force` skips that).

## If something looks wrong

| You see | What it means | What to do |
|---|---|---|
| "Orbit data age ... built into this page" | CelesTrak was not reachable, so the page uses its built-in orbit data | nothing: the tracker still works; the label shows how old the data is |
| The age label is amber or red | the orbit data is over 1 day (amber) or 3 days (red) old | connect to the internet and reload |
| "Could not reach wheretheiss.at" | no internet, or the reference site is slow | the tracker keeps running; try the button again online |
| "built-in NASA Blue Marble image" under the map | offline, or NASA GIBS did not answer | nothing: the map still works; online, reload for the daily image |
| "Saved copy from ..." under the events | the live NASA EONET list did not load | the saved list is used and dated; reload when online |
| "AI key refused", "AI rate limit reached" or "AI took too long" above the plan | the AI provider said no or was slow | nothing: the card shows the fixed plan; check the key in Settings, or wait a minute |
| The planner says "this one needs the AI" | the sentence has two places and no key is set | add a key in Settings, or use the plain controls for one place |
| `npm run build` fails with a type error | `tsc` found a TypeScript error | read the file and line it prints |
