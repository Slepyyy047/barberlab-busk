import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { getDatabase } from './store';

export const SESSION_COOKIE = 'barberlab_admin';
export const SESSION_TTL_SECONDS = 60 * 60 * 12;
const SCRYPT_BYTES = 64;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

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
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function digest(token: string): string { return createHash('sha256').update(token).digest('hex'); }

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

export function checkLogin(username: string, password: string, address: string): { ok: true } | { ok: false; limited: boolean } {
  const now = Date.now();
  if (loginAttempts.size > 10_000) {
    for (const [key, attempt] of loginAttempts) if (attempt.resetAt <= now) loginAttempts.delete(key);
  }
  const state = loginAttempts.get(address);
  if (state && state.resetAt > now && state.count >= 10) return { ok: false, limited: true };
  if (!state || state.resetAt <= now) loginAttempts.set(address, { count: 1, resetAt: now + 15 * 60_000 });
  else state.count++;
  const db = getDatabase();
  const user = db.prepare('SELECT username, password_hash FROM admins WHERE username = ?').get(username) as { username: string; password_hash: string } | undefined;
  const hash = user?.password_hash ?? hashPassword('invalid-login-placeholder');
  const valid = verifyPassword(password, hash) && Boolean(user);
  if (valid) { loginAttempts.delete(address); return { ok: true }; }
  return { ok: false, limited: false };
}

export function hasSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const suppliedOrigin = new URL(origin).origin;
    const allowedOrigins = new Set([request.nextUrl.origin]);
    const host = request.headers.get('host');
    if (host) allowedOrigins.add(new URL(`${request.nextUrl.protocol}//${host}`).origin);
    const configuredOrigin = process.env.BARBERLAB_APP_ORIGIN;
    if (configuredOrigin) allowedOrigins.add(new URL(configuredOrigin).origin);
    return allowedOrigins.has(suppliedOrigin);
  } catch { return false; }
}
