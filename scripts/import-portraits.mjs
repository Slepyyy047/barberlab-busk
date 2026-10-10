import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { getContent, saveContent } from '../lib/store.ts';

const teamDir = path.join(process.cwd(), 'assets', 'team');
const uploadDir = path.resolve(process.env.BARBERLAB_DATA_DIR || path.join(process.cwd(), 'data'), 'uploads');
const portraits = [
  { name: 'Ігор Павлів', file: 'ihor-pavliv.png' },
  { name: 'Роман Падус', file: 'roman-padus.webp' },
  { name: 'Андрій', file: 'andrii.jpeg' },
  { name: 'Надя', file: 'nadia.jpeg' },
  { name: 'Ілля', file: 'illia.jpeg' },
];

function stableUuid(buffer) {
  const bytes = createHash('sha256').update(buffer).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const content = getContent();
const byName = new Map(content.staff.map((person) => [person.name, person]));
const sources = await Promise.all(portraits.map(async ({ name, file }) => {
  const staff = byName.get(name);
  if (!staff) throw new Error(`У базі даних не знайдено майстра «${name}». Жодних змін не збережено.`);
  return { staff, original: await readFile(path.join(teamDir, file)) };
}));

await mkdir(uploadDir, { recursive: true });
for (const { staff, original } of sources) {
  const filename = `${stableUuid(original)}.webp`;
  const src = `/api/media/${filename}`;
  if (staff.portrait && staff.portrait !== src) continue;
  const destination = path.join(uploadDir, filename);
  try { await stat(destination); }
  catch {
    const normalized = await sharp(original, { limitInputPixels: 25_000_000, failOn: 'error' })
      .rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 84 }).toBuffer();
    try { await writeFile(destination, normalized, { flag: 'wx' }); }
    catch (error) { if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST')) throw error; }
  }
  staff.portrait = src;
}

saveContent(content);
console.log(`Імпортовано портрети: ${portraits.map(({ name }) => name).join(', ')}.`);
