type LogValue = string | number | boolean | null;

// Selected fields only: never log bodies, cookies, credentials or raw error messages.
export function logEvent(level: 'info' | 'error', event: string, fields: Record<string, LogValue> = {}): void {
  process.stderr.write(JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...fields }) + '\n');
}

export function errorCode(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'UNKNOWN';
  return /^[A-Z0-9_]{1,60}$/.test(code) ? code : 'UNKNOWN';
}

export function isStorageError(error: unknown): boolean {
  const code = errorCode(error);
  return ['EACCES', 'EPERM', 'ENOSPC', 'EROFS', 'EIO', 'EMFILE', 'ENFILE', 'ENOTDIR', 'EEXIST'].includes(code) || code.includes('SQLITE');
}
