'use client';
import ArrowIcon from '@/components/ArrowIcon';


import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Content, GalleryImage, Review, Service, Staff } from '@/lib/types';

type Section = 'services' | 'staff' | 'gallery' | 'settings' | 'reviews';
type Notice = { kind: 'error' | 'success'; text: string } | null;

const emptyContent: Content = {
  services: [], staff: [], gallery: [], reviews: [],
  settings: {
    name: '', descriptor: '', address: '', phone: '', phoneLink: '', bookingUrl: '',
    instagram: '', tiktok: '', facebook: '', hours: '', weeklyHours: [], amenities: [], rating: 0, reviewCount: 0,
  },
};

async function responseError(response: Response) {
  const payload = await response.json().catch(() => ({}));
  return typeof payload.error === 'string' ? payload.error : 'Сталася помилка. Спробуйте ще раз.';
}

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export default function AdminPanel() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentReady, setContentReady] = useState(false);
  const [username, setUsername] = useState('');
  const [csrfToken, setCsrfToken] = useState('');
  const [password, setPassword] = useState('');
  const [content, setContent] = useState<Content>(emptyContent);
  const [savedContent, setSavedContent] = useState<Content>(emptyContent);
  const [section, setSection] = useState<Section>('services');
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const dirty = useMemo(() => JSON.stringify(content) !== JSON.stringify(savedContent), [content, savedContent]);

  const loadContent = useCallback(async () => {
    setContentReady(false);
    setContentLoading(true);
    try {
      const response = await fetch('/api/admin/content', { cache: 'no-store' });
      if (!response.ok) throw new Error(await responseError(response));
      const data = await response.json() as Content;
      setContent(data);
      setSavedContent(data);
      setContentReady(true);
    } finally {
      setContentLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/api/admin/session', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return { authenticated: false };
        return response.json() as Promise<{ authenticated: boolean; csrfToken?: string }>;
      })
      .then(async ({ authenticated: isAuthenticated, csrfToken: token }) => {
        if (!active) return;
        setAuthenticated(isAuthenticated);
        setCsrfToken(token ?? '');
        if (isAuthenticated) {
          try { await loadContent(); }
          catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Не вдалося завантажити дані.' }); }
        }
      })
      .catch(() => { if (active) setNotice({ kind: 'error', text: 'Не вдалося перевірити авторизацію.' }); })
      .finally(() => { if (active) setCheckingSession(false); });
    return () => { active = false; };
  }, [loadContent]);

  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (dirty) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);

  const updateContent = (updater: (previous: Content) => Content) => setContent((previous) => updater(previous));
  const switchSection = (next: Section) => {
    if (next === section) return;
    if (dirty && !window.confirm('Є незбережені зміни. Перейти без збереження?')) return;
    setSection(next);
    setNotice(null);
  };

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice(null);
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const session = await fetch('/api/admin/session', { cache: 'no-store' });
      const result = await session.json() as { authenticated: boolean; csrfToken?: string };
      if (!result.authenticated || !result.csrfToken) throw new Error('Сесію не створено. Перевірте облікові дані.');
      setCsrfToken(result.csrfToken);
      setAuthenticated(true); setPassword('');
      await loadContent();
      setNotice({ kind: 'success', text: 'Вхід виконано.' });
    } catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Не вдалося увійти.' }); }
    finally { setBusy(false); }
  }

  async function logout() {
    if (dirty && !window.confirm('Є незбережені зміни. Вийти без збереження?')) return;
    setBusy(true); setNotice(null);
    try {
      const response = await fetch('/api/admin/logout', { method: 'POST', headers: { 'X-CSRF-Token': csrfToken } });
      if (!response.ok) throw new Error(await responseError(response));
      setAuthenticated(false); setCsrfToken(''); setContent(emptyContent); setSavedContent(emptyContent);
      setNotice({ kind: 'success', text: 'Ви вийшли з адмінпанелі.' });
    } catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Не вдалося завершити сесію.' }); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!contentReady) return;
    const validationError = validateContent(content);
    if (validationError) { setNotice({ kind: 'error', text: validationError }); return; }
    setBusy(true); setNotice(null);
    try {
      const response = await fetch('/api/admin/content', {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify(content),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const result = await response.json().catch(() => null) as Content | { content?: Content } | null;
      const persisted = result && 'content' in result && result.content ? result.content : result && 'services' in result && Array.isArray(result.services) ? result as Content : content;
      setContent(persisted); setSavedContent(persisted);
      setNotice({ kind: 'success', text: 'Зміни збережено.' });
    } catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Не вдалося зберегти зміни.' }); }
    finally { setBusy(false); }
  }

  async function upload(file: File) {
    setUploading(true); setNotice(null);
    try {
      const body = new FormData(); body.append('file', file);
      const response = await fetch('/api/admin/upload', { method: 'POST', headers: { 'X-CSRF-Token': csrfToken }, body });
      if (!response.ok) throw new Error(await responseError(response));
      const result = await response.json() as { src: string };
      if (!result.src) throw new Error('Сервер не повернув адресу файлу.');
      return result.src;
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Не вдалося завантажити фото.' });
      return null;
    } finally { setUploading(false); }
  }

  async function deleteImage(src: string) {
    if (!contentReady) return;
    if (dirty) {
      setNotice({ kind: 'error', text: 'Спершу збережіть зміни. Видалення фото одразу оновлює опублікований вміст.' });
      return;
    }
    if (!window.confirm('Видалити це фото з галереї та сховища?')) return;
    setBusy(true); setNotice(null);
    try {
      const response = await fetch('/api/admin/upload', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify({ src }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const removeReferences = (previous: Content) => ({
        ...previous,
        gallery: previous.gallery.filter((item) => item.src !== src),
        staff: previous.staff.map((person) => person.portrait === src ? { ...person, portrait: null } : person),
      });
      setContent(removeReferences);
      setSavedContent(removeReferences);
      setNotice({ kind: 'success', text: 'Фото видалено.' });
    } catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Не вдалося видалити фото.' }); }
    finally { setBusy(false); }
  }

  async function retryContentLoad() {
    setNotice(null);
    try { await loadContent(); }
    catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Не вдалося завантажити дані.' }); }
  }

  if (checkingSession) return <div className="admin-shell"><p className="admin-loading">Перевіряємо доступ…</p></div>;
  if (!authenticated) return (
    <div className="admin-shell admin-login-wrap">
      <section className="admin-login" aria-labelledby="login-title">
        <Link className="admin-eyebrow" href="/">BARBERLAB <span>·</span> КАБІНЕТ</Link>
        <p className="admin-kicker">КЕРУВАННЯ САЙТОМ</p>
        <h1 id="login-title">Вхід до<br /><em>адмінпанелі.</em></h1>
        <p className="admin-muted">Увійдіть, щоб оновити послуги, команду та інформацію для клієнтів.</p>
        <form className="admin-form" onSubmit={login}>
          <label>Ім’я користувача<input autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} /></label>
          <label>Пароль<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {notice && <NoticeView notice={notice} />}
          <button className="admin-button admin-button-primary" disabled={busy}>{busy ? 'Входимо…' : 'Увійти до кабінету'} <span aria-hidden="true"><ArrowIcon/></span></button>
        </form>
        <Link className="admin-back" href="/"><ArrowIcon direction="left"/> На головну</Link>
      </section>
    </div>
  );

  if (contentLoading || !contentReady) return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <Link className="admin-eyebrow" href="/">BARBERLAB <span>·</span> КАБІНЕТ</Link>
        <button className="admin-button admin-button-quiet" onClick={logout} disabled={busy}>Вийти <ArrowIcon/></button>
      </header>
      <section className="admin-load-error" aria-live="polite">
        {contentLoading ? <p className="admin-loading">Завантажуємо вміст сайту…</p> : <>
          <p className="admin-kicker">ВМІСТ НЕДОСТУПНИЙ</p>
          <h1>Не вдалося завантажити дані.</h1>
          {notice && <NoticeView notice={notice} />}
          <button className="admin-button admin-button-primary" onClick={retryContentLoad} disabled={contentLoading}>Спробувати ще раз <ArrowIcon/></button>
        </>}
      </section>
    </div>
  );

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <Link className="admin-eyebrow" href="/">BARBERLAB <span>·</span> КАБІНЕТ</Link>
        <div className="admin-top-actions"><span className={dirty ? 'admin-dirty' : 'admin-clean'}>{dirty ? '● Є незбережені зміни' : '● Усі зміни збережено'}</span><button className="admin-button admin-button-quiet" onClick={logout} disabled={busy}>Вийти <ArrowIcon/></button></div>
      </header>
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <p className="admin-kicker">РОБОЧИЙ ПРОСТІР</p>
          <h1>Керування<br /><em>BARBERLAB</em></h1>
          <nav className="admin-nav" aria-label="Розділи адмінпанелі">
            {([
              ['services', '01', 'Послуги', content.services.length], ['staff', '02', 'Команда', content.staff.length],
              ['gallery', '03', 'Галерея', content.gallery.length], ['settings', '04', 'Інформація', null], ['reviews', '05', 'Відгуки', content.reviews.length],
            ] as const).map(([key, number, label, count]) => <button key={key} className={section === key ? 'admin-nav-item active' : 'admin-nav-item'} onClick={() => switchSection(key)} aria-current={section === key ? 'page' : undefined}><span>{number}</span>{label}{count !== null && <small>{count}</small>}</button>)}
          </nav>
          <p className="admin-sidebar-note">Зміни з’являться на сайті після збереження.</p>
        </aside>
        <section className="admin-workspace">
          <div className="admin-section-heading"><div><p className="admin-kicker">НАЛАШТУВАННЯ САЙТУ / {sectionTitle(section).toLocaleUpperCase('uk-UA')}</p><h2>{sectionTitle(section)}</h2></div><span className="admin-live"><i /> ПАНЕЛЬ КЕРУВАННЯ</span></div>
          {notice && <NoticeView notice={notice} />}
          {section === 'services' && <ServicesEditor content={content} update={updateContent} />}
          {section === 'staff' && <StaffEditor content={content} update={updateContent} upload={upload} uploading={uploading} />}
          {section === 'gallery' && <GalleryEditor content={content} update={updateContent} upload={upload} uploading={uploading} busy={busy} deleteImage={deleteImage} />}
          {section === 'settings' && <SettingsEditor content={content} update={updateContent} />}
          {section === 'reviews' && <ReviewsEditor content={content} update={updateContent} />}
          <div className="admin-savebar"><span>{dirty ? 'Є зміни, які ще не опубліковано.' : 'Поточна версія опублікована.'}</span><button className="admin-button admin-button-primary" onClick={save} disabled={busy || !contentReady || !dirty}>{busy ? 'Зберігаємо…' : 'Зберегти зміни'} <span aria-hidden="true"><ArrowIcon/></span></button></div>
        </section>
      </div>
    </div>
  );
}

