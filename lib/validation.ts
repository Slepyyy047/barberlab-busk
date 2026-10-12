import type { Content, GalleryImage, Review, Service, Settings, Staff } from './types';

export class ContentValidationError extends Error {}
const fail = (message: string): never => { throw new ContentValidationError(message); };
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : fail('Очікується об’єкт даних.');
const text = (value: unknown, label: string, max = 300): string => typeof value === 'string' && value.trim().length > 0 && value.length <= max ? value.trim() : fail(`Поле «${label}» має містити від 1 до ${max} символів.`);
const optionalText = (value: unknown, label: string, max = 300): string => value === '' ? '' : text(value, label, max);
const bool = (value: unknown, label: string): boolean => typeof value === 'boolean' ? value : fail(`Поле «${label}» має бути логічним.`);
const integer = (value: unknown, label: string, min: number, max: number): number => Number.isInteger(value) && (value as number) >= min && (value as number) <= max ? value as number : fail(`Поле «${label}» має бути числом від ${min} до ${max}.`);
const list = <T>(value: unknown, label: string, max: number, parse: (item: unknown) => T): T[] => {
  if (!Array.isArray(value) || value.length > max) fail(`Перевірте список «${label}» (не більше ${max} записів).`);
  return (value as unknown[]).map(parse);
};
const mediaPath = (value: unknown, label: string): string => {
  const candidate = text(value, label, 220);
  return /^\/(?:api\/media|hosted-media)\/[a-f0-9-]{36}\.webp$/i.test(candidate) ? candidate : fail(`Поле «${label}» має посилатися на завантажене зображення.`);
};
const httpsUrl = (value: unknown, label: string, allowEmpty = false): string => {
  if (allowEmpty && value === '') return '';
  const candidate = text(value, label, 500);
  try { if (new URL(candidate).protocol === 'https:') return candidate; } catch { /* handled below */ }
  return fail(`Поле «${label}» має бути коректним посиланням HTTPS.`);
};
function parseService(value: unknown): Service {
  const v = record(value);
  return { id: text(v.id, 'id', 80), name: text(v.name, 'назва послуги', 120), price: integer(v.price, 'ціна', 0, 1_000_000), duration: integer(v.duration, 'тривалість', 1, 1440), category: text(v.category, 'категорія', 80), note: optionalText(v.note, 'примітка', 500), visible: bool(v.visible, 'видимість'), order: integer(v.order, 'порядок', 0, 10_000) };
}
function parseStaff(value: unknown): Staff {
  const v = record(value);
  return { id: text(v.id, 'id', 80), name: text(v.name, 'ім’я майстра', 100), level: text(v.level, 'рівень майстра', 100), portrait: v.portrait === null || v.portrait === '' ? null : mediaPath(v.portrait, 'портрет'), visible: bool(v.visible, 'видимість'), order: integer(v.order, 'порядок', 0, 10_000) };
}
function parseGallery(value: unknown): GalleryImage {
  const v = record(value);
  return { id: text(v.id, 'id', 80), src: mediaPath(v.src, 'зображення'), alt: text(v.alt, 'опис зображення', 240), category: optionalText(v.category, 'категорія', 80), visible: bool(v.visible, 'видимість'), order: integer(v.order, 'порядок', 0, 10_000) };
}
function parseSettings(value: unknown): Settings {
  const v = record(value);
  const phone = text(v.phone, 'телефон', 40);
  const phoneLink = text(v.phoneLink, 'телефонне посилання', 50);
  if (!/^tel:\+[0-9]{8,15}$/.test(phoneLink)) fail('Телефонне посилання має бути у форматі tel:+380…');
  const weeklyHours = list(v.weeklyHours, 'графік роботи', 7, (item) => {
    const row = record(item);
    const day = text(row.day, 'день тижня', 20);
    if (!['Понеділок','Вівторок','Середа','Четвер','П’ятниця','Субота','Неділя'].includes(day)) fail('Перевірте день у графіку роботи.');
    const closed = bool(row.closed, 'вихідний');
    const time = (input: unknown, label: string) => {
      if (closed && input === '') return '';
      const t = text(input, label, 5);
      return /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(t) ? t : fail(`Поле «${label}» має бути у форматі ГГ:ХХ.`);
    };
    return { day, open: time(row.open, 'час відкриття'), close: time(row.close, 'час закриття'), closed };
  });
  if (new Set(weeklyHours.map((item) => item.day)).size !== weeklyHours.length) fail('Дні тижня не мають повторюватися.');
  const amenities = list(v.amenities, 'зручності', 40, (item) => text(item, 'зручність', 120));
  const rating = v.rating === null ? null : v.rating;
  const reviewCount = v.reviewCount === null ? null : v.reviewCount;
  if ((typeof rating !== 'number' || !Number.isFinite(rating) || rating < 0 || rating > 5)) fail('Оцінка має бути від 0 до 5 або порожньою.');
  if ((!Number.isInteger(reviewCount) || (reviewCount as number) < 0 || (reviewCount as number) > 1_000_000)) fail('Кількість відгуків має бути невід’ємним цілим числом або порожньою.');
  return {
    name: text(v.name, 'назва', 100), descriptor: text(v.descriptor, 'опис', 160), address: text(v.address, 'адреса', 300), phone, phoneLink,
    bookingUrl: httpsUrl(v.bookingUrl, 'посилання для запису'), instagram: httpsUrl(v.instagram, 'Instagram', true), tiktok: httpsUrl(v.tiktok, 'TikTok', true), facebook: httpsUrl(v.facebook, 'Facebook', true),
    hours: text(v.hours, 'години роботи', 300), weeklyHours, amenities, rating: rating as number, reviewCount: reviewCount as number,
  };
}
function parseReview(value: unknown): Review {
  const v = record(value);
  return { name: text(v.name, 'автор відгуку', 100), text: text(v.text, 'текст відгуку', 1000) };
}

export function validateContent(value: unknown): Content {
  const v = record(value);
  const services = list(v.services, 'послуги', 300, parseService);
  const staff = list(v.staff, 'команда', 100, parseStaff);
  const gallery = list(v.gallery, 'галерея', 500, parseGallery);
  const reviews = list(v.reviews, 'відгуки', 100, parseReview);
  const unique = (items: { id: string }[], label: string) => { if (new Set(items.map((item) => item.id)).size !== items.length) fail(`У списку «${label}» є повторені id.`); };
  unique(services, 'послуги'); unique(staff, 'команда'); unique(gallery, 'галерея');
  return { services, staff, gallery, settings: parseSettings(v.settings), reviews };
}

