// A2 step 3: the one-page briefing for one pass, in two kinds: a family sheet and a class handout.
// The engine writes every number on the sheet, each copied from a tool result of this run (the pass
// as planLeg returns it, the cloud source, whatItFliesOver, stationNews, orbitDataAge). The model may
// add at most 3 short sentences. The whole sheet goes through the same number audit as the model's
// words (audit.ts), so a number that no tool returned shows up on the sheet's badge.
import { audit, type AuditResult } from './audit';

export type BriefKind = 'family' | 'class';
export const BRIEF_KINDS: BriefKind[] = ['family', 'class'];

/** The class handout's questions: no numbers in them, so a class can talk before anyone computes. */
export const CLASS_QUESTIONS = [
  'The station makes no light of its own. What are we seeing when it shines?',
  'Why do we see it in the evening or the early morning, but not in the middle of a winter night?',
  'Why does it cross a different part of the sky on different nights?',
];

/** The facts the sheet is written from: each is the exact object a tool returned. */
export interface BriefFacts {
  /** The pass as planLeg returns it (passTexts), plus the leg's cloud source text. */
  pass: Record<string, unknown> & { passId: string; place: string; night: string; start: string; look: string; peak: string; peakDirection: string; length: string; cloud: string; cloudSource: string };
  flies: FliesView;
  news: NewsView | null;
  age: Record<string, string>;
}

export interface FliesView {
  passId: string;
  computedAt: string;
  window: string;
  eventsSource: string;
  events: { title: string; category: string; closest: string; at: string; link: string }[];
  photo: { place: string; title: string; credit: string; page: string } | null;
  note: string | null;
}

export interface NewsView {
  query: string;
  label: string;
  items: { title: string; date: string; link: string }[];
  engineBurnAfterOrbitNumbers: boolean;
  message?: string | null;
}

export interface SheetLine {
  text: string;
  link?: string;
}

export interface Sheet {
  kind: BriefKind;
  passId: string;
  title: string;
  blocks: { heading: string; lines: SheetLine[] }[];
  questions: string[];
  /** The model's sentences (at most 3), or ''. */
  note: string;
  /** Every word printed on the sheet, links included (what the audit reads). */
  text: string;
  audit: AuditResult;
  /** The tool results the audit compared with. */
  toolResults: string[];
}

/** At most three sentences and 400 characters from the model. */
export function threeSentences(s: string): string {
  const parts = String(s ?? '').trim().split(/(?<=[.!?])\s+/);
  return parts.slice(0, 3).join(' ').trim().slice(0, 400);
}

export function buildSheet(kind: BriefKind, f: BriefFacts, note = '', userSentence = ''): Sheet {
  const p = f.pass;
  const title =
    kind === 'class'
      ? `Class handout: watch the space station from ${p.place}`
      : `Space station over ${p.place}: ${p.night} at ${p.start}`;
  const blocks: Sheet['blocks'] = [];
  blocks.push({
    heading: 'When and where to look',
    lines: [
      { text: `${p.night} at ${p.start} (local time), visible for ${p.length}.` },
      { text: `Start looking ${p.look}, low in the sky. It climbs to ${p.peak} above the horizon in the ${p.peakDirection}.` },
      { text: 'It looks like a bright star that moves steadily and does not blink.' },
      { text: 'Never look at the Sun.' },
    ],
  });
  blocks.push({
    heading: 'The sky',
    lines: [{ text: p.cloud === 'unknown' ? `Cloud for that hour: unknown (${p.cloudSource}).` : `Cloud ${p.cloud} for that hour (${p.cloudSource}).` }],
  });
  const way: SheetLine[] = f.flies.events.map((e) => ({ text: `${e.title} (${e.category}): ${e.closest} from the point under the station at ${e.at}.`, link: e.link }));
  if (f.flies.photo) way.push({ text: `NASA astronaut photo of ${f.flies.photo.place}: "${f.flies.photo.title}". ${f.flies.photo.credit}.`, link: f.flies.photo.page });
  if (f.flies.note) way.push({ text: f.flies.note });
  blocks.push({ heading: `What it flies over in ${f.flies.window}`, lines: way });
  const web: SheetLine[] = (f.news?.items ?? []).map((i) => ({ text: `"${i.title}" (${i.date})`, link: i.link }));
  if (!web.length) web.push({ text: f.news ? (f.news.message ?? 'no station news found from the last week') : 'no web search in this run' });
  blocks.push({ heading: 'From the live web (quoted, not checked by us)', lines: web });
  blocks.push({
    heading: 'Computed and sources',
    lines: [
      { text: `Computed ${f.flies.computedAt} in your browser by ISS Ride-Along.` },
      { text: `Pass times: our own math from CelesTrak orbit numbers from ${f.age.orbitNumbersFrom}.` },
      { text: `Cloud: ${p.cloudSource} (weather data by Open-Meteo.com).` },
      { text: `Natural events: ${f.flies.eventsSource}. Photos: NASA Image and Video Library.` },
      { text: 'Web items: Exa web search. Not affiliated with or endorsed by NASA.' },
    ],
  });
  const questions = kind === 'class' ? [...CLASS_QUESTIONS] : [];
  const n = threeSentences(note);
  const text = [
    title,
    ...blocks.flatMap((b) => [b.heading, ...b.lines.flatMap((l) => (l.link ? [l.text, l.link] : [l.text]))]),
    ...(questions.length ? ['Talk about it', ...questions] : []),
    ...(n ? [n] : []),
  ].join('\n');
  const toolResults = [JSON.stringify(f.pass), JSON.stringify(f.flies), JSON.stringify(f.news), JSON.stringify(f.age)];
  return { kind, passId: p.passId, title, blocks, questions, note: n, text, audit: audit(text, toolResults, userSentence), toolResults };
}
