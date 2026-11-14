# How ISS Ride-Along works

ISS Ride-Along is a web page that shows where the International Space Station is right now. The
position is computed in the visitor's own browser from the station's published orbit numbers, then
checked against an independent tracker: in the saved test, our position agreed with wheretheiss.at
to within 0.0003 km on 10 of 10 samples. The whole page builds into one HTML file that also opens
without internet.

Status (Sat Nov 14, 6:30 PM EST): the live tracker, the NASA layers, the "when can I see it" pass predictor and the
"Plan my sighting" planner (an AI agent, or a fixed plan with no key) are built. The game is planned and not built yet.

## In one minute

The station's orbit is published as a TLE (two-line element set: the orbit's size, tilt and position at one moment,
its epoch), replaced as fresh tracking data comes in. The page feeds it into SGP4, the standard model for these
numbers, which moves the orbit to the current second: latitude, longitude, altitude and speed every second, and the
path one orbit back and ahead. A button asks wheretheiss.at, a separate tracker, for the same second and shows the gap.

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
| Cloud for each pass hour, station news | fetched only when "Plan my sighting" is pressed | %, dates | Open-Meteo (no key), Exa web search (no key) |

There is no server and no account. The only key is one a visitor may type into the planner's settings.

## The NASA layers

- **The station's view.** Everything inside the circle sees the station above its horizon: on a round Earth of radius R,
  cos(angle) = R / (R + h), and the circle's ground radius is R times that angle. At 437.66 km it is 4,593.5 km
  across; wheretheiss.at gives 4,596 km (0.054% apart; within 0.059% on all 10 saved samples).
- **Satellite image.** GIBS's daily mosaic for yesterday (UTC) if its `Layer-Time-Actual` header confirms that day,
  else two days ago; the date is printed under the map.
- **Events.** Every EONET event reported in the last 30 days, no count limit (saved copy, Nov 14: 38 events, 25 US
  wildfires, 2 tropical cyclones, 11 sea ice). Older open events (7,244 open in all that day, the oldest last reported
  9,081 days earlier) are left out. Events inside the circle are listed; if none, the nearest one is named.
- **Photos.** Places set by hand from each title (the library has no coordinates); NASA-credited photos only; no
  NASA logo or insignia.

## When can I see it (visible passes)

- The page looks 5 days ahead for times when the station is at least 10° above your horizon, your sky
  is dark (Sun 6° or more below the horizon) and the station is in sunlight (satellite.js `shadowFraction`
  under 1): 20 s steps, each start and end narrowed to 0.5 s, peak by golden-section search; 5 days took 21 ms in Node.
- Against Heavens-Above's Ypsilanti list for Nov 14-18, saved by hand with the same TLE (`tests/passes.test.ts`): 8 of 8
  passes, starts within 1.3 s, ends within 4.8 s, peak within 0.6° (limits 5 s, 15 s, 3°). Far north or south (Alert,
  82.5° N) it says why the list is empty. Times are Ypsilanti's for Ypsilanti, otherwise the visitor's own time zone.

## Plan my sighting (the AI agent and the fixed plan)

- **Why an agent.** The pass table answers for one place. The box takes a week in your own words ("Ypsilanti until
  Monday, then Chicago Tuesday to Thursday, kids in bed by 8:30"). The model (Gemini, with an OpenAI adapter behind the
  same code) splits it into legs (one place, its nights), calls our tools and picks one pass. Tools: `findCity`, `planLeg`
  (our pass engine, the Open-Meteo cloud for the hour of each pass's peak, then the fixed score), `stationNews` (an Exa
  web search the model writes; we keep items from the last 7 days), `orbitDataAge`, `showPass` (only ids the engine returned).
- **The fixed rule** (both modes): a pass counts if it starts on your nights inside your times; score = (peak ÷ 90) ×
  (1 − cloud ÷ 100), unknown cloud = 50%; under 0.05 everywhere means "no pass worth going out for in your window".
