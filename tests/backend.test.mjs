import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const dataDir = mkdtempSync(path.join(os.tmpdir(), 'barberlab-test-'));
const env = { ...process.env, BARBERLAB_DATA_DIR: dataDir };
function run(code, extraEnv = {}) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], { cwd: process.cwd(), encoding: 'utf8', env: { ...env, ...extraEnv } });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
run(`import {provisionAdmin} from './lib/auth.ts'; provisionAdmin('owner-test','test-password-long-enough');`);

test('initial SQLite content reflects the supplied services, team, business facts, and actual reviews', () => {
  const summary = JSON.parse(run(`import { getContent } from './lib/store.ts'; const c=getContent(); console.log(JSON.stringify({services:c.services.length,beard:c.services.find(x=>x.id==='beard-trim')?.note,staff:c.staff.map(x=>x.name),gallery:c.gallery.length,phone:c.settings.phoneLink,hours:c.settings.hours,reviews:c.reviews.length}));`));
  assert.equal(summary.services, 11);
  assert.equal(summary.beard, 'Експерт-майстер');
  assert.deepEqual(summary.staff, ['Роман Падус', 'Ігор Павлів', 'Андрій', 'Надя', 'Ілля']);
  assert.equal(summary.gallery, 0);
  assert.equal(summary.phone, 'tel:+380684040130');
  assert.match(summary.hours, /Робочі дні уточнюйте/);
  assert.equal(summary.reviews, 3);
});

test('content changes persist when a new process opens the SQLite database', () => {
  run(`import { getContent,saveContent } from './lib/store.ts'; const c=getContent(); c.services[0].price=525; saveContent(c);`);
  assert.equal(run(`import { getContent } from './lib/store.ts'; process.stdout.write(String(getContent().services[0].price));`), '525');
  run(`import { getContent,saveContent } from './lib/store.ts'; const c=getContent(); c.services[0].price=500; saveContent(c);`);
});

test('opaque sessions are stored, resolve to an admin, and can be revoked', () => {
  const result = JSON.parse(run(`import {createSession,getSession,deleteSession} from './lib/auth.ts'; const {token}=createSession('owner-test'); const req={cookies:{get:(name)=>name==='barberlab_admin'?{value:token}:undefined}}; const before=getSession(req); deleteSession(req); console.log(JSON.stringify({before,after:getSession(req)}));`));
  assert.equal(result.before, 'owner-test');
  assert.equal(result.after, null);
});

test('admin routes enforce login and origin checks, then end access on logout', async () => {
  const result = JSON.parse(run(`import {NextRequest} from 'next/server'; import {GET as readContent} from './app/api/admin/content/route.ts'; import {POST as login} from './app/api/admin/login/route.ts'; import {POST as logout} from './app/api/admin/logout/route.ts'; const anonymous=await readContent(new NextRequest('http://localhost/api/admin/content')); const blocked=await login(new NextRequest('http://localhost/api/admin/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'owner-test',password:'test-password-long-enough'})})); const signedIn=await login(new NextRequest('http://localhost/api/admin/login',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:JSON.stringify({username:'owner-test',password:'test-password-long-enough'})})); const token=signedIn.cookies.get('barberlab_admin').value; const authorized=await readContent(new NextRequest('http://localhost/api/admin/content',{headers:{cookie:'barberlab_admin='+token}})); const signedOut=await logout(new NextRequest('http://localhost/api/admin/logout',{method:'POST',headers:{origin:'http://localhost',cookie:'barberlab_admin='+token}})); const deniedAgain=await readContent(new NextRequest('http://localhost/api/admin/content',{headers:{cookie:'barberlab_admin='+token}})); console.log(JSON.stringify({anonymous:anonymous.status,csrf:blocked.status,login:signedIn.status,authorized:authorized.status,services:(await authorized.json()).services.length,logout:signedOut.status,afterLogout:deniedAgain.status}));`));
  assert.deepEqual(result, { anonymous: 401, csrf: 403, login: 200, authorized: 200, services: 11, logout: 200, afterLogout: 401 });
});

