# How ISS Ride-Along works

ISS Ride-Along is a web page that shows where the International Space Station is right now. The position is computed in
the visitor's own browser from the station's published orbit numbers and checked twice: against an independent tracker
(wheretheiss.at, within 0.0003 km on 10 of 10 saved samples) and against NASA mission control's own predicted trajectory
(0.37 km apart on median within 12 hours of the orbit numbers' time). The page builds into one HTML file.

Status (Sat Nov 14, 9:30 PM EST): tracker, NASA layers, pass predictor, planner, NASA trajectory check, the M7 first screen (planner box, next-pass line, "How accurate is this?"; the rest in tabs; a source that cannot be reached shows a warning naming it), day and night, the game (Game tab) with the orbit lab line, and the plain sentence above the map with keyboard and screen-reader use (C3) built.

## In one minute

The station's orbit is published as a TLE (two-line element set: the orbit's size, tilt and position at one moment, its
epoch). The page feeds it into SGP4, the standard model for these numbers, which moves the orbit to the current second:
position, altitude and speed every second, and the path one orbit back and ahead. A button asks wheretheiss.at for the gap.

## What is computed and what is fetched

| Shown on the page | Computed in the browser or fetched | Units | Where from |
|---|---|---|---|
| Latitude, longitude | computed every second (SGP4) | degrees | TLE from CelesTrak |
| Altitude | computed | km above the WGS-84 ellipsoid (the standard Earth shape) | TLE from CelesTrak |
| Speed | computed | km/h; orbital speed through space, not speed over the ground | TLE from CelesTrak |
| Last orbit (solid line), next orbit (dashed) | computed, one point every 30 s | degrees | TLE from CelesTrak |
| Orbit data age | computed: now minus the TLE's epoch | days, hours, minutes | TLE from CelesTrak |
| The TLE itself | fetched: one CelesTrak request per page load, else the copy saved in this browser, else the copy built into the page (newest wins) | - | CelesTrak (US Space Force data; not NASA) |
| "X km from wheretheiss.at" | fetched (their position) and computed (ours, at their timestamp) | km, km/h | wheretheiss.at (not NASA) |
| World map (default) | cloud-free Blue Marble, no date: 21 tiles built into the page (zoom 0-2, works offline), the same layer fetched from GIBS to zoom 8 when online | - | NASA EOSDIS GIBS, Blue Marble Shaded Relief and Bathymetry |
| Daily satellite photo (switch under the map, off at first) | fetched tiles only while the switch is on, labelled "daily satellite image, {date}, not a live camera" | - | NASA GIBS, MODIS Terra true colour |
| The station's view (circle) | computed: horizon radius from altitude (see below) | km | our geometry |
| 3D globe (G1: the "3D" button or `?view=3d`; the page still opens flat, and stays flat without WebGL 2, in software, when slow or with reduced motion) | computed: the same station, two orbits (`stateAt` every 30 s), night side (`subsolarPoint`) and view circle drawn on a three.js sphere; the Earth picture is fetched once and built in | degrees, km | our engine; NASA GIBS Blue Marble, saved 2026-11-15 |
| The chosen pass on the globe (G2), and the 3D view's black look | computed: after "Plan my sighting" the globe turns to the point under the pass's highest moment and draws the pass rise to set (`passPoints`: `stateAt` every 5 s, the same times as the flat map's pink arc) at the station's height, with a dot on the planned place | degrees, km | our engine |
| Natural events in view | fetched list (one request per page load, else the saved copy); which ones are in view and how far is computed | km, dates in UTC | NASA EONET |
| Astronaut photo | built in (12 thumbnails chosen by hand, labelled curated); which one is in view is computed | - | NASA Image and Video Library |
| Visible passes for a city (next 5 days) | computed in the browser | local time, compass points, degrees above the horizon | TLE from CelesTrak; cities from Natural Earth |
| Cloud for each pass hour, station news | fetched only when "Plan my sighting" is pressed | %, dates | Open-Meteo (no key), Exa web search (no key) |
| "X km apart" from NASA's trajectory | computed at NASA's latest row time, against the built-in copy of NASA's file | km, hours | NASA JSC trajectory file (OEM) |
| The sentence above the map ("1,050 km west of Johannesburg, South Africa, heading southeast, 430 km up.") | computed once a minute, on purpose, so a screen reader announces it once a minute (it can be up to a minute behind the numbers): the nearest of the 150 built-in cities only, no oceans (haversine distance, rounded to 10 km), the 8-point compass direction from that city, the direction of travel from two SGP4 positions 10 s apart. Keyboard and screen-reader use checked by axe-core and a scripted keyboard run (`node scripts/smoke.mjs --a11y`), not yet by a person using a screen reader | km, compass words | TLE from CelesTrak; city list in `src/data/cities.json` |
| Sky from the station tab (star chart, redrawn every second while open) | computed: "straight up" from the station has right ascension = local sidereal time and declination = its latitude, turned into J2000 by the same matrix as the NASA check; 1,627 built-in stars of magnitude 5 or brighter and 88 constellation figures; the "in sunlight" label is the map's; drag, wheel, pinch and arrow keys move a stereographic view (30 to 180° across), a tap names the nearest star or constellation line | degrees | XHIP star catalogue and IAU constellation lines, via d3-celestial (BSD 3-Clause); not NASA |
| Game "N km off" (board kept in this browser only); orbit lab line | computed: our SGP4 position 10 min after the round's start and the haversine distance to your tap; a circular orbit's speed = √(GM ÷ r), time = 2πr ÷ speed (GM = 398,600.4418 km³/s², r = 6,378.137 km + height; 7.6686 km/s and 92.560 min at 400 km in `tests/geometry.test.ts`) | km; min, km/s | TLE from CelesTrak; textbook formula |

There is no server and no account. The only key is one a visitor may type into the Settings tab. The page shows this table too ("Accuracy and sources" tab).

## The NASA layers

- **The station's view.** Everything inside the circle sees the station above its horizon: cos(angle) = R / (R + h), ground radius R times that angle. At 437.66 km: 4,593.5 km across; wheretheiss.at 4,596 km (0.054%; within 0.059% on 10 of 10).
- **Map.** Cloud-free Blue Marble by default, so a stranger can see the continents under the marker; the switch shows GIBS's daily mosaic for yesterday (UTC) if `Layer-Time-Actual` confirms it, else two days ago; dated.
- **Events.** Every EONET event reported in the last 30 days, no count limit (Nov 14: 38 events, 25 US wildfires, 2 tropical cyclones, 11 sea ice; 7,244 older open events left out). Those inside the circle are listed, else the nearest is named.
- **Photos.** Places set by hand from each title (the library has no coordinates); NASA-credited only; no NASA logo.

## When can I see it (visible passes)

- The page looks 5 days ahead for times when the station is at least 10° above your horizon, your sky is dark (Sun 6° or more below) and the station is in sunlight (`shadowFraction` under 1): 20 s steps, edges to 0.5 s; 5 days took 21 ms.
- **Day and night on the map.** You can see it only when you are in the dark and it is still in sunlight, which happens in the hours after sunset and before sunrise. The shaded part of the map is where the Sun is below the horizon (one latitude per degree of longitude, the Sun's centre on the horizon, no bending of light by the air); the marker says "in sunlight" or "in Earth's shadow, sunrise in N min" from the same shadow test as the pass list (`tests/daynight.test.ts`: the line's Sun height within 0.007° of astronomy-engine at 24 points; 559 of 559 samples over one orbit agree with the pass test).
- Against Heavens-Above's Ypsilanti list for Nov 14-18, same TLE (`tests/passes.test.ts`): 8 of 8 passes, starts within 1.3 s, ends 4.8 s, peak 0.6° (limits 5 s, 15 s, 3°). Far north (Alert, 82.5° N) it says why the list is empty. Ypsilanti's times, else the viewer's.

## Plan my sighting (the AI agent and the fixed plan)

- **Why an agent.** The pass table answers for one place. The box takes a week in your own words ("Ypsilanti until Monday, then Chicago Tuesday to Thursday, kids in bed by 8:30"). The model (Gemini; an OpenAI adapter behind the same code) splits it into legs, calls our tools and picks one pass. Tools: `findCity`, `planLeg` (our pass engine, Open-Meteo cloud at each peak, the fixed score), `stationNews` (Exa web search, last 7 days), `orbitDataAge` (with the NASA-measured gap), `showPass`, and `makeCalendarFile` / `writeBriefing` (a calendar file and a one-page sheet, handed over only on your click).
- **The fixed rule** (both modes): a pass counts if it starts on your nights inside your times; score = (peak ÷ 90) × (1 − cloud ÷ 100), unknown cloud = 50%; under 0.05 everywhere means "no pass worth going out for in your window". When the pick is not the first screen's "Next time" pass, the card adds one engine-written "Why not the next pass" line (outside your nights or times, more cloud, or lower peak).
- **Numbers.** Every number on the card is written by the engine. The audit checks each number in the model's words against the tools' texts and your sentence; anything else is marked "not from our engine". Web text never feeds a number.
- **Limits.** At most 6 model calls, 15 s per reply, 30 s per plan; any failure, or no key, gives the fixed plan with the reason.
- **One retry.** A reply that is slow (15 s), refused for the rate limit (429) or a server error (5xx) is asked once more, from the next Gemini model id, if 5 s of the 30 are left; the Steps list says "asked again" and the call count includes it; a second failure gives the fixed plan as before.
- **Measured** (Nov 14, 6:09-6:13 PM, `scripts/check-agent.mjs`, Gemini `gemini-4-hydrogen`): 3 of 3 one-place runs and 1 trip run chose an allowed pass with 0 unverified numbers, in 7.2-11.0 s and 4 model calls each.

## Checked against NASA's own trajectory

- **What.** NASA Johnson Space Center publishes the station's predicted position every 4 minutes for 15 days (the "OEM" file, originator NASA/JSC/FOD/TOPO; ours created 2026-11-13 15:58 UTC), from NASA's own orbit model, not SGP4. It is a prediction too, so the page says how far "apart" the two are, not how right we are.
- **How.** Only at NASA's own row times (the station moves about 1,840 km in 4 minutes, so no interpolation), SGP4's position is turned from TEME into J2000: IAU 1976 precession, all 106 IAU 1980 nutation terms (from ERFA), equation of the equinoxes.
- **Measured** (`node scripts/check-oem.mjs`): 0.485 km at the TLE's epoch, 0.308 at 12 h, 0.870 at 24 h, 1.767 at 36 h, 4.763 at 72 h; at most 1.031 km over the 360 rows within 12 h; with no conversion 26.10 to 45.19 km (median 36.95).
- **Checked outside our code** (`tests/oem.test.ts`): 0.82 m from the printed J2000 example in Vallado et al. 2006 (limit 1 m) and 1.89-2.61 m from astronomy-engine, a separate library (limit 50 m); one nutation sign flipped fails the first.

## What the reference check means

Both trackers run their own code on public orbit numbers: a small difference shows our math is right, not where the station truly is.

- Saved test (`tests/position.test.ts`, 10 wheretheiss.at positions, Nov 14 19:07 UTC, their TLE): at most 0.0003 km position, 0.0020 km altitude, 0.0000 km/h speed (limits 2 km, 0.1 km, 1 km/h).
- Live check (`node scripts/check-live.mjs`, 2:28 PM EST Nov 14): 0.729 km both runs (our TLE was newer than theirs; on their own TLE, 0 km). The station moves 7.666 km/s, so 0.729 km is about a tenth of a second.

## Each tool in one line

- **SGP4 via satellite.js 7.2.0** (MIT licence): the standard orbit model for TLEs, comparable with other trackers.
- **CelesTrak** redistributes the US Space Force's TLEs (one request per page load); **wheretheiss.at**: the reference tracker.
- **Leaflet 1.9.4** (BSD-2-Clause): a small map library that draws the 2D map, marker and lines.
- **NASA GIBS, EONET, Image and Video Library**: NASA's map tiles (Blue Marble by default, the daily MODIS photo by switch), list of open natural events, and photo archive. **NASA's ISS trajectory file (OEM)**: the check above.
- **Gemini API** (`gemini-4-hydrogen`, `generateContent`): the planner's model, live-tested; OpenAI only with saved replies.
- **ERFA** (BSD 3-clause, from the IAU's SOFA library): source of the 106-term nutation table. **astronomy-engine 2.1.19** (MIT): a second, independent frame conversion, used only in a test.
- **Open-Meteo** (free weather service, CC BY 4.0) for cloud; **Exa** (a search engine built for AI) for station news.
- **Vite 8.3.8 + vite-plugin-singlefile 2.3.4** build one self-contained `index.html`; **TypeScript 7.0.2** (type-checked JavaScript); **Vitest 5.1.0** runs the 159 unit tests offline; **playwright-core 1.65.1** drives Chrome; **axe-core 4.14.0** (an accessibility checker) runs in the smoke test.

## Forecast lab: the harvest from orbit (a research demo)

- **What.** A weather forecast is judged against a simple baseline. The Forecast lab card (in "What it is flying over") does the same for the US corn harvest: a straight trend line through earlier harvests (USDA's Economic Research Service) against that trend line plus NOAA's satellite crop-health score (the Vegetation Health Index, 0-100, from the AVHRR and VIIRS instruments, averaged over early July to mid-August in Iowa, Illinois, Nebraska, Minnesota and Indiana). Each year from 1994 to 2025 is forecast using only earlier years (2004 is skipped: one week of Iowa data is missing). `src/altdata/backtest.ts` does the fitting; the page runs it on the bundled data when the card opens.
- **Measured** (`npm test`, `tests/altdata.test.ts`): over 31 test years the satellite forecast's typical error is 6.42 bushels per acre against the trend line's 9.76, a skill of 0.57 (the share of the trend line's squared error it removes; 0 = no better, 1 = perfect). "Same as last year" is a weaker baseline (12.84). In the 2012 drought the trend line said 158.3, the satellite 142.1, the harvest was 123.1. 30 of 31 harvests fell inside the 80% range, so the range is too wide. 2026: 182.6 (172.6 to 192.5); trend line 185.0; USDA's current estimate 179.6.
- **The price.** The same signal on the corn price from September to December (the IMF series via FRED; only the computed result is kept, because the series is copyrighted): skill 0.00 against "no change" over 23 years. The page shows no price forecast, and the planner answers buy, sell, invest, stock or futures questions with a fixed line and no AI call.
- **Honest edges.** A retrospective test with today's reprocessed data and five states chosen with hindsight; 31 years is a small sample, and most of the gain comes from drought years like 2012. The two images are NASA MODIS 16-day composites from the Terra satellite, not from the ISS and not live; read back with NASA's colour key, their mean greenness (NDVI) is 0.76 in late July 2012 and 0.87 in late July 2026.

## Honest edges

- The built-in TLE is from CelesTrak, 12:36 PM EST Nov 14 (CelesTrak did not answer from our network later); a fresh copy arrives when a visitor's network reaches it, and the age label always says which copy is in use.
- Offline, the map is the built-in Blue Marble (sharp to zoom 2) and events are the dated saved copy. The daily photo is cloudy and has gaps where the satellite did not pass. Open events are mostly US wildfires, so "none in view" is common.
- The planner's trip was run live once (Nov 14); that night both the agent and the fixed plan picked the same Ypsilanti pass. The case where they differ is shown by a test with a made-up cloud table (`tests/planner.test.ts`, test i).
- The speed shown is orbital speed (over the ground it is lower). On a phone the map does not follow the marker yet.
- NASA's file is built in (its server allows no browser download): rows from Nov 14 11:52 to Nov 18 23:48 UTC; the measured table is from one set of orbit numbers. Outside that span the panel says there is no comparison.

## How it was built

Built at Hack the Nest 2026 through Claude Code: Fable 5.2 planned, Opus 5.5 wrote the code, and Ahmed Sohail Butt approved
the plan and decides what is pushed. Not affiliated with or endorsed by NASA. Code tour: `CODE_TOUR.md`; commands: `RUN.md`.
