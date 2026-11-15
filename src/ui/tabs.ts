// M7: everything that is not on the first screen opens from a tab (the passes table, the NASA panel,
// the accuracy numbers, the AI keys; anything built later gets a tab here too). One panel is shown
// at a time; the buttons follow the WAI-ARIA tabs pattern (arrow keys move between tabs), except that
// every tab stays in the Tab order (C3: a keyboard user who does not know the arrow-key convention still
// reaches each one with Tab).
export interface TabDef {
  id: string;
  label: string;
  html: string;
}

export function tabsHtml(tabs: TabDef[], open: string): string {
  const buttons = tabs
    .map(
      (t) =>
        `<button type="button" role="tab" class="tab" id="tab-btn-${t.id}" data-tab="${t.id}" aria-controls="tab-${t.id}" aria-selected="${t.id === open}" tabindex="0">${t.label}</button>`,
    )
    .join('');
  const panels = tabs
    .map((t) => `<div role="tabpanel" class="tab-panel" id="tab-${t.id}" aria-labelledby="tab-btn-${t.id}"${t.id === open ? '' : ' hidden'}>${t.html}</div>`)
    .join('');
  return `<section class="tabs-wrap" aria-label="More"><div class="tabs" role="tablist">${buttons}</div>${panels}</section>`;
}

export function initTabs(onOpen?: (id: string) => void): { open(id: string): void } {
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('.tabs [role="tab"]')];
  const open = (id: string) => {
    for (const b of buttons) {
      const on = b.dataset.tab === id;
      b.setAttribute('aria-selected', String(on));
      document.getElementById(`tab-${b.dataset.tab}`)!.hidden = !on;
    }
    document.body.dataset.tab = id;
    onOpen?.(id);
  };
  buttons.forEach((b, i) => {
    b.addEventListener('click', () => open(b.dataset.tab!));
    b.addEventListener('keydown', (e) => {
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      const next = buttons[(i + step + buttons.length) % buttons.length];
      next.focus();
      open(next.dataset.tab!);
    });
  });
  // Any element with data-open-tab="<id>" opens that tab and scrolls to it.
  for (const a of document.querySelectorAll<HTMLElement>('[data-open-tab]')) {
    a.addEventListener('click', () => {
      open(a.dataset.openTab!);
      document.getElementById(`tab-btn-${a.dataset.openTab}`)?.scrollIntoView({ block: 'start' });
    });
  }
  return { open };
}
