<!--
DRAFT for MLH's DEV Writing Challenge. NOT PUBLISHED. Publishing waits for a human (Ahmed or a teammate,
Mon Nov 16 or later). Before publishing: read it all; change "we" lines that are not true for you; add
your own sentence under "Who we are" or leave the names only; keep "published: false" until you press
Publish on DEV yourself. Paste from the first "---" line down. This file is checked by
`node scripts/check-docs.mjs`: every number in it must appear in the build log's evidence, and it may
name only parts that passed their verification run.
-->
---
title: How we checked our ISS tracker against NASA mission control's own trajectory file
published: false
description: A public orbit model, NASA's predicted trajectory, the coordinate-frame trap in between, and how far apart the two really are.
tags: mlhacks, space, javascript, testing
---

**In one paragraph.** At Hack the Nest 2026 (an MLH event at Eastern Michigan University, Nov 14-15, 2026)
our team built ISS Ride-Along, a web page that shows where the International Space Station is and plans
the one pass worth going outside for. This post is about the part we are proudest of: checking the
page's orbit math against the station trajectory that NASA's Johnson Space Center publishes. Within 12
hours of the timestamp on our orbit numbers, our position and NASA's were 0.37 km apart in the middle and
1.03 km apart at most, over 360 of NASA's 4-minute rows. When our orbit numbers were 3 days old, the two
were 4.76 km apart. Without one coordinate conversion they were 26 to 45 km apart. NASA's file is also a
prediction, so these are distances between two predictions, not errors against the truth. If you have
ever wondered how to check a satellite tracker, this is a method you can copy.

## Who wrote the code (read this first)

The code was written by Claude Code, Anthropic's AI coding tool (the Fable 5.2 model planned, the Opus 5.5
model wrote the code), directed by our teammate Ahmed Sohail Butt, who chose the idea with the team,
approved the plan and decided what was pushed. Every part had to pass checks that do not trust the AI:
tests against outside data, and a separate verification run for each part, started fresh, that re-ran
the checks itself before anything counted as done. This post was also drafted by Claude (Opus 5.5) from
the project's own documents and test output, and read by the person who published it.

## The problem: a dot on a map proves nothing

Any tracker can draw a dot. The hard part is knowing the dot is in the right place.

A few words first:

- **TLE** (two-line element set): the public description of an orbit. It gives the orbit's size, tilt
  and position at one moment, called its **epoch**. The station's TLEs come from US Space Force tracking
  and are redistributed by CelesTrak.
- **SGP4**: the standard model that takes a TLE and moves the orbit forward to any second. Our page runs
  it in the browser with satellite.js, an open-source SGP4 library.

The usual check is to compare with another tracker. We did that too: against 10 positions saved from
wheretheiss.at, using the same TLE they used, our largest difference was 0.0003 km (10 of 10 samples).
But both trackers run SGP4 on the same public numbers. A tiny difference shows that the math was copied
correctly. It says nothing about where the station really is, because both could share the same blind
spot.

We wanted something that does not run our model.

## NASA's own trajectory file

