export type QualityPref = 'auto' | 'low' | 'medium' | 'high';
export interface Settings { sens: number; bob: boolean; reduced: boolean; quality: QualityPref; tutorialDone: boolean }

const KEY = 'jm.settings';
const VERSION = 2;
const reducedDefault = (): boolean => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

export function loadSettings(): Settings {
  const d: Settings = { sens: 1, bob: false, reduced: reducedDefault(), quality: 'auto', tutorialDone: false };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings> & { version?: number };
      const quality = ['auto', 'low', 'medium', 'high'].includes(String(parsed.quality)) ? parsed.quality! : d.quality;
      return {
        sens: Number.isFinite(parsed.sens) ? Math.max(.4, Math.min(2, parsed.sens!)) : d.sens,
        // Version one persisted the experimental head bob as enabled for some users.
        bob: parsed.version === VERSION ? parsed.bob === true : false,
        reduced: typeof parsed.reduced === 'boolean' ? parsed.reduced : d.reduced,
        quality,
        tutorialDone: parsed.tutorialDone === true,
      };
    }
  } catch { /* ignore */ }
  return d;
}
export function saveSettings(s: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify({ ...s, version: VERSION })); } catch { /* ignore */ }
}
