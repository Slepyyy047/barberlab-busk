import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true});
const dir='verification/work/editorial';await mkdir(dir,{recursive:true});
const report={routes:[],checks:[],errors:[]};
for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:900}});
 page.on('pageerror',e=>report.errors.push(e.message));
 for(const route of ['/','/services','/team','/gallery','/about','/contacts','/admin']){
  const response=await page.goto('http://127.0.0.1:3000'+route);assert.equal(response.status(),200);
  await page.waitForTimeout(400);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false,route+' overflow '+width);
  report.routes.push({width,route,status:response.status()});
 }
 await page.goto('http://127.0.0.1:3000/');await page.waitForTimeout(600);
 await page.screenshot({path:dir+'/home-'+width+'.png'});
 const before=await page.locator('.hero-brand').evaluate(e=>getComputedStyle(e).transform);
 await page.evaluate(()=>scrollTo({top:350,behavior:'instant'}));await page.waitForTimeout(200);
 const after=await page.locator('.hero-brand').evaluate(e=>getComputedStyle(e).transform);assert.notEqual(before,after);
 report.checks.push('scroll hero changes '+width);
 await page.goto('http://127.0.0.1:3000/services');
 for(const button of await page.locator('.filter-buttons button').all()){await button.click();assert.equal(await button.getAttribute('aria-pressed'),'true');assert.ok(await page.locator('.service-row').count());}
 report.checks.push('all filters '+width);
 if(width===390){await page.locator('.menu-toggle').click();await page.getByRole('link',{name:'Команда',exact:true}).click();await page.waitForURL('**/#team');assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'),'false');report.checks.push('mobile navigation');}
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('http://127.0.0.1:3000/');assert.equal(await page.locator('.hero-brand').evaluate(e=>getComputedStyle(e).transform),'none');
 await page.close();
}
assert.deepEqual(report.errors,[]);await writeFile(dir+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();


