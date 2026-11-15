// A2 step 1: the calendar file for one pass. `.ics` (iCalendar, RFC 5545) is the format every phone
// and laptop calendar opens. One VEVENT with UID, DTSTAMP, DTSTART and DTEND in UTC, SUMMARY,
// DESCRIPTION (where to look, peak height) and a VALARM that fires 10 minutes before the pass starts.
// RFC 5545 rules followed here (checked against the RFC's sections when writing it):
//   3.1    content lines end in CRLF and are folded at 75 octets: a longer line is split and each
//          continuation line starts with one space (we never split inside a UTF-8 character).
//   3.3.5  date-times in UTC are written YYYYMMDDTHHMMSSZ.
//   3.3.11 TEXT values escape backslash, semicolon, comma and line breaks.
//   3.6.1  a VEVENT needs UID and DTSTAMP; 3.6.6 a DISPLAY alarm needs ACTION, TRIGGER, DESCRIPTION.
//   3.7.3 / 3.7.4 a VCALENDAR needs PRODID and VERSION:2.0.
import { compass, type VisiblePass } from '../orbit/passes';
import { deg, fmtClock, localDate } from '../agent/format';

export interface IcsPlace {
  /** "Ypsilanti, Michigan": the part before the comma names the file. */
  name: string;
  /** IANA time zone of the place (the clock times in the description). */
  timeZone: string;
}

export interface IcsFile {
  filename: string;
  text: string;
}

export const ICS_MIME = 'text/calendar;charset=utf-8';
export const ALARM_TRIGGER = '-PT10M';
const PRODID = '-//ISS Ride-Along//Hack the Nest 2026//EN';
const FOLD_OCTETS = 75;

/** "20261114T225628Z": UTC, rounded to the nearest second. */
export function icsUtc(d: Date): string {
  const r = new Date(Math.round(d.getTime() / 1000) * 1000);
  return r.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** RFC 5545 3.3.11 TEXT escaping. */
export function icsText(s: string): string {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

const utf8 = new TextEncoder();

/** RFC 5545 3.1 folding: no line over 75 octets; continuation lines start with one space. */
export function foldLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  let limit = FOLD_OCTETS;
  for (const ch of line) {
    const n = utf8.encode(ch).length;
    if (bytes + n > limit) {
      out.push(cur);
      cur = ' ';
      bytes = 1;
      limit = FOLD_OCTETS;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out;
}

export function slugCity(name: string): string {
  const s = name
    .split(',')[0]
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'place';
}

/** The default description: where to look, how high, how long (engine numbers only). */
export function passDescription(pass: VisiblePass, city: IcsPlace): string[] {
  const s = Math.round((pass.end.getTime() - pass.start.getTime()) / 1000);
  const len = s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
  return [
    `Look ${compass(pass.startAzDeg)} at ${fmtClock(pass.start, city.timeZone)}; it climbs to ${deg(pass.peakElDeg)} in the ${compass(pass.peakAzDeg)} and is visible for ${len}.`,
    'Never look at the Sun.',
  ];
}

/**
 * The calendar file for one pass. `o.description` replaces the default lines (the result card's own
 * lines, so the file says what the card says); `o.uid` defaults to one made from the place and start.
 */
export function passToIcs(pass: VisiblePass, city: IcsPlace, o: { now: Date; uid?: string; description?: string[] }): IcsFile {
  const place = city.name.split(',')[0].trim() || city.name;
  const date = localDate(pass.start, city.timeZone);
  const uid = o.uid ?? `${slugCity(city.name)}-${icsUtc(pass.start)}@iss-ride-along`;
  const desc = [...(o.description ?? passDescription(pass, city)), 'Planned by ISS Ride-Along from public orbit numbers (CelesTrak).'];
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsUtc(o.now)}`,
    `DTSTART:${icsUtc(pass.start)}`,
    `DTEND:${icsUtc(pass.end)}`,
    `SUMMARY:${icsText(`Space station pass over ${place}: look ${compass(pass.startAzDeg)}, up to ${deg(pass.peakElDeg)}`)}`,
    `LOCATION:${icsText(city.name)}`,
    `DESCRIPTION:${icsText(desc.join('\n'))}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsText(`The space station rises in 10 minutes: look ${compass(pass.startAzDeg)}`)}`,
    `TRIGGER:${ALARM_TRIGGER}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  const text = lines.flatMap(foldLine).join('\r\n') + '\r\n';
  return { filename: `iss-pass-${slugCity(city.name)}-${date}.ics`, text };
}
