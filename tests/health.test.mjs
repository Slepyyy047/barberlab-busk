import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

function run(code) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'barberlab-health-'));
  try {
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], {
      encoding: 'utf8', env: { ...process.env, BARBERLAB_DATA_DIR: directory },
    });
    assert.equal(result.status, 0, result.stderr);
    return { value: JSON.parse(result.stdout), stderr: result.stderr };
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

test('health returns 503 without creating a missing database or exposing server paths', () => {
  const { value, stderr } = run(`import {existsSync} from 'node:fs'; import path from 'node:path'; import {GET} from './app/api/health/route.ts'; const response=await GET(); console.log(JSON.stringify({status:response.status,body:await response.json(),cache:response.headers.get('cache-control'),created:existsSync(path.join(process.env.BARBERLAB_DATA_DIR,'barberlab.sqlite'))}));`);
  assert.deepEqual(value.body, { status: 'unavailable' });
  assert.equal(value.status, 503);
  assert.equal(value.created, false);
  assert.match(value.cache, /no-store/);
  assert.match(stderr, /health.failed/);
});

test('health checks existing CMS data and rejects corruption without changing its schema', () => {
  const { value } = run(`import {getDatabase} from './lib/store.ts'; import {GET} from './app/api/health/route.ts'; const db=getDatabase(); const tables=()=>db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all(); const before=tables(); const ok=await GET(); db.prepare('UPDATE content SET json=? WHERE id=1').run('{}'); const failed=await GET(); console.log(JSON.stringify({ok:ok.status,body:await ok.json(),failed:failed.status,failure:await failed.json(),unchanged:JSON.stringify(before)===JSON.stringify(tables())})); db.close();`);
  assert.deepEqual(value, { ok: 200, body: { status: 'ok' }, failed: 503, failure: { status: 'unavailable' }, unchanged: true });
});

test('upload storage failure is 503 while malformed images remain 400', () => {
  const { value, stderr } = run(`import {writeFileSync} from 'node:fs'; import path from 'node:path'; import sharp from 'sharp'; import {NextRequest} from 'next/server'; import {provisionAdmin,createSession} from './lib/auth.ts'; import {getSessionCsrfToken} from './lib/csrf.ts'; import {POST} from './app/api/admin/upload/route.ts'; import {getDatabase} from './lib/store.ts'; provisionAdmin('health-test','private-health-test-password'); const {token}=createSession('health-test'); const csrf=getSessionCsrfToken({cookies:{get:()=>({value:token})}}); async function send(bytes){const form=new FormData();form.append('file',new File([bytes],'image.png',{type:'image/png'}));return POST(new NextRequest('http://localhost/api/admin/upload',{method:'POST',headers:{origin:'http://localhost',cookie:'barberlab_admin='+token,'x-csrf-token':csrf},body:form}));} const malformed=await send(new Uint8Array([1,2,3])); writeFileSync(path.join(process.env.BARBERLAB_DATA_DIR,'uploads'),'blocked');const png=await sharp({create:{width:2,height:2,channels:3,background:'black'}}).png().toBuffer();const unavailable=await send(png);console.log(JSON.stringify({malformed:malformed.status,storage:unavailable.status,body:await unavailable.json()}));getDatabase().close();`);
  assert.equal(value.malformed, 400);
  assert.equal(value.storage, 503);
  assert.doesNotMatch(JSON.stringify(value.body), /uploads|barberlab-health|private-health-test-password/);
  assert.match(stderr, /media.upload_failed/);
  assert.doesNotMatch(stderr, /private-health-test-password/);
});

test('structured error logs exclude raw exception messages', () => {
  const { stderr } = run(`import {logEvent,errorCode} from './lib/observability.ts';const error=Object.assign(new Error('secret-password-and-cookie'),{code:'EACCES'});logEvent('error','test.failed',{code:errorCode(error)});console.log('{}');`);
  const entry = stderr.trim().split('\n').map(line => { try { return JSON.parse(line); } catch { return null; } }).find(line => line?.event === 'test.failed');
  assert.equal(entry.code, 'EACCES');
  assert.equal(entry.level, 'error');
  assert.doesNotMatch(stderr, /secret-password-and-cookie/);
});
