# Checkpoints (newest first)

Suggestions and questions go in your own Google Doc under a "Checkpoint N" heading (or in the team's Discord group chat). Each one gets an answer in the next checkpoint: yes, later, or no with the reason.

## Checkpoint 12 — Sunday Nov 15, 12:40 AM EST

**Time left:** 9 hours to our feature freeze (9:30 AM), 11.5 hours to the final Devpost deadline (12:00 PM). Posted quietly; the morning summary comes at about 7:00 AM.

**Everything on the plan is now built and checked.** 159 of 159 automated tests pass, and a fresh copy of the repo installs, tests and builds from the README alone.

**New since checkpoint 11:**
- **The final presenter files.** [docs/PRESENTING.md](docs/PRESENTING.md) and [docs/CUE_SHEET.md](docs/CUE_SHEET.md) are marked "Final version" and match the page as it is now. The 2-minute script is 296 spoken words.
- **A new backup video**, 2 minutes 12 seconds, no sound, showing every part: [docs/demo-backup.mp4](docs/demo-backup.mp4).
- **Forecast lab**, a small extra card behind its own button: NASA greenness pictures of the US corn belt in the 2012 drought and this year, and a forecast of this year's corn harvest from satellite data, scored the way a weather forecast is scored. Its label says plainly what the test found: the harvest forecast has real skill (0.57, where 0 is no better than a trend line and 1 is perfect, over 31 test years), and the same signal has no skill on the corn price (0.00 over 23 years). It is a research demo, not investment advice, and shows no price forecast.
- **A full re-test of every earlier part**, including the comparison with NASA's trajectory and two live runs of the planner on Gemini.

**One thing to know for the table:** in the overnight test one of two live planner runs was slow (the AI did not answer within 15 seconds), and the page fell back to the plan for one city without AI and said why. The second run took 15 seconds and worked. If that happens in front of a judge, say "that is the plan for one city without AI" and press the trip example again. A small fix that retries a slow answer once is being added now.

## Checkpoint 11 — Saturday Nov 14, 11:50 PM EST

**Time left:** 9.5 hours to our feature freeze (9:30 AM Sunday), 12 hours to the final Devpost deadline (12:00 PM Sunday). This one is posted quietly because you are asleep; a summary with what each of you needs before the 9:00 AM run comes at about 7:00 AM.

**New since checkpoint 10 (both passed an independent check):**
- **Drag and zoom the sky.** In the Sky tab you can now drag to look around the whole sky, scroll or pinch to zoom, click a star for its name ("Procyon: magnitude 0.4, 53° above the station's horizon, one of the stars of Canis Minor"), and press "Back to the station's view" to return to what is straight above the station. It also works from the keyboard. The sky is drawn the way star charts are (a stereographic projection, which keeps the shapes of constellations true): measured on screen, the distance between Dubhe and Merak came out 5.374 degrees against a true 5.375.
- **Read aloud.** A "Read aloud" button makes the page speak the sentence for where the station is, once a minute, and speak the plan when one is made. It uses the browser's own voice, needs no account and no microphone, and is off until you press it.
- 147 of 147 automated tests pass.

**Try it:** open https://ahmedsohail2003.github.io/iss-ride-along/ , go to the Sky tab, drag the sky around and click a bright star. Then press "Read aloud".

**Overnight:** a small "forecast lab" card, then a full re-test of every part, fresh orbit numbers, a new backup video, and the final versions of the demo script, the cue sheet and the presenter pack, posted by 6:30 AM. Nothing new gets added after that; from 7:15 AM it is fixes only.

## Checkpoint 10 — Saturday Nov 14, 10:40 PM EST

**Time left:** 11 hours to our feature freeze (9:30 AM Sunday), 13.5 hours to the final Devpost deadline (12:00 PM Sunday).

**New since checkpoint 9 (both passed an independent check):**
- **A clear map (Denim's suggestion).** The map now opens on NASA's cloud-free picture of Earth, so you can see the continents under the station. Yesterday's real satellite photo, with its clouds and the black stripes between the satellite's passes, is one switch away: "Daily satellite photo (with clouds)". It still shows its date and says it is not a live camera. **Denim: open the live page and say whether you can now tell where the station is.**
- **The sky from the station.** A new Sky tab draws the stars and constellations that are straight above the station right now: about 800 stars and 45 constellations, with the bright ones named, and the Sun when the station is in sunlight. It says whether the station is "in sunlight" or "in Earth's shadow", matching the map. The star positions were checked against an independent astronomy library (worst difference 0.03 of an arcsecond for four bright stars), and Polaris sits where it should when the station is placed over latitude 45 north. The star list is an open catalogue, not NASA data, and the page says so.
- 133 of 133 automated tests pass.

**For the demo:** in beat 3 Armeis now turns on the "Daily satellite photo" switch to show the dated NASA picture. [docs/PRESENTING.md](docs/PRESENTING.md) and [docs/CUE_SHEET.md](docs/CUE_SHEET.md) are updated.

**Try it:** open https://ahmedsohail2003.github.io/iss-ride-along/ . Look at the map, flip the daily-photo switch on and off, then open the Sky tab.

**Being built next:** dragging and zooming the sky, the page reading its answer aloud, and a small "forecast lab" card. Then overnight: a full re-test of everything, a refreshed demo script, and a new backup video. The final script will be posted by 6:30 AM.

**Still open for each of you** (before the 9:00 AM timed run at the latest): study cards 3 and 4 out loud, and your own closing line of 12 words at most. Armeis: join the Devpost project and add your school.

## Checkpoint 9 — Saturday Nov 14, 10:00 PM EST

**Time left:** 11.5 hours to our feature freeze (9:30 AM Sunday), 14 hours to the final Devpost deadline (12:00 PM Sunday).

**New since checkpoint 8 (both passed an independent check):**
- **The game.** Open the Game tab and tap where you think the station will be in 10 minutes. Three rounds, and your score is how many kilometres you were off. The best totals are kept on that device. In the check, a first try was 4,312 km off, which shows how fast the station moves: it crosses a continent in 10 minutes.
- **A plain sentence for where it is.** Above the map: "1,610 km southeast of Durban, South Africa, heading southeast, 437 km up." It updates once a minute.
- **A page everyone can use.** Every button can be reached and pressed from the keyboard, the sentence above is read out by a screen reader (the tool blind users run) when it changes, and an automatic accessibility check on 7 states of the page found 0 problems.
- A line under the numbers: "At this height a circular orbit takes 93.0 min at 7.66 km/s", worked out from the height shown.
- 119 of 119 automated tests pass.

**Try it:** open https://ahmedsohail2003.github.io/iss-ride-along/ , go to the Game tab and play three rounds. Then press Tab a few times and watch the yellow outline move from button to button.

**Your feedback since checkpoint 8:**
- Quinn read the day-and-night sentence and said "That sentence looks good to me". Thank you: that is the science check for that part.
- Denim: "The map looks really cloudy ... I would like to use a clear image of the earth instead of the cloudy one so the user can tell where the ISS is." **Adopted, and it is being built next:** the clear NASA image of Earth becomes the default map, and yesterday's real satellite photo (with its clouds and the black stripes between the satellite's passes) moves to a switch, still with its date.
- Denim joined the Devpost project and added his school.

**Being built next:** the clear map, then the star view from the station.

**The list for tonight, as it stands at 10:00 PM:**
| What | Quinn | Denim | Armeis |
|---|---|---|---|
| On the Devpost project | yes | yes | not yet |
| School on the Devpost form | yes | yes | not yet |
| "card done" for cards 3 and 4 | not yet | not yet | not yet |
| Your own closing line (12 words at most) | not yet | not yet | not yet |

The cards and the closing line take about 20 minutes together: [docs/STUDY_CARDS.md](docs/STUDY_CARDS.md) and [docs/PRESENTING.md](docs/PRESENTING.md) section 2. If tonight is not possible, do them before the 9:00 AM timed run.

## Checkpoint 8 — Saturday Nov 14, 9:25 PM EST

**Time left:** 12 hours to our feature freeze (9:30 AM Sunday), 14.5 hours to the final Devpost deadline (12:00 PM Sunday).

**The planner now runs on the demo laptop.** Denim ran the trip example on his laptop with his own Gemini key at 8:58 PM: planned by the AI in 13.7 seconds, 4 AI calls, 0 unverified numbers. Unless one of you says otherwise, Denim's laptop is the demo laptop. Denim: the page forgets the key when the tab is closed, so paste it again at 9:00 AM Sunday.

**New since checkpoint 7 (both passed an independent check):**
- **Day and night on the map.** The night side of Earth is shaded, and the marker says "in sunlight" or "in Earth's shadow, sunrise in 32 min". Under it: "You can see it only when you are in the dark and it is still in sunlight, which happens in the hours after sunset and before sunrise." The edge of the shading was checked against an independent astronomy library at 24 points (worst difference 0.007 of a degree), and the sunrise countdown against a second-by-second search (0 seconds off).
- **The plan now says why.** When the plan picks a later pass than the "next time you can see it" line, the card gives the reason from the engine's own numbers, for example: "Why not the next pass, Sun, Nov 15 at 6:45 PM: it has 36% cloud and climbs only to 33°; this one has 9% cloud and climbs to 48°." And the Place box and the passes table now follow the city you planned for.
- 102 of 102 automated tests pass.

**Try it:** open https://ahmedsohail2003.github.io/iss-ride-along/ and look at the map: the shaded half is night. Then plan for your own city and read the "Why not the next pass" line.

**Being built next:** a small game ("tap where the station will be in 10 minutes"), accessibility (a plain sentence for where the station is, keyboard and screen-reader use), then the star view from the station.

**Still need from you tonight:**
1. Study cards 3 and 4 out loud, then "card done" ([docs/STUDY_CARDS.md](docs/STUDY_CARDS.md)).
2. Your own closing line, 12 words at most, about what you learned ([docs/PRESENTING.md](docs/PRESENTING.md) section 2).
3. Denim and Armeis: your school, for the Devpost form. Armeis: join the Devpost project with the link in the chat.
4. Quinn: one science read. Is the day-and-night sentence quoted above right as written?

## Checkpoint 7 — Saturday Nov 14, 9:00 PM EST

**Time left:** 12.5 hours to our feature freeze (9:30 AM Sunday), 15 hours to the final Devpost deadline (12:00 PM Sunday).

**Devpost: submitted.** Quinn uploaded the backup video and pressed Submit at 8:28 PM, so the midnight draft is done. The entry stays editable until noon tomorrow. On the project now: Ahmed, Quinn and Denim. **Armeis: please join with the link in the chat.**

**New since checkpoint 6 (both passed an independent check):**
- **A first screen a stranger can use.** The page now opens with the map, one box ("Where will you be, and when are you free?") and one line that answers the most common question: "Next time you can see it from Detroit: Sun, Nov 15 6:45 PM, look west, 4 min". Type a city and press Enter and that line answers in about a tenth of a second. Everything else sits in four tabs: All passes, What it is flying over, Accuracy and sources, Settings.
- **Every data source is allowed to fail.** If any of the 8 outside services the page talks to cannot be reached, the page says which one in plain words and keeps working. All 8 were blocked one at a time in the check, and each time the marker kept moving.
- **What the plan hands you.** After a plan, one button downloads a calendar file for the chosen pass with a reminder 10 minutes before, and another prints a one-page briefing: a family sheet or a class handout with three questions. Every number on the sheets comes from our engine and goes through the same audit.
- **A new backup video**, 54 seconds, that opens with a real planner run: [docs/demo-backup.mp4](docs/demo-backup.mp4).
- 92 of 92 automated tests pass.

**Try it:** open https://ahmedsohail2003.github.io/iss-ride-along/ , type your city in the first box and press Enter. Then press "Plan my sighting" and try the calendar button.

**Known small things** (noticed by the check, being fixed next): when the plan picks a later pass than the "next time" line, the page does not yet say why; and after you plan for another city the Place box still shows Ypsilanti.

**Being built next:** those two fixes, then day and night on the map, a small game, accessibility, and, if the night keeps going this well, the star view from the station.

**Still need from you tonight:**
1. **Which laptop is the demo laptop**, and its owner's screenshot of the trip example running with their own Gemini key ([docs/DEMO_LAPTOP.md](docs/DEMO_LAPTOP.md)). The opening of the demo needs it.
2. Study cards 3 and 4 out loud, then "card done" ([docs/STUDY_CARDS.md](docs/STUDY_CARDS.md)).
3. Your own closing line, 12 words at most, about what you learned ([docs/PRESENTING.md](docs/PRESENTING.md) section 2).
4. Denim and Armeis: your school, for the Devpost form.

## Checkpoint 6 — Saturday Nov 14, 8:15 PM EST

**Time left:** under 4 hours to the Devpost draft (midnight tonight), 13 hours to our feature freeze (9:30 AM Sunday), 16 hours to the final Devpost deadline (12:00 PM Sunday).

**New: everything you need to present, written for the three of you.**
- **[docs/PRESENTING.md](docs/PRESENTING.md)**: how to set up the table, the **2-minute demo script** in four beats with who says what, a version of the pitch for each kind of judge (the AI track, the NASA track, the Computer Science track, Best Beginner and the Gemini prize), twelve likely questions, what to do when something breaks, what to do when a judge comes back, and the Sunday morning plan.
- **[docs/CUE_SHEET.md](docs/CUE_SHEET.md)**: one page to keep next to the laptop: what to click, what to say, the few numbers to remember.
- **[docs/PRESENTER_PACK.md](docs/PRESENTER_PACK.md)**: the one-line pitch, the three numbers with what each one counts, every tool in one line, a 90-second click path, 10 judge questions with short answers and the file behind each answer, common mix-ups, and a page for each of you with a "What I learned" box that only you can fill in.
- A check runs on every push: every number in these files appears in our test records, every button they name exists on the page, and the spoken script stays under 300 words (it is 287 now, which reads in about 2 minutes).

**The script in one breath:** Denim opens by pressing the trip example and talks while the Steps list fills in. Denim then shows the audit badge, and Quinn shows the panel comparing us with NASA's trajectory and presses "Check against reference". Armeis shows what the station is flying over and the credits. Everyone closes with one line of their own about what they learned, and Denim asks "What would you like to see?" The speakers are a proposal: swap parts if you want, and say so in the chat.

**Do this tonight (about 30 minutes each):**
1. Read [docs/PRESENTING.md](docs/PRESENTING.md) section 2 and say your own part out loud once.
2. Study cards 3 and 4 in [docs/STUDY_CARDS.md](docs/STUDY_CARDS.md), then "card done" in the chat.
3. Write your own closing line (12 words at most) in your "What I learned" box in [docs/PRESENTER_PACK.md](docs/PRESENTER_PACK.md), by sending it in the chat or your Google Doc.

**Still open from earlier checkpoints:**
- **A YouTube link for the backup video**, so the Devpost entry can be finished and submitted before midnight: download [docs/demo-backup.mp4](docs/demo-backup.mp4), upload it as Unlisted, post the link in the chat.
- Which laptop is the demo laptop, and its owner's screenshot of the trip example running with their own Gemini key ([docs/DEMO_LAPTOP.md](docs/DEMO_LAPTOP.md)). Beat 1 of the script needs that key.
- Denim and Armeis: join the Devpost project (link in the chat) and add your school.

**Being built next:** a first screen a stranger can use in a minute, with every data source allowed to fail without breaking the page; then a calendar file and one-page briefing for the chosen pass, day and night on the map, a small game, and accessibility.

## Checkpoint 5 — Saturday Nov 14, 7:45 PM EST

**Time left:** about 4 hours to the Devpost draft (midnight tonight), 14 hours to our feature freeze (9:30 AM Sunday), 16 hours to the final Devpost deadline (12:00 PM Sunday).

**New since checkpoint 4 (both passed an independent check):**
- **Our orbit math checked against NASA's own trajectory.** NASA's mission control publishes where it predicts the station will be, as a file of positions 4 minutes apart. The page now compares our position with that file and shows the gap. Measured on 360 of NASA's rows within 12 hours of our orbit numbers' timestamp: **1.03 km apart at most, 0.37 km in the middle**. The gap grows as our orbit numbers age: 0.87 km at one day, 1.77 km at a day and a half, 4.76 km at three days. The page shows that age next to the gap, and says NASA's file is a prediction, not a measurement.
- **Why it was hard:** our orbit model and NASA's file use two different coordinate systems. Without converting between them the gap is 26 to 45 km at every one of the 360 rows; with the conversion it is about a kilometre at most. The conversion itself was checked against a published worked example to within 1 metre.
- **A README and a "how we test" list** for anyone who opens the repo, a record of each part's independent check ([docs/VERIFICATION.md](docs/VERIFICATION.md)), and two more safety nets on every push: the docs are checked against the code, and the push is scanned for anything that looks like a key before the live page updates.
- **A backup demo video**, 36 seconds, no sound: [docs/demo-backup.mp4](docs/demo-backup.mp4).
- 78 of 78 automated tests pass.

**Try it:** open https://ahmedsohail2003.github.io/iss-ride-along/ and find the panel "Our math vs NASA's own trajectory" under the numbers. Then open [README.md](README.md).

**Study (required, 5 to 10 min):** [docs/STUDY_CARDS.md](docs/STUDY_CARDS.md), card 4, the check against NASA. Cards 3 and 4 are the two main stories at the table. Say "card done" in the chat when you have done each one out loud.

**Devpost, needs one of you tonight:** the project is saved as a draft, but Devpost will not accept the story step or the Submit button without a demo video link. Please download [docs/demo-backup.mp4](docs/demo-backup.mp4) ("Download raw file" on GitHub), upload it to YouTube as **Unlisted**, and post the link in the chat. Then the entry gets finished and submitted, and we swap in the real video on Sunday morning.

**Being built next:** the presenter pack (10 likely judge questions with short answers, a page per person) and the 2-minute demo script with a cue sheet. After that: a first screen a stranger can use in a minute, a calendar file for the chosen pass, day and night on the map, a small game, accessibility.

**Still need from you:**
- Which laptop is the demo laptop, and its owner's screenshot of the trip example running with their own Gemini key ([docs/DEMO_LAPTOP.md](docs/DEMO_LAPTOP.md)).
- Denim and Armeis: join the Devpost project (link in the chat) and add your school.
- "card done" for cards 3 and 4.

**Your feedback since checkpoint 4:**
- Quinn checked the event app: the midnight draft only has to be on Devpost. Thank you; nothing separate is needed there.

## Checkpoint 4 — Saturday Nov 14, 6:45 PM EST

**Time left:** about 5 hours to the Devpost draft (midnight tonight), 15 hours to our feature freeze (9:30 AM Sunday), 17 hours to the final Devpost deadline (12:00 PM Sunday).

**New: Plan my sighting, the AI part for our main track, is live.**
- At the top of the page there is one box: "Where will you be, and when are you free?" You type your week the way you would say it, for example "Ypsilanti until Monday, then Chicago Tuesday to Thursday, kids in bed by 8:30".
- An AI agent (an AI model that chooses which tools to run, step by step) splits that into parts, runs our own pass math and a cloud forecast for each part, does its own live web search about the station, picks one pass and moves the map to it. A "Steps" list shows every tool it ran and what came back.
- **The AI only chooses. Every number on the result card is written by our own engine**, and an audit marks any number in the AI's sentences that no tool gave.
- **With no key it still works:** the button runs a fixed plan with no AI for one place, using the same scoring rule.
- Checked: 68 of 68 automated tests pass. Four live runs on Google's Gemini (model `gemini-4-hydrogen`) each chose a pass the rule allows, with 0 unverified numbers, in 7 to 11 seconds and 4 model calls. The independent check then ran the trip sentence once more at 6:22 PM: it picked Sunday Nov 15 at 6:45 PM in Ypsilanti (36% cloud forecast) in 13.2 seconds.
- What is true about each AI service: Gemini is live-tested. There is an OpenAI adapter behind the same code that is tested only with saved replies, not live. The web search is Exa, live-tested without a key. The cloud forecast is Open-Meteo.

**Try it:** open https://ahmedsohail2003.github.io/iss-ride-along/ and press "Plan my sighting" (with no key you get the fixed plan). To see the AI: open "Settings: AI keys" under the planner, paste your own Gemini key, tick "keep until this tab is closed", then press the trip example. Setup for the demo laptop is in [docs/DEMO_LAPTOP.md](docs/DEMO_LAPTOP.md).

**Study (required this time, 5 to 10 min):** [docs/STUDY_CARDS.md](docs/STUDY_CARDS.md), card 3. It teaches you to read one planner run aloud, which is the first thing a judge will watch. Say the "Say it" line, answer the three judge questions out loud, then write "card done" and your weakest question in the group chat or your Google Doc.

**Devpost:** the project is created under Ahmed's account (name, tagline, main track Future of Intelligence, opt-ins Beyond the Horizon, the Computer Science track and Best Beginner, the repo link, the AI tools answers). The team invite link is in the Discord chat only. Still open there: Denim and Armeis add their schools; the story step needs the demo video link, so its text waits in [DEVPOST_DRAFT.md](DEVPOST_DRAFT.md) until Sunday morning; the final Submit comes after the video.

**Being built next:** our orbit math checked against NASA mission control's own trajectory file, then the submission text and README, the presenter pack, and the 2-minute demo script (by about 10:30 PM).

**Need from you tonight:**
- The demo laptop's owner: make a free Gemini key at aistudio.google.com on your own Google account, type it into "Settings: AI keys" on the live page, tick "keep until this tab is closed", press the trip example, and post a screenshot of the result and the Steps list in the chat **with the settings box closed**. Say "demo laptop: me".
- Everyone: join the Devpost project with the link in the chat. Denim and Armeis: add your school under "Additional info".
- Everyone: "card done" for card 3.
- Anyone on site: does the event app (the one with our table number) also need the project entered tonight? The packet says "Draft on Devpost and the event app".

**Your feedback since checkpoint 3:**
- Denim asked the organiser: "it is not necessary to use OpenAI's models, Exa search plus Gemini counts perfectly well". Adopted: the planner runs on Gemini with Exa search, and no OpenAI key is needed.
- Denim: this is the first hackathon for Denim, Quinn and Armeis. Adopted: Best Beginner is ticked on Devpost.
- The demo laptop is one of yours (Ahmed's laptop is not at the venue). You decide which.

## Checkpoint 3 — Saturday Nov 14, 5:45 PM EST

**Time left:** about 6 hours to the Devpost draft (midnight tonight), 16 hours to our feature freeze (9:30 AM Sunday), 18 hours to the final Devpost deadline (12:00 PM Sunday).

**The big change: we enter a main track.** The event's Devpost page says "Enter one main track, then opt in to any partner, academic and MLH prizes that fit your project." Beyond the Horizon is a partner track, so it stays as an opt-in on top. Our main track is **Future of Intelligence** (the AI track). Denim and Quinn caught this. The same page gives the five things the judges score: does it work, technical challenge ("real use of the track's technology"), originality and impact, design and usability ("a stranger can use it in a minute"), and learning and growth ("the team picked up a new tool, language or field").

**New since checkpoint 2 (both passed an independent check):**
- **What the station is flying over, from NASA data.** The map shows NASA's daily satellite image with its date ("daily satellite image, 2026-11-13, not a live camera"). A circle shows how much of Earth the station can see (4,595 km across at 438 km altitude in the check run). Under it: NASA's live list of natural events (in the check run, 38 open events reported in the last 30 days: 25 wildfires, 11 sea and lake ice, 2 severe storms), with the nearest one named, and an astronaut photo taken near that spot with its NASA credit. A credits panel says where every piece comes from.
- **When can I see it.** Pick a city (Ypsilanti is the default; 150 more, or type a latitude and longitude) and get every visible pass for the next 5 days: the time, where to look and how high. A pass counts as visible only when the station is at least 10 degrees above your horizon, the Sun is at least 6 degrees below it (so your sky is dark), and the station itself is still in sunlight. Checked for Ypsilanti against Heavens-Above (a well-known pass prediction site): 8 of 8 passes matched, with start times within 1.3 seconds, end times within 4.8 seconds and peak height within 0.57 degrees.
- 47 of 47 automated tests pass (re-run at 5:35 PM).

**Try it:** open https://ahmedsohail2003.github.io/iss-ride-along/ , scroll to "When can I see it?", leave Ypsilanti selected and read the next pass. Then open the credits panel at the bottom.

**Being built next, in this order:**
1. **Plan my sighting (the AI part, for the main track).** You type your week the way you would say it, for example "Ypsilanti until Monday, then Chicago Tuesday to Thursday, kids in bed by 8:30". An AI agent (an AI model that chooses which tools to run, step by step) runs our own pass math and a cloud forecast for each part of the trip, does its own live web search about the station, picks the one pass worth going outside for and moves the map to it. Every step is shown on screen and every number is checked against our own math. Without a key the page still runs a simpler fixed plan for one city.
2. **Our orbit math checked against NASA mission control's own trajectory file**, with the gap shown on the page.
3. The submission text, the presenter pack and the 2-minute demo script (tonight), then a first screen a stranger can use in a minute, a calendar file for the chosen pass, day and night on the map, a small game, and accessibility.

**Study (5 to 10 min, optional this time):** [docs/STUDY_CARDS.md](docs/STUDY_CARDS.md), cards 1 and 2. Do the "Say it" line and the three judge questions out loud, then write "card done" and your weakest question in the group chat or your Google Doc. The next two cards (the planner, and the NASA check) are the ones everyone needs. You can also tell your own AI: "Read https://github.com/ahmedsohail2003/iss-ride-along/blob/main/AGENTS.md and quiz me on checkpoint 3."

**Need from you tonight:**
- Quinn or Denim, by 8:00 PM: ask an organiser or the OpenAI and Exa mentors (1) whether a Future of Intelligence entry must use OpenAI's models or whether Exa search plus Gemini counts, (2) whether there are OpenAI credits for hackers, (3) what the track's prizes are. Post the answers only.
- By 9:00 PM: Denim claims the Exa credit and makes an Exa key on his own account; whoever owns the demo laptop makes a free Gemini key at aistudio.google.com on their own Google account. Keys stay in your own password manager and are typed into the page's settings box on the demo laptop once the planner is live. Never post a key or a code in the chat, a doc or the repo.
- Everyone, by 10:00 PM: which laptop is the demo laptop; is this your first hackathon, yes or no; and check your own sentence under "Who did what" in [DEVPOST_DRAFT.md](DEVPOST_DRAFT.md).
- Denim, by 10:00 PM: make the Devpost draft at https://hack-the-nest.devpost.com/ from [DEVPOST_DRAFT.md](DEVPOST_DRAFT.md), invite the rest of us, and write "draft in" in the chat. Quinn is the backup at 10:45 PM.

**Your feedback on checkpoint 2:**
- Denim and Quinn (we need a main track): adopted, see the top of this entry.
- Quinn ("If the tracking data is found from CelesTrak, then how are we meeting the requirements for the Beyond The Horizon track?"): the orbit numbers are US Space Force tracking data published by CelesTrak, and the page says so. The NASA parts are the imagery, live events and astronaut photos above, and next the check against NASA mission control's trajectory file. Beyond the Horizon's extra criterion is "meaningful use of the partner's tool or data".
- Armeis (code breakdown doc): the part about how the page gets published was mostly right; the corrections are in the chat (we use no React or Tailwind, and the tests check our position against saved samples from a separate tracker). The flight-booking idea is still a different project; a small space-weather panel stays a "later, if there is time" candidate.

**Correction to checkpoint 1:** it said the live difference was 0.74 km and that the station moves about 7.6 km every second. The live-check script measured 0.729 km and 7.67 km per second (HOW_IT_WORKS.md). Use those.

## Checkpoint 2 — Saturday Nov 14, 3:40 PM EST

**Time left:** 18 hours to our feature freeze (9:30 AM Sunday), 20.5 hours to the Devpost deadline (12:00 PM Sunday). The Devpost draft is due at midnight tonight.

**New since checkpoint 1:**
- **A guide for presenting.** `HOW_IT_WORKS.md` explains the project in plain words, `CODE_TOUR.md` walks through the code in 6 stops, and `RUN.md` says how to run it. An automatic check confirms that every file and function the tour names really exists (it found all 13 files and 19 functions).
- **One offline file.** `docs/iss-ride-along-offline.html` (221 KB) is the whole page in a single file. Download it, turn Wi-Fi off, double-click it: the tracker still runs, because the orbit numbers are built in. Tested with the browser offline: the page loaded and made no network requests. The "Check against reference" button needs the internet and says so when offline.
- 14 of 14 automated tests still pass.

**Try it:** open https://github.com/ahmedsohail2003/iss-ride-along/blob/main/docs/iss-ride-along-offline.html , press the download button, and open the file with Wi-Fi off. Then read `HOW_IT_WORKS.md`.

**Next (about 4:00 to 7:30 PM):** what the station is flying over (NASA satellite imagery, NASA's live feed of wildfires and storms, astronaut photos), then "when can I see it from my city".

**Your feedback on checkpoint 1:** Quinn and Denim: "keep going", so we kept going. Armeis: the space-weather idea is kept for after the core parts (NASA has a live feed of solar flares and geomagnetic storms); the flight-booking and station-power ideas are a different project and too big to build and test by noon Sunday.

**Still need from you (Discord or your Google Doc):** are you here through judging on Sunday 1:15 to 2:15 PM, and is this your first hackathon? Who gets 5 people to try the live page? Who asks the NASA mentors what they want to see? Who joins the event's Devpost page and owns the draft due at midnight?

## Checkpoint 1 — Saturday Nov 14, 2:30 PM EST

**Time left:** 19 hours to our feature freeze (9:30 AM Sunday), 21.5 hours to the Devpost deadline (12:00 PM Sunday). The Devpost draft is due at midnight tonight.

**Works now: the live tracker.**
- The page works out where the space station is from its published orbit numbers, using our own orbit math, and shows latitude, longitude, altitude and orbital speed.
- It draws the last orbit (solid line) and the next orbit (dashed line) on a map.
- The "Check against reference" button compares our position with an independent tracker (wheretheiss.at) on the spot. Today the difference was 0.74 km. For scale, the station moves about 7.6 km every second.
- 14 of 14 automated tests pass.

**Try it:** open https://ahmedsohail2003.github.io/iss-ride-along/ , watch the marker move for a few seconds, then press "Check against reference".

**Known small issues:** on a phone-sized screen the map does not follow the marker. The orbit numbers built into the page were fetched at 12:36 PM today; the page shows how old they are.

**Next (by about 4:00 PM):** a plain "how it works" guide and a code tour for presenters, and a single offline file that works without Wi-Fi. After that: NASA imagery and events under the station.

**Need from you (reply in Discord):**
1. Everyone: are you here through judging on Sunday, 1:15 to 2:15 PM? Is this your first hackathon? Windows or Mac?
2. Zach: get 5 people to try the page and write down where each one gets stuck.
3. Quinn: ask the NASA and space-grant mentors what they most want to see in a space station project.
4. Denim: join the event's Devpost page and post its link in the chat.

If nobody answers, we assume everyone stays through judging and Denim owns the Devpost submission.
