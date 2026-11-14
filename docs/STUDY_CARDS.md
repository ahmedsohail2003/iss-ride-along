# Study cards

One short card per part of the project. The required part takes 5 minutes and is done out loud: learn the "Say it" sentence, then answer the three judge questions aloud before you read the answers. Then write "card done" and your weakest question in the team chat or your Google Doc. Everything on a card comes from this repository.

Words to know: **TLE** (two-line element set): two lines of numbers that describe the station's orbit at one moment. **SGP4**: the standard model that moves that orbit forward to any time; here it runs through the satellite.js library.

## Card 1: the live tracker and the check against an independent tracker

**Say it:** "The page works out where the space station is every second, inside your own browser, from its published orbit numbers. A button checks our answer against an independent tracker: in the live check the two were 0.729 km apart, about a tenth of a second of the station's travel."

**Judge questions (answer out loud first):**
1. *How do you know the position is right?* A saved test compares our answer with 10 positions recorded from wheretheiss.at, using the same orbit numbers that tracker used, and the largest difference was 0.0003 km (under 1 metre) on 10 of 10 samples. Live, with our newer orbit numbers, the gap was 0.729 km.
2. *Is this NASA's data?* The orbit numbers are not: they come from CelesTrak, which publishes US Space Force tracking data, and the comparison tracker wheretheiss.at is not NASA either. The NASA parts are the map imagery (NASA GIBS), the live natural-events list (NASA EONET) and the astronaut photos (NASA Image and Video Library), each credited on the page. The project is not affiliated with or endorsed by NASA.
3. *Why isn't the difference zero, and does it show where the station really is?* The two trackers may be using orbit numbers of different ages, and errors grow as orbit numbers age, which is why the page shows how old its numbers are. The check shows our math matches another tracker's. It does not measure the station's true position.

**Optional, click and watch (2 min):** open https://ahmedsohail2003.github.io/iss-ride-along/ , watch the marker and the latitude and longitude change for 5 seconds, then press "Check against reference" and read the km. That number is the distance on the ground between our position and wheretheiss.at's position for the same second.

**Optional, explain it back (in your Google Doc):** in 3 or 4 sentences of your own, what is a TLE, what does SGP4 do with it, and what does the "Check against reference" number prove and not prove?

## Card 2: the guides and the code tour

**Say it:** "The code tour follows the page in 8 stops, from the orbit numbers to the dot on the map to the pass predictor, and `npm test` runs 47 checks, including the ones that prove the math against outside sources."

**Judge questions (answer out loud first):**
1. *Walk me through what happens every second.* `tick()` in `src/main.ts` calls `stateAt()` in `src/orbit/orbit.ts` for "now", which runs SGP4 and returns latitude, longitude, altitude and speed, and then the page updates the numbers and moves the marker. `drawTrack()` draws the solid line (one orbit back) and the dashed line (one orbit ahead).
2. *Who wrote this code, and what is the library's part versus yours?* The code was written with Claude Code, an AI coding tool, directed by Ahmed, and every part had to pass automated tests and a separate verification run. The library satellite.js supplies SGP4. The project's own code picks and checks the orbit numbers (`parseIssTle()` in `src/elements.ts` rejects anything that is not the ISS, catalogue number 25544), turns them into the numbers on screen, draws the path, and compares with the reference tracker (`compareWithReference()` in `src/orbit/compare.ts`).
3. *What happens if a data source is down?* The page never waits for the network: it starts on the orbit numbers built into the page or saved by this browser, and tries a CelesTrak download in the background. Only the "Check against reference" button needs the other tracker to answer, and it says so when it cannot reach it.

**Optional, click and watch (3 min):** open [CODE_TOUR.md](../CODE_TOUR.md) and read Stop 2. Then open `src/orbit/orbit.ts` and find `stateAt()`. Then read Stop 7, "how we know it works".

