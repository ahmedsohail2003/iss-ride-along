# Presenting ISS Ride-Along at the table (Quinn, Denim, Armeis)

**Demo from this address:** https://ahmedsohail2003.github.io/iss-ride-along/?view=3d
Spare (the flat page, if the globe does not appear): https://ahmedsohail2003.github.io/iss-ride-along/?view=flat

**In short:** judging is Sunday 1:15 to 2:15 PM at our table in the Student Center Ballroom. Judges walk up, watch about 2 minutes, ask questions and may come back more than once. This file says what is on the table, the 2-minute script with who says what, a short opening for each kind of judge, 12 likely questions, what to do when something breaks, what to show on a second visit, and the Sunday rehearsal plan. The one-page version to print is [CUE_SHEET.md](CUE_SHEET.md); the longer answers and the 90-second click path are in [PRESENTER_PACK.md](PRESENTER_PACK.md).

Final version, Sun Nov 15, 5:15 AM EST, the 3D refresh (before it: 12:30 AM; version 1 was Sat 7:59 PM). Every part of the page passed its separate verification run by 4:52 AM Sunday, and only those parts are named here (`node scripts/check-docs.mjs` checks this, every number against the build log, and every file and screen element named here). What is new since version 1: the planner's newest live runs (beat 1), the test count, and a longer list of what to show on a second visit (section 6: the game, the sky from the station, the Forecast lab, the calendar file). If a judge asks for something not in this file, say "that is not built yet" and show the next part.

**New on the first screen since 12:30 AM (the spoken lines and the clicks are unchanged):**

- **The globe:** a 3D Earth in the map's place, with the station, its two orbits, the night side and the area the crew can see, from the same orbit math as the map.
- **The dark look:** black background, white and grey type, a "3D globe" badge in the header.
- **The "3D / Flat page" switch** above the globe (`#view-3d`, `#view-flat`): the flat page is one press away, and pressing "3D" brings the globe back.
- **The scroll story below the tool** (`#story`): six short scenes that turn the globe as you scroll, shown in the 3D view only.
- **Optional: the Photo / Dots switch** on the globe (`#style-photo`, `#style-dots`): the same Earth drawn as a cloud of dots, with small labels on the globe; nothing in the script changes.
- **New type and cards:** the type and the cards were restyled at about 9:40 AM (Geist, a two-tone headline above the globe, rounder cards, a "Code" link in the header); every click and line is unchanged.
- **Space scene and calmer cards:** in the 3D view a dotted Moon, a ringed planet and stars sit behind the page and move with the mouse (background art, not data); two longer notes fold under "About these numbers" and "How this is checked". Every click and line is unchanged.

## 1. The table

| What | Which | Status |
|---|---|---|
| The demo laptop (one, for every run) | Denim's laptop (the planner ran there with his own Gemini key at 8:58 PM Saturday) | Denim; (to fill: its screen size) |
| The spare device | a second teammate's laptop or a phone, with the spare address https://ahmedsohail2003.github.io/iss-ride-along/?view=flat already open | (to fill: whose) |
| On screen when a judge walks up | the demo address (the globe) scrolled to "Where will you be, and when are you free?" (`#planner-h`), the Gemini key already in, "Settings: AI keys" closed; a second tab with [CODE_TOUR.md](../CODE_TOUR.md) on GitHub | set up by [DEMO_LAPTOP.md](DEMO_LAPTOP.md) |
| Power | charger in, sleep and notifications off | |
| On paper | one printed [CUE_SHEET.md](CUE_SHEET.md) per person | |

## 2. The 2-minute demo script

Four beats and no more. Read the "> " lines aloud; the rest is what to do. Read at a normal pace, the spoken lines fit in 2 minutes with room for your own three lines in beat 4; `scripts/check-docs.mjs` counts them and fails if they grow past that. Who speaks follows the proposed owners (PRESENTER_PACK.md, "Who owns what") until the team picks the lead at 9:30 AM Sunday from the first timed run.

