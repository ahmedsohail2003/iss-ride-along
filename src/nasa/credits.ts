// Credit lines shown in the page's credits panel. Wording from the research verdict table
// (.autopilot/research/track-data-sources-cors.md); the GIBS line is NASA's own requested text.

export const CREDIT_GIBS =
  "We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS).";
export const CREDIT_GIBS_LAYERS =
  'Daily image: MODIS Terra Corrected Reflectance (True Color). Built-in base map: Blue Marble Shaded Relief and Bathymetry. Both from NASA EOSDIS GIBS.';
export const CREDIT_EONET = 'Natural events: NASA Earth Observatory Natural Event Tracker (EONET)';
export const CREDIT_EONET_SOURCES =
  "Each event also names the agency that reported it (for example IRWIN for US wildfires, JTWC for tropical storms, NATICE for ice), as EONET lists it.";
export const CREDIT_PHOTOS =
  'Astronaut photos: NASA Image and Video Library (images.nasa.gov), chosen by hand (curated); each photo shows its own NASA ID and credit.';
export const CREDIT_CELESTRAK =
  'Orbital elements: CelesTrak (celestrak.org), GP data from the US Space Force (18 SDS). Not NASA data.';
export const CREDIT_WHERETHEISS = 'Reference positions: Where the ISS at? API (wheretheiss.at). Not NASA data.';
export const CREDIT_NOT_NASA =
  'ISS Ride-Along is a Hack the Nest 2026 hackathon project. Not affiliated with or endorsed by NASA. No NASA logo or insignia is used.';
export const CREDIT_CITIES =
  'Cities: Natural Earth populated places (naturalearthdata.com, public domain), the largest 150 by population';
export const CREDIT_HEAVENS_ABOVE =
  "Pass check: Heavens-Above (heavens-above.com) pass list for Ypsilanti, saved once by hand on 2026-11-14 for our test; the page is not scraped or contacted.";

/** C1: NASA's ISS trajectory file. `created` is the file's own CREATION_DATE (UTC). */
export const creditOem = (created: string) =>
  `ISS trajectory ephemeris (OEM), NASA Johnson Space Center, Flight Operations Directorate (originator NASA/JSC/FOD/TOPO), file created ${created.slice(0, 16).replace('T', ' ')} UTC. A prediction from NASA's model, not a measurement.`;
export const CREDIT_ERFA =
  'Frame conversion: the IAU 1980 nutation table (106 terms) is copied from ERFA (derived from the IAU SOFA library), BSD 3-clause licence; notice in docs/THIRD_PARTY_NOTICES.md.';
