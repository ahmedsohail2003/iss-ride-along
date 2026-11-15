# Code tour (10 stops)

For anyone presenting ISS Ride-Along. A judge may say "walk me through this": each stop has the file, the functions to
point at, what they do, and a sentence to say out loud. It follows the page's life, from orbit numbers to the dot on the map.

`node scripts/check-docs.mjs` checks that every file and function named here exists.

## Stop 1: where the orbit numbers come from

- File: `src/elements.ts`
- Functions: `initialElements()`, `refreshElements()`, `parseIssTle()`
- The station's orbit is published as a TLE ("two-line element set": two lines of numbers describing
  its orbit at one moment, called the epoch). CelesTrak redistributes the US Space Force's TLEs.
- `initialElements()` picks the newer of the copy built into the page and the one this browser saved.
  `refreshElements()` then tries one CelesTrak download in the background (not if this device saved one
  under 2 hours ago, and not when the browser reports no network).
- `parseIssTle()` rejects anything that is not the ISS (catalogue number 25544) or that SGP4 cannot run.
- Say: "The page never waits for the network: it starts on saved orbit numbers and swaps in a fresh copy."

## Stop 2: the orbit engine

- Files: `src/orbit/orbit.ts`, `src/orbit/satellite-lite.ts`
- Functions: `satrecFromTle()`, `stateAt()`, `greatCircleKm()`, `isSunlitCylinder()`
- `stateAt()` runs SGP4, the standard model for propagating TLEs (it moves the orbit from the epoch to any time), through
  satellite.js, and turns the result into latitude, longitude, altitude in km and speed in km/s (through space, not over the ground).
- `greatCircleKm()` is the haversine formula: the distance between two points on the Earth's surface.
- `isSunlitCylinder()` is a simple Earth-shadow test; the pass predictor (stop 8) uses satellite.js's `shadowFraction()`. `satellite-lite.ts` imports only satellite.js's plain JavaScript (its WebAssembly broke the build).
- Day and night (C2), `src/orbit/daynight.ts`: `nightLine()` gives the day/night line, one latitude per degree of longitude, closed over the dark pole for the map's shading; `sunlitNow()` calls the pass predictor's own `inSunlight()` test, so the marker's "in sunlight" can never disagree with the pass list; `nextSunlightChange()` steps 10 s, then 1 s, for "sunrise in N min".
- Say: "This file is pure math with no internet and no screen, which is why we can test it on its own."

## Stop 3: the path on the map and the data-age label

- File: `src/orbit/track.ts`
- Functions: `groundTrack()`, `splitAtAntimeridian()`, `periodMinutes()`, `ageLevel()`
- `periodMinutes()` gets the time for one orbit from the TLE's mean motion (92.95 minutes for the built-in TLE).
  `groundTrack()` computes the point under the station every 30 seconds from one orbit ago to one orbit ahead.
- `splitAtAntimeridian()` cuts the path at longitude 180, so a flat map draws no line across the world.
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
- Say: "Both trackers run their own code on public orbit numbers: a small gap shows our math is right, not where it truly is."

## Stop 5: the page itself

- Files: `src/main.ts`, `src/ui/warnings.ts`, `src/ui/tabs.ts`
- Functions: `tick()`, `drawTrack()`, `renderAge()`, `warnSource()`, `initTabs()`
- Leaflet, a map library, draws the map. `initNasaLayers()` (stop 6) adds the NASA layers to it. First screen (M7): map, planner box, next-pass line, "How accurate is this?"; the rest in tabs; a source that fails calls `warnSource()`.
- `tick()` runs every second: it calls `stateAt()` for "now", updates the numbers and moves the marker.
  `drawTrack()` redraws the two orbit lines every minute. `renderAge()` writes the data-age label.
- Say: "Every second the browser recomputes the station's position itself; nothing is streamed from a server."

## Stop 6: what the station is flying over (NASA layers)

- Files: `src/nasa/layers.ts`, `src/nasa/footprint.ts`, `src/nasa/gibs.ts`, `src/nasa/eonet.ts`, `src/nasa/photos.ts`
- Functions: `initNasaLayers()`, `renderLists()`, `footprintRadiusKm()`, `splitByFootprint()`, `pickGibsDay()`, `parseEonet()`, `photoCreditLine()`
- `footprintRadiusKm()` is the station's view: how far along the ground a place can be and still see
  the station above its horizon (cos(angle) = R / (R + altitude)). `splitByFootprint()` sorts events or
  photos by distance and keeps the ones inside that circle.
- `pickGibsDay()` chooses the NASA GIBS daily image: yesterday (UTC) if GIBS's reply header confirms it,
  else two days ago; the date is printed under the map. `parseEonet()` reads NASA EONET's events and
  turns GeoJSON's [longitude, latitude] into named fields so they cannot be swapped.
