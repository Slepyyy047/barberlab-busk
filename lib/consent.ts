export const CONSENT_KEY = 'barberlab_cookie_preferences';
export const CONSENT_EVENT = 'barberlab-consent-changed';
export const CONSENT_TTL = 180 * 24 * 60 * 60 * 1000;
export type Consent = { version: 1; necessary: true; externalMedia: boolean; savedAt: number };

export function parseConsent(raw: string | null, now = Date.now()): Consent | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (value.version !== 1 || value.necessary !== true || typeof value.externalMedia !== 'boolean' ||
      typeof value.savedAt !== 'number' || !Number.isFinite(value.savedAt) || value.savedAt > now || now - value.savedAt >= CONSENT_TTL) return null;
    return { version: 1, necessary: true, externalMedia: value.externalMedia, savedAt: value.savedAt };
  } catch { return null; }
}
