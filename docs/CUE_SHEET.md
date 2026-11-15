# Cue sheet (print this page, one per person)

**Demo from this address:** https://ahmedsohail2003.github.io/iss-ride-along/?view=3d
Spare (the flat page): https://ahmedsohail2003.github.io/iss-ride-along/?view=flat

**ISS Ride-Along:** tell it your week in your own words, and it plans the one space-station pass worth going outside for, and shows where every number came from.

Final version, Sun Nov 15, 5:15 AM EST, the 3D refresh (before it: 12:30 AM; version 1: Sat 7:59 PM). New on the first screen; the spoken lines and clicks are unchanged:

- **The globe** in the map's place: the station, its orbits, the night side, from the same orbit math.
- **The dark look:** black page, white type, a "3D globe" badge.
- **The "3D / Flat page" switch** (`#view-3d`, `#view-flat`): the flat page is one press away.
- **The scroll story below the tool** (`#story`): six scenes that turn the globe as you scroll.
- **Optional: the Photo / Dots switch** on the globe (`#style-photo`, `#style-dots`); nothing in the script changes.
- **New type and cards:** the type and the cards were restyled at about 9:40 AM; every click and line is unchanged.
- **Space scene and calmer cards:** a dotted space scene behind the 3D page moves with the mouse (background art, not data); two notes fold under "About these numbers" and "How this is checked". Every click and line is unchanged.
 Full plan: [PRESENTING.md](PRESENTING.md). Answers to judge questions: [PRESENTER_PACK.md](PRESENTER_PACK.md).

## The three numbers (say what each one counts)

| Say | What it measures | Where it comes from |
|---|---|---|
| **7 of 7 finished AI runs, 0 made-up numbers** | Eight real planner runs on Gemini: 5 on Nov 14, 3 at 12:15-12:18 AM Sunday. The AI finished 7; after each, the audit read its sentences and found 0 numbers that no tool of ours gave. The eighth (a trip) got no AI reply within 15 seconds and ended in the fixed plan, as built. | `README.md`, "AI in the app" |
| **1.03 km apart at most, over 360 of NASA's rows** | How far our computed position is from the trajectory NASA mission control publishes, at every row within 12 hours of our orbit numbers' timestamp (0.37 km in the middle). Without our coordinate conversion: 26 to 45 km. | `node scripts/check-oem.mjs` |
| **8 of 8 passes, start times within 1.3 seconds** | For Ypsilanti, Nov 14-18, our list of visible passes against every pass on Heavens-Above's saved list. | `tests/passes.test.ts` |

If a judge asks "so how accurate are you?": "About a kilometre from NASA's own prediction when our orbit numbers are under a day old. For scale, the station moves 7.67 km every second." NASA's file is a prediction too, so say **apart**, never "accurate to".

**The gap grows as our orbit numbers age** (quote this table, not the live panel, which changes):

| Age of our orbit numbers | fresh | 12 h | 24 h | 36 h | 72 h |
|---|---|---|---|---|---|
| Gap to NASA's trajectory | 0.485 km | 0.308 km | 0.870 km | 1.767 km | 4.763 km |

## The 2-minute demo (four beats; who speaks is a proposal until the 9:30 AM pick)

| Time | Who | Do | Say (short form; full words in PRESENTING.md) |
|---|---|---|---|
| 0:00-0:35 | Denim | Press the trip example "Ypsilanti until Monday...", then "Plan my sighting" (`#plan-go`), first thing; the globe turns to the chosen pass | "Pass apps tell you when it flies over one place..." Read the Steps (`#plan-trace`) as they fill in. |
| 0:35-1:15 | Denim, then Quinn | Point at the audit badge (`#plan-audit`), then the NASA panel (`#oem-panel`), then press "Check against reference" (`#check-ref`) | Audit: "anything the AI made up would be marked." NASA: read the gap and the age on the panel; "1.03 km at most within 12 hours." |
| 1:15-1:35 | Armeis | Point at the shaded night side, then tick "Daily satellite photo (with clouds)" (`#daily-toggle`), point at its date (`#gibs-date`), untick it (the page changes to the flat map when you tick it; that is meant to happen); then the events (`#events-list`), the photo (`#photo-card`), the credits (`#credits`) | "The clear map is NASA's Blue Marble; the shaded half is night. This switch shows NASA's photo of the day. Under the station: NASA's open natural events, an astronaut photo." |
| 1:35-2:00 | everyone | Hands off the laptop | Who built it and how; one line each from your own "What I learned" box. Then: "What would you like to see?" |

Live trip runs took 11.0, 13.2 and 15.4 seconds (4 AI calls each). If the run is cut off (the limit is now 2 minutes), say "that is the plan for one city without AI" and go on to beat 2.

## The honest line (say it without looking)

"Ahmed directed an AI coding tool, Claude Code, which wrote the code. Every part had to pass tests that do not trust the AI, and each of us learned one part of the code well enough to walk you through it."

## If something breaks (in this order)

- **Globe misbehaves or does not appear:** press "Flat page" (`#view-flat`) or open the spare address. After beat 3, press "3D" (`#view-3d`) before the next judge.
- **Page will not load:** reload → the spare device → a teammate's phone hotspot (ask first) → the backup video `docs/demo-backup.mp4` (147 seconds, recorded 5:05 AM Sunday on the 3D globe, no sound: talk over it; it shows every part) → last, the offline file `docs/iss-ride-along-offline.html` (an older build without the planner).
- **Planner key gone after a reload:** it stays if "keep until this tab is closed" was ticked. Otherwise type it again from the password manager, between judges, screen turned away, never read aloud. Only then: "Plan my sighting" with no key gives the fixed plan: "this is the plan for one city without AI; the trip sentence needs the AI."
- **AI slow:** one slow reply is asked again by itself ("asked again" in the Steps list); if that fails too, the page cuts over by 2 minutes and says why: press the trip example again. **Web search down:** the plan still runs and says so.

## Openings for the partner judges (20 seconds, before the demo)

- **Beyond the Horizon (Quinn):** "We checked our own orbit math against the trajectory NASA's mission control publishes: 1.03 km apart at most over 360 of their rows within 12 hours, growing to 4.76 km when our orbit numbers are 3 days old. NASA's file is a prediction from their model, not a measurement. Orbit numbers come from CelesTrak, which is US Space Force tracking data; the imagery, events and trajectory are NASA's, each credited."
- **Future of Intelligence (Denim):** one city in the plain controls ("the form gives this"), then the trip sentence ("the agent read our week and gives this"). Then the audit, the search text the agent wrote for Exa, and: "live-tested on Gemini; the OpenAI adapter is tested with saved replies, not live-tested."

## Second visit (pick one; never repeat the script)

- **Game** tab, "Play 3 rounds" (`#game-start`): the judge taps where the station will be in 10 minutes; the score is the km off.
- **Sky from the station** tab (`#sky-canvas`): drag, zoom, tap a star; "Back to the station's view" (`#sky-reset`).
- **Forecast lab** (`#forecast-open`, in "What it is flying over"): corn harvest skill 0.57 over 31 test years; price 0.00 over 23. Say: "Research demo, not investment advice."
- **Their own city** in "When can I see it?" (`#city`), then "Add to calendar (.ics)" (`#out-ics`) after a plan.
