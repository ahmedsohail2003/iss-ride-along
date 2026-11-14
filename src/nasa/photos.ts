// Curated astronaut photos from the NASA Image and Video Library (images.nasa.gov). The library
// has no coordinates, so each photo's place and lat / lon were set by hand from its title
// (scripts/snapshot.mjs, CURATED). Only photos whose description credits NASA are included.

export interface CuratedPhoto {
  nasa_id: string;
  place: string;
  /** Approximate position of the place named in the title (set by hand). */
  lat: number;
  lon: number;
  title: string;
  date_created: string;
  center: string | null;
  photographer: string | null;
  secondary_creator: string | null;
  keywords: string[];
  /** The "Credit:" text from NASA's description, e.g. "NASA/Chris Williams". */
  credit: string | null;
  description: string;
  page: string;
}

/**
 * A credit that names NASA and, optionally, a photographer: "NASA" or "NASA/First Last". A partner
 * agency after the slash ("NASA/ESA") is a joint credit and does not count as NASA only.
 */
export const NASA_ONLY_CREDIT = /^NASA(\/(?!(ESA|JAXA|CSA|Roscosmos)\b)[\p{L} .'’-]+)?$/u;

/** The credit line shown under a photo (wording from the research table, plus NASA's own credit). */
export function photoCreditLine(p: Pick<CuratedPhoto, 'nasa_id' | 'credit'>): string {
  const base = `Photo: NASA, Image and Video Library, ${p.nasa_id}`;
  return p.credit && p.credit !== 'NASA' ? `${base} (credit: ${p.credit})` : base;
}

/** Short date (YYYY-MM-DD) the photo was taken, from date_created. */
export function photoDay(p: Pick<CuratedPhoto, 'date_created'>): string {
  return p.date_created.slice(0, 10);
}
