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

## Data used so far (saved in `src/data/`, sources and retrieval times in `snapshot-meta.json`)

| File | What it is | Source |
|---|---|---|
| `iss.tle`, `iss.omm.json` | the station's orbit elements (NORAD 25544) | CelesTrak (US Space Force data, distributed by CelesTrak; not NASA) |
| `wheretheiss-samples.json` | 10 reference positions and the orbit elements that tracker used | wheretheiss.at (an independent implementation of the same public orbit data; not NASA, not a measurement) |
| `bluemarble-z0.jpg` | one world map tile for the offline base map | NASA EOSDIS GIBS, Blue Marble Shaded Relief and Bathymetry |
| `cities.json` | the 150 largest populated places by population | Natural Earth (public domain) |

The orbit elements in this commit were fetched from CelesTrak at 12:36 PM EST on Nov 14 (inside
the hackathon window); CelesTrak could not be reached when the snapshot ran at 2:07 PM, so the
snapshot used that earlier fetch and says so in `snapshot-meta.json`.

## Built with

- [satellite.js](https://github.com/shashwatak/satellite-js) 7.2.0 (MIT): SGP4 orbit propagation, the standard model for these orbit elements.
- [Leaflet](https://leafletjs.com/) 1.9.4 (BSD-2-Clause): the 2D map.
- [Vite](https://vite.dev/) 8.3.8 and vite-plugin-singlefile 2.3.4: build the page into one HTML file.
- [Vitest](https://vitest.dev/) 5.1.0: the unit tests.

## How we used AI

Built through Claude Code: Fable 5.2 planned, Opus 5.5 wrote the code. Ahmed Sohail Butt approved
the plan and reviews every change before it is pushed. What each teammate did is listed in the
submission once it is done.

## Provenance

All code in this repository was written during Hack the Nest 2026, starting after hacking began at
12:00 PM EST on Sat Nov 14, 2026. `src/orbit/orbit.ts` and `tests/orbit.test.ts` are ported from a
feasibility spike written between 12:35 and 12:40 PM that day for this project. No code from earlier projects is
reused. Third-party code comes only from the open-source packages listed above.

## License

MIT, see `LICENSE`.
