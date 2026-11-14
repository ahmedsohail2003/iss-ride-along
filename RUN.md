# How to run ISS Ride-Along

## Just look at it (no install)

- Live page: https://ahmedsohail2003.github.io/iss-ride-along/ (GitHub Pages, rebuilt by
  `.github/workflows/pages.yml` on every push to `main`: `npm ci`, `npm test`, `npm run build`).
- Offline: double-click `docs/iss-ride-along-offline.html` (also small enough to send as a Discord
  attachment). It is one self-contained file, so it opens from `file://` with no server and no
  internet; it then runs on the orbit data built into it and says so in the "Orbit data age" label
  ("built into this page"). With the network off it makes no requests at all.

## From the code

Needs Node 22 (built with 22.14.0) and npm. In this folder:

```
npm install        # once; installs the exact versions in package-lock.json
npm test           # 14 unit tests, offline, about 1 second
npm run build      # type check + one self-contained file: dist/index.html
npm run offline    # build, then copy it to docs/iss-ride-along-offline.html (fails at 8 MB or more)
npm run dev        # local dev server with reload; open the address Vite prints
npm run preview    # serve the built dist/ folder
npm run snapshot   # refresh the saved data in src/data/ (needs the network; one request per source)
```

## Checks

They use the Chrome already installed on the laptop through playwright-core (no browser download).
`smoke.mjs` and `record-demo.mjs` open `dist/index.html`, so run `npm run build` first.

```
node scripts/smoke.mjs        # headless Chrome on dist/index.html from file://, network mocked
node scripts/smoke.mjs --net  # real network; also presses "Check against reference"
node scripts/smoke.mjs --offline  # network off, on docs/iss-ride-along-offline.html
node scripts/make-offline.mjs # copy dist/index.html to docs/; checks size and no http(s) tags
node scripts/check-live.mjs   # our position for "now" vs wheretheiss.at; prints SKIPPED offline without network
node scripts/record-demo.mjs  # backup demo capture -> docs/demo-backup.mp4 (needs ffmpeg and AC power)
node scripts/check-docs.mjs   # every file and function named in CODE_TOUR.md exists; docs under 120 lines
```

- `smoke.mjs` passes when the latitude is a number, the marker moves within 2.5 s, both orbit lines are
  drawn and there are 0 console or page errors.
  With `--offline` it also needs the label to say "built into this page".
  Options: `--url <url>`, `--out <png>`, `--size 390x844`. Screenshots go to `evidence/` (not committed).
- `check-live.mjs` exits 1 if our position is 2 km or more from wheretheiss.at.
- `smoke.mjs` and `record-demo.mjs` wait if the laptop has under 0.8 GB of free memory and then print
  `DEFERRED` instead of failing. `record-demo.mjs` also prints `DEFERRED` on battery (`--force` skips that).

## If something looks wrong

| You see | What it means | What to do |
|---|---|---|
| "Orbit data age ... built into this page" | CelesTrak was not reachable, so the page uses its built-in orbit data | nothing: the tracker still works; the label shows how old the data is |
| The age label is amber or red | the orbit data is over 1 day (amber) or 3 days (red) old | connect to the internet and reload |
| "Could not reach wheretheiss.at" | no internet, or the reference site is slow | the tracker keeps running; try the button again online |
| `npm run build` fails with a type error | `tsc` found a TypeScript error | read the file and line it prints |