- **Numbers.** Every number on the card is written by the engine. The audit checks each number in the model's words
  against the tools' texts and your sentence; anything else is marked "not from our engine". Web text never feeds a number.
- **Limits.** At most 6 model calls, 15 s per reply, 30 s per plan; a bad key, a rate limit or a timeout ends in the
  fixed plan with the reason named. No key: the button runs the fixed plan for the plain controls.
- **Measured** (Nov 14, 6:09-6:13 PM, `scripts/check-agent.mjs`, Gemini `gemini-4-hydrogen`): 3 of 3 one-place runs and
  1 trip run chose an allowed pass with 0 unverified numbers, in 7.2-11.0 s and 4 model calls each.

## What the reference check means

Both trackers run their own code on public orbit numbers, so a small difference shows our math is right; it does not
measure where the station truly is, and it grows when the two sides use TLEs of different ages.

- Saved test (`tests/position.test.ts`): 10 wheretheiss.at positions (Nov 14, 19:07 UTC) with the TLE they used.
  Largest differences: 0.0003 km position, 0.0020 km altitude, 0.0000 km/h speed (limits 2 km, 0.1 km, 1 km/h).
- Live check (`node scripts/check-live.mjs`, 2:28 PM EST Nov 14): 0.729 km both runs (our TLE was newer than
  theirs; on their own TLE, 0 km). The station moves 7.666 km/s, so 0.729 km is about a tenth of a second.

## Each tool in one line

- **SGP4 via satellite.js 7.2.0** (MIT licence): the standard orbit model for TLEs, comparable with other trackers.
- **CelesTrak**: a public website that redistributes the US Space Force's TLEs; one request per page load.
- **wheretheiss.at**: a free independent ISS tracker, used only as the reference to check against.
- **Leaflet 1.9.4** (BSD-2-Clause): a small map library that draws the 2D map, marker and lines.
- **NASA GIBS**: NASA's map tiles; Blue Marble built in, the daily MODIS Terra image fetched live.
- **NASA EONET**: NASA's list of open natural events (wildfires, storms, ice), as points with dates.
- **NASA Image and Video Library**: NASA's photo archive; the source of the curated astronaut photos.
- **Vite 8.3.8 + vite-plugin-singlefile 2.3.4**: build the site into one self-contained `index.html`.
- **Gemini API** (Google's AI models; `gemini-4-hydrogen`, `generateContent` endpoint): the planner's model, live-tested.
  The OpenAI Responses adapter is tested with saved replies, not live-tested.
- **Open-Meteo** (free weather service, CC BY 4.0) for cloud; **Exa** (a search engine built for AI) for station news.
- **TypeScript 7.0.2**: JavaScript with type checks; `npm run build` fails on a type error.
- **Vitest 5.1.0**: runs the 68 unit tests in a few seconds, with no network.
- **playwright-core 1.65.1**: drives the laptop's own Chrome for the screenshot and video scripts.

## Honest edges

- The built-in TLE is from CelesTrak, 12:36 PM EST Nov 14 (CelesTrak did not answer from our network later); a
  fresh copy arrives when a visitor's network reaches it, and the age label always says which copy is in use.
- Offline, the map is the built-in Blue Marble (sharp to zoom 2) and events are the dated saved copy. The daily image
  has gaps where the satellite did not pass. Open events are mostly US wildfires, so "none in view" is common.
- The planner's trip was run live once (Nov 14); that night both the agent and the fixed plan picked the same Ypsilanti
  pass. The case where they differ is shown by a test with a made-up cloud table (`tests/planner.test.ts`, test i).
- The speed shown is orbital speed (over the ground it is lower). On a phone the map does not follow the marker yet.

## How it was built

Built at Hack the Nest 2026 through Claude Code: Fable 5.2 planned, Opus 5.5 wrote the code, and Ahmed Sohail Butt
approved the plan and decides what is pushed. Not affiliated with or endorsed by NASA. Code tour: `CODE_TOUR.md`;
how to run everything: `RUN.md`.