- `photoCreditLine()` writes each curated photo's NASA credit. `renderLists()` refreshes events and photo every 5 seconds.
- Say: "The circle is computed from the altitude; the image, events and photos are NASA data, each with its date and credit."

## Stop 7: how we know it works

- Files: `tests/position.test.ts`, `tests/track.test.ts`, `tests/orbit.test.ts`, `tests/geometry.test.ts`, `tests/nasa.test.ts`, `tests/passes.test.ts`, `scripts/check-live.mjs`, `scripts/smoke.mjs`
- Functions: `stateAt()` (the copy in `scripts/check-live.mjs`)
- `tests/position.test.ts` compares our position, altitude and speed with 10 saved wheretheiss.at
  positions, using the same TLE that tracker used. Limits: 2 km, 0.1 km, 1 km/h. Measured: at most
  0.0003 km, 0.0020 km and 0.0000 km/h over the 10 samples.
- `scripts/check-live.mjs` does the same for "now" against the live site. `scripts/smoke.mjs` opens the
  built page in headless Chrome, checks the numbers appear and the marker moves, and saves a screenshot.
- `tests/geometry.test.ts` checks the view circle against wheretheiss.at's own figure (4,596 km across
  at 437.66 km; ours 4,593.5 km). `tests/nasa.test.ts` checks the EONET coordinate order, the GIBS date
  rule and that every photo's credit is NASA only.
- `tests/passes.test.ts` checks the pass list against Heavens-Above (stop 8) and a polar city;
  `tests/planner.test.ts` checks the planner (stop 9), with every service answered from saved replies.
- Say: "`npm test` runs 78 checks in a few seconds; the position test proves the math: 10 of 10 samples within 1 metre."

## Stop 8: when can I see it (visible passes)

- Files: `src/orbit/passes.ts`, `src/passes-ui.ts`, `tests/fixtures/passes-ypsilanti-2026-11-14.json`
- Functions: `findVisiblePasses()`, `isVisibleAt()`, `predictForPlace()`, `agreementWith()`, `initPassPanel()`
- `isVisibleAt()` is the rule: station 10° or more above your horizon, Sun 6° or more below it, station
  in sunlight. `findVisiblePasses()` checks it every 20 s over 5 days, narrows each start and end to
  0.5 s, and finds the highest point. `predictForPlace()` adds a plain sentence when the list is empty.
- `agreementWith()` re-runs the search on Heavens-Above's saved list for Ypsilanti; the page prints the
  result. `initPassPanel()` reads the city box or typed coordinates and writes the table.
- Say: "For Ypsilanti we found the same 8 passes Heavens-Above lists, starts within about a second, recomputed on every load."

## Stop 9: the sighting planner (the agent loop and the number audit)

- Files: `src/agent/loop.ts`, `src/agent/tools.ts`, `src/agent/audit.ts`, `src/agent/providers.ts`, `src/agent/fixedPlan.ts`, `src/agent/score.ts`
- Functions: `runAgent()`, `runTool()`, `planLeg()`, `showPass()`, `audit()`, `runFixedPlan()`, `scorePass()`
- `runAgent()` sends your sentence and 5 tool descriptions to the model, runs each tool it asks for with
  `runTool()`, and repeats (at most 6 calls, 30 s); any failure ends in `runFixedPlan()` with the reason shown.
- `planLeg()` runs our pass engine, the cloud forecast and `scorePass()` for one place and its nights. `showPass()`
  refuses any pass id the engine did not return. `audit()` marks every number in the model's words that no tool gave.
- Say: "The AI only chooses; every number on the card comes from our engine, and the badge counts any it made up."

## Stop 10: our math against NASA's own trajectory (the frame conversion)

- Files: `src/orbit/frames.ts`, `src/orbit/oem.ts`, `src/orbit/oemCompare.ts`, `src/oem-ui.ts`, `tests/oem.test.ts`, `scripts/check-oem.mjs`
- Functions: `parseOem()`, `temeToJ2000Matrix()`, `precessionMatrix()`, `nutation80()`, `gapAt()`, `initOemPanel()`
- SGP4 answers in TEME, a frame tied to each date; NASA's file is in J2000. `temeToJ2000Matrix()` turns one into the other:
  precession (`precessionMatrix()`), nutation from all 106 terms (`nutation80()`) and the equation of the equinoxes.
- `gapAt()` compares only at NASA's own 4-minute row times. `tests/oem.test.ts` checks the conversion against a published
  example (Vallado et al. 2006, 0.82 m off) and astronomy-engine (under 3 m); with no conversion the gap is 26 to 45 km.
- Say: "Within 12 hours of the orbit numbers' time we are 0.37 km from NASA mission control's own trajectory (median; 1.03 km at most)."
