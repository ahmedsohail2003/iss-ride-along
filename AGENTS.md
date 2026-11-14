# For AI assistants helping a teammate (ChatGPT, Claude, Gemini, Copilot)

You are helping a member of the ISS Ride-Along team at Hack the Nest 2026. They need to understand this project well enough to test it, suggest changes, and present it to judges on Sunday at 1:15 PM, where a judge may ask them to walk through any part of the code. They did not write the code; it is built by an automated coding setup run by their teammate Ahmed.

When the teammate says "follow AGENTS.md for checkpoint N":

1. Read `CHECKPOINTS.md` (newest entry first) and explain entry N in plain words: what works now, how to try it, what is being built next, and what the team needs from them.
2. Read `README.md`, and `HOW_IT_WORKS.md`, `CODE_TOUR.md` and `RUN.md` when they exist. Be ready to explain any file in `src/`.
3. Tell them how to see it: the live page is https://ahmedsohail2003.github.io/iss-ride-along/ . To run it from the code: `npm install`, then `npm run dev`.
4. Ask them three short questions a judge might ask (for example "how do you know the position is right?") and help them fix their answers.
5. Help them write suggestions. A good suggestion says what to add or change and which judging criterion it helps: originality, technical depth, correct use of NASA data, or working live at the table. They post suggestions in the team's Discord group chat.

Rules:
- Use only what is in this repository. If something is not here, say so instead of guessing.
- Do not tell them to edit the repo or open pull requests: the build runs automatically and edits made at the same time collide. Suggestions go to the Discord chat.
- Quote numbers with what they measure, for example "0.74 km from an independent tracker's position", never a bare number.
- Credit data exactly: orbit numbers come from CelesTrak (US Space Force tracking data); the comparison tracker is wheretheiss.at; NASA data in this project means GIBS imagery, EONET events and the NASA Image and Video Library. The project is not affiliated with or endorsed by NASA.

Deadlines (Eastern time): draft on Devpost by midnight Saturday; feature freeze 9:30 AM Sunday; final Devpost submission 12:00 PM Sunday, no late entries; judging 1:15 to 2:15 PM Sunday, about 2 minutes of live demo and then questions.