**Optional, explain it back (in your Google Doc):** pick one function from the code tour, for example `compareWithReference()` or `splitAtAntimeridian()`. Open it on GitHub and explain in your own words what goes in, what comes out, and why the project needs it.

## Card 3 (required): the sighting planner, and how to read one run aloud

**Say it:** "The AI only chooses. Every number on the card comes from our own engine, and the audit counts any number the AI made up."

**One real run to read aloud** (the independent check's live run, Nov 14 at 6:22 PM, on Gemini; the sentence was "Ypsilanti until Monday, then Chicago Tuesday to Thursday, kids in bed by 8:30"):

| Step | Tool the AI asked for | What came back |
|---|---|---|
| 1, 2 | `findCity` twice | Ypsilanti, Michigan and Chicago, both from the built-in list |
| 3 | `listVisiblePasses` for Ypsilanti | 8 visible passes in the next days, from our own pass math |
| 4 | `cloudForecast` | the cloud for the hour of each pass, from Open-Meteo: 100%, 36%, 62%, 16%, 10%, 100%, 100%, 0% |
| 5 | `scorePasses` for the Ypsilanti nights (Nov 14 to 16, before 8:30 PM) | the first pass scores 0 (cloud 100%); the second scores 0.24; passes on other nights are "not allowed" |
| 6 to 8 | the same three tools for Chicago (Nov 17 to 19) | 8 passes; the two clear ones fall on nights the traveller is not in Chicago, and the others have 64% to 100% cloud |
| 9 | `stationNews` | the AI wrote its own web search ("ISS reboost orbit maneuver news"); nothing from the last 7 days was shown |
| 10 | `orbitDataAge` | our orbit numbers were 19.2 hours old |
| 11 | `showPass` | the map and clock moved to the chosen pass and a countdown started |

Result card: "Go out Sun, Nov 15 at 6:45 PM in Ypsilanti, Michigan. Look W at 6:45 PM; it climbs to 34° in the NNW and is visible for 4 min 05 s. Cloud 36% for that hour." Audit: 0 unverified numbers. 13.2 seconds, 4 calls to the AI model.

How a pass is scored (the same rule with or without AI): score = (peak height ÷ 90) × (1 − cloud ÷ 100). A pass must start on your nights and inside your times to count.

**Judge questions (answer out loud first):**
1. *Why does this need an AI agent and not just a form?* The form takes one place, one latest time and a set of nights. The agent takes a week in your own words with several places and rules, splits it into parts, runs the engine once per part and picks one pass across them. In our test trip, the agent picks a pass in Chicago on a night the traveller is in Chicago, while the plain form left at its defaults picks a Ypsilanti pass for that same night, when the traveller is not there.
2. *What stops the AI from making numbers up?* It can only pick among pass ids our engine returned; `showPass()` refuses any other id. Every number on the card is written by the engine, not by the model. Then `audit()` reads the model's own sentences and marks any number that no tool gave. In a test with a fake time and a made-up 512 km altitude put into the reply, exactly those 2 were flagged.
3. *What happens with no key, or if the AI is down?* The button runs the fixed plan with no AI for one place: the same engine steps, the same scoring rule, the same Steps list. A bad key, a rate limit or a timeout also ends in the fixed plan, with the reason shown. A plan makes at most 6 calls to the model and is cut off at 30 seconds.

**If a judge asks which AI:** Gemini (model `gemini-4-hydrogen`), tested live on Nov 14. There is an OpenAI adapter behind the same code that is tested only with saved replies, not live, so we do not claim it. The web search is Exa and the cloud forecast is Open-Meteo.

**Optional, click and watch:** on the live page press "Plan my sighting" with no key and read the Steps list. Then, with a key in "Settings: AI keys", press the trip example and compare.

**Optional, explain it back (in your Google Doc):** in your own words, what does the AI decide, and what does our engine decide? Where in the code is the rule that refuses a made-up pass (`src/agent/tools.ts`, `showPass()`)?

