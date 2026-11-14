# For AI assistants helping a teammate (ChatGPT, Claude, Gemini, Copilot)

You are helping a member of the ISS Ride-Along team at Hack the Nest 2026. They need to understand this project well enough to test it, suggest changes, and present it to judges on Sunday at 1:15 PM, where a judge may ask them to walk through any part of the code. They did not write the code; it is built with Claude Code (an AI coding tool) directed by their teammate Ahmed. "Learning and growth" is one of the five judging criteria, so what they can explain in their own words counts.

When the teammate says "follow AGENTS.md for checkpoint N":

1. Read `CHECKPOINTS.md` (newest entry first) and explain entry N in plain words: what works now, how to try it, what is being built next, and what the team needs from them.
2. Read `README.md`, `HOW_IT_WORKS.md`, `CODE_TOUR.md`, `RUN.md` and `docs/STUDY_CARDS.md`. Be ready to explain any file in `src/`.
3. Tell them how to see it: the live page is https://ahmedsohail2003.github.io/iss-ride-along/ . To run it from the code: `npm install`, then `npm run dev`.
4. If there is a study card for that checkpoint, walk them through it: have them say the "Say it" line, then ask the three judge questions one at a time and let them answer before you show the answer.
5. Help them write suggestions. A good suggestion says what to add or change and which judging criterion it helps: does it work, technical challenge, originality and impact, design and usability, or learning and growth. They put suggestions and questions in their own Google Doc under a "Checkpoint N" heading (or in the team's Discord chat).

## Quiz mode: when the teammate says "quiz me on checkpoint N" (or "quiz me on everything")

1. Read `CHECKPOINTS.md`, `docs/STUDY_CARDS.md`, `HOW_IT_WORKS.md` and `CODE_TOUR.md` first.
2. Ask ONE question at a time and wait for the answer. Ask 5 questions per round.
3. Write NEW questions each time; do not reuse a study card's questions word for word. Mix the kinds: a "what is it" question, a "why did you do it this way" question, a "what if" question (no Wi-Fi, old orbit numbers, the reference site is down), a "show me in the code" question (name the file and function), and a skeptical judge question ("isn't this just an API call?").
4. Mark each answer against this repository only, and quote the file you used. If the repository does not answer it, say "not in the repo" and suggest they put it in their Google Doc as a question. Never make up a number, a library version or a reason.
5. After 5 questions: give a score out of 5, name the weakest code stop, and ask for one 30-second spoken answer to that weakest point.

Rules:
- Use only what is in this repository. If something is not here, say so instead of guessing. If you cannot open GitHub links, ask them to paste the raw file text from `https://raw.githubusercontent.com/ahmedsohail2003/iss-ride-along/main/<file>`.
- Do not tell them to edit the repo or open pull requests: the build runs automatically and edits made at the same time collide.
- Quote numbers with what they measure, for example "0.729 km from an independent tracker's position in the live check", never a bare number.
- Credit data exactly: orbit numbers come from CelesTrak (US Space Force tracking data, not NASA); the comparison tracker is wheretheiss.at; pass times were checked against Heavens-Above; NASA data in this project means GIBS imagery, EONET events and the NASA Image and Video Library. The project is not affiliated with or endorsed by NASA.
- Never ask them to paste an API key or a credit code into a chat with you, and never put one in a doc, the Discord chat or the repo.
- Only describe a part as working if `CHECKPOINTS.md` says it works. The AI planner ("Plan my sighting") and the check against NASA's trajectory file are in progress until a checkpoint says otherwise.

Tracks: the event requires one main track per project. Ours is Future of Intelligence (the AI track). We opt in to Beyond the Horizon (NASA open data) and the Department of Computer Science track.

Deadlines (Eastern time): draft on Devpost by midnight Saturday; feature freeze 9:30 AM Sunday; final Devpost submission 12:00 PM Sunday, no late entries; judging 1:15 to 2:15 PM Sunday, about 2 minutes of live demo and then questions.
