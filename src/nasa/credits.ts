// Credit lines shown in the page's credits panel. Wording from the research verdict table
// (.autopilot/research/track-data-sources-cors.md); the GIBS line is NASA's own requested text.

export const CREDIT_GIBS =
  "We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS).";
export const CREDIT_GIBS_LAYERS =
  'Default map: Blue Marble Shaded Relief and Bathymetry (cloud-free; built into the page to zoom 2, from GIBS to zoom 8 when online). Daily photo behind the switch: MODIS Terra Corrected Reflectance (True Color). Both from NASA EOSDIS GIBS.';
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
/** X5: the star view's catalogue and constellation lines (neither is NASA data). */
export const CREDIT_SKY =
  'Star view: star positions and brightness from the XHIP catalogue (Anderson and Francis 2012, VizieR V/137D) and constellation lines from the IAU charts with changes by Olaf Frohn, both as packaged in d3-celestial by Olaf Frohn (BSD 3-Clause licence; notice in docs/THIRD_PARTY_NOTICES.md). Not NASA data.';
/** G1: the 3D globe's library and its Earth picture. */
export const CREDIT_THREE = '3D globe: drawn with three.js 0.187.0 (MIT licence; notice in docs/THIRD_PARTY_NOTICES.md).';
export const creditGlobeImage = (savedOn: string) =>
  `3D globe image: NASA Blue Marble Shaded Relief and Bathymetry from NASA EOSDIS GIBS, one 2048x1024 picture saved into the page on ${savedOn}.`;
/** X6 Forecast lab sources. */
export const CREDIT_NOAA_VHI =
  'Crop signal: NOAA STAR Vegetation Health Index (VHI), weekly by state, cropland only, from the AVHRR and VIIRS instruments (star.nesdis.noaa.gov). NOAA marks this data for experimental use only.';
export const CREDIT_GIBS_NDVI =
  'Greenness images: NASA GIBS, MODIS Terra NDVI 16-day composites (250 m), and the GIBS MODIS_L3_NDVI colour key used to read the colours back as values.';
export const CREDIT_ERS = 'Harvests: USDA Economic Research Service, Feed Grains Yearbook tables, US corn yield per harvested acre.';
/** The IMF corn price is used only for the stored test result; its citation is required. */
export const creditImfPrice = (citation: string) => `Price test: ${citation}`;
