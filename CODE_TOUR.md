# Code tour (6 stops)

For anyone presenting ISS Ride-Along. A judge may say "walk me through this": each stop has the file,
the functions to point at, what they do, and a one-sentence answer to say out loud. Read it top to
bottom once; it follows one second of the page's life, from orbit numbers to the dot on the map.

`node scripts/check-docs.mjs` checks that every file and function named here exists.

## Stop 1: where the orbit numbers come from

- File: `src/elements.ts`
- Functions: `initialElements()`, `refreshElements()`, `parseIssTle()`
- The station's orbit is published as a TLE ("two-line element set": two lines of numbers describing
  its orbit at one moment, called the epoch). CelesTrak redistributes the US Space Force's TLEs.
- `initialElements()` picks the newest of two copies that need no network: the one built into the
  page and the one this browser saved last time. `refreshElements()` then tries one CelesTrak download
  in the background (skipped if this device saved one less than 2 hours ago, to be polite to CelesTrak,
  and skipped when the browser reports no network, so the offline file makes no request at all).
- `parseIssTle()` rejects anything that is not the ISS (catalogue number 25544) or that SGP4 cannot run.
- Say: "The page never waits for the network: it starts on the newest saved orbit numbers and swaps in
  a fresh download if one arrives."

## Stop 2: the orbit engine

- Files: `src/orbit/orbit.ts`, `src/orbit/satellite-lite.ts`
- Functions: `satrecFromTle()`, `stateAt()`, `greatCircleKm()`, `isSunlitCylinder()`
- `stateAt()` runs SGP4, the standard model for propagating TLEs (it moves the orbit forward from the
  epoch to any time), through the satellite.js library. It turns the result into latitude, longitude,
  altitude in km and speed in km/s. The speed is the speed through space, not over the ground.
- `greatCircleKm()` is the haversine formula: the distance between two points on the Earth's surface.
- `isSunlitCylinder()` tests whether the station is in Earth's shadow. It is tested but not on the
  page yet; the planned pass predictor needs it (the station is only visible while sunlit).
- `satellite-lite.ts` imports only the plain JavaScript parts of satellite.js, because its optional
  WebAssembly part broke the one-file build.
- Say: "This file is pure math with no internet and no screen, which is why we can test it on its own."

## Stop 3: the path on the map and the data-age label

- File: `src/orbit/track.ts`
- Functions: `groundTrack()`, `splitAtAntimeridian()`, `periodMinutes()`, `ageLevel()`
- `periodMinutes()` gets the time for one orbit from the TLE's mean motion (92.95 minutes for the
  built-in TLE). `groundTrack()` computes the point under the station every 30 seconds from one
  orbit ago to one orbit ahead.
- `splitAtAntimeridian()` cuts the path where it crosses longitude 180, so a flat map does not draw a
  line straight across the world.
- `ageLevel()` colours the "orbit data age" label: green under 1 day, amber 1-3 days, red over 3 days,
  because SGP4 errors grow as the TLE gets older.
- Say: "The solid and dashed lines are one orbit back and one orbit ahead, computed, not downloaded."

## Stop 4: the "Check against reference" button

- Files: `src/reference.ts`, `src/orbit/compare.ts`, `src/orbit/orbit.ts`
- Functions: `fetchReference()`, `compareWithReference()`, `greatCircleKm()`
- `fetchReference()` makes one request to wheretheiss.at, an independent tracker (not NASA), and checks
  that the reply has numbers for time, latitude, longitude, altitude and speed.
- `compareWithReference()` runs our model at the reference's own timestamp, so both numbers describe
  the same second, then reports the ground distance in km and the altitude and speed differences.
- Say: "Both trackers run their own code on public orbit numbers, so a small difference shows our math
  is right; it does not measure the station's true position."

## Stop 5: the page itself

- File: `src/main.ts`
- Functions: `tick()`, `drawTrack()`, `renderAge()`
- Leaflet, a map library, draws one built-in NASA Blue Marble world image so the map also works offline.
- `tick()` runs every second: it calls `stateAt()` for "now", updates the numbers and moves the marker.
  `drawTrack()` redraws the two orbit lines every minute. `renderAge()` writes the data-age label.
- Say: "Every second the browser recomputes the station's position itself; nothing is streamed from a
  server."

## Stop 6: how we know it works

- Files: `tests/position.test.ts`, `tests/track.test.ts`, `tests/orbit.test.ts`, `scripts/check-live.mjs`, `scripts/smoke.mjs`
- Functions: `stateAt()` (the copy in `scripts/check-live.mjs`)
- `tests/position.test.ts` compares our position, altitude and speed with 10 saved wheretheiss.at
  positions, using the same TLE that tracker used. Limits: 2 km, 0.1 km, 1 km/h. Measured: at most
  0.0003 km, 0.0020 km and 0.0000 km/h over the 10 samples.
- `scripts/check-live.mjs` does the same for "now" against the live site. `scripts/smoke.mjs` opens the
  built page in headless Chrome, checks the numbers appear and the marker moves, and saves a screenshot.
- Say: "`npm test` runs 14 checks in about a second, and the position test is the one that proves the
  math: 10 of 10 samples within 1 metre of the reference."