**Beat 1: the planner (0:00-0:35, Denim).** Before saying anything, press the trip example "Ypsilanti until Monday, then Chicago Tuesday to Thursday, kids in bed by 8:30", then "Plan my sighting" (`#plan-go`). Talk while the Steps list (`#plan-trace`) fills in. Live trip runs took 11.0, 13.2 and 15.4 seconds; one more, at 12:16 AM Sunday, got no AI reply within 15 seconds, and the page gave the fixed plan and said why, as it is built to.

> **Denim:** Pass apps tell you when the space station flies over one place. You still have to match that to your week, your sky and where you will be. I just gave it a week with two cities, in my own words. A form cannot take a week like that; an agent can. Watch the steps: it found both places, ran our own orbit engine for each on the nights we are there, checked the cloud, searched the web, and picked one.

The globe turns to the chosen pass (`#plan-card` shows it). Say a cloud line only if the Steps list shows a cloudy night being ruled out ("that night was too cloudy"). If the page says it cut the AI off at 30 seconds, say "that is the plan for one city without AI" and go on.

**Beat 2: how we know the numbers are right (0:35-1:15, Denim then Quinn).** Point at the audit badge (`#plan-audit`), then scroll to the NASA panel (`#oem-panel`), then press "Check against reference" (`#check-ref`).

> **Denim:** This badge is the audit: every number on the card came from our engine, and anything the AI made up would be marked. In all 7 live AI runs, none.
>
> **Quinn:** This panel compares our engine with NASA mission control's own trajectory. Here is the gap, and the age of our orbit numbers. Within 12 hours of their timestamp we measured 1.03 kilometres apart at most, over 360 of NASA's rows. NASA's file is a prediction too, so we say apart, not accurate. This button asks an independent tracker too.

Read the km it shows (`#ref-km`): "that is how far our answer is from the other tracker."

**Beat 3: what it is flying over (1:15-1:35, Armeis).** Scroll to the map and the NASA layers: tick the switch "Daily satellite photo (with clouds)" (`#daily-toggle`) under the map and point at the image date that appears (`#gibs-date`), untick it to go back to the clear map, then the events list (`#events-list`), the photo (`#photo-card`), then open the credits (`#credits`). The page changes to the flat map when you tick it; that is meant to happen. Before the next judge, press "3D" (`#view-3d`) to bring the globe back.

> **Armeis:** The clear map is NASA's Blue Marble; the shaded half is night right now. This switch shows NASA's satellite photo of the day, clouds and all. Under the station: NASA's natural events in the station's view, and an astronaut photo of a place in view. Every NASA source is dated and credited here.

**Beat 4: close (1:35-2:00, everyone).** Hands off the laptop.

> **Denim:** Our teammate Ahmed directed an AI coding tool, Claude Code, which wrote the code. Every part had to pass tests that do not trust the AI, and each of us learned one part well enough to walk you through it.
>
> **Quinn:** (your own line from your "What I learned" box)
>
> **Armeis:** (your own line from your "What I learned" box)
>
> **Denim:** (your own line from your "What I learned" box) What would you like to see?

Each "What I learned" line is 12 words at most and is written by that person, not by the build assistant. Typing a judge's own city, the passes table and the code tour are for a second visit or when a judge asks.

## 3. A version for each kind of judge

**Beyond the Horizon (the NASA partner track; Quinn opens, 20 seconds, before the demo).** Partner tracks have their own judges, so this is a separate visit that starts with the science:

> **Quinn:** We checked our own orbit math against the trajectory NASA's mission control publishes for the station: 1.03 kilometres apart at most over 360 of their rows within 12 hours, growing to 4.76 when our orbit numbers are 3 days old. NASA's file is a prediction from their model, not a measurement. Orbit numbers come from CelesTrak, which is US Space Force tracking data; the imagery, events and trajectory are NASA's, each credited.

