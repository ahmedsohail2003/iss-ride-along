# How ISS Ride-Along works

ISS Ride-Along is a web page that shows where the International Space Station is right now. The
position is computed in the visitor's own browser from the station's published orbit numbers, then
checked against an independent tracker: in the saved test, our position agreed with wheretheiss.at
to within 0.0003 km on 10 of 10 samples. The whole page builds into one HTML file that also opens
without internet.

Status (Sat Nov 14, 5:30 PM EST): the live tracker, the NASA layers (a dated NASA satellite image, NASA natural events
in the station's view, curated NASA astronaut photos) and the "when can I see it" pass predictor work. The game is planned and not built yet.

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
| World map (base) | built into the page: 21 tiles, zoom 0-2, so it works offline | - | NASA EOSDIS GIBS, Blue Marble |
| Daily satellite image on top | fetched tiles, labelled "daily satellite image, {date}, not a live camera" | - | NASA GIBS, MODIS Terra true colour |
| The station's view (circle) | computed: horizon radius from altitude (see below) | km | our geometry |
| Natural events in view | fetched list (one request per page load, else the saved copy); which ones are in view and how far is computed | km, dates in UTC | NASA EONET |
| Astronaut photo | built in (12 thumbnails chosen by hand, labelled curated); which one is in view is computed | - | NASA Image and Video Library |
| Visible passes for a city (next 5 days) | computed in the browser | local time, compass points, degrees above the horizon | TLE from CelesTrak; cities from Natural Earth |

Nothing else is downloaded. There is no server, no account and no API key.

## The NASA layers

- **The station's view.** Everything within the circle can see the station above its horizon. On a
  round Earth of radius R, a station at altitude h sees out to the angle where cos(angle) = R / (R + h);
  the circle's radius along the ground is R times that angle. At 437.66 km it is 4,593.5 km across;
  wheretheiss.at gives 4,596 km (0.054% apart; `tests/geometry.test.ts`, and within 0.059% on all 10
  saved samples).
- **Satellite image.** The page asks GIBS for yesterday's daily mosaic (UTC) and uses it if GIBS's
  `Layer-Time-Actual` reply header confirms that day, else two days ago. The date is printed under the map.
- **Events.** The page asks EONET for every open event reported in the last 30 days, with no count
  limit, and prints how many there are (saved copy, Nov 14: 38 events, 25 US wildfires, 2 tropical
  cyclones, 11 sea-ice events). EONET leaves some events open for years without a new report (7,244 open
  in all that day, the oldest last reported 9,081 days earlier), so older ones are left out. The page lists
  the ones inside the circle with category, date, reporting agency and distance; if none are, it says
  so and names the nearest one.
- **Photos.** The library has no coordinates, so each photo's place was set by hand from its title.
  Only photos whose own NASA description credits NASA are used (ESA, JAXA and CSA photos were left
  out). No NASA logo or insignia is used.

## When can I see it (visible passes)

- The page looks 5 days ahead for times when the station is at least 10° above your horizon, your sky
  is dark (Sun 6° or more below the horizon) and the station is in sunlight (satellite.js `shadowFraction`
  under 1): 20 s steps, each start and end narrowed to 0.5 s, peak by golden-section search; 5 days took 21 ms in Node.
- Against Heavens-Above's Ypsilanti list for Nov 14-18, saved by hand with the same TLE (`tests/passes.test.ts`): 8 of 8
  passes, starts within 1.3 s, ends within 4.8 s, peak within 0.6° (limits 5 s, 15 s, 3°). Far north or south (Alert,
  82.5° N) it says why the list is empty. Times are Ypsilanti's for Ypsilanti, otherwise the visitor's own time zone.

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
- **NASA GIBS**: NASA's map-tile service; Blue Marble tiles are built in (offline), the daily MODIS
  Terra image is fetched live.
- **NASA EONET**: NASA's list of open natural events (wildfires, storms, ice), as points with dates.
- **NASA Image and Video Library**: NASA's photo archive; the source of the curated astronaut photos.
- **Vite 8.3.8 + vite-plugin-singlefile 2.3.4**: build the site into one self-contained `index.html`
  that teammates can open on their own laptops.
- **TypeScript 7.0.2**: JavaScript with type checks; `npm run build` fails on a type error.
- **Vitest 5.1.0**: runs the 47 unit tests in about a second, with no network.
- **playwright-core 1.65.1**: drives the Chrome already on the laptop for the screenshot and video
  scripts (no browser download).

## Honest edges

- The built-in TLE was downloaded from CelesTrak at 12:36 PM EST Nov 14; CelesTrak did not answer
  from our network later that afternoon, so a fresh copy arrives only when a visitor's network
  reaches it. The age label always shows which copy is in use and how old it is.
- Offline, the map is the built-in Blue Marble image (sharp to zoom 2 only) and the events are the
  saved copy, labelled with its date. The daily image has gaps where the satellite did not pass.
- Open events are mostly US wildfires, so "no events in view" is the common, honest answer.
- On a phone-sized screen the map does not follow the marker yet.
- The speed shown is orbital speed. Speed over the ground is lower because the Earth turns
  underneath; the label says so.

## How it was built

Built at Hack the Nest 2026 through Claude Code: Fable 5.2 planned, Opus 5.5 wrote the code, and
Ahmed Sohail Butt approved the plan and decides what is pushed. Not affiliated with
or endorsed by NASA. The code tour for presenters is `CODE_TOUR.md`; how to run everything is `RUN.md`.