test('same-origin checks accept the local Host alias and reject foreign origins', () => {
  const result = JSON.parse(run(`import {NextRequest} from 'next/server'; import {hasSameOrigin} from './lib/auth.ts'; const local=new NextRequest('http://localhost:3000/api/admin/login',{headers:{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000'}}); const foreign=new NextRequest('http://localhost:3000/api/admin/login',{headers:{host:'127.0.0.1:3000',origin:'http://attacker.example'}}); const portMismatch=new NextRequest('http://localhost:3000/api/admin/login',{headers:{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3001'}}); console.log(JSON.stringify({local:hasSameOrigin(local),foreign:hasSameOrigin(foreign),portMismatch:hasSameOrigin(portMismatch)}));`));
  assert.deepEqual(result, { local: true, foreign: false, portMismatch: false });
});

test('production same-origin checks can use the explicitly configured public origin', () => {
  const result = JSON.parse(run(`import {NextRequest} from 'next/server'; import {hasSameOrigin} from './lib/auth.ts'; const allowed=new NextRequest('http://internal:3000/api/admin/login',{headers:{host:'internal:3000',origin:'https://barberlab.example'}}); const other=new NextRequest('http://internal:3000/api/admin/login',{headers:{host:'internal:3000',origin:'https://attacker.example'}}); console.log(JSON.stringify({allowed:hasSameOrigin(allowed),other:hasSameOrigin(other)}));`, { BARBERLAB_APP_ORIGIN: 'https://barberlab.example' }));
  assert.deepEqual(result, { allowed: true, other: false });
});

test('login API enforces its byte cap on a chunked request without Content-Length', async () => {
  const result = JSON.parse(run(`import {NextRequest} from 'next/server'; import {POST as login} from './app/api/admin/login/route.ts'; const body=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(6000));controller.enqueue(new Uint8Array(6000));controller.close();}}); const request=new NextRequest('http://localhost/api/admin/login',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body,duplex:'half'}); const response=await login(request); console.log(JSON.stringify({status:response.status,error:(await response.json()).error}));`));
  assert.equal(result.status, 413);
  assert.match(result.error, /завеликий/);
});

test('authorized image uploads are normalized, served, and removed with their content references', async () => {
  const result = JSON.parse(run(`import sharp from 'sharp'; import {NextRequest} from 'next/server'; import {createSession} from './lib/auth.ts'; import {getContent,saveContent} from './lib/store.ts'; import {POST,DELETE} from './app/api/admin/upload/route.ts'; import {GET as serveMedia} from './app/api/media/[filename]/route.ts'; const {token}=createSession('owner-test'); const png=await sharp({create:{width:12,height:10,channels:3,background:{r:180,g:120,b:80}}}).png().toBuffer(); const form=new FormData(); form.append('file',new File([png],'salon.png',{type:'image/png'})); const uploaded=await POST(new NextRequest('http://localhost/api/admin/upload',{method:'POST',headers:{origin:'http://localhost',cookie:'barberlab_admin='+token},body:form})); const {src}=await uploaded.json(); const filename=src.split('/').at(-1); const media=await serveMedia(new NextRequest('http://localhost'+src),{params:Promise.resolve({filename})}); const content=getContent(); content.gallery.push({id:'test-image',src,alt:'Тестове фото',category:'Інтер’єр',visible:true,order:0}); saveContent(content); const removed=await DELETE(new NextRequest('http://localhost/api/admin/upload',{method:'DELETE',headers:{origin:'http://localhost',cookie:'barberlab_admin='+token,'content-type':'application/json'},body:JSON.stringify({src})})); const after=getContent(); const missing=await serveMedia(new NextRequest('http://localhost'+src),{params:Promise.resolve({filename})}); console.log(JSON.stringify({upload:uploaded.status,srcType:src.endsWith('.webp'),media:media.status,mediaType:media.headers.get('content-type'),bytes:(await media.arrayBuffer()).byteLength,delete:removed.status,referenceRemoved:!after.gallery.some(image=>image.src===src),mediaAfter:missing.status}));`));
  assert.equal(result.upload, 201);
  assert.equal(result.srcType, true);
  assert.equal(result.media, 200);
  assert.equal(result.mediaType, 'image/webp');
  assert.ok(result.bytes > 0);
  assert.equal(result.delete, 200);
  assert.equal(result.referenceRemoved, true);
  assert.equal(result.mediaAfter, 404);
});

