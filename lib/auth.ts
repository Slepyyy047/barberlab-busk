import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { getDatabase } from './store';

export const SESSION_COOKIE = 'barberlab_admin';
export const SESSION_TTL_SECONDS = 60 * 60 * 12;
const SCRYPT_BYTES = 64;
const LOGIN_WINDOW_MS = 15 * 60_000;
const ACCOUNT_ATTEMPT_LIMIT = 10;
const GLOBAL_ATTEMPT_LIMIT = 100;
const DUMMY_PASSWORD_HASH = hashPassword('invalid-login-placeholder');

export function hashPassword(password: string, salt = randomBytes(16).toString('hex')): string {
  return `${salt}:${scryptSync(password, salt, SCRYPT_BYTES).toString('hex')}`;
}

export function verifyPassword(password: string, encoded: string): boolean {
  const [salt, expectedHex, extra] = encoded.split(':');
  if (!salt || !expectedHex || extra || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(expectedHex)) return false;
  const actual = scryptSync(password, salt, SCRYPT_BYTES);
  const expected = Buffer.from(expectedHex, 'hex');
  return timingSafeEqual(actual, expected);
}

export function provisionAdmin(username: string, password: string): void {
  const cleanUsername = username.trim();
  if (cleanUsername.length < 2 || cleanUsername.length > 80) throw new Error('Ім’я адміністратора має містити від 2 до 80 символів.');
  if (password.length < 12 || password.length > 256) throw new Error('Пароль адміністратора має містити від 12 до 256 символів.');
  const db = getDatabase();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT INTO admins (username, password_hash, created_at) VALUES (?, ?, ?) ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash')
      .run(cleanUsername, hashPassword(password), new Date().toISOString());
    db.prepare('DELETE FROM sessions WHERE username = ?').run(cleanUsername);
    db.prepare('DELETE FROM login_limits WHERE key = ?').run(accountLimitKey(cleanUsername));
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function digest(token: string): string { return createHash('sha256').update(token).digest('hex'); }
function accountLimitKey(username: string): string { return `account:${digest(username.trim().toLowerCase())}`; }

export function createSession(username: string): { token: string; expiresAt: number } {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const database = getDatabase();
  database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
  database.prepare('INSERT INTO sessions (token_hash, username, expires_at) VALUES (?, ?, ?)').run(digest(token), username, expiresAt);
  return { token, expiresAt };
}

export function getSession(request: NextRequest): string | null {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 128) return null;
  const row = getDatabase().prepare('SELECT username FROM sessions WHERE token_hash = ? AND expires_at > ?').get(digest(token), Date.now()) as { username: string } | undefined;
  return row?.username ?? null;
}

export function deleteSession(request: NextRequest): void {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token && token.length <= 128) getDatabase().prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest(token));
}

export function checkLogin(username: string, password: string): { ok: true } | { ok: false; limited: boolean } {
  const now = Date.now();
  const db = getDatabase();
  const cleanUsername = username.trim();
  const accountKey = accountLimitKey(cleanUsername);
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('DELETE FROM login_limits WHERE reset_at <= ?').run(now);
    const readLimit = db.prepare('SELECT count FROM login_limits WHERE key = ?');
    const account = readLimit.get(accountKey) as { count: number } | undefined;
    const global = readLimit.get('global') as { count: number } | undefined;
    if ((account?.count ?? 0) >= ACCOUNT_ATTEMPT_LIMIT || (global?.count ?? 0) >= GLOBAL_ATTEMPT_LIMIT) {
      db.exec('COMMIT');
      return { ok: false, limited: true };
    }
    const user = db.prepare('SELECT password_hash FROM admins WHERE username = ?').get(cleanUsername) as { password_hash: string } | undefined;
    const valid = verifyPassword(password, user?.password_hash ?? DUMMY_PASSWORD_HASH) && Boolean(user);
    if (valid) {
      db.prepare('DELETE FROM login_limits WHERE key = ?').run(accountKey);
      db.exec('COMMIT');
      return { ok: true };
    }
    const increment = db.prepare('INSERT INTO login_limits (key, count, reset_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1');
    increment.run(accountKey, now + LOGIN_WINDOW_MS);
    increment.run('global', now + LOGIN_WINDOW_MS);
    db.exec('COMMIT');
    return { ok: false, limited: false };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function hasSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin || origin === 'null') return false;
  try {
    const suppliedOrigin = new URL(origin);
    if (origin !== suppliedOrigin.origin) return false;
    const configuredOrigin = process.env.BARBERLAB_APP_ORIGIN;
    if (configuredOrigin) return suppliedOrigin.origin === new URL(configuredOrigin).origin;
    const loopback = (host: string) => host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
    if (!loopback(request.nextUrl.hostname)) return false;
    if (suppliedOrigin.origin === request.nextUrl.origin) return true;
    const host = request.headers.get('host');
    if (!host) return false;
    const hostOrigin = new URL(`${request.nextUrl.protocol}//${host}`);
    return loopback(hostOrigin.hostname) && hostOrigin.port === request.nextUrl.port && suppliedOrigin.origin === hostOrigin.origin;
  } catch { return false; }
}
