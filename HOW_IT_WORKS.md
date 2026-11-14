# How ISS Ride-Along works

ISS Ride-Along is a web page that shows where the International Space Station is right now. The
position is computed in the visitor's own browser from the station's published orbit numbers, then
checked against an independent tracker: in the saved test, our position agreed with wheretheiss.at
to within 0.0003 km on 10 of 10 samples. The whole page builds into one HTML file that also opens
without internet.

Status (Sat Nov 14, 2:30 PM EST): the live tracker works. The NASA imagery and events under the
station, the "when can I see it" predictor and the game are planned and not built yet; this page is
updated as each one ships.

## In one minute

The station's orbit is published as a TLE (two-line element set: the orbit's size, tilt and
position at one moment, its epoch), and a new one replaces it as fresh tracking data comes in. The page feeds that TLE into SGP4, the standard model for
these numbers, which moves the orbit forward to the current second. Out come latitude, longitude,
altitude and speed, recomputed every second, and the path one orbit back and one orbit ahead. A
button asks wheretheiss.at, a separate tracker with its own code, for the same second and shows the
distance between the two answers.

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
| World map | built into the page (one low-resolution image) | - | NASA EOSDIS GIBS, Blue Marble |

Nothing else is downloaded. There is no server, no account and no API key.

## What the reference check means

Both trackers start from public orbit numbers and run their own code, so a small difference shows
our math is right. It does not measure where the station truly is; nobody in this project measures
the station. The difference also grows when the two sides use TLEs of different ages.

- Saved test (`npm test`, file `tests/position.test.ts`): 10 positions from wheretheiss.at, saved
  Nov 14 at 19:07 UTC, compared using the same TLE that tracker used. Largest differences over the
  10 samples: 0.0003 km in position, 0.0020 km in altitude, 0.0000 km/h in speed. Limits: 2 km,
  0.1 km, 1 km/h.
- Live check (`node scripts/check-live.mjs`, 2 runs at 2:28 PM EST Nov 14): 0.729 km both times.
  Our TLE (epoch 04:10 UTC Nov 14) was newer than the one wheretheiss.at used (epoch 21:59 UTC
  Nov 13); run on wheretheiss.at's own TLE, the difference was 0 km.
- For scale: the station moves about 7.67 km every second (SGP4 speed at the built-in TLE's epoch:
  7.666 km/s), so 0.729 km is about a tenth of a second of travel.

## Each tool in one line

- **SGP4 via satellite.js 7.2.0** (MIT licence): the standard orbit model for TLEs, so our positions
  can be compared with other trackers that use the same TLEs.
- **CelesTrak**: a public website that redistributes the US Space Force's TLEs; one request per page load.
- **wheretheiss.at**: a free independent ISS tracker, used only as the reference to check against.
- **Leaflet 1.9.4** (BSD-2-Clause): a small map library that draws the 2D map, marker and lines.
- **NASA GIBS Blue Marble**: one world image built into the page, so the map works offline.
- **Vite 8.3.8 + vite-plugin-singlefile 2.3.4**: build the site into one self-contained `index.html`
  that teammates can open on their own laptops.
- **TypeScript 7.0.2**: JavaScript with type checks; `npm run build` fails on a type error.
- **Vitest 5.1.0**: runs the 14 unit tests in about a second, with no network.
- **playwright-core 1.65.1**: drives the Chrome already on the laptop for the screenshot and video
  scripts (no browser download).

## Honest edges

- The built-in TLE was downloaded from CelesTrak at 12:36 PM EST Nov 14; CelesTrak did not answer
  from our network later that afternoon, so a fresh copy arrives only when a visitor's network
  reaches it. The age label always shows which copy is in use and how old it is.
- The map is one low-resolution world image for now; sharper NASA imagery is the next feature.
- On a phone-sized screen the map does not follow the marker yet.
- The speed shown is orbital speed. Speed over the ground is lower because the Earth turns
  underneath; the label says so.

## How it was built

Built at Hack the Nest 2026 through Claude Code: Fable 5.2 planned, Opus 5.5 wrote the code, and
Ahmed Sohail Butt approved the plan and decides what is pushed. Not affiliated with
or endorsed by NASA. The code tour for presenters is `CODE_TOUR.md`; how to run everything is `RUN.md`.
