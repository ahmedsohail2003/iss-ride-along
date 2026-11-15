# ISS Ride-Along

Built at Hack the Nest 2026 (Eastern Michigan University, Nov 14-15, 2026).

**In one paragraph.** Tell the page where you will be this week and when you are free, in your own
words, and it plans the one International Space Station pass worth going outside for, then moves the
map to it and starts a countdown. Everything it shows is computed in your browser from public orbit
data, and every number carries its source: where the station is right now, what NASA data says it is
flying over, when you can see it from a city, and how far our math is from NASA mission control's
own trajectory file. Live page: https://ahmedsohail2003.github.io/iss-ride-along/

**Not affiliated with or endorsed by NASA.**

## The user and the problem

The International Space Station passes over most places several times a week, but you see it only if
you are in the dark, it is still in sunlight, the sky is clear and you look the right way at the
right minute. Pass apps tell you when it flies over. You still have to match that to your week, your
sky and where you will be. ISS Ride-Along does that, and shows where every number came from. It is
for a parent, a teacher or a first-time stargazer, starting with us in Michigan in November.

## What it does (each part below passed a separate verification run; see `docs/VERIFICATION.md`)

- **Where it is now.** The station's latitude, longitude, altitude and speed, recomputed every second
  and drawn on a world map with the last orbit (solid) and the next one (dashed). The orbit comes from
  a TLE ("two-line element set", the public description of an orbit) run through SGP4, the standard
  model for TLEs. A label shows how old the orbit data is.
- **Check against reference.** One button asks an independent tracker, wheretheiss.at, where the
  station is, and prints the distance from our answer for the same second. Both use public orbit
  data, so this checks our math, not the station's true position.
- **What it is flying over.** The daily NASA satellite image under the station with its date (NASA
  GIBS), NASA's list of open natural events reported in the last 30 days that fall inside the area
  the station can see (NASA EONET), and one of 12 astronaut photos chosen by hand (NASA Image and
  Video Library) whose place is in view, or the nearest one, labelled as not in view. Each is credited
  on the page.
- **When can I see it?** Every visible pass for the next 5 days for a city or typed coordinates.
- **Plan my sighting.** Type a week in your own words ("Ypsilanti until Monday, then Chicago Tuesday
  to Thursday, kids in bed by 8:30"). An AI agent splits it into places and nights, runs our pass
  engine and the Open-Meteo cloud forecast for each, searches the web for station news through Exa,
  and picks one pass. Every step is listed on the page. Without a key, the same button runs a fixed
  plan (no AI) for one place.
- **Our math vs NASA's own trajectory.** NASA Johnson Space Center publishes the station's predicted
  position every 4 minutes for 15 days. The page shows how far apart our position and NASA's are at
  NASA's latest row, how old our orbit numbers were then, and a 3-day chart.

Still being built at the time of writing (Sat Nov 14, 7:30 PM EST), so not listed above: a first
screen built around the planner, a calendar file for the chosen pass, day and night on the map, a
30-second guessing game, and a plain sentence for where the station is.

## How it works, and how we know the numbers are right

The hard part of a tracker is not drawing a dot; it is knowing the dot is right. So each layer was
checked against something we did not write:

1. **Position.** Against 10 positions saved from wheretheiss.at, using the same TLE that tracker
   used, our largest differences were 0.0003 km in position, 0.0020 km in altitude and 0.0000 km/h
   in speed (10 of 10 samples). Live, with our newer TLE, the gap was 0.774 km at 7:19 PM EST Nov 14.
2. **Passes.** For Ypsilanti, our list matched 8 of the 8 passes Heavens-Above lists for Nov 14-18,
   with the worst start time 1.3 s off (one city, one saved list, the same orbit data).
3. **NASA's trajectory.** NASA's file is in a different reference frame (J2000) from SGP4's output
   (TEME), so we wrote the conversion (IAU 1976 precession and the 106-term IAU 1980 nutation) and
   tested it against the printed example in Vallado et al. 2006 (0.82 m off). On one set of orbit
   numbers our position and NASA's were 0.485 km apart at the epoch, 0.870 km after 24 h, 1.767 km
   after 36 h and 4.763 km after 72 h; with the conversion switched off they were 26 to 45 km apart
   (360 rows within 12 h of the epoch). NASA's file is a prediction too, so this is a distance
   between two predictions, not a measured error.
4. **The agent cannot invent numbers.** It can only choose among pass ids our engine returned, the
   result card is written by our engine, and every number in the model's own words is checked
   against what our tools returned ("audit: 0 unverified numbers" in every live run so far).

Therefore: the page shows its own measured error next to each answer instead of asking to be trusted.

## AI in the app

The planner is an agent: the model chooses which of our tools to run, step by step (find the place,
plan each part of the trip, search the news, show a pass), and our code runs them.

- **Gemini** (`gemini-4-hydrogen`, `generateContent` endpoint): live-tested on Nov 14, 2026,
  6:09-6:23 PM EST: 5 runs (3 one-place, 2 two-city trips), 4 model calls each, 7.2-13.2 s,
  0 unverified numbers, every chosen pass inside the user's rules.
- **OpenAI** (Responses API): the same adapter, tested with saved replies written from OpenAI's
  documentation, not live-tested.
- **Exa search**: live-tested without a key; the keyed call is not live-tested.
- Keys are typed into the page's settings by the person using it, kept in memory (or in this tab's
  storage until it closes, if ticked), and never put in the repo, the address bar or a log.
