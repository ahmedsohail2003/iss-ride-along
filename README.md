# ISS Ride-Along

Built at Hack the Nest 2026 (Eastern Michigan University, Nov 14-15, 2026). Work in progress.

A web page that shows where the International Space Station is right now, computed in the browser
from public orbit data, and checks that position against an independent tracker. Later in the
weekend: what NASA data says the station is flying over, when you can see it from your city, and a
30-second guessing game.

**Not affiliated with or endorsed by NASA.**

## Run it

```
npm install
npm test         # unit tests (offline, uses the saved data in src/data/)
npm run dev      # local dev server
npm run build    # one self-contained file: dist/index.html (opens from file:// too)
npm run snapshot # refresh the saved data in src/data/ (needs the network)
```

Node 22 was used. `npm run snapshot` makes one request per source and never retries.

Checks (they use the Chrome already installed on the machine through playwright-core; no browser download):

```
node scripts/smoke.mjs        # opens dist/index.html from file:// in headless Chrome, saves evidence/m1.png
node scripts/check-live.mjs   # our position for "now" vs wheretheiss.at (prints SKIPPED offline without network)
node scripts/record-demo.mjs  # backup demo capture -> docs/demo-backup.mp4 (needs ffmpeg; runs on AC power)
```

## What works so far

- A world map with the station's position, moved every second, and its path over the last orbit
  (solid) and the next orbit (dashed).
- Latitude, longitude, altitude (km) and orbital speed (km/h; the speed through space, not over the ground).
- An "orbit data age" label: green under 1 day old, amber 1-3 days, red over 3 days.
- Orbit elements: one CelesTrak fetch per page load (skipped if this device saved a copy in the last
  2 hours), else the copy saved on the device, else the copy built into the page. The newest wins.
- "Check against reference": one request to wheretheiss.at, then the distance between its position
  and ours for the same second. Both run their own code on public orbit data, so this checks our
  math, not the station's true position.
- "Plan my sighting": type your week in your own words ("Ypsilanti until Monday, then Chicago Tuesday
  to Thursday, kids in bed by 8:30"). An AI agent splits it into places and nights, runs our pass engine,
  the Open-Meteo cloud forecast and an Exa web search for station news, and picks the one pass worth going
  out for; the map moves to it and a countdown starts. Every step is listed on the page, and every number
  in the AI's words is checked against what our tools returned. Without a key, the same button runs a
  fixed plan (no AI) for one place.
- "Our math vs NASA's own trajectory": NASA Johnson Space Center publishes the station's predicted
  position every 4 minutes for 15 days from its own orbit model. The page shows how far apart our
  position and NASA's are at NASA's latest row time, how old our orbit numbers were then, the gap
  measured for that age, and a chart of the next 3 days. Measured with `node scripts/check-oem.mjs`
  on one set of orbit numbers: 0.485 km apart at their epoch, 0.870 km at 24 h, 1.767 km at 36 h,
  4.763 km at 72 h (26 to 45 km if the frame conversion is switched off). NASA's file is a
  prediction too, so this is a distance between two predictions, not a measured error.
- `npm test` compares our position, altitude and speed with 10 saved wheretheiss.at samples,
  propagated from the same element set that tracker used (limits: 2 km, 0.1 km, 1 km/h).

## Data used so far (saved in `src/data/`, sources and retrieval times in `snapshot-meta.json`)

| File | What it is | Source |
|---|---|---|
| `iss.tle`, `iss.omm.json` | the station's orbit elements (NORAD 25544) | CelesTrak (US Space Force data, distributed by CelesTrak; not NASA) |
| `wheretheiss-samples.json` | 10 reference positions and the orbit elements that tracker used | wheretheiss.at (an independent implementation of the same public orbit data; not NASA, not a measurement) |
| `bluemarble-z0.jpg` | one world map tile for the offline base map | NASA EOSDIS GIBS, Blue Marble Shaded Relief and Bathymetry |
| `cities.json` | the 150 largest populated places by population | Natural Earth (public domain) |
| `iss-oem.json` | NASA's predicted ISS positions (J2000), Nov 14 11:52 to Nov 18 23:48 UTC | ISS trajectory ephemeris (OEM), NASA Johnson Space Center, Flight Operations Directorate (originator NASA/JSC/FOD/TOPO), file created 2026-11-13 15:58 UTC. A prediction from NASA's model, not a measurement. |
| `oem-agreement.json` | the gap by age of the orbit numbers, from `scripts/check-oem.mjs` | computed by us from the file above |

The orbit elements in this commit were fetched from CelesTrak at 12:36 PM EST on Nov 14 (inside
the hackathon window); CelesTrak could not be reached when the snapshot ran at 2:07 PM, so the
snapshot used that earlier fetch and says so in `snapshot-meta.json`.

## Built with

- [satellite.js](https://github.com/shashwatak/satellite-js) 7.2.0 (MIT): SGP4 orbit propagation, the standard model for these orbit elements.
- [Leaflet](https://leafletjs.com/) 1.9.4 (BSD-2-Clause): the 2D map.
- [Vite](https://vite.dev/) 8.3.8 and vite-plugin-singlefile 2.3.4: build the page into one HTML file.
- [Vitest](https://vitest.dev/) 5.1.0: the unit tests.
- [ERFA](https://github.com/liberfa/erfa) (BSD 3-clause, derived from the IAU SOFA library): the 106-term IAU 1980
  nutation table in `src/orbit/nut80-table.ts`, copied by script; its notice is in `docs/THIRD_PARTY_NOTICES.md`.
- [astronomy-engine](https://github.com/cosinekitty/astronomy) 2.1.19 (MIT): used only in `tests/oem.test.ts`, as an
  independent second frame conversion.
- Frame conversion formulas: Vallado, Crawford, Hujsak and Kelso 2006, "Revisiting Spacetrack Report #3",
  AIAA 2006-6753, Appendix C (its printed example is one of the tests).

## AI in the app

The planner is an agent: the model chooses which of our tools to run, step by step, and can only pick
among pass ids our engine returned; the card's numbers are written by our engine, not the model.

- Gemini (`gemini-4-hydrogen`, `generateContent` endpoint): live-tested on Nov 14, 2026, 6:09-6:13 PM EST
  (3 one-place runs and 1 two-city trip run, each 4 model calls, 7.2-11.0 s, 0 unverified numbers).
- OpenAI (Responses API): the same adapter, tested with saved replies written from OpenAI's documentation, not live-tested.
- Exa search: live-tested without a key; the keyed call is not live-tested.
- Keys are typed into the page's settings by the person using it, kept in memory (or in this tab's
  storage until it closes, if ticked), and never put in the repo, the address bar or a log.

## How we used AI to build it

Built through Claude Code: Fable 5.2 planned, Opus 5.5 wrote the code. Ahmed Sohail Butt approved
the plan and reviews every change before it is pushed. What each teammate did is listed in the
submission once it is done.

## Provenance

All code in this repository was written during Hack the Nest 2026, starting after hacking began at
12:00 PM EST on Sat Nov 14, 2026. `src/orbit/orbit.ts` and `tests/orbit.test.ts` are ported from a
feasibility spike written between 12:35 and 12:40 PM that day for this project. No code from earlier projects is
reused. Third-party code comes only from the open-source packages listed above, plus the ERFA nutation table.

## License

MIT, see `LICENSE`.
