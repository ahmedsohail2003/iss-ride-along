// Number texts shared by the result card, the trace and the tools. Every number the model is given is
// one of these exact strings, so the number audit (audit.ts) can compare character for character.
// Intl puts a narrow no-break space before "PM" in some engines; we always use a plain space.

const plain = (s: string) => s.replace(/[  ]/g, ' ');

/** "6:45 PM" in the given IANA time zone. */
export function fmtClock(d: Date, timeZone: string): string {
  return plain(d.toLocaleTimeString('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }));
}

/** "Sun, Nov 15" in the given time zone. */
export function fmtDay(d: Date, timeZone: string): string {
  return plain(d.toLocaleDateString('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric' }));
}

/** Local calendar date "2026-11-15" (the "night" a pass belongs to is the local date it starts on). */
export function localDate(d: Date, timeZone: string): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Local 24-hour clock "18:45" (used to compare with the window's earliest and latest times). */
export function localHM(d: Date, timeZone: string): string {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)!.value;
  return `${get('hour')}:${get('minute')}`;
}

/** "Sat" for a local date "2026-11-14" (noon UTC, so no time zone can move it to another day). */
export function weekdayOf(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short' });
}

/** The local dates from `from` for `days` + 1 days ("today plus 5 days" = 6 dates). */
export function nextDates(from: Date, timeZone: string, days: number): string[] {
  const first = localDate(from, timeZone);
  const out: string[] = [];
  const base = new Date(`${first}T12:00:00Z`).getTime();
  for (let i = 0; i <= days; i++) out.push(new Date(base + i * 86_400_000).toISOString().slice(0, 10));
  return out;
}

/** The UTC instant of local midnight at the end of local date `isoDate` in `timeZone`. */
export function endOfLocalDay(isoDate: string, timeZone: string): Date {
  // Start from UTC midnight of the next day and correct by the zone's offset at that moment.
  const next = new Date(new Date(`${isoDate}T00:00:00Z`).getTime() + 86_400_000);
  const asLocal = new Date(next.toLocaleString('en-US', { timeZone }));
  const asUtc = new Date(next.toLocaleString('en-US', { timeZone: 'UTC' }));
  return new Date(next.getTime() + (asUtc.getTime() - asLocal.getTime()));
}

export const pct = (x: number) => `${Math.round(x)}%`;
export const deg = (x: number) => `${Math.round(x)}°`;
