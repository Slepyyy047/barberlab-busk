import { DatabaseSync } from 'node:sqlite';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const dataDir = path.resolve(process.env.BARBERLAB_DATA_DIR || 'data');
const db = new DatabaseSync(path.join(dataDir, 'barberlab.sqlite'), { readOnly: true });
let content;
try {
  const row = db.prepare('SELECT json FROM content WHERE id = 1').get();
  if (!row) throw new Error('Public content is missing');
  content = JSON.parse(row.json);
} finally {
  db.close();
}

const publicDir = path.resolve('public/hosted-media');
await mkdir(publicDir, { recursive: true });
const copyPortrait = async (src) => {
  if (!src) return null;
  const match = /^\/api\/media\/([a-f0-9-]{36}\.webp)$/i.exec(src);
  if (!match) throw new Error(`Unsupported portrait path: ${src}`);
  const source = path.join(dataDir, 'uploads', match[1]);
  await readFile(source); // Fail before publishing a snapshot with a broken image.
  await copyFile(source, path.join(publicDir, match[1]));
  return `/hosted-media/${match[1]}`;
};

content.services = content.services.filter((item) => item.visible);
content.staff = await Promise.all(content.staff.filter((item) => item.visible).map(async (item) => ({ ...item, portrait: await copyPortrait(item.portrait) })));
content.gallery = await Promise.all(content.gallery.filter((item) => item.visible).map(async (item) => ({ ...item, src: await copyPortrait(item.src) })));
await writeFile(path.resolve('lib/hosted-content.json'), `${JSON.stringify(content, null, 2)}\n`);
console.log(`Exported ${content.services.length} services, ${content.staff.length} staff, ${content.gallery.length} gallery items.`);
