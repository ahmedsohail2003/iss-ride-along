# Devpost draft text (for the draft due Sunday 12:00 AM; updated as parts are finished)

Event page: https://hack-the-nest.devpost.com/ . Paste field by field. Every line is true as of Saturday 5:45 PM. A part is described as working only after it has passed its independent check; everything else says "in progress".

**Main track:** Future of Intelligence

**Opt-ins to tick tonight:** Beyond the Horizon (partner track) and the Department of Computer Science Track (academic track; its page says "No separate project: opt in from any track").

**Opt-ins to tick only when true:** Best Use of Gemini API (MLH), once the planner has passed a live Gemini run. Best Beginner, once Quinn, Denim and Armeis have each said this is their first hackathon. Nothing else.

**Name:** ISS Ride-Along

**Short description:** Tell it where you will be this week and when you are free, in your own words. It plans the one space-station pass worth going outside for, and shows where every number came from.

**The problem it solves:** The International Space Station passes over most places several times a week, but you see it only if you are in the dark, it is still in sunlight, the sky is clear and you look the right way at the right minute. Pass apps tell you when it flies over. You still have to match that to your week, your sky and where you will be. ISS Ride-Along does that, and shows where every number came from. It is for a parent, a teacher or a first-time stargazer, starting with us in Michigan in November.

**What works tonight:**
- A live tracker: the page works out where the station is every second with its own orbit math, and draws the last and next orbit on a map.
- A "Check against reference" button that compares our position with an independent tracker on the spot.
- What the station is flying over, from NASA data: the daily satellite image with its date, NASA's live list of natural events, and astronaut photos, each credited.
- "When can I see it?": every visible pass for the next 5 days for your city. For Ypsilanti, 8 of 8 passes matched Heavens-Above, with start times within 1.3 seconds.
- 47 automated tests, run again on every push before the live page updates.

**In progress (say "in progress", not "works"):** the AI sighting planner; a check of our orbit math against NASA mission control's own trajectory file; a first screen a stranger can use in a minute; a calendar file and one-page briefing; day and night on the map; a small game.

**Which AI tools we used and how:** (1) To build it: Claude Code (Anthropic's coding tool; the Fable 5.2 model planned, the Opus 5.5 model wrote the code), directed by Ahmed, who chose the idea with the team and approved the plan. Every part had to pass checks that do not trust the AI: tests against outside data, a separate verification run for each part, and a test run on every push before the live page updates. (2) Inside the app: an AI sighting planner is in progress.

**Who did what** (check your own sentence and change it if it is not true):
- Ahmed: directed the build through Claude Code and approved the plan.
- Quinn: posted the event's Devpost page and pointed out that the project needs a main track.
- Denim: read the Devpost rules, found that Beyond the Horizon is a partner track and that a main track is required, which changed the plan.
- Armeis: reviews each checkpoint build and wrote up how the publishing workflow works.

**Built with:** TypeScript, Vite, Leaflet, satellite.js, Vitest, GitHub Actions and GitHub Pages.

**Data credits:** CelesTrak (US Space Force tracking data, not NASA), wheretheiss.at (reference tracker, not NASA), Heavens-Above (pass times used to check ours), Natural Earth (city list), NASA GIBS, NASA EONET and the NASA Image and Video Library. Not affiliated with or endorsed by NASA.

**Links:** code https://github.com/ahmedsohail2003/iss-ride-along · live page https://ahmedsohail2003.github.io/iss-ride-along/

**Still to add before the final (Sunday 11:00 AM):** the demo video (3 minutes or less), the real status of the AI planner and which AI model it was tested with, and two "What I learned" lines from each of Quinn, Denim and Armeis in their own words.
