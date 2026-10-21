export type QualityPref = 'auto' | 'low' | 'medium' | 'high';
export interface Settings { sens: number; bob: boolean; reduced: boolean; quality: QualityPref; tutorialDone: boolean }

const KEY = 'jm.settings';
const reducedDefault = (): boolean => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

export function loadSettings(): Settings {
  const d: Settings = { sens: 1, bob: false, reduced: reducedDefault(), quality: 'auto', tutorialDone: false };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...d, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch { /* ignore */ }
  return d;
}
export function saveSettings(s: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
