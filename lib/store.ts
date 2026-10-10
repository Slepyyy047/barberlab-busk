import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { seedContent } from './seed';
import type { Content } from './types';
import { validateContent } from './validation';

const dataDir = path.resolve(/* turbopackIgnore: true */ process.env.BARBERLAB_DATA_DIR || path.join(process.cwd(), 'data'));
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'barberlab.sqlite'));
// Set this before journal-mode changes and schema creation so concurrent app workers wait on SQLite locks.
db.exec('PRAGMA busy_timeout = 10000;');
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
db.exec('BEGIN IMMEDIATE;');
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS content (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS admins (username TEXT PRIMARY KEY, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, username TEXT NOT NULL REFERENCES admins(username) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
  `);
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
  db.prepare('INSERT OR IGNORE INTO content (id, json, updated_at) VALUES (1, ?, ?)').run(JSON.stringify(seedContent), new Date().toISOString());
  db.exec('COMMIT;');
} catch (error) {
  db.exec('ROLLBACK;');
  throw error;
}

export function getDatabase(): DatabaseSync { return db; }

export function getContent(): Content {
  const row = db.prepare('SELECT json FROM content WHERE id = 1').get() as { json: string } | undefined;
  if (!row) throw new Error('Сховище вмісту не ініціалізовано.');
  const parsed: unknown = JSON.parse(row.json);
  return validateContent(parsed);
}

export function saveContent(input: unknown): Content {
  const content = validateContent(input);
  db.prepare('INSERT INTO content (id, json, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET json=excluded.json, updated_at=excluded.updated_at')
    .run(JSON.stringify(content), new Date().toISOString());
  return content;
}

export function removeMediaReferences(src: string): void {
  const current = getContent();
  current.gallery = current.gallery.filter((image) => image.src !== src);
  for (const person of current.staff) if (person.portrait === src) person.portrait = null;
  saveContent(current);
}

