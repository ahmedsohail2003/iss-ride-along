# Setting up the demo laptop

One of Quinn's, Denim's or Armeis's laptops is the demo laptop at the table on Sunday (judging 1:15 to 2:15 PM). The project is a web page, so there is nothing to install.

## Tonight (about 10 minutes)

1. Open https://ahmedsohail2003.github.io/iss-ride-along/ in Chrome and bookmark it.
2. Open [CODE_TOUR.md](../CODE_TOUR.md) on GitHub in a second tab, for when a judge asks to see the code.
3. Make a free Gemini key at https://aistudio.google.com on your own Google account. Save it in your password manager. Never put a key in the chat, a doc or the repo.
4. On the live page, click the "Settings" tab (in the row of tabs under the first screen) and open "Settings: AI keys". Paste the key into "Gemini key" and tick "keep until this tab is closed". The button "Plan my sighting" at the top now reads "Plan my sighting (AI: Gemini)".
5. Press the trip example ("Ypsilanti until Monday, then Chicago Tuesday to Thursday, kids in bed by 8:30"). In about 10 seconds you should get a result card and a Steps list. Close the settings box, take a screenshot and post it in the team chat.
6. Optional: an Exa key from the hacker credit goes in "Exa key (optional)". The web search also works without one.
7. Download the backup copy of the page, [iss-ride-along-offline.html](iss-ride-along-offline.html), and check it opens with a double-click. Have a second device (a phone is fine) with the live page open as a spare.

## Sunday morning

- 9:00 AM: press the trip example once to confirm the key still works. The key is forgotten when the tab is closed, so paste it again if you closed it.
- Before judging: charger in, sleep and notifications off, the settings box closed, the live page in one tab and the code tour in another.

## If something goes wrong at the table

- **The AI does not answer:** the page falls back to the fixed plan by itself and says why. Say: "this is the plan for one city without AI; the scoring rule is the same." Paste the key again between judges.
- **The page will not load:** use the spare device, then the backup file.
- **The reference check fails:** say what it normally shows and point to the saved test (10 of 10 samples within 1 metre of the other tracker).

## Optional: run it from the code

Install Node.js 22 and git, then `git clone https://github.com/ahmedsohail2003/iss-ride-along`, `npm install`, `npm run dev`. See [RUN.md](../RUN.md).
