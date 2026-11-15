# Presenter pack v1 (Quinn, Denim, Armeis)

**ISS Ride-Along in two sentences:** you tell it where you will be this week and when you are free, in your own words, and it plans the one space-station pass worth going outside for. Every number on the result comes from our own orbit math, which we checked against an independent tracker, against Heavens-Above and against NASA mission control's own trajectory file.

This pack is a review of the four study cards in [STUDY_CARDS.md](STUDY_CARDS.md), not new material. Version 1, Sat Nov 14, 7:45 PM EST. Every fact here comes from a file in this repository, and the file is named next to each answer, so you can open it if a judge asks "show me". `node scripts/check-docs.mjs` checks that each of those files exists, and `node scripts/smoke.mjs --path` presses every click in the 90-second path below on the built page.

## The one page

**Pitch (the Devpost short description):** "Tell it where you will be this week and when you are free, in your own words. It plans the one space-station pass worth going outside for, and shows where every number came from."

**The user:** a parent, a teacher or a first-time stargazer, starting with us in Michigan in November.

**The problem:** the space station passes over most places several times a week, but you see it only if you are in the dark, it is still in sunlight, the sky is clear and you look the right way at the right minute. Pass apps tell you when it flies over; you still have to match that to your week, your sky and where you will be.

**The three numbers (each with what it counts):**

1. **5 of 5 live AI runs, 0 made-up numbers.** Five real runs on Gemini on Nov 14 (3 one-place, 2 two-city trips), and each one's audit counted 0 numbers that no tool gave (`README.md`, "AI in the app").
2. **360 of NASA's rows, at most 1.03 km apart.** Within 12 hours of our orbit numbers' timestamp, our position and NASA's predicted trajectory are 0.37 km apart in the middle and 1.03 km at most. With our coordinate conversion switched off, the gap is 26 to 45 km (`node scripts/check-oem.mjs`, 7:39 PM).
3. **8 of 8 passes, start times within 1.3 seconds.** For Ypsilanti, Nov 14-18, our pass list matches every pass on Heavens-Above's saved list (`tests/passes.test.ts`).

**Each tool in one line (what it is, why it is here):**