function sectionTitle(section: Section) {
  return ({ services: 'Послуги', staff: 'Команда', gallery: 'Галерея', settings: 'Інформація', reviews: 'Відгуки' })[section];
}

function validateContent(value: Content): string | null {
  for (const service of value.services) {
    if (!service.name.trim() || !service.category.trim()) return 'Заповніть назву та категорію кожної послуги.';
    if (!Number.isFinite(service.price) || service.price < 0 || !Number.isFinite(service.duration) || service.duration < 1) return `Перевірте ціну та тривалість послуги «${service.name}».`;
  }
  if (value.staff.some((person) => !person.name.trim() || !person.level.trim())) return 'Заповніть ім’я та рівень кожного майстра.';
  if (value.gallery.some((image) => !image.alt.trim() || !image.category.trim())) return 'Додайте опис і категорію для кожного фото галереї.';
  if (value.reviews.some((review) => !review.name.trim() || !review.text.trim())) return 'Заповніть ім’я та текст кожного відгуку.';
  if (!value.settings.name.trim()) return 'Вкажіть назву барбершопу в розділі «Інформація».';
  return null;
}

function NoticeView({ notice }: { notice: Exclude<Notice, null> }) {
  return <p className={`admin-notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.kind === 'success' ? '✓' : '!'} {notice.text}</p>;
}

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={wide ? 'admin-field wide' : 'admin-field'}>{label}{children}</label>;
}

function TextInput({ value, onChange, ...props }: { value: string | number; onChange: (value: string) => void; [key: string]: unknown }) {
  return <input {...props} value={value} onChange={(event) => onChange(event.target.value)} />;
}

function ServicesEditor({ content, update }: { content: Content; update: (fn: (previous: Content) => Content) => void }) {
  const blank = (): Service => ({ id: makeId('service'), name: '', price: 0, duration: 30, category: 'Стрижки', note: '', visible: true, order: content.services.length });
  const patch = (id: string, changes: Partial<Service>) => update((previous) => ({ ...previous, services: previous.services.map((item) => item.id === id ? { ...item, ...changes } : item) }));
  const shift = (index: number, delta: number) => update((previous) => {
    const services = [...previous.services]; const next = index + delta;
    if (next < 0 || next >= services.length) return previous;
    [services[index], services[next]] = [services[next], services[index]];
    return { ...previous, services: services.map((item, order) => ({ ...item, order })) };
  });
  return <div className="admin-editor">
    <div className="admin-editor-intro"><p>Ціни та тривалість послуг, які бачать клієнти на сайті.</p><button className="admin-button admin-button-outline" onClick={() => update((previous) => ({ ...previous, services: [...previous.services, blank()] }))}>＋ Додати послугу</button></div>
    {content.services.length === 0 && <p className="admin-empty">Послуг поки немає. Додайте першу.</p>}
    {content.services.map((service, index) => <article className="admin-card" key={service.id}>
      <div className="admin-card-top"><span className="admin-order">{String(index + 1).padStart(2, '0')}</span><strong>{service.name || 'Нова послуга'}</strong><span className={service.visible ? 'admin-chip' : 'admin-chip muted'}>{service.visible ? 'Опубліковано' : 'Приховано'}</span><div className="admin-row-actions"><button aria-label={`Перемістити ${service.name || 'послугу'} вгору`} disabled={index === 0} onClick={() => shift(index, -1)}><ArrowIcon direction="up"/></button><button aria-label={`Перемістити ${service.name || 'послугу'} вниз`} disabled={index === content.services.length - 1} onClick={() => shift(index, 1)}><ArrowIcon direction="down"/></button></div></div>
      <div className="admin-fields"><Field label="Назва"><TextInput required value={service.name} onChange={(name) => patch(service.id, { name })} /></Field><Field label="Категорія"><TextInput required value={service.category} onChange={(category) => patch(service.id, { category })} /></Field><Field label="Ціна, ₴"><TextInput type="number" min="0" required value={service.price} onChange={(raw) => patch(service.id, { price: Number(raw) })} /></Field><Field label="Тривалість, хв"><TextInput type="number" min="1" required value={service.duration} onChange={(raw) => patch(service.id, { duration: Number(raw) })} /></Field><Field label="Примітка" wide><TextInput value={service.note} onChange={(note) => patch(service.id, { note })} /></Field></div>
      <label className="admin-check"><input type="checkbox" checked={service.visible} onChange={(event) => patch(service.id, { visible: event.target.checked })} /> Показувати на сайті</label>
    </article>)}
  </div>;
}

function StaffEditor({ content, update, upload, uploading }: { content: Content; update: (fn: (previous: Content) => Content) => void; upload: (file: File) => Promise<string | null>; uploading: boolean }) {
  const patch = (id: string, changes: Partial<Staff>) => update((previous) => ({ ...previous, staff: previous.staff.map((item) => item.id === id ? { ...item, ...changes } : item) }));
  const add = () => update((previous) => ({ ...previous, staff: [...previous.staff, { id: makeId('staff'), name: '', level: 'Майстер', portrait: null, visible: true, order: previous.staff.length }] }));
  const shift = (index: number, delta: number) => update((previous) => {
    const staff = [...previous.staff]; const next = index + delta;
    if (next < 0 || next >= staff.length) return previous;
    [staff[index], staff[next]] = [staff[next], staff[index]];
    return { ...previous, staff: staff.map((item, order) => ({ ...item, order })) };
  });
  async function onPortrait(event: ChangeEvent<HTMLInputElement>, person: Staff) {
    const file = event.target.files?.[0]; if (!file) return;
    const src = await upload(file); if (src) patch(person.id, { portrait: src });
    event.target.value = '';
  }
  return <div className="admin-editor"><div className="admin-editor-intro"><p>Профілі майстрів, фото та порядок у списку.</p><button className="admin-button admin-button-outline" onClick={add}>＋ Додати майстра</button></div>
    {content.staff.map((person, index) => <article className="admin-card admin-person" key={person.id}>
      <div className="admin-portrait">{person.portrait ? <Image src={person.portrait} alt={`Портрет ${person.name}`} width={164} height={164} unoptimized /> : <span>Фото ще не додано</span>}</div>
      <div className="admin-person-fields"><div className="admin-fields"><Field label="Ім’я"><TextInput required value={person.name} onChange={(name) => patch(person.id, { name })} /></Field><Field label="Рівень майстра"><TextInput value={person.level} onChange={(level) => patch(person.id, { level })} /></Field></div><label className="admin-check"><input type="checkbox" checked={person.visible} onChange={(event) => patch(person.id, { visible: event.target.checked })} /> Показувати на сайті</label>
        <label className="admin-button admin-button-outline admin-upload">{uploading ? 'Завантажуємо…' : 'Завантажити портрет'}<input type="file" accept="image/*" onChange={(event) => onPortrait(event, person)} disabled={uploading} /></label>
      </div><div className="admin-row-actions"><button aria-label={`Перемістити ${person.name || 'майстра'} вгору`} disabled={index === 0} onClick={() => shift(index, -1)}><ArrowIcon direction="up"/></button><button aria-label={`Перемістити ${person.name || 'майстра'} вниз`} disabled={index === content.staff.length - 1} onClick={() => shift(index, 1)}><ArrowIcon direction="down"/></button></div>
    </article>)}
  </div>;
}

function GalleryEditor({ content, update, upload, uploading, busy, deleteImage }: { content: Content; update: (fn: (previous: Content) => Content) => void; upload: (file: File) => Promise<string | null>; uploading: boolean; busy: boolean; deleteImage: (src: string) => Promise<void> }) {
  async function onFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []); event.target.value = '';
    for (const file of files) {
      const src = await upload(file); if (!src) continue;
      update((previous) => ({ ...previous, gallery: [...previous.gallery, { id: makeId('gallery'), src, alt: '', category: 'Барбершоп', visible: true, order: previous.gallery.length }] }));
    }
  }
  const patch = (id: string, changes: Partial<GalleryImage>) => update((previous) => ({ ...previous, gallery: previous.gallery.map((item) => item.id === id ? { ...item, ...changes } : item) }));
  const shift = (index: number, delta: number) => update((previous) => {
    const gallery = [...previous.gallery]; const next = index + delta;
    if (next < 0 || next >= gallery.length) return previous;
    [gallery[index], gallery[next]] = [gallery[next], gallery[index]];
    return { ...previous, gallery: gallery.map((item, order) => ({ ...item, order })) };
  });
  return <div className="admin-editor"><div className="admin-editor-intro"><p>Фотографії простору, робіт та команди.</p><label className="admin-button admin-button-outline admin-upload">{uploading ? 'Завантажуємо…' : '＋ Додати фото'}<input type="file" accept="image/*" multiple onChange={onFiles} disabled={uploading} /></label></div>
    {content.gallery.length === 0 && <p className="admin-empty">Галерея поки порожня. Завантажте перші фото.</p>}
    <div className="admin-gallery-grid">{content.gallery.map((image, index) => <article className="admin-gallery-card" key={image.id}><div className="admin-gallery-image"><Image src={image.src} alt={image.alt || 'Фото галереї'} width={600} height={400} unoptimized /></div><div className="admin-gallery-fields"><Field label="Опис фото"><TextInput value={image.alt} onChange={(alt) => patch(image.id, { alt })} /></Field><Field label="Категорія"><TextInput value={image.category} onChange={(category) => patch(image.id, { category })} /></Field><label className="admin-check"><input type="checkbox" checked={image.visible} onChange={(event) => patch(image.id, { visible: event.target.checked })} /> Публікувати</label><div className="admin-gallery-actions"><button aria-label="Перемістити фото вгору" disabled={busy || index === 0} onClick={() => shift(index, -1)}><ArrowIcon direction="up"/></button><button aria-label="Перемістити фото вниз" disabled={busy || index === content.gallery.length - 1} onClick={() => shift(index, 1)}><ArrowIcon direction="down"/></button><button className="admin-delete" disabled={busy || uploading} onClick={() => deleteImage(image.src)}>Видалити фото</button></div></div></article>)}</div>
  </div>;
}

function SettingsEditor({ content, update }: { content: Content; update: (fn: (previous: Content) => Content) => void }) {
  const settings = content.settings;
  const patch = (key: keyof Content['settings'], value: Content['settings'][keyof Content['settings']]) => update((previous) => ({ ...previous, settings: { ...previous.settings, [key]: value } }));
  const amenities = settings.amenities.join('\n');
  return <div className="admin-editor"><div className="admin-editor-intro"><p>Контактні дані, запис, соцмережі та години роботи.</p></div><article className="admin-card"><div className="admin-fields"><Field label="Назва"><TextInput required value={settings.name} onChange={(value) => patch('name', value)} /></Field><Field label="Опис"><TextInput value={settings.descriptor} onChange={(value) => patch('descriptor', value)} /></Field><Field label="Адреса" wide><TextInput value={settings.address} onChange={(value) => patch('address', value)} /></Field><Field label="Телефон"><TextInput type="tel" value={settings.phone} onChange={(value) => patch('phone', value)} /></Field><Field label="Посилання для дзвінка"><TextInput value={settings.phoneLink} onChange={(value) => patch('phoneLink', value)} /></Field><Field label="Посилання для запису" wide><TextInput type="url" value={settings.bookingUrl} onChange={(value) => patch('bookingUrl', value)} /></Field><Field label="Instagram"><TextInput type="url" value={settings.instagram} onChange={(value) => patch('instagram', value)} /></Field><Field label="TikTok"><TextInput type="url" value={settings.tiktok} onChange={(value) => patch('tiktok', value)} /></Field><Field label="Facebook"><TextInput type="url" value={settings.facebook} onChange={(value) => patch('facebook', value)} /></Field><Field label="Години роботи" wide><textarea rows={3} value={settings.hours} onChange={(event) => patch('hours', event.target.value)} /></Field><Field label="Зручності · кожна з нового рядка" wide><textarea rows={5} value={amenities} onChange={(event) => patch('amenities', event.target.value.split('\n').map((item) => item.trim()).filter(Boolean))} /></Field><Field label="Рейтинг"><TextInput type="number" min="0" max="5" step="0.1" value={settings.rating} onChange={(value) => patch('rating', Number(value))} /></Field><Field label="Кількість відгуків"><TextInput type="number" min="0" value={settings.reviewCount} onChange={(value) => patch('reviewCount', Number(value))} /></Field></div></article><section className="admin-weekly" aria-labelledby="weekly-hours-heading"><div className="admin-weekly-title"><div><p className="admin-kicker">РОЗКЛАД ЗА ДНЯМИ</p><h3 id="weekly-hours-heading">Тижневі години</h3></div><button className="admin-button admin-button-outline" onClick={() => patch('weeklyHours', [...settings.weeklyHours, { day: '', open: '10:00', close: '20:00', closed: false }])}>＋ Додати день</button></div>{settings.weeklyHours.length === 0 && <p className="admin-empty">Тижневий розклад не задано. Зараз використовується загальний опис годин роботи.</p>}{settings.weeklyHours.map((hours, index) => <div className="admin-hours-row" key={`hours-${index}`}><Field label="День"><TextInput value={hours.day} onChange={(day) => patch('weeklyHours', settings.weeklyHours.map((row, i) => i === index ? { ...row, day } : row))} /></Field><Field label="Відкриття"><TextInput type="time" value={hours.open} disabled={hours.closed} onChange={(open) => patch('weeklyHours', settings.weeklyHours.map((row, i) => i === index ? { ...row, open } : row))} /></Field><Field label="Закриття"><TextInput type="time" value={hours.close} disabled={hours.closed} onChange={(close) => patch('weeklyHours', settings.weeklyHours.map((row, i) => i === index ? { ...row, close } : row))} /></Field><label className="admin-check"><input type="checkbox" checked={hours.closed} onChange={(event) => patch('weeklyHours', settings.weeklyHours.map((row, i) => i === index ? { ...row, closed: event.target.checked } : row))} /> Вихідний</label><button className="admin-delete" onClick={() => patch('weeklyHours', settings.weeklyHours.filter((_, i) => i !== index))}>Видалити день</button></div>)}</section></div>;
}

function ReviewsEditor({ content, update }: { content: Content; update: (fn: (previous: Content) => Content) => void }) {
  const patch = (index: number, changes: Partial<Review>) => update((previous) => ({ ...previous, reviews: previous.reviews.map((review, i) => i === index ? { ...review, ...changes } : review) }));
  return <div className="admin-editor"><div className="admin-editor-intro"><p>Відгуки, які відображаються на сайті.</p><button className="admin-button admin-button-outline" onClick={() => update((previous) => ({ ...previous, reviews: [...previous.reviews, { name: '', text: '' }] }))}>＋ Додати відгук</button></div>
    {content.reviews.map((review, index) => <article className="admin-card" key={`review-${index}`}><div className="admin-card-top"><span className="admin-order">{String(index + 1).padStart(2, '0')}</span><strong>{review.name || 'Новий відгук'}</strong><button className="admin-delete" onClick={() => update((previous) => ({ ...previous, reviews: previous.reviews.filter((_, i) => i !== index) }))}>Видалити</button></div><div className="admin-fields"><Field label="Ім’я"><TextInput required value={review.name} onChange={(name) => patch(index, { name })} /></Field><Field label="Текст відгуку" wide><textarea rows={3} required value={review.text} onChange={(event) => patch(index, { text: event.target.value })} /></Field></div></article>)}
  </div>;
}
