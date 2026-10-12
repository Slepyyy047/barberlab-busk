import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('visit shortlist excludes unpublished services and falls back to current custom CMS entries', () => {
  const code = `import React from 'react';globalThis.React=React;
    import {renderToStaticMarkup} from 'react-dom/server';
    import pickerModule from './components/VisitPicker.tsx';
    const VisitPicker=pickerModule.default ?? pickerModule;
    const base={price:555,duration:45,category:'Custom',note:'',visible:true,order:0};
    const services=[{...base,id:'mens-cut',name:'HIDDEN PRICE',visible:false},{...base,id:'new-service',name:'CURRENT CMS SERVICE'},{...base,id:'second',name:'SECOND SERVICE',order:1}];
    console.log(JSON.stringify({html:renderToStaticMarkup(React.createElement(VisitPicker,{services,bookingUrl:'https://example.org/booking'})),empty:renderToStaticMarkup(React.createElement(VisitPicker,{services:[],bookingUrl:'https://example.org/booking'}))}));`;
  const result = spawnSync(process.execPath, ['--import','tsx','--input-type=module','-e',code], {encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const {html,empty}=JSON.parse(result.stdout);
  assert.ok(html.includes('CURRENT CMS SERVICE'));
  assert.ok(html.includes('SECOND SERVICE'));
  assert.ok(!html.includes('HIDDEN PRICE'));
  assert.ok(html.includes('href="https://example.org/booking"'), 'first published service offers a direct booking link');
  assert.ok(html.includes('aria-pressed="true"'), 'first published service is clearly selected');
  assert.ok(html.includes('Далі в Altegio обери цю послугу, майстра та час'), 'shortlist does not imply the external booking is prefilled');
  assert.equal(empty,'');
});
