import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

function run(code) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('consent defaults to no external media for missing, malformed, expired or future choices', () => {
  const result = run(`import {parseConsent,CONSENT_TTL} from './lib/consent.ts';const now=1800000000000;const encode=(x)=>JSON.stringify({version:1,necessary:true,externalMedia:true,savedAt:now,...x});console.log(JSON.stringify([null,'null','{bad',encode({version:2}),encode({necessary:false}),encode({externalMedia:'true'}),encode({savedAt:now+1}),encode({savedAt:now-CONSENT_TTL})].map(raw=>parseConsent(raw,now))));`);
  assert.deepEqual(result, Array(8).fill(null));
});

test('explicit acceptance and rejection are retained with only the documented fields', () => {
  const result = run(`import {parseConsent} from './lib/consent.ts';const now=1800000000000;const value={version:1,necessary:true,externalMedia:true,savedAt:now,unexpected:'not-an-identifier'};console.log(JSON.stringify({accept:parseConsent(JSON.stringify(value),now),reject:parseConsent(JSON.stringify({...value,externalMedia:false}),now)}));`);
  assert.equal(result.accept.externalMedia, true);
  assert.equal(result.reject.externalMedia, false);
  assert.deepEqual(Object.keys(result.accept).sort(), ['externalMedia', 'necessary', 'savedAt', 'version']);
});