Then the 2-minute script. What these judges look for: NASA data used correctly (each source dated, the trajectory file called a prediction), each source credited (the credits on the page, `src/nasa/credits.ts`), and the measured error with its table (CUE_SHEET.md).

**Future of Intelligence (the main track; Denim opens, 20 seconds).** Show the two paths one after the other, so the judge sees what only the agent does:

1. Press the trip example (it also sets the plain controls to Ypsilanti, every night, 8:30 PM), clear the sentence box (`#plan-sentence`), press "Plan my sighting": the card says "fixed plan, no AI". Say "the form gives this: one place, one latest time."
2. Press the trip example again and "Plan my sighting": "the agent read our week and gives this."
3. If both picked the same pass, say so: "tonight's clouds make them agree; our saved test shows the case where the form picks a night you are in Chicago" (`tests/planner.test.ts`, test i).
4. The audit badge, the search text the agent wrote for Exa (`#news-query`), and the honest provider line: "live-tested on Gemini; the OpenAI adapter is tested with saved replies, not live-tested." If a real OpenAI run is recorded before judging, this line changes and the page is set to OpenAI for these judges.

Rehearse three questions for them (answers in section 4): "why an agent and not an if-statement?", "what stops it making numbers up?", "what happens with no key or a failed search?".

**EMU Computer Science track.** Lead with the orbit engine and the tests: 240 automated tests in 28 files (240 of 240 passed at 11:38 AM Sunday), run again by GitHub Actions on every push before the live page updates (`README.md`, "How we test"). One test to name: the Forecast lab's no-peeking test (`tests/altdata.test.ts`) catches a version that is allowed to look at future years; exactly 2 tests fail on it. Then a 60-second code walk: each of you shows your own stop in [CODE_TOUR.md](../CODE_TOUR.md) (Denim stop 9, `src/agent/loop.ts`; Quinn stop 10, `src/orbit/frames.ts`; Armeis stop 5 or 6).

**The overall prize.** The 2-minute script as written.

**Best Beginner (if entered).** This is the first hackathon for Quinn, Denim and Armeis. Each of you says, in their own words, what they did and what they learned (the "What I learned" box and the check you ran yourself, PRESENTER_PACK.md).

**MLH Best Use of Gemini (only if the team entered it on Devpost).** The planner runs on Gemini (`gemini-4-hydrogen`): the model chooses which of our tools to run step by step, and the audit checks its numbers. Live-tested in 8 runs (5 on Nov 14, 3 at 12:15-12:18 AM Sunday): 7 finished by the AI with 0 made-up numbers, 1 ended in the fixed plan when the model sent no reply within 15 seconds.

## 4. Thirteen likely questions (two sentences each; answer aloud before reading)

