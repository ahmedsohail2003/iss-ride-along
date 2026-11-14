# Checkpoints (newest first)

Suggestions go in the team's Discord group chat. Each one gets an answer in the next checkpoint: yes, later, or no with the reason.

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
