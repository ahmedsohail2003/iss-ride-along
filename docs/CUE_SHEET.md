# Cue sheet (print this page, one per person)

**ISS Ride-Along:** tell it your week in your own words, and it plans the one space-station pass worth going outside for, and shows where every number came from.

Version 1, Sat Nov 14, 7:59 PM EST. Full plan: [PRESENTING.md](PRESENTING.md). Answers to judge questions: [PRESENTER_PACK.md](PRESENTER_PACK.md).

## The three numbers (say what each one counts)

| Say | What it measures | Where it comes from |
|---|---|---|
| **5 of 5 live AI runs, 0 made-up numbers** | Five real planner runs on Gemini on Nov 14 (3 one-place, 2 two-city trips). After each run the audit read the AI's own sentences and found 0 numbers that no tool of ours gave. | `README.md`, "AI in the app" |
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
| 0:00-0:35 | Denim | Press the trip example "Ypsilanti until Monday...", then "Plan my sighting" (`#plan-go`), first thing | "Pass apps tell you when it flies over one place..." Read the Steps (`#plan-trace`) as they fill in. |
| 0:35-1:15 | Denim, then Quinn | Point at the audit badge (`#plan-audit`), then the NASA panel (`#oem-panel`), then press "Check against reference" (`#check-ref`) | Audit: "anything the AI made up would be marked." NASA: read the gap and the age on the panel; "1.03 km at most within 12 hours." |
| 1:15-1:35 | Armeis | Tick "Daily satellite photo (with clouds)" (`#daily-toggle`), point at its date (`#gibs-date`), untick it; then the events (`#events-list`), the photo (`#photo-card`), the credits (`#credits`) | "The clear map is NASA's Blue Marble; this switch shows NASA's photo of the day. Under the station: NASA's open natural events, an astronaut photo." |
| 1:35-2:00 | everyone | Hands off the laptop | Who built it and how; one line each from your own "What I learned" box. Then: "What would you like to see?" |

A live trip run took 11.0 and 13.2 seconds (4 AI calls each). If the run is cut off at 30 seconds, say "that is the plan for one city without AI" and go on to beat 2.

## The honest line (say it without looking)

"Ahmed directed an AI coding tool, Claude Code, which wrote the code. Every part had to pass tests that do not trust the AI, and each of us learned one part of the code well enough to walk you through it."

## If something breaks (in this order)

- **Page will not load:** reload → the spare device → a teammate's phone hotspot (ask first) → the backup video `docs/demo-backup.mp4` (36 seconds, no sound: talk over it) → last, the offline file `docs/iss-ride-along-offline.html` (an older build without the planner).
- **Planner key gone after a reload:** it stays if "keep until this tab is closed" was ticked. Otherwise type it again from the password manager, between judges, screen turned away, never read aloud. Only then: "Plan my sighting" with no key gives the fixed plan: "this is the plan for one city without AI; the trip sentence needs the AI."
- **AI slow:** the page cuts over by itself at 30 seconds and says so. **Web search down:** the plan still runs and says so.

## Openings for the partner judges (20 seconds, before the demo)

- **Beyond the Horizon (Quinn):** "We checked our own orbit math against the trajectory NASA's mission control publishes: 1.03 km apart at most over 360 of their rows within 12 hours, growing to 4.76 km when our orbit numbers are 3 days old. NASA's file is a prediction from their model, not a measurement. Orbit numbers come from CelesTrak, which is US Space Force tracking data; the imagery, events and trajectory are NASA's, each credited."
- **Future of Intelligence (Denim):** one city in the plain controls ("the form gives this"), then the trip sentence ("the agent read our week and gives this"). Then the audit, the search text the agent wrote for Exa, and: "live-tested on Gemini; the OpenAI adapter is tested with saved replies, not live-tested."