- **satellite.js** (SGP4): the standard model that moves a station's published orbit numbers forward to any second, so we compute the position ourselves.
- **CelesTrak**: where the orbit numbers come from (US Space Force tracking data, not NASA). **wheretheiss.at**: an independent tracker we compare against.
- **Leaflet**: a small map library that draws the map, the station and its path.
- **NASA GIBS, EONET, Image and Video Library**: the daily satellite image, the list of open natural events and the astronaut photos. **NASA's ISS trajectory file**: the check in number 2.
- **Gemini** (Google's AI model): the planner's model, live-tested. **Exa**: a search engine built for AI, for station news. **Open-Meteo**: the free cloud forecast.
- **Vitest**: runs the 78 automated tests (78 of 78 passed at 7:39 PM). **GitHub Actions**: runs them again on every push before the live page updates.
- **Claude Code**: the AI coding tool that wrote the code (question 1 below).

Full list with versions: [HOW_IT_WORKS.md](../HOW_IT_WORKS.md) "Each tool in one line". Tech stack and licences: [README.md](../README.md) "Built with" and `package.json`.

## The 90-second click path

On the demo laptop, with the live page https://ahmedsohail2003.github.io/iss-ride-along/ open. The first four rows are done before judges arrive (docs/DEMO_LAPTOP.md, step 4). `node scripts/smoke.mjs --path` reads this table and does each row on the built page: it finds the element, checks it shows the quoted words, does the action, and waits for the "then you see" element.

| Step | When | Do | Where on screen | Then you see | Say |
|---|---|---|---|---|---|
| 1 | before | `click` | `#tab-btn-settings` "Settings" (the tab row under the first screen) | `#plan-settings` | (nothing; setup) |
| 2 | before | `click` | `#plan-settings summary` "Settings: AI keys" | `#key-gemini` | (nothing; setup) |
| 3 | before | `key` | `#key-gemini` | — | (paste your own Gemini key from your password manager) |
| 4 | before | `tick` | `#key-keep` | — | (keep until this tab is closed; then close the settings box) |
| 5 | 0:00 | `look` | `#planner-h` "Where will you be, and when are you free?" | — | The pitch, in your own words. |
| 6 | 0:10 | `click` | `button.example[data-example="trip"]` "Ypsilanti until Monday" | `#plan-sentence` | "This is a real week: two cities and a bedtime." |
| 7 | 0:15 | `click` | `#plan-go` "Plan my sighting" | `#plan-card` | "The AI only chooses. Every number on the card comes from our own engine." |
| 8 | 0:25 | `look` | `#plan-trace` | `#plan-trace li` | Read three Steps rows aloud: which tool ran and what came back (card 3). |
| 9 | 0:50 | `look` | `#lat` | — | "Every second the browser works out where the station is, from its published orbit numbers." |
| 10 | 1:00 | `click` | `#check-ref` "Check against reference" | `#ref-km` | Read the km: "that is how far our answer is from an independent tracker for the same second." |
| 11 | 1:10 | `look` | `#oem-panel` "Our math vs NASA's own trajectory" | `#oem-gap` | "Within 12 hours of our orbit numbers' time, NASA's file and ours are 1.03 km apart at most." |
| 12 | 1:20 | `click` | `#credits summary` "Credits and data sources" | `#credits-body` | "Every NASA source is dated and credited. Not affiliated with or endorsed by NASA." |
| 13 | 1:25 | `look` | `#passes-h` "When can I see it?" | — | "For Ypsilanti we found the same 8 passes Heavens-Above lists." Then: "What would you like to see?" |

## 10 judge questions (answer out loud first, then read the answer)

Two sentences each. The file under each answer is where a judge can see it.

### 1. Who wrote the code and how did you use AI?

The code was written by Claude Code, Anthropic's AI coding tool (the Fable 5.2 model planned, the Opus 5.5 model wrote the code), directed by our teammate Ahmed, who could not be here for judging. Every part had to pass checks that do not trust the AI, tests against outside data and a separate verification run for each part, and each of us can walk you through the code from the code tour.

Then each person says their own part (each sentence is a proposal until that person says yes in the group chat or their doc; change it to what you really did):
- Zach, who left the team at 12:49 PM Saturday, suggested the original ISS dashboard idea with Denim.
- Quinn (waiting for Quinn's yes): "I found the event's Devpost page and pointed out that the project needs a main track."
- Denim (waiting for Denim's yes): "I read the Devpost rules, found that a main track is required, which changed the plan, and asked the organiser which AI tools count."
- Armeis (waiting for Armeis's yes): "I reviewed each checkpoint build and wrote up how the publishing workflow works."

File: `README.md` ("AI used to build it"), `docs/VERIFICATION.md`, `CODE_TOUR.md`

### 2. Why an agent and not an if-statement?

The plain form takes one place, one latest time and a set of nights; the agent takes a week in your own words with several places and rules, runs our engine once per place and picks one pass across them. In our trip test (saved replies) the agent picks a Chicago pass on a night the traveller is in Chicago, while the form at its defaults picks a Ypsilanti pass for that night, when the traveller is not there; in both live trip runs that evening's clouds made the two pick the same pass.

File: `src/agent/loop.ts` (`runAgent()`), `tests/planner.test.ts` (test i)

### 3. What stops it making numbers up?

The AI can only pick among pass ids our engine returned, `showPass()` refuses any other id, and every number on the card is written by the engine, not the model. Then `audit()` reads the model's own sentences and marks any number no tool gave: in a test with a made-up time and a made-up 512 km altitude put into the reply, exactly those 2 were flagged.

File: `src/agent/tools.ts` (`showPass()`), `src/agent/audit.ts` (`audit()`)

### 4. What happens with no key, or a failed search?

With no key the button runs the fixed plan for one place: the same engine steps and the same scoring rule, with no AI, and a bad key, a rate limit or a timeout also ends in the fixed plan with the reason shown. If the web search fails, the news box says "live web search unavailable" and the plan carries on, because the news only adds context.

File: `src/agent/fixedPlan.ts` (`runFixedPlan()`), `src/agent/loop.ts` (`reasonText()`), `src/news/exaMcp.ts` (`searchStationNews()`)

### 5. Which AI does it use? Does it work with OpenAI?

Gemini (model gemini-4-hydrogen) is **live-tested**: five real runs on Nov 14, each with 0 unverified numbers. The OpenAI adapter behind the same code is **tested with saved replies, not live-tested**, so we do not claim it, and the settings box shows these same words for each provider.

File: `src/ui/settings.ts`, `src/agent/providers.ts`

### 6. How do you know the position is right?

A saved test compares our answer with 10 positions recorded from wheretheiss.at, using the same orbit numbers that tracker used, and the largest difference was 0.0003 km (under 1 metre) on 10 of 10 samples. The live button compares with the newest numbers each tracker has, so it shows a little more (0.789 km at 7:40 PM Sat), and it checks our math, not where the station truly is.

File: `tests/position.test.ts`, `src/orbit/compare.ts` (`compareWithReference()`)

### 7. Is this NASA's data?

The orbit numbers are not: they come from CelesTrak, which publishes US Space Force tracking data, and wheretheiss.at is not NASA either. The NASA parts are the daily satellite image (GIBS), the natural-events list (EONET), the astronaut photos (Image and Video Library) and NASA's ISS trajectory file, each credited on the page, and the project is not affiliated with or endorsed by NASA.

File: `src/nasa/credits.ts`

### 8. What is NASA's trajectory file, and why does the gap grow?

It is the path NASA's mission control predicts for the station, a list of positions 4 minutes apart from their detailed model, so it is a prediction too, and we say the two are a distance apart, not that either one is the truth. Our orbit numbers are a snapshot of one moment and the simple model drifts as the snapshot ages: 0.870 km after 24 hours and 4.763 km after 72 hours.

File: `src/orbit/oemCompare.ts` (`gapAt()`), `scripts/check-oem.mjs`

### 9. What was the hard part?

Our model gives positions in one coordinate system and NASA's file uses another (they differ in how they treat the slow wobble of Earth's axis), so without converting we are 26 to 45 km off at every row. The conversion was checked against a published worked example (Vallado and others, 2006) to 0.82 metres, and with it the gap within 12 hours is 1.03 km at most.

File: `src/orbit/frames.ts` (`temeToJ2000Matrix()`), `tests/oem.test.ts`

### 10. Walk me through what happens every second.

`tick()` runs every second and calls `stateAt()` for "now", which runs SGP4 on the orbit numbers and returns latitude, longitude, altitude and speed. The page then updates the numbers and moves the marker, and nothing is streamed from a server.

File: `src/main.ts` (`tick()`), `src/orbit/orbit.ts` (`stateAt()`)

## If something breaks at the table

- **The page will not load:** open it on the spare device within 30 seconds; if that fails too, play the backup video `docs/demo-backup.mp4`.
- **The reference check fails:** say what it normally shows and point to the saved test: 10 of 10 samples within 1 metre of the other tracker (question 6).
- **The AI does not answer:** the page falls back to the fixed plan by itself and names the reason. Say: "this is the plan for one city without AI; the scoring rule is the same." Paste the key again between judges.
- **A data source is down:** the tracker never waits for the network; it runs on the orbit numbers built into the page and says how old they are.

## Common mix-ups (say the right-hand side)

No written explain-backs had arrived by 7:45 PM, so these come from the corrections already made in the build log and the docs check.

| Easy to say | Say instead |
|---|---|
| "NASA's orbit data" | Orbit numbers from CelesTrak (US Space Force data); the NASA parts are the imagery, events, photos and the trajectory file. |
| "We know the true position to within a kilometre" | "About a kilometre apart from NASA's own prediction when our orbit numbers are under a day old." |
| "It runs on OpenAI" | "Live-tested on Gemini; the OpenAI adapter is tested with saved replies, not live-tested." |
| "The AI works out the pass" | The engine computes every pass and number; the AI only chooses among them. |
| "The reference check shows where the station really is" | It shows our math matches another tracker's; neither side measures the station. |
| "0.74 km" (an early estimate) | Quote the number the button shows, or the saved test's 0.0003 km on 10 of 10 samples. |
| "Field of view" | "The station's view": every place that can see the station above its horizon. |
| "We coded it" | "Ahmed directed an AI coding tool; we tested it, checked the science and learned it well enough to explain it." |
| "The speed is how fast it crosses the map" | It is orbital speed through space; over the ground it is lower. |

## Who owns what (a proposal; confirm or swap in your doc)

Everyone can answer a basic question on every part. Each person leads these and learns one code stop.

### Denim

- Leads: the opening with the planner, reading the Steps list and the audit aloud, question 1 "who built it and how", and the Future of Intelligence opening.
- Code stop: `src/agent/loop.ts`, `runAgent()`, and its audit call (code tour stop 9).
- What I learned (Denim writes this, 2 lines):
  > 
- One check I ran myself (time and what I saw):
  > 

### Quinn

- Leads: the live tracker, the check against NASA's trajectory (card 4), "when can I see it" and why, and the Beyond the Horizon opening.
- Code stop: `src/orbit/frames.ts`, `temeToJ2000Matrix()`, and its test `tests/oem.test.ts` (code tour stop 10).
- What I learned (Quinn writes this, 2 lines):
  > 
- One check I ran myself (time and what I saw):
  > 

### Armeis

- Leads: what the station is flying over (NASA imagery and events), and "how we know it works" (the tests, the run on every push).
- Code stop: your choice of code tour stop 5 (`src/main.ts`, `tick()`) or stop 6 (`src/nasa/footprint.ts`, `footprintRadiusKm()`).
- What I learned (Armeis writes this, 2 lines):
  > 
- One check I ran myself (time and what I saw):
  > 

## Phone cue cards (one per screen; scroll on your phone)

1. **Open:** "Tell it your week in your own words; it plans the one pass worth going out for, and shows where every number came from."
2. **Planner:** "The AI only chooses. 5 of 5 live runs, 0 made-up numbers." Read three Steps rows.
3. **Tracker:** "Computed every second in your browser. Saved test: 10 of 10 within 1 metre of another tracker."
4. **NASA:** "Within 12 hours, 1.03 km apart at most from NASA mission control's own trajectory; 26 to 45 km without our conversion."
5. **Passes:** "8 of 8 Heavens-Above passes for Ypsilanti, start times within 1.3 seconds."
6. **Honest line:** "Claude Code wrote the code, directed by Ahmed; every part had to pass tests that do not trust the AI."

## Where things are

- The code tour, 10 stops with a sentence to say at each: [CODE_TOUR.md](../CODE_TOUR.md)
- How it works in plain words: [HOW_IT_WORKS.md](../HOW_IT_WORKS.md)
- The four study cards: [STUDY_CARDS.md](STUDY_CARDS.md)
- Setting up the demo laptop: [DEMO_LAPTOP.md](DEMO_LAPTOP.md)
- Every command and what it checks: [RUN.md](../RUN.md) and [README.md](../README.md) "How we test"
- Each part's separate verification result: [VERIFICATION.md](VERIFICATION.md)
