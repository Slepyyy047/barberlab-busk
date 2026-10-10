import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const dataDir = mkdtempSync(path.join(os.tmpdir(), 'barberlab-portrait-import-'));
const env = { ...process.env, BARBERLAB_DATA_DIR: dataDir };
const expectedNames = ['Ігор Павлів', 'Роман Падус', 'Андрій', 'Надя', 'Ілля'];
const expectedFiles = new Map([
  ['Ігор Павлів', 'ihor-pavliv.png'],
  ['Роман Падус', 'roman-padus.webp'],
  ['Андрій', 'andrii.jpeg'],
  ['Надя', 'nadia.jpeg'],
  ['Ілля', 'illia.jpeg'],
]);

function expectedSrc(file) {
  const bytes = createHash('sha256').update(readFileSync(path.join('assets', 'team', file))).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return `/api/media/${id}.webp`;
}

function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8', env });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function getPortraits() {
  return JSON.parse(run(['--import', 'tsx', '--input-type=module', '-e', "import {getContent} from './lib/store.ts'; console.log(JSON.stringify(getContent().staff.map(({name,portrait})=>({name,portrait}))));"]));
}

test('imports portraits by exact staff name and preserves later CMS portrait edits on rerun', () => {
  try {
    run(['--import', 'tsx', 'scripts/import-portraits.mjs']);
    const first = getPortraits();
    assert.deepEqual(first.map(({ name }) => name), ['Роман Падус', 'Ігор Павлів', 'Андрій', 'Надя', 'Ілля']);
    for (const [name, file] of expectedFiles) assert.equal(first.find((person) => person.name === name).portrait, expectedSrc(file));
    assert.equal(readdirSync(path.join(dataDir, 'uploads')).length, 5);

    const cmsOverride = '/api/media/00000000-0000-5000-8000-000000000123.webp';
    run(['--import', 'tsx', '--input-type=module', '-e', `import {getContent,saveContent} from './lib/store.ts'; const c=getContent(); c.staff.find(x=>x.name==='Роман Падус').portrait='${cmsOverride}'; saveContent(c);`]);
    run(['--import', 'tsx', 'scripts/import-portraits.mjs']);

    const second = getPortraits();
    assert.equal(second.find(({ name }) => name === 'Роман Падус').portrait, cmsOverride);
    for (const name of expectedNames.filter((item) => item !== 'Роман Падус')) {
      assert.equal(second.find((person) => person.name === name).portrait, first.find((person) => person.name === name).portrait);
    }
    assert.equal(readdirSync(path.join(dataDir, 'uploads')).length, 5);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});
