// X3 "Listen": a speaker toggle that reads two things aloud with the browser's own speech
// (window.speechSynthesis: built into the browser, free, no key, nothing sent to us):
//   1. C3's sentence above the map, each time the once-a-minute timer refreshes it, and
//   2. the planner's result line, once each time a plan finishes.
// The words spoken are always shown on screen too (the caption), because a ballroom is too loud to hear.
// Off by default; browsers only allow speech after a click, and nobody expects a page to talk.
// When the browser has no speechSynthesis the toggle stays hidden and nothing else changes.
// No microphone. The DOM pieces are passed in, so tests can drive it with plain objects.
import type { Card } from '../agent/fixedPlan';

export interface SynthLike {
  speak(u: unknown): void;
  cancel(): void;
}
export interface VoiceWindow {
  speechSynthesis?: SynthLike;
  SpeechSynthesisUtterance?: new (text: string) => unknown;
}
/** Just what voice.ts touches on the toggle button. */
export interface ToggleLike {
  hidden: boolean | string;
  textContent: string | null;
  setAttribute(name: string, value: string): void;
  addEventListener(type: 'click', fn: () => void): void;
}
export interface CaptionLike {
  hidden: boolean | string;
}
export interface TextLike {
  textContent: string | null;
}

export const VOICE_LABEL_OFF = 'Read aloud: off';
export const VOICE_LABEL_ON = 'Read aloud: on';

export const voiceHtml = `
      <div class="voice-bar">
        <button type="button" id="voice-toggle" class="voice-toggle" aria-pressed="false" hidden>${VOICE_LABEL_OFF}</button>
        <p id="voice-caption" class="small voice-caption" aria-live="off" hidden><span class="voice-said">Spoken:</span> <span id="voice-text"></span></p>
      </div>`;

/** True when this browser can speak: speechSynthesis and the utterance constructor both exist. */
export function voiceSupported(win: VoiceWindow): boolean {
  return 'speechSynthesis' in win && !!win.speechSynthesis && typeof win.SpeechSynthesisUtterance === 'function';
}

/**
 * The planner's result line: the card's headline ("Go out Sunday at 6:45 PM in Ypsilanti.") followed by
 * its first line, which says where to look ("Look southwest at 6:45 PM; it climbs to ..."). With no pass
 * the headline alone ("No visible pass in your window.").
 */
export function resultLine(card: Pick<Card, 'kind' | 'headline' | 'lines'>): string {
  return card.kind === 'pass' && card.lines.length ? `${card.headline} ${card.lines[0]}` : card.headline;
}

export interface Voice {
  supported: boolean;
  isOn(): boolean;
  setOn(on: boolean): void;
  /** Speak this text now and show it in the caption (only does anything while the toggle is on). */
  speak(text: string): void;
  /** C3's sentence was just refreshed: speak exactly the live region's text. */
  sayWhere(text: string): void;
  /** A plan finished: speak exactly its result line. */
  sayPlan(card: Pick<Card, 'kind' | 'headline' | 'lines'>): void;
}

export function initVoice(o: { win: VoiceWindow; toggle: ToggleLike; caption: CaptionLike; captionText: TextLike }): Voice {
  const supported = voiceSupported(o.win);
  let on = false;
  o.toggle.hidden = !supported;
  const render = () => {
    o.toggle.textContent = on ? VOICE_LABEL_ON : VOICE_LABEL_OFF;
    o.toggle.setAttribute('aria-pressed', String(on));
    o.caption.hidden = !on || !o.captionText.textContent;
  };
  const v: Voice = {
    supported,
    isOn: () => on,
    setOn(next) {
      on = supported && next;
      if (!on && supported) o.win.speechSynthesis!.cancel();
      render();
    },
    speak(text) {
      if (!on || !text) return;
      o.captionText.textContent = text;
      render();
      o.win.speechSynthesis!.speak(new o.win.SpeechSynthesisUtterance!(text));
    },
    sayWhere: (text) => v.speak(text),
    sayPlan: (card) => v.speak(resultLine(card)),
  };
  if (supported) o.toggle.addEventListener('click', () => v.setOn(!on));
  render();
  return v;
}
