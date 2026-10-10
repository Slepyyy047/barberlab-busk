import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const root = process.cwd();
const port = 3111;
const origin = `http://127.0.0.1:${port}`;
const dataDir = await mkdtemp(path.join(os.tmpdir(), 'barberlab-corrective-'));
const username = `corrective-${randomBytes(5).toString('hex')}`;
const password = `QA-${randomBytes(32).toString('base64url')}-Aa9!`;
const env = { ...process.env, BARBERLAB_DATA_DIR: dataDir, BARBERLAB_TEST_URL: origin, BARBERLAB_ISOLATED: '1', BARBERLAB_ADMIN_USER: username, BARBERLAB_ADMIN_PASSWORD: password };
let server;

function assertPortFree() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', (error) => reject(new Error(`Port ${port} is occupied; refusing to test an unknown process.`, { cause: error })));
    probe.listen(port, '127.0.0.1', () => probe.close((error) => error ? reject(error) : resolve()));
  });
}

try {
  await assertPortFree();
  const provision = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', "import { provisionAdmin } from './lib/auth.ts'; provisionAdmin(process.env.BARBERLAB_ADMIN_USER, process.env.BARBERLAB_ADMIN_PASSWORD);"], { cwd: root, env, encoding: 'utf8', windowsHide: true });
  assert.equal(provision.status, 0, `disposable CMS account provision: ${provision.stderr || provision.stdout}`);
  server = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: root, env, stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true });
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Isolated Next server exited (${server.exitCode}).`);
    try {
      const response = await fetch(`${origin}/services`, { signal: AbortSignal.timeout(1000) });
      if (response.status === 200) { ready = true; break; }
    } catch { /* server is starting */ }
    await delay(500);
  }
  assert.ok(ready, `isolated server did not become ready at ${origin}`);
  const result = spawnSync(process.execPath, ['tests/corrective-browser.mjs'], { cwd: root, env, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `corrective browser test exited with ${result.status}`);
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
