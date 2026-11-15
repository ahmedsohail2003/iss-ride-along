// M7: every live source may fail. Each one that does adds one line here, naming the source and
// saying what the page uses instead, and the page carries on. The list sits on the first screen
// (#source-warnings) and is hidden while it is empty. A source that works again removes its line.
export const SOURCE_NAMES = {
  celestrak: 'CelesTrak',
  gibs: 'NASA GIBS',
  eonet: 'NASA EONET',
  wheretheiss: 'wheretheiss.at',
  forecast: 'Open-Meteo forecast',
  places: 'Open-Meteo place search',
  exa: 'Exa',
  ai: 'AI provider',
} as const;

export type SourceKey = keyof typeof SOURCE_NAMES;

const lines = new Map<SourceKey, string>();

function render(): void {
  const ul = document.getElementById('source-warnings');
  if (!ul) return;
  ul.replaceChildren(
    ...[...lines.entries()].map(([k, text]) => {
      const li = document.createElement('li');
      li.dataset.source = k;
      li.textContent = text;
      return li;
    }),
  );
  ul.hidden = lines.size === 0;
  document.body.dataset.warnings = [...lines.keys()].join(' ');
}

/** Show (or replace) the warning line for one source. The text must name the source. */
export function warnSource(key: SourceKey, text: string): void {
  lines.set(key, text);
  render();
}

/** The source answered again: remove its line. */
export function clearSource(key: SourceKey): void {
  if (lines.delete(key)) render();
}

export const warningsHtml = `<ul id="source-warnings" class="warnings" role="status" aria-label="Sources that could not be reached" hidden></ul>`;