1. **Who wrote the code?** Claude Code, an AI coding tool, wrote it (the Fable 5.2 model planned, the Opus 5.5 model wrote the code), directed by our teammate Ahmed, who could not be here for judging. Every part had to pass checks that do not trust the AI, and here is what each of us did: (your own confirmed sentence, PRESENTER_PACK.md question 1).
2. **How do you know it is right?** We compare it with three outside sources: an independent tracker (10 of 10 saved samples within 1 metre), Heavens-Above's pass list (8 of 8 passes, start times within 1.3 seconds) and NASA's own trajectory (1.03 km apart at most within 12 hours). The numbers are re-run by 240 automated tests on every push.
3. **Is this NASA's data?** The orbit numbers are not: they come from CelesTrak, which publishes US Space Force tracking data. The NASA parts are the map (GIBS: the cloud-free Blue Marble, and the daily satellite photo behind the switch), the natural events (EONET), the astronaut photos and the ISS trajectory file, each credited, and we are not affiliated with or endorsed by NASA.
4. **Why an agent and not an if-statement?** The form takes one place and one latest time; the agent takes a week in your own words with several places, runs our engine once per place and picks one pass across them. In our trip test the agent picks a Chicago pass on a night you are in Chicago, while the form picks a Ypsilanti pass for that night.
5. **What stops it making numbers up?** The AI can only choose among pass ids our engine returned, and every number on the card is written by our code, not the model. The audit then marks any number in the AI's sentences that no tool gave: 0 in 5 of 5 live runs, and in a test with 2 made-up numbers put in, exactly those 2 were marked.
6. **What happens with no key, or a failed search?** With no key, a bad key, a rate limit or a timeout, the button runs the fixed plan for one place with the same engine and scoring rule and shows the reason. If the web search fails, the news box says so and the plan carries on.
7. **Which AI does it use?** Gemini is live-tested: 8 real runs, 7 finished by the AI and 1 that fell back to the fixed plan when the model was silent for 15 seconds. The OpenAI adapter is tested with saved replies, not live-tested, so we do not claim it.
8. **Why does the gap to NASA grow?** Our orbit numbers are a snapshot of one moment, and the simple model that moves them forward drifts as the snapshot ages. We measured 0.870 km at 24 hours and 4.763 km at 72 hours, which is why the page prints the age next to the gap.
9. **What was the hard part?** Our model and NASA's file use two coordinate systems that differ in how they treat the slow wobble of Earth's axis, so without converting we were 26 to 45 km off at every row. The conversion was checked against a published worked example (Vallado and others, 2006) to 0.82 metres.
10. **How does it know when I can see it?** A pass counts when the station is at least 10 degrees above your horizon, your sky is dark and the station itself is still in sunlight; the planner then adds the cloud forecast from Open-Meteo for that hour. The score is the peak height times the clear-sky share, and a pass must fall on your nights and before your latest time to count.
11. **What would you do next?** Run the OpenAI adapter live and record it, and keep comparing with each new NASA trajectory file over several days. Then put it in front of real stargazers, starting with a class, and fix what confuses them.
12. **What did you learn?** Your own answer from your "What I learned" box. Fields you can name truthfully: how an orbit is predicted and why the prediction ages, how to read NASA data with its date and credit, how an AI agent calls tools and why its numbers are checked, and what a test run on every push is.

13. **Can it predict prices, like a stock forecast?** No. The Forecast lab uses a meteorologist's method on satellite crop data: it forecast the US corn harvest with skill 0.57 against a trend line over 31 test years, but on the corn price the same data scored 0.00 over 23 years, so the page shows no price forecast and is labelled "Research demo, not investment advice."

## 5. When something breaks

**The globe misbehaves or does not appear:** press "Flat page" (`#view-flat`) or open the spare address; everything in the script works there.

**The page will not load,** in this order: reload → the spare device (within 30 seconds) → a teammate's phone hotspot, if someone has one (ask) → the backup video `docs/demo-backup.mp4` (147 seconds, recorded 5:05 AM Sunday on the 3D globe, no sound: talk over it; it shows every part) → last, the offline file `docs/iss-ride-along-offline.html` as last built (an older build without the planner; it is not kept up to date).

**The planner,** in this order:

1. The key is gone after a reload → it is still there if "keep until this tab is closed" (`#key-keep`) was ticked when the key was typed (tick it).
2. Otherwise type it again from the password manager on the demo laptop, between visits, screen turned away, never read aloud.
3. Only then press "Plan my sighting" for the fixed plan and say "this is the plan for one city without AI; the trip sentence needs the AI."

