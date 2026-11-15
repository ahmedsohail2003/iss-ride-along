# Devpost text, final (ISS Ride-Along, Hack the Nest 2026)

Final version, Sun Nov 15, 6:00 AM EST. It replaces the Saturday draft. Every part named below as
working has passed its separate verification run (`docs/VERIFICATION.md`), and every number comes
from a command in the build log. Final deadline: Sunday 12:00 PM on Devpost, no late entries; the
team's target is 11:00 AM.

## How to paste this (about 5 minutes)

Open https://devpost.com/software/iss-ride-along while signed in as a team member and press "Edit
project". Work down the list in this order. Each grey box below has a copy button in its top right corner on
GitHub; paste the box as it is.

1. **Overview.** Project name = box A. Tagline = box B. Both are already saved; check that they match.
2. **Additional info.** The tracks and prizes are already saved (list C; change nothing). Replace the
   AI tools answer with box D. Schools: Ahmed's, Quinn's and Denim's are saved; Armeis adds theirs.
3. **Project details.** Story = box E, the whole box (the field takes Markdown). Before pasting, each
   of Quinn, Denim and Armeis replaces their own `[FILL ...]` line under "What we learned" with 2 to
   3 sentences in their own words; delete a line that is still empty at 10:30 AM. "Built with" =
   box F. "Try it out" links = box G. Video link: upload `docs/demo-backup.mp4` (147 seconds) to
   YouTube as Public, or the team's own recording of 3 minutes or less, and put the new link in place
   of the Saturday one. Images: screenshots of the live page (the globe, the plan card).
4. **Team.** Armeis joins with the invite link in the team chat.
5. **Submit.** A person ticks the terms box and presses "Submit project", by 11:00 AM. Then post
   "final submitted" in the team chat.

## Box A: project name (Overview)

```text
ISS Ride-Along
```

## Box B: tagline (Overview)

```text
Tell it where you will be this week and when you are free, in your own words. It plans the one space-station pass worth going outside for, and shows where every number came from.
```

## List C: tracks and prizes (Additional info; already saved, for checking only)

- Main track: Future of Intelligence.
- Opt-ins: Beyond the Horizon (partner track), the Department of Computer Science Track (academic
  track), Best Beginner (Denim wrote on Saturday that this is the first hackathon for Quinn, Denim
  and Armeis, 3 of the 4 members) and Best Use of Gemini API (MLH). Nothing else is ticked.

## Box D: which AI tools we used and how (Additional info)

```text
(1) To build it: Claude Code (Anthropic's coding tool; the Fable 5.2 model planned, the Opus 5.5 model wrote the code), directed by Ahmed, who chose the idea with the team and approved the plan. Every part had to pass checks that do not trust the AI: tests against outside data, a separate verification run for each part, and a test run on every push before the live page updates. (2) Inside the app: an agent plans a sighting from a plan in your own words by calling our own orbit engine, the Open-Meteo cloud forecast and Exa web search; every number it says is checked against the engine. Live-tested with Gemini (model gemini-4-hydrogen) on Sat Nov 14 and Sun Nov 15: 13 of the 14 live runs in our build log were finished by the AI, each with 0 unverified numbers; in the other run no model reply came within 15 seconds, and the page gave its fixed plan and said why. OpenAI: the same adapter, tested with saved replies written from OpenAI's documentation, not live-tested. Exa search: live-tested without a key.
```

## Box E: the story (Project details, the "About the project" field)

