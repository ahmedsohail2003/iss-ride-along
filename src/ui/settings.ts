// Keys for the sighting planner. A key lives in memory only. The tick box "keep until this tab is
// closed" stores it in this tab's sessionStorage (wiped when the tab closes), so a reload at the demo
// table does not lose it. Never localStorage, never the page address, never a log line.

export type KeyName = 'gemini' | 'openai' | 'exa';
export const SESSION_KEY = 'iss-ride-along-keys';

/** Status words (PLAN rule 3), the same words as in the README and SUBMISSION.md. */
export const STATUS: Record<KeyName, string> = {
  gemini: 'tested with saved replies, not live-tested',
  openai: 'tested with saved replies, not live-tested',
  exa: 'live-tested without a key; the keyed call is not live-tested',
};

export const PRIVACY_LINE = 'The place you type goes to Open-Meteo and, if you add a key, to that AI provider. Nothing is stored.';

interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export class KeyStore {
  private keys: Record<KeyName, string> = { gemini: '', openai: '', exa: '' };
  keep = false;
  private session: StorageLike | null;

  constructor(session: StorageLike | null) {
    this.session = session;
    const saved = session?.getItem(SESSION_KEY);
    if (saved) {
      try {
        const k = JSON.parse(saved) as Partial<Record<KeyName, string>>;
        this.keys = { gemini: k.gemini ?? '', openai: k.openai ?? '', exa: k.exa ?? '' };
        this.keep = true;
      } catch {
        session?.removeItem(SESSION_KEY);
      }
    }
  }

  get(name: KeyName): string {
    return this.keys[name];
  }

  set(name: KeyName, value: string) {
    this.keys[name] = value.trim();
    this.persist();
  }

  setKeep(on: boolean) {
    this.keep = on;
    this.persist();
  }

  private persist() {
    if (!this.session) return;
    if (this.keep) this.session.setItem(SESSION_KEY, JSON.stringify(this.keys));
    else this.session.removeItem(SESSION_KEY);
  }

  /** The provider to use: OpenAI when an OpenAI key is present, otherwise Gemini; null without a key. */
  defaultProvider(): 'openai' | 'gemini' | null {
    if (this.keys.openai) return 'openai';
    if (this.keys.gemini) return 'gemini';
    return null;
  }
}