**The AI is slow:** one slow reply is asked again by itself (the Steps list shows "the AI was slow (no reply in 60 seconds), asked again"); if that one fails too, the page cuts over to the fixed plan by 2 minutes and says why: press the trip example again. **The AI is refused** (the note says Gemini refused the model names; a free key's quota can run out): open Settings, pick another Gemini model (`#gemini-model`), press the trip example again; or wait a minute. **The web search is down:** the plan still runs and says so. **A part misbehaves:** say "that is a known small bug", and show the next part.

## 6. When a judge comes back

Do not repeat the script. Ask "what would you like to see?" and offer one of:

- **Their own city:** type it in "When can I see it?" (`#city`) and read the next visible pass; or put it in the plain controls and press "Plan my sighting".
- **The code:** your own code tour stop on GitHub, in under 60 seconds, pointing at the named function.
- **The checks:** the 3-day chart in the NASA panel (`#oem-chart`), the reference button pressed again, or the latest test run on the GitHub Actions tab.
- **The trace:** read one run of the Steps list line by line: which tool ran, what it returned, why that pass was chosen, which numbers the audit checked (STUDY_CARDS.md, card 3).
- **The game:** the Game tab, "Play 3 rounds" (`#game-start`): the judge taps where the station will be in 10 minutes and the score is how many km off they were. Our answer is the same orbit engine run 10 minutes ahead.
- **The sky from the station:** the "Sky from the station" tab (`#sky-canvas`): the stars above the station's own horizon right now. Let the judge drag and zoom, tap a star for its name, then press "Back to the station's view" (`#sky-reset`).
- **The Forecast lab:** in "What it is flying over", the "Forecast lab" button (`#forecast-open`): satellite greenness and the corn harvest, skill 0.57 over 31 test years, and the price at 0.00. Read its yellow label aloud: "Research demo, not investment advice."
- **Take it home:** after a plan, "Add to calendar (.ics)" (`#out-ics`), the family sheet (`#out-family`) and the class handout (`#out-class`).
- **For everyone:** the plain sentence above the map (`#where-now`), read aloud by the "Read aloud" switch (`#voice-toggle`) or a screen reader; the night-side switch (`#night-toggle`); every button works from the keyboard (Tab, then Enter).

## 7. Sunday plan (all on the named demo laptop)

To spare the Gemini key's daily limit, the AI runs once in each timed run and once for the video; the drill and the mock questions use the fixed plan. The settings box counts the AI calls (`#ai-calls`).

| Time | What |
|---|---|
| tonight, if still at the venue | 10 min reading the script and this cue sheet, then 20 min saying your own part aloud once (otherwise the same 30 minutes at 8:30 AM) |
| 8:50 AM | open the demo address on Denim's laptop and drag the globe once: if it appears within 3 seconds and follows the drag, demo from it; if not, use the spare address (the flat page) all day |
| 9:00 AM | the owner presses the trip example once (the key still works), then the **first timed 2-minute run**, all three speaking |
| by 9:30 | pick who leads the demo from that run; the speaker names in section 2 change to match |
| 9:30-9:45 | read the final PRESENTING.md and CUE_SHEET.md |
| 9:45-10:05 | the second timed run |
| 10:05-10:25 | record the team's own video (next paragraph) |
| 10:25-10:40 | one mock question each, with your code stop |
| 10:40-10:55 | the something-broke drill, one case each: (a) the page will not load → spare device within 30 seconds, then the backup video; (b) the reference check fails → say what it shows and point to the saved test (10 of 10 samples); (c) the AI does not answer → the key from the password manager between visits, else the fixed plan and "this is the plan for one city without AI" |
| by 10:55 | each person posts yes or no to the four "ready" lines below in the group chat |
| 11:00 | final Devpost |
| 1:00 PM | table setup in the Ballroom; judging 1:15-2:15 |

**The video** (Devpost needs one of 3 minutes or less). By 9:45 AM Denim uploads the backup video `docs/demo-backup.mp4` as Public and pastes the link into Devpost, so the entry has a video whatever happens. At 10:05-10:25 the team records its own version on the demo laptop (Win+Shift+R or Cmd+Shift+5), with the settings box closed for the whole recording. If it is under 3 minutes and uploaded by 10:45, Denim swaps the link; if not, the backup stays.

**Ready (four lines, yes or no each):**

1. One timed run at 2:00 or under.
2. My code stop walked on GitHub in under 60 seconds, pointing at the named function.
3. My something-broke case done within 30 seconds.
4. The honest "who wrote the code" answer without looking.

If someone is not ready, the two who are lead the demo and the third takes second-visit questions on their own stop.
