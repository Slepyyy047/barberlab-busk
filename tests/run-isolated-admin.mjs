import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const repoRoot = process.cwd();
const port = 3101;
const baseURL = `http://127.0.0.1:${port}`;
const dataDir = await mkdtemp(path.join(os.tmpdir(), 'barberlab-admin-e2e-'));
const env = { ...process.env, BARBERLAB_DATA_DIR: dataDir, BARBERLAB_E2E_BASE_URL: baseURL };
let server;
let testStatus = 1;

function assertPortAvailable() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', (error) => reject(new Error(`Port ${port} is occupied; refusing to test an unknown server.`, { cause: error })));
    probe.listen(port, '127.0.0.1', () => probe.close((error) => error ? reject(error) : resolve()));
  });
}

try {
  await assertPortAvailable();
  server = spawn(process.execPath, [path.join(repoRoot, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: repoRoot, env, stdio: ['ignore', 'inherit', 'inherit'],
  });
  server.once('error', (error) => { throw error; });

  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Isolated Next server exited early (${server.exitCode}).`);
    try {
      const response = await fetch(`${baseURL}/admin`, { signal: AbortSignal.timeout(1000) });
      if (response.status === 200) { ready = true; break; }
    } catch { /* the isolated server is still starting */ }
    await delay(500);
  }
  assert.ok(ready, `Isolated Next server did not become ready at ${baseURL}.`);

  const result = spawnSync(process.execPath, ['tests/admin-browser.mjs'], {
    cwd: repoRoot, env, stdio: 'inherit', windowsHide: true,
  });
  testStatus = result.status ?? 1;
  if (result.error) throw result.error;
  if (testStatus !== 0) throw new Error(`Admin browser checks exited with status ${testStatus}.`);
} finally {
  if (server && server.exitCode === null) {
    const stopped = new Promise((resolve) => server.once('exit', resolve));
    server.kill('SIGTERM');
    await Promise.race([stopped, delay(10_000)]);
    if (server.exitCode === null) {
      server.kill('SIGKILL');
      await Promise.race([stopped, delay(2_000)]);
    }
  }
  await rm(dataDir, { recursive: true, force: true });
}