- What only the agent does is shown by a test, not yet by a live run: for the Ypsilanti-then-Chicago
  week (saved replies) the agent picks a Chicago pass on a Chicago night, while the fixed plan at its
  defaults picks an Ypsilanti pass on a night the user is in Chicago (`tests/planner.test.ts`,
  test (i)). In both live trip runs, that evening's real clouds made the
  agent and the fixed plan choose the same pass.

## AI used to build it

Built through Claude Code (Anthropic's coding tool; the Fable 5.2 model planned, the Opus 5.5 model
wrote the code), directed by Ahmed Sohail Butt, who chose the idea with the team, approved the plan
and decides what is pushed. Every part had to pass checks that do not trust the AI: tests against
outside data, a separate verification run for each milestone (`docs/VERIFICATION.md`), and a test run
on every push before the live page updates.

## How we test

[![Publish the live page](https://github.com/ahmedsohail2003/iss-ride-along/actions/workflows/pages.yml/badge.svg)](https://github.com/ahmedsohail2003/iss-ride-along/actions/workflows/pages.yml)

Every push to `main` runs `.github/workflows/pages.yml` (GitHub Actions, GitHub's automatic build):
`npm test`, then the docs check, then a secret scan, then the build; the live page is published only
if all of them pass. Latest local results, Sat Nov 14, 2026 (EST):

| Command | What it checks | Latest result |
|---|---|---|
| `npm test` | Vitest unit tests, offline, on saved data: position, passes, footprint, NASA data parsing, the planner (fixed and AI, with saved replies), the NASA trajectory conversion | 78 of 78 passed, 9 files (7:19 PM) |
| `npx tsc --noEmit` | the TypeScript compiler in strict mode (`"strict": true` in `tsconfig.json`) over `src/` | 0 errors (7:24 PM) |
| `node scripts/check-docs.mjs` | every file and function named in `CODE_TOUR.md` exists; every command in `RUN.md` and in this section exists; the NASA gap is worded as a distance apart, never as accuracy | DOCS PASS (7:24 PM) |
| `node scripts/check-live.mjs` | our position for "now" vs wheretheiss.at (needs the network) | 0.774 km, under the 2 km limit (7:19 PM) |
| `node scripts/check-oem.mjs` | our position vs NASA's trajectory file at 0, 12, 24, 36 and 72 h, and with the conversion off | 0.485 / 0.308 / 0.870 / 1.767 / 4.763 km; off: 26.10-45.19 km (7:19 PM) |
| `node scripts/smoke.mjs` | opens the built page in headless Chrome (Playwright drives it), network mocked: the dot moves, both orbit lines, the NASA panel, 0 console errors | SMOKE PASS (7:20 PM) |
| `node scripts/check-agent.mjs --provider gemini` | the planner against the real Gemini API (key from the environment, never printed) | 1 trip run, 13.2 s, 4 model calls, audit 0 (6:23 PM) |
| secret scan (a `git grep` step in `.github/workflows/pages.yml`) | no tracked file holds text shaped like a Google, OpenAI or GitHub key, a NASA demo key, a key assignment, or a key header or `Bearer` line with a value | no hits (7:24 PM) |

The commands, their options and what to do when one fails are in `RUN.md`.

## Who did what

Team: Ahmed Sohail Butt, Quinn Favre, Denim Yadav and Armeis. Ahmed directed the build (see "AI used
to build it"). Each teammate's own sentence is added here once they have confirmed it.

## Data and credits (saved copies in `src/data/`; sources and retrieval times in `snapshot-meta.json`)

| Source | What we use | Note |
|---|---|---|
| CelesTrak | the station's orbit elements (NORAD 25544) | US Space Force tracking data, distributed by CelesTrak; not NASA |
| wheretheiss.at | reference positions for the check button and the tests | an independent tracker on the same public data; not NASA, not a measurement |
| NASA EOSDIS GIBS | the daily MODIS Terra image and the built-in Blue Marble map | "We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS)." |
| NASA EONET | open natural events reported in the last 30 days | |
| NASA Image and Video Library | 12 astronaut photos, each with its NASA ID and credit | photo places set by hand from each title (approximate) |
| NASA Johnson Space Center | the ISS trajectory file (OEM, J2000), created 2026-11-13 15:58 UTC | a prediction from NASA's model, not a measurement |
| Heavens-Above | one pass list for Ypsilanti, saved by hand to check ours | used in a test only |
| Open-Meteo | the cloud forecast and the place search the planner uses | fetched when you plan |
| Exa | the web search for station news | results filtered to the last 7 days in our code; not checked by us |
| Natural Earth | the 150 largest populated places | public domain |

The orbit elements built into the page were fetched from CelesTrak at 12:36 PM EST on Nov 14
(inside the hackathon window); CelesTrak could not be reached from our network later that afternoon,
so the page falls back to that copy and its age label says so.

## Built with

- TypeScript (strict mode) and [Vite](https://vite.dev/) 8.3.8 with vite-plugin-singlefile 2.3.4:
  the page builds into one HTML file that also opens from `file://`.
- [satellite.js](https://github.com/shashwatak/satellite-js) 7.2.0: SGP4 orbit propagation.
- [Leaflet](https://leafletjs.com/) 1.9.4: the 2D map.
- [Vitest](https://vitest.dev/) 5.1.0: the unit tests. playwright-core 1.65.1: drives the Chrome
  already on the machine for the smoke test (no browser download).
- [astronomy-engine](https://github.com/cosinekitty/astronomy) 2.1.19: used only in
  `tests/oem.test.ts`, as an independent second frame conversion.
- Frame conversion formulas: Vallado, Crawford, Hujsak and Kelso 2006, "Revisiting Spacetrack Report
  #3", AIAA 2006-6753, Appendix C (its printed example is one of the tests).
- GitHub Actions and GitHub Pages: the test run on every push and the live page.

## Run it

```
npm install
npm test         # unit tests (offline, uses the saved data in src/data/)
npm run dev      # local dev server
npm run build    # type check + one self-contained file: dist/index.html
```

Node 22 was used. More commands, and how to read each check, are in `RUN.md`. For people presenting
or reading the code: `HOW_IT_WORKS.md` (what is computed and what is fetched) and `CODE_TOUR.md`
(where each part lives).

## Known limits

- The agent-vs-form difference rests on a test, not on a live run (see "AI in the app").
- OpenAI and keyed Exa calls are not live-tested.
- When CelesTrak cannot be reached, the page runs on older orbit numbers; the gap to NASA's
  trajectory grows with their age (table above), and the page prints the age.
- The offline file `docs/iss-ride-along-offline.html` is not rebuilt after every change.

## THIRD_PARTY_NOTICES

- Leaflet 1.9.4: BSD 2-Clause License, Copyright (c) 2010-2023 Volodymyr Agafonkin, (c) 2010-2011
  CloudMade. Bundled into the built page.
- satellite.js 7.2.0: MIT License, Copyright (C) 2013 Shashwat Kandadai, UCSC Jack Baskin School of
  Engineering. Bundled into the built page.
- Natural Earth: public domain (the city list in `src/data/cities.json`).
- ERFA (the 106-term IAU 1980 nutation table in `src/orbit/nut80-table.ts`, copied by script): BSD
  3-Clause, derived from the IAU SOFA library.
- astronomy-engine 2.1.19: MIT License; tests only, not in the built page.

The full licence texts for the bundled code are in `docs/THIRD_PARTY_NOTICES.md`.

## Provenance

All code in this repository was written during Hack the Nest 2026, starting after hacking began at
12:00 PM EST on Sat Nov 14, 2026. `src/orbit/orbit.ts` and `tests/orbit.test.ts` are ported from a
feasibility spike written between 12:35 and 12:40 PM that day for this project. No code from earlier
projects is reused. Third-party code comes only from the open-source packages listed above, plus the
ERFA nutation table.

## License

MIT, see `LICENSE`.