test('password hashes verify and full-content validation rejects unsafe input', () => {
  const result = JSON.parse(run(`import {hashPassword,verifyPassword} from './lib/auth.ts'; import {getContent} from './lib/store.ts'; import {validateContent} from './lib/validation.ts'; const encoded=hashPassword('a-private-test-password'); const original=getContent(); const unsafe=structuredClone(original); unsafe.settings.bookingUrl='javascript:alert(1)'; const duplicate=structuredClone(original); duplicate.services[1].id=duplicate.services[0].id; const invalid=structuredClone(original); invalid.services[0].price=-1; const throws=(value)=>{try{validateContent(value);return false}catch{return true}}; console.log(JSON.stringify({hash:encoded!=='a-private-test-password',correct:verifyPassword('a-private-test-password',encoded),wrong:verifyPassword('wrong-password',encoded),badUrl:throws(unsafe),duplicate:throws(duplicate),price:throws(invalid)}));`));
  assert.deepEqual(result, { hash: true, correct: true, wrong: false, badUrl: true, duplicate: true, price: true });
});

test('admin provisioning command accepts test environment credentials without printing them', () => {
  const password = 'private-command-test-password';
  const command = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/create-admin.mjs'], {
    cwd: process.cwd(), encoding: 'utf8', env: { ...env, BARBERLAB_ADMIN_USER: 'cli-owner', BARBERLAB_ADMIN_PASSWORD: password },
  });
  assert.equal(command.status, 0, command.stderr);
  assert.match(command.stdout, /збережено в базі даних/);
  assert.ok(!command.stdout.includes(password));
  const valid = run(`import {checkLogin} from './lib/auth.ts'; process.stdout.write(JSON.stringify(checkLogin('cli-owner','${password}','test-cli')));`);
  assert.deepEqual(JSON.parse(valid), { ok: true });
});

test('password provisioning revokes active sessions and request bodies are capped while streaming', () => {
  const result = JSON.parse(run(`import {createSession,getSession,provisionAdmin,checkLogin} from './lib/auth.ts'; import {readBody} from './lib/http.ts'; const {token}=createSession('owner-test'); const req={cookies:{get:()=>({value:token})}}; const wasValid=Boolean(getSession(req)); provisionAdmin('owner-test','another-test-password-long'); const wasRevoked=getSession(req)===null; const oldPassword=checkLogin('owner-test','test-password-long-enough','reset-test').ok; const newPassword=checkLogin('owner-test','another-test-password-long','reset-test').ok; const limited={headers:new Headers(),body:new ReadableStream({start(controller){controller.enqueue(new Uint8Array(80));controller.enqueue(new Uint8Array(80));controller.close();}})}; let tooLarge=false; try{await readBody(limited,100)}catch(error){tooLarge=error.name==='RequestBodyTooLargeError'} console.log(JSON.stringify({wasValid,wasRevoked,oldPassword,newPassword,tooLarge}));`));
  assert.deepEqual(result, { wasValid: true, wasRevoked: true, oldPassword: false, newPassword: true, tooLarge: true });
});

test('importing the server auth module never resets credentials from environment variables', () => {
  const token = run(`import {createSession} from './lib/auth.ts'; process.stdout.write(createSession('owner-test').token);`);
  const result = JSON.parse(run(`import {getSession,checkLogin} from './lib/auth.ts'; const request={cookies:{get:()=>({value:${JSON.stringify(token)}})}}; console.log(JSON.stringify({session:getSession(request),password:checkLogin('owner-test','another-test-password-long','stable-check').ok}));`, {
    BARBERLAB_ADMIN_USER: 'owner-test', BARBERLAB_ADMIN_PASSWORD: 'must-not-reset-existing-account',
  }));
  assert.deepEqual(result, { session: 'owner-test', password: true });
});
