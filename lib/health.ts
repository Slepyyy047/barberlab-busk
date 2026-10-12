import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { validateContent } from './validation';
import hostedContent from './hosted-content.json';

export async function checkHealth(dataDir = process.env.BARBERLAB_DATA_DIR || path.join(process.cwd(), 'data')): Promise<void> {
  if (process.env.VERCEL) {
    validateContent(hostedContent);
    return;
  }
  // A health probe must not provision a database or apply schema changes.
  const db = new DatabaseSync(path.join(dataDir, 'barberlab.sqlite'), { readOnly: true });
  try {
    db.exec('PRAGMA busy_timeout = 1000;');
    const check = db.prepare('PRAGMA quick_check(1)').get() as Record<string, unknown>;
    if (Object.values(check)[0] !== 'ok') throw new Error('Database check failed');
    const content = db.prepare('SELECT json FROM content WHERE id = 1').get() as { json: string } | undefined;
    if (!content) throw new Error('Content unavailable');
    validateContent(JSON.parse(content.json));
  } finally { db.close(); }
  await access(dataDir, constants.R_OK | constants.W_OK);
  try { await access(path.join(dataDir, 'uploads'), constants.R_OK | constants.W_OK); }
  catch (error) {
    // Before the first upload the writable parent directory is sufficient.
    if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT') throw error;
  }
}
