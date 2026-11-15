// G7 part B: a calmer right side and page in the 3D view (CLEAN_ON; the rules are the G7 block of src/style.css,
// under body.clean[data-view="3d"]). The same information in fewer, calmer pieces: the planner's plain controls in
// even label-and-value rows with the nights as one row of chips, the example sentences as quiet pills, and the long
// explanations folded under a "More"-style disclosure (<details class="more">), so each card shows its main fact
// first. Every element and id stays in the page. On the flat page and in print every disclosure is open and its
// summary hidden, so the flat page reads exactly as before.
export const CLEAN_ON = true;

/** The disclosure's markup: a native <details> (Enter and Space open it, Tab reaches its summary). */
export function moreHtml(summary: string, inner: string, extraClass = ''): string {
  if (!CLEAN_ON) return inner;
  return `<details class="more ${extraClass}"><summary>${summary}</summary>${inner}</details>`;
}

/** Keep every disclosure open outside the 3D view (and while printing); closed when the 3D view is entered. */
export function initClean(doc: Document = document, onView?: (view: string | undefined) => void): void {
  if (!CLEAN_ON) return;
  const body = doc.body;
  body.classList.add('clean');
  const all = () => [...doc.querySelectorAll<HTMLDetailsElement>('details.more')];
  let last: string | undefined;
  const sync = () => {
    const v = body.dataset.view;
    if (v === last) return;
    last = v;
    for (const d of all()) d.open = v !== '3d';
    onView?.(v);
  };
  sync();
  new MutationObserver(sync).observe(body, { attributes: true, attributeFilter: ['data-view'] });
  let before: boolean[] = [];
  doc.defaultView?.addEventListener('beforeprint', () => {
    before = all().map((d) => d.open);
    for (const d of all()) d.open = true;
  });
  doc.defaultView?.addEventListener('afterprint', () => {
    all().forEach((d, i) => (d.open = before[i] ?? d.open));
  });
}
