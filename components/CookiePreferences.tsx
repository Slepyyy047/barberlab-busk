'use client';

import Link from 'next/link';
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CONSENT_EVENT, CONSENT_KEY, parseConsent, type Consent } from '@/lib/consent';

let cachedRaw: string | null | undefined;
let cachedConsent: Consent | null = null;
let temporaryConsent: Consent | null = null;
let useTemporary = false;
const subscribers = new Set<() => void>();
const subscribeToClient = () => () => {};
function notify() { for (const callback of subscribers) callback(); }
function snapshot(): Consent | null {
  if (useTemporary) return temporaryConsent;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (raw !== cachedRaw || (cachedConsent && !parseConsent(raw))) {
      cachedRaw = raw;
      cachedConsent = parseConsent(raw);
    }
    return cachedConsent;
  } catch { return temporaryConsent; }
}
function subscribe(callback: () => void) {
  subscribers.add(callback);
  const changed = (event: StorageEvent) => {
    if (event.key === CONSENT_KEY || event.key === null) { useTemporary = false; notify(); }
  };
  window.addEventListener('storage', changed);
  window.addEventListener('focus', callback);
  return () => { subscribers.delete(callback); window.removeEventListener('storage', changed); window.removeEventListener('focus', callback); };
}
function saveConsent(externalMedia: boolean): boolean {
  const value: Consent = { version: 1, necessary: true, externalMedia, savedAt: Date.now() };
  temporaryConsent = value;
  let saved = false;
  try { localStorage.setItem(CONSENT_KEY, JSON.stringify(value)); useTemporary = false; saved = true; }
  catch { useTemporary = true; }
  notify();
  window.dispatchEvent(new Event(CONSENT_EVENT));
  return saved;
}
const Context = createContext<{ externalMedia: boolean; openSettings: () => void }>({ externalMedia: false, openSettings: () => undefined });

export function useCookiePreferences() { return useContext(Context); }

export default function CookiePreferences({ navigation, children }: { navigation: React.ReactNode; children: React.ReactNode }) {
  // Without JavaScript the map cannot load; don't show an undismissable consent overlay.
  const clientReady = useSyncExternalStore(subscribeToClient, () => true, () => false);
  const consent = useSyncExternalStore(subscribe, snapshot, () => null);
  const [requested, setRequested] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [externalMedia, setExternalMedia] = useState(false);
  const [notice, setNotice] = useState('');
  const panel = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const visible = clientReady && (requested || (!consent && !dismissed));

  const openSettings = () => {
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setExternalMedia(consent?.externalMedia ?? false);
    setEditing(true); setRequested(true); setDismissed(false);
  };
  useEffect(() => {
    if (requested) panel.current?.focus({ preventScroll: true });
  }, [requested]);
  const close = () => {
    setRequested(false); setDismissed(true); setEditing(false);
    if (trigger.current?.isConnected) trigger.current.focus();
    else document.getElementById('main')?.focus();
  };
  const choose = (allowed: boolean) => {
    const persisted = saveConsent(allowed);
    setNotice(persisted ? 'Налаштування cookie збережено.' : 'Вибір діє в цій вкладці. Браузер не дозволив зберегти його для наступного візиту.');
    close();
  };

  return <Context.Provider value={{ externalMedia: consent?.externalMedia === true, openSettings }}>
    {navigation}
    {visible && <section ref={panel} tabIndex={-1} className="cookie-banner" aria-labelledby="cookie-title"
      onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); close(); } }}>
      <div className="cookie-panel-content">
        <div className="cookie-panel-heading">
          <h2 id="cookie-title">Трохи про cookie</h2>
          <button className="cookie-close" type="button" onClick={close} aria-label="Закрити налаштування cookie">×</button>
        </div>
        <p>Дозволити Google-карту? Решта сайту й запис працюють без неї.</p>
        <p><Link href="/cookies">Про cookie</Link> · <Link href="/privacy">Приватність</Link></p>
        {editing && <fieldset><legend>Що дозволити</legend>
          <p>Необхідні функції — завжди активні; вони не використовуються для реклами.</p>
          <label className="consent-option"><input type="checkbox" checked={externalMedia} onChange={event => setExternalMedia(event.target.checked)} /> Зовнішній контент: Google-карта</label>
        </fieldset>}
        <div className="cookie-actions">
          <button type="button" onClick={() => choose(false)}>Лише необхідні</button>
          <button type="button" onClick={() => choose(true)}>Дозволити карту</button>
          {editing ? <button type="button" onClick={() => choose(externalMedia)}>Зберегти вибір</button>
            : <button className="cookie-customize" type="button" onClick={() => { setExternalMedia(consent?.externalMedia ?? false); setEditing(true); }}>Налаштувати</button>}
        </div>
      </div>
    </section>}
    <p className="sr-only" role="status">{notice}</p>
    {children}
  </Context.Provider>;
}

export function CookieSettingsButton() {
  const { openSettings } = useCookiePreferences();
  return <button type="button" className="footer-preference" onClick={openSettings}>Налаштування cookie</button>;
}

export function MotionToggle() {
  const [paused, setPaused] = useState(false);
  return <button type="button" className="footer-preference" aria-pressed={paused} onClick={() => {
    document.documentElement.dataset.motionPaused = String(!paused); setPaused(!paused);
  }}>{paused ? 'Відновити анімації' : 'Зупинити анімації'}</button>;
}
