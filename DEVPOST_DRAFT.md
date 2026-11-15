# Devpost draft text (for the draft due Sunday 12:00 AM; updated as parts are finished)

Event page: https://hack-the-nest.devpost.com/ . Paste field by field. Every line is true as of Saturday 7:45 PM. The project already exists on Devpost under Ahmed's account (join it with the link in the team chat); the story step there needs the demo video link, so paste the text below when the video exists. A part is described as working only after it has passed its independent check; everything else says "in progress".

**Main track:** Future of Intelligence

**Opt-ins ticked:** Beyond the Horizon (partner track), the Department of Computer Science Track (academic track; its page says "No separate project: opt in from any track") and Best Beginner (Denim confirmed it is the first hackathon for Quinn, Denim and Armeis).

**Opt-in to tick next:** Best Use of Gemini API (MLH). The planner passed its live Gemini runs on Saturday at 6:37 PM; the form also asks for the Gemini project number, which Ahmed has. Nothing else is ticked.

**Name:** ISS Ride-Along

**Short description:** Tell it where you will be this week and when you are free, in your own words. It plans the one space-station pass worth going outside for, and shows where every number came from.

**The problem it solves:** The International Space Station passes over most places several times a week, but you see it only if you are in the dark, it is still in sunlight, the sky is clear and you look the right way at the right minute. Pass apps tell you when it flies over. You still have to match that to your week, your sky and where you will be. ISS Ride-Along does that, and shows where every number came from. It is for a parent, a teacher or a first-time stargazer, starting with us in Michigan in November.

**What works tonight:**
- A live tracker: the page works out where the station is every second with its own orbit math, and draws the last and next orbit on a map.
- A "Check against reference" button that compares our position with an independent tracker on the spot.
- What the station is flying over, from NASA data: a clear cloud-free map (NASA Blue Marble) with the daily satellite image and its date one switch away, NASA's live list of natural events, and astronaut photos, each credited.
- "When can I see it?": every visible pass for the next 5 days for your city. For Ypsilanti, 8 of 8 passes matched Heavens-Above, with start times within 1.3 seconds.
- Plan my sighting: type your week in your own words and an AI agent runs our pass math and a cloud forecast for each part of the trip, searches the live web, picks one pass and shows every step. Every number on the card is written by our engine, and an audit marks any number the AI made up. With no key the page runs a fixed plan with no AI.
- Our orbit math checked against the trajectory file NASA's mission control publishes for the station: on 360 of NASA's rows within 12 hours of our orbit numbers' timestamp, 1.03 km apart at most and 0.37 km in the middle. The page shows the gap, the age of our numbers, and that NASA's file is a prediction.
- 78 automated tests, run again on every push before the live page updates, together with a check of the docs against the code and a scan for anything that looks like a key.

**In progress (say "in progress", not "works"):** a first screen a stranger can use in a minute; a calendar file and one-page briefing; day and night on the map; a small game.

**Which AI tools we used and how:** (1) To build it: Claude Code (Anthropic's coding tool; the Fable 5.2 model planned, the Opus 5.5 model wrote the code), directed by Ahmed, who chose the idea with the team and approved the plan. Every part had to pass checks that do not trust the AI: tests against outside data, a separate verification run for each part, and a test run on every push before the live page updates. (2) Inside the app: an agent plans a sighting from a plan in your own words by calling our own orbit engine, the Open-Meteo cloud forecast and Exa web search; every number it says is checked against the engine. Live-tested with Gemini (model gemini-4-hydrogen) on Saturday Nov 14 between 6:09 and 6:37 PM. OpenAI: the same adapter, tested with saved replies written from OpenAI's documentation, not live-tested. Exa search: live-tested without a key.

**Who did what** (check your own sentence and change it if it is not true):
- Ahmed: directed the build through Claude Code and approved the plan.
- Quinn: posted the event's Devpost page and pointed out that the project needs a main track.
- Denim: read the Devpost rules, found that Beyond the Horizon is a partner track and that a main track is required, which changed the plan.
- Armeis: reviews each checkpoint build and wrote up how the publishing workflow works.

**Built with:** TypeScript, Vite, Leaflet, satellite.js, Vitest, GitHub Actions and GitHub Pages, the Gemini API, Exa search.

**Data credits:** CelesTrak (US Space Force tracking data, not NASA), wheretheiss.at (reference tracker, not NASA), Heavens-Above (pass times used to check ours), Natural Earth (city list), NASA GIBS, NASA EONET and the NASA Image and Video Library, NASA's ISS trajectory file (the comparison), Open-Meteo (cloud forecast), Exa (web search). Not affiliated with or endorsed by NASA.

**Links:** code https://github.com/ahmedsohail2003/iss-ride-along · live page https://ahmedsohail2003.github.io/iss-ride-along/

**Still to add before the final (Sunday 11:00 AM):** the demo video (3 minutes or less), and two "What I learned" lines from each of Quinn, Denim and Armeis in their own words.
