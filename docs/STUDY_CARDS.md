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
