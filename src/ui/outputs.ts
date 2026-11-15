// A2: the result card's "take it with you" buttons and the printable one-page sheet.
// Nothing downloads or prints without the user's own click: the agent's makeCalendarFile and
// writeBriefing only prepare the file or the sheet; these buttons hand it over.
// Every text from the web or the model goes on the page with textContent, never as HTML.
import { ICS_MIME } from '../passes/ics';
import type { BriefKind, Sheet } from '../agent/briefing';
import { makeCalendarFile, writeBriefing, type RunContext } from '../agent/tools';

export const outputsHtml = `
      <div id="plan-outputs" class="plan-outputs" hidden>
        <span class="small">Take it with you:</span>
        <button type="button" id="out-ics">Add to calendar (.ics)</button>
        <button type="button" id="out-family">Family sheet</button>
        <button type="button" id="out-class">Class handout</button>
        <p id="out-note" class="small"></p>
      </div>
`;

/** The sheet sits at the end of the page; print shows only the sheet (style.css, @media print). */
export const briefSheetHtml = `
  <section id="brief-sheet" class="brief-sheet" aria-label="One-page briefing" hidden>
    <div class="sheet-bar no-print">
      <button type="button" id="sheet-print">Print this sheet</button>
      <button type="button" id="sheet-close" class="linkish">Close</button>
      <span id="sheet-audit" class="audit"></span>
    </div>
    <article id="sheet-body"></article>
  </section>
`;

const KIND_TEXT: Record<BriefKind, string> = { family: 'family sheet', class: 'class handout' };

export function initOutputs() {
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  let ctx: RunContext | null = null;
  let passId: string | null = null;

  function el(tag: string, text: string, cls?: string) {
    const e = document.createElement(tag);
    e.textContent = text;
    if (cls) e.className = cls;
    return e;
  }

  function renderSheet(s: Sheet) {
    const body = $('sheet-body');
    const parts: HTMLElement[] = [el('h2', s.title)];
    for (const b of s.blocks) {
      parts.push(el('h3', b.heading));
      const ul = document.createElement('ul');
      for (const l of b.lines) {
        const li = el('li', l.text);
        if (l.link) {
          const a = document.createElement('a');
          a.href = l.link;
          a.rel = 'noopener noreferrer';
          a.target = '_blank';
          a.textContent = l.link;
          a.className = 'sheet-link';
          li.append(' ', a);
        }
        ul.append(li);
      }
      parts.push(ul);
    }
    if (s.questions.length) {
      parts.push(el('h3', 'Talk about it'));
      const ol = document.createElement('ol');
      for (const q of s.questions) ol.append(el('li', q));
      parts.push(ol);
    }
    if (s.note) parts.push(el('h3', 'A note from the AI'), el('p', s.note));
    body.replaceChildren(...parts);
    const au = $('sheet-audit');
    au.textContent = s.audit.unverified ? `${s.audit.badge} (not from our engine: ${s.audit.flagged.join(', ')})` : s.audit.badge;
    au.className = s.audit.unverified ? 'audit audit-bad' : 'audit';
    const sheet = $('brief-sheet');
    sheet.hidden = false;
    sheet.dataset.kind = s.kind;
    document.body.dataset.sheet = s.kind;
    sheet.scrollIntoView({ block: 'start' });
  }

  $('out-ics').addEventListener('click', async () => {
    if (!ctx || !passId) return;
    if (ctx.outputs.calendar?.passId !== passId) await makeCalendarFile(ctx, passId, 'button');
    const f = ctx.outputs.calendar;
    if (!f || f.passId !== passId) return;
    const url = URL.createObjectURL(new Blob([f.file.text], { type: ICS_MIME }));
    const a = document.createElement('a');
    a.href = url;
    a.download = f.file.filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    $('out-note').textContent = `Downloaded ${f.file.filename}: open it to add the pass to your calendar, with a reminder 10 minutes before. A phone may save it to Files or Downloads first; open it from there.`;
  });

  for (const kind of ['family', 'class'] as const) {
    $(`out-${kind}`).addEventListener('click', async () => {
      if (!ctx || !passId) return;
      if (ctx.outputs.sheets.get(kind)?.passId !== passId) await writeBriefing(ctx, passId, kind, '', 'button');
      const s = ctx.outputs.sheets.get(kind);
      if (!s || s.passId !== passId) return;
      renderSheet(s);
      $('out-note').textContent = `The ${KIND_TEXT[kind]} is below the page. Press "Print this sheet" to print it or save it as a PDF.`;
    });
  }

  $('sheet-print').addEventListener('click', () => window.print());
  $('sheet-close').addEventListener('click', () => {
    $('brief-sheet').hidden = true;
    delete document.body.dataset.sheet;
  });

  /** Called after every plan: the buttons follow the shown pass; none when there is no pass. */
  return function show(c: RunContext, id: string | null) {
    ctx = c;
    passId = id && c.passes.has(id) ? id : null;
    $('plan-outputs').hidden = !passId;
    $('brief-sheet').hidden = true;
    delete document.body.dataset.sheet;
    const ready = [c.outputs.calendar?.passId === passId ? 'a calendar file' : '', ...[...c.outputs.sheets.values()].filter((s) => s.passId === passId).map((s) => `a ${KIND_TEXT[s.kind]}`)].filter(Boolean);
    $('out-note').textContent = passId
      ? ready.length
        ? `The AI prepared ${ready.join(' and ')}. Nothing downloads or prints until you press a button.`
        : 'A calendar file with a 10-minute reminder, or a one-page sheet to print. Nothing downloads or prints until you press a button.'
      : '';
  };
}