NASA's Johnson Space Center publishes the station's predicted position and velocity every 4 minutes for
the next 15 days, as a plain text file in a standard format called OEM (Orbit Ephemeris Message):
[ISS.OEM_J2K_EPH.txt](https://nasa-public-data.s3.amazonaws.com/iss-coords/current/ISS_OEM/ISS.OEM_J2K_EPH.txt).
The copy we saved has 5,403 rows, was created on 2026-11-13 at 15:58 UTC, and names its originator as
NASA/JSC/FOD/TOPO, the flight operations team. It comes from NASA's own, more detailed orbit model, not
from SGP4. That makes it a fair outside check.

Two details mattered:

- The file is a **prediction** too. So the page says how far "apart" our position and NASA's are, and
  never calls that number accuracy. A docs check (`scripts/check-docs.mjs`) fails our build if the
  wrong wording shows up next to this number.
- NASA's server sends no header that lets a browser download the file from another site, so the page
  carries a saved copy (the rows from Nov 14 11:52 to Nov 18 23:48 UTC) instead of fetching it live.

## The trap: compare directly and miss by 26 to 45 km

The obvious comparison is to run SGP4 at the exact time of each NASA row and measure the distance. Our
tests keep that version as a control. Over the 360 rows within 12 hours of the TLE's epoch, it misses
by 26.10 km at least, 36.95 km in the middle and 45.19 km at most.

That is far too much for two good models of the same station a few hours apart. The cause was not the
orbit. It was the **coordinate frame**: the set of axes the numbers are written in.

- SGP4 gives positions in a frame called **TEME**, tied to where Earth's axis points on that date.
- NASA's file uses **J2000** (written EME2000 in the file), tied to where Earth's axis pointed at the
  start of the year 2000.

Earth's axis slowly wobbles and drifts, so the two sets of axes are turned slightly against each other.
At the station's distance from Earth's centre, that small turn is tens of kilometres.

## The fix: convert the frames, then compare

The conversion from TEME to J2000 has three parts:

- **Precession** (IAU 1976): the slow drift of Earth's axis over the years since 2000.
- **Nutation** (IAU 1980): the smaller nodding of the axis. We used all 106 terms of the standard
  table, copied by a script from ERFA, the open-source version of the International Astronomical
  Union's SOFA library, not typed by hand.
- **The equation of the equinoxes**: a small correction that links the two.

The formulas come from Vallado, Crawford, Hujsak and Kelso, "Revisiting Spacetrack Report #3" (2006),
and the code cites them (`src/orbit/frames.ts`).

One more rule: compare only at NASA's own row times. The station moves 7.666 km every second, about
1,840 km between two rows, so averaging between rows would add an error as large as the gap we wanted
to measure. Our code runs SGP4 at each row's exact time instead (`src/orbit/oemCompare.ts`).

With the conversion, over the same 360 rows: **0.368 km apart in the middle, 1.031 km at most.**

## How we know the conversion itself is right

This step holds the main lesson. Two easy checks could not catch a wrong nutation term:

- Converting TEME to J2000 and back returns the input within 1 mm. That only proves the two directions
  match each other.
- "Under 2 km from NASA" is too loose. One wrong term moves the answer by metres, and that still passes.

So the conversion is checked against things we did not write (`tests/oem.test.ts`):

1. **A printed worked example.** The 2006 paper prints a J2000 position for one test satellite (TLE
   00005, its equation C-3). Our conversion lands 0.82 m from it (limit 1 m, all 106 terms). With the
   nutation turned off, the same check misses by 169.5 m, so the check really can see nutation. (We
   first planned to use the paper's other example, at 2004-04-06 07:51:28 UTC, but that one prints only
   TEME and Earth-fixed vectors, not J2000. Read the paper before you plan around it.)
2. **A second library.** astronomy-engine 2.1.19, an independent astronomy library installed for tests
   only, agrees within 1.89 to 2.61 m at 5 times (limit 50 m).

Then we broke the code on purpose. Flipping the sign of one nutation term (term 9) made the paper check
fail, as it should. But the second-library check (9.9 to 12.9 m, still under 50 m) and the NASA check
both still passed. So only the strictest check guards the conversion, and it is the one that comes from
outside the code. That is the main lesson of this post: **a check only counts if it can fail on the
mistake you are worried about.** Break the code once and see which checks notice.

## The gap grows as the orbit numbers age

A TLE is a snapshot of the orbit at its epoch. The simple model that carries it forward drifts as the
snapshot gets older. Measured on one set of orbit numbers (`scripts/check-oem.mjs`):

| Age of our orbit numbers | Our position vs NASA's |
|---|---|
| at the epoch | 0.485 km apart |
| 12 hours | 0.308 km |
| 24 hours | 0.870 km |
| 36 hours | 1.767 km |
| 72 hours | 4.763 km |

We measured how fast the gap grows, not exactly why. It is not even smooth in the first hours (it is
smaller at 12 hours than at the epoch), and we did not dig into that.

What the page does with it:

- It shows the gap at NASA's latest row time and the age of the orbit numbers it is using, counted
  from their epoch, not from when they were downloaded.
- Under it, the measured line for that age from the table above, labelled as measured on one set of
  orbit numbers.
- The AI sighting planner quotes the same measured line when it plans a pass several days away, so a
  person can see how far to trust a pass time before driving somewhere for it.

## How to check your own tracker

1. Compare against a source that does not run your model. Another SGP4 tracker checks your math, not
   your position.
2. Find out which frame each side uses before comparing anything. A 26 to 45 km miss is a frame
   problem, not an orbit problem.
3. Compare at the reference's own timestamps. Do not interpolate fast-moving positions.
4. Check the conversion against a printed worked example, and plant a mistake to prove the check can
   catch it.
5. Always print the age of your orbit numbers next to the gap. The same code gives 0.3 km or 4.8 km
   depending on that age.
6. Call it a distance between two predictions unless your reference is a measurement.

## Honest edges

- The table comes from one set of orbit numbers (epoch 2026-11-14 04:10 UTC). Another set may give
  other numbers.
- NASA's file is a prediction from NASA's model. Being close to it is evidence, not proof, of where the
  station is.
- The orbit numbers built into the page are from Nov 14. When CelesTrak can be reached the page fetches
  newer ones, and its age label always says which copy is in use.
- The 0.82 m left over against the paper's example matches the small daily nutation correction the
  paper includes and we leave out. A probe that added it matched the paper to 5 mm, but that correction
  was fitted to the answer, so it is evidence of the cause, not a second test.

## The rest of the project

The NASA check is one card on the page. The rest, each part checked by its own verification run: the
live position with the last and next orbit; NASA imagery, natural events and astronaut photos for
what the station is flying over; every visible pass for a city over the next 5 days (8 of 8 matched
Heavens-Above's list for Ypsilanti, start times within 1.3 s); an AI sighting planner that takes a
week in plain words and can only choose among passes our own engine computed; day and night on the
map; a calendar file; a game; the sky from the station; a 3D globe; and 193 automated tests that run
on every push before the live page updates.

- Live page: https://ahmedsohail2003.github.io/iss-ride-along/
- Code: https://github.com/ahmedsohail2003/iss-ride-along (the code tour is `CODE_TOUR.md`; the NASA
  check is `src/orbit/oemCompare.ts` and `tests/oem.test.ts`)

## Who we are

Ahmed Sohail Butt, Quinn Favre, Denim Yadav and Armeis, at Hack the Nest 2026. For three of the four of
us it was a first hackathon.

## Credits

- Orbit elements: CelesTrak (US Space Force tracking data, redistributed by CelesTrak; not NASA).
- ISS trajectory ephemeris (OEM): NASA Johnson Space Center, Flight Operations Directorate (originator
  NASA/JSC/FOD/TOPO), file created 2026-11-13 15:58 UTC. A prediction from NASA's model, not a
  measurement.
- Reference tracker: wheretheiss.at (an independent tracker on the same public data; not NASA).
- Frame conversion: Vallado, Crawford, Hujsak and Kelso 2006, "Revisiting Spacetrack Report #3", AIAA
  2006-6753, Appendix C ([PDF](https://celestrak.org/publications/AIAA/2006-6753/AIAA-2006-6753-Rev3.pdf)).
- Nutation table: ERFA (BSD 3-Clause), derived from the IAU SOFA library
  ([liberfa/erfa](https://github.com/liberfa/erfa)).
- Code libraries: satellite.js 7.2.0 (MIT) for SGP4; astronomy-engine 2.1.19 (MIT) in the tests only.
- The page's other sources (NASA GIBS, NASA EONET, NASA Image and Video Library, Heavens-Above,
  Open-Meteo, Exa, Natural Earth, d3-celestial) are credited on the page and in the README.

Not affiliated with or endorsed by NASA.

#mlhacks
