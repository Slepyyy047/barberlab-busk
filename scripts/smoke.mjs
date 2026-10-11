import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const REQUEST_TIMEOUT_MS = 5_000;
const STARTUP_TIMEOUT_MS = 60_000;

async function getFreePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function request(baseUrl, route) {
  return fetch(new URL(route, baseUrl), { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), redirect: 'manual' });
}

export async function runSmoke(baseUrl) {
  const checks = [];

  const health = await request(baseUrl, '/api/health');
  assert.equal(health.status, 200, `health endpoint returned HTTP ${health.status}`);
  const healthBody = await health.json();
  assert.equal(healthBody.status, 'ok', 'health endpoint reports healthy status');
  assert.match(health.headers.get('cache-control') ?? '', /no-store/i, 'health response is not cached');
  checks.push({ name: 'health', status: health.status, body: healthBody });

  for (const route of ['/', '/services', '/team', '/contacts', '/privacy', '/terms', '/cookies', '/licenses']) {
    const response = await request(baseUrl, route);
    assert.equal(response.status, 200, `${route} returned HTTP ${response.status}`);
    assert.match(response.headers.get('content-type') ?? '', /text\/html/i, `${route} returned HTML`);
    const html = await response.text();
    assert.match(html, /<h1\b/i, `${route} contains a page heading`);
    checks.push({ name: route, status: response.status });
  }

  const anonymousAdmin = await request(baseUrl, '/api/admin/content');
  assert.equal(anonymousAdmin.status, 401, `anonymous admin content returned HTTP ${anonymousAdmin.status}`);
  assert.match(anonymousAdmin.headers.get('cache-control') ?? '', /no-store/i, 'admin content response is not cached');
  await anonymousAdmin.arrayBuffer();
  checks.push({ name: 'anonymous admin content denied', status: anonymousAdmin.status });

  const session = await request(baseUrl, '/api/admin/session');
  assert.equal(session.status, 200, `anonymous session returned HTTP ${session.status}`);
  assert.match(session.headers.get('cache-control') ?? '', /no-store/i, 'session response is not cached');
  const sessionBody = await session.json();
  assert.equal(sessionBody.authenticated, false, 'anonymous session does not authenticate');
  checks.push({ name: 'anonymous session', status: session.status, authenticated: sessionBody.authenticated });

  return { baseUrl, checks };
}

async function waitForHealthy(baseUrl, child, getOutput) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  let lastError = 'health endpoint did not return ready';
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`production server exited with ${child.exitCode}\n${getOutput()}`);
    try {
      // The health probe is deliberately read-only. Exercise the app's normal startup path first.
      const session = await request(baseUrl, '/api/admin/session');
      if (session.status !== 200) {
        lastError = `anonymous session endpoint returned HTTP ${session.status}`;
        await delay(250);
        continue;
      }
      const response = await request(baseUrl, '/api/health');
      if (response.status === 200 && (await response.json()).status === 'ok') return;
      lastError = `health endpoint returned HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(250);
  }
  throw new Error(`production server was not healthy within ${STARTUP_TIMEOUT_MS} ms (${lastError})\n${getOutput()}`);
}

async function stopServer(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  const exited = await Promise.race([
    once(child, 'exit').then(() => true),
    delay(5_000).then(() => false),
  ]);
  if (!exited) {
    child.kill('SIGKILL');
    await once(child, 'exit');
  }
}

async function main() {
  const target = process.env.BARBERLAB_SMOKE_URL;
  if (target) {
    const result = await runSmoke(target.replace(/\/$/, ''));
    console.log(JSON.stringify({ mode: 'external', ...result }, null, 2));
    return;
  }

  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'barberlab-smoke-'));
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const nextCli = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
  const child = spawn(process.execPath, [nextCli, 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      BARBERLAB_DATA_DIR: dataDir,
      BARBERLAB_APP_ORIGIN: baseUrl,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  const append = (chunk) => { output = `${output}${chunk}`.slice(-20_000); };
  child.stdout.setEncoding('utf8').on('data', append);
  child.stderr.setEncoding('utf8').on('data', append);

  try {
    await waitForHealthy(baseUrl, child, () => output);
    const result = await runSmoke(baseUrl);
    // Prove a later render sees CMS edits: this fixture belongs only to our disposable database.
    const marker = 'CI-CMS-FRESH-CONTENT';
    const edit = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
      `import {getContent,saveContent} from './lib/store.ts';const content=getContent();content.services[0].name='${marker}';saveContent(content);`], {
      cwd: process.cwd(), env: { ...process.env, BARBERLAB_DATA_DIR: dataDir }, encoding: 'utf8',
    });
    assert.equal(edit.status, 0, edit.stderr);
    for (const route of ['/', '/services']) {
      const response = await request(baseUrl, route);
      assert.equal(response.status, 200);
      assert.match(await response.text(), new RegExp(marker), `${route} sees content saved after its previous render`);
    }
    result.checks.push({ name: 'CMS edits visible on the next request', status: 200 });
    console.log(JSON.stringify({ mode: 'production-start', ...result }, null, 2));
  } finally {
    await stopServer(child);
    await rm(dataDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exitCode = 1;
  });
}