```markdown
ISS Ride-Along plans the one International Space Station pass worth going outside for: type where you will be this week and when you are free, in your own words. It is for a parent, a teacher or a first-time stargazer. Its pass list matched 8 of the 8 passes that Heavens-Above (a satellite pass site) lists for Ypsilanti for Nov 14-18, the worst start time 1.3 seconds off.

## Inspiration

You see the station only if you are in the dark, it is still in sunlight, the sky is clear and you look the right way at the right minute. Pass apps list the times and leave the rest to you.

## What it does

- **Plan my sighting.** An AI agent (a model that chooses which of our tools to run) runs our pass math and the Open-Meteo cloud forecast for each place and night you named, searches the web through Exa and picks one pass. Our engine writes every number on the card, and an audit marks any number the AI made up. With no key, a fixed plan runs instead.
- **Live tracker.** Where the station is every second, its last and next orbit, and a button that checks our position against an independent tracker, wheretheiss.at.
- **From NASA data.** What the station is flying over (the daily satellite photo, open natural events, astronaut photos), and how far our position is from NASA's own trajectory file.
- **Also.** A calendar file for the chosen pass, a three-round game, a star chart, a read-aloud switch and a Forecast lab (a research demo, not investment advice).

Where the device can draw it smoothly, the page opens on a 3D globe in a dark look, drawn with three.js (MIT). It is a drawing of computed positions, not a live camera: the Earth is NASA's cloud-free Blue Marble from NASA GIBS (one copy saved on Nov 15, 2026 and built into the page), and the station at its true height, its last and next orbit, the night side, the area the crew can see and the chosen pass over your city all come from the same tested orbit and Sun math as the flat map; the 1,627 stars behind it are the Sky tab's own catalogue. Below the tool, a six-scene scroll story turns the globe as you read. The flat page is one press away ("Flat page"), and it opens by itself on a device with no WebGL2, a software renderer, a slow graphics chip or reduced motion. The look was modelled on Ahmed's earlier RoBuff page; all code was written new at this event. Not affiliated with or endorsed by NASA.

## How we built it

Everything is computed in the browser, in TypeScript. The orbit comes from a TLE (the public two-line description of an orbit) run through SGP4, the standard model for TLEs, in satellite.js. GitHub Actions runs the tests on every push before GitHub Pages publishes the page.

The code was written by Claude Code, Anthropic's AI coding tool (the Fable 5.2 model planned, the Opus 5.5 model wrote the code), directed by our teammate Ahmed. Every part had to pass checks that do not trust the AI: tests against outside data and a separate verification run. Inside the app, the planner was live-tested with Gemini; the OpenAI adapter was tested with saved replies only, not live-tested.

Who did what: Ahmed directed the build. Quinn posted the event's Devpost page and pressed Submit on the Saturday draft. Denim ran the planner on the demo laptop, his own, with his own Gemini key, and suggested the clear map that is now the default. Armeis wrote up how the publishing workflow works.

## Challenges

NASA's trajectory file uses a different reference frame from SGP4's output. Unconverted, the two positions were 26 to 45 km apart on 360 of NASA's rows; with our conversion, 0.485 km at our orbit numbers' timestamp.

## Accomplishments

- Position: 0.0003 km at most from 10 of 10 positions saved from wheretheiss.at, on the same orbit numbers. This checks our math, not the station's true position.
- NASA's trajectory: 0.870 km apart after 24 hours and 4.763 km after 72 hours. NASA's file is a prediction too, so this is a distance between two predictions, not a measured error.
- The agent: 13 of the 14 live Gemini runs in our build log were finished by the AI, each with 0 unverified numbers. In the other, no reply came within 15 seconds; the page now asks once more, then falls back to the fixed plan and says why.
- 204 of 204 automated tests pass.

## What we learned

- Ahmed: An independent check finds what the builder's own check misses: 6 verification runs, across 4 parts, failed work that had passed its builder's test.
- Quinn: [FILL: Quinn's own words]
- Denim: [FILL: Denim's own words]
- Armeis: [FILL: Armeis's own words]

## What's next

Not done yet: a test with a screen-reader user, timed tests with strangers, a live test of the OpenAI adapter, and the 3D view on more than the one laptop it was checked on.

Data: CelesTrak (US Space Force tracking data, not NASA), NASA GIBS, EONET, the NASA Image and Video Library and Johnson Space Center's trajectory file, wheretheiss.at, Heavens-Above, Open-Meteo, Exa; the README credits every source.
```

## Box F: built with (Project details)

```text
TypeScript, Vite, Leaflet, three.js, Geist, satellite.js, Vitest, Playwright, GitHub Actions, GitHub Pages, Gemini API, Exa
```

## Box G: "Try it out" links (Project details)

```text
https://ahmedsohail2003.github.io/iss-ride-along/
https://github.com/ahmedsohail2003/iss-ride-along
```

## Box H: the problem it solves (only if a field asks for it; the story already says it)

```text
The International Space Station passes over most places several times a week, but you see it only if you are in the dark, it is still in sunlight, the sky is clear and you look the right way at the right minute. Pass apps tell you when it flies over. You still have to match that to your week, your sky and where you will be. ISS Ride-Along does that, and shows where every number came from. It is for a parent, a teacher or a first-time stargazer, starting with us in Michigan in November.
```

## For the team, not for pasting

- Each person checks their own "Who did what" sentence in box E and changes it if it is not true.
  Nobody but the AI tools wrote code, so no sentence says so.
- The "Who wrote the code" line is the first sentence of question 1 in `docs/PRESENTER_PACK.md`; keep
  it word for word.
- The demo address for the table is https://ahmedsohail2003.github.io/iss-ride-along/?view=3d and the
  spare is https://ahmedsohail2003.github.io/iss-ride-along/?view=flat .
- The check: `node scripts/check-docs.mjs` holds this file to the build log (every number), to the
  verdicts (no part named before it is VERIFIED) and to the honesty lines. It prints "wait" for each
  `[FILL ...]` line still open.
