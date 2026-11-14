# Checkpoints (newest first)

Suggestions go in the team's Discord group chat. Each one gets an answer in the next checkpoint: yes, later, or no with the reason.

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
