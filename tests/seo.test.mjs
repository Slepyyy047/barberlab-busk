import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

function run(script, env = {}) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], {
    cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, ...env },
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

const settings = {
  name: 'BARBERLAB', descriptor: 'Барбершоп у Буську', address: 'майдан Незалежності, 1, Буськ',
  phone: '068 404 0130', phoneLink: 'tel:+380684040130', bookingUrl: 'https://example.alteg.io/book',
  instagram: 'https://www.instagram.com/barberlab.busk/', tiktok: '', facebook: '', hours: '',
  weeklyHours: [], amenities: [], rating: 4.9, reviewCount: 67,
};

test('page metadata carries canonical, Open Graph and Twitter URLs from the configured public origin', () => {
  const result = run(`import {createPageMetadata} from './lib/seo.ts'; const settings=${JSON.stringify(settings)}; console.log(JSON.stringify(createPageMetadata({settings,path:'/services',title:'Послуги та ціни',description:'Стрижки та догляд.'})))`, { BARBERLAB_PUBLIC_URL: 'https://barberlab.example/' });
  assert.equal(result.alternates.canonical, 'https://barberlab.example/services');
  assert.equal(result.openGraph.url, 'https://barberlab.example/services');
  assert.equal(result.openGraph.type, 'website');
  assert.equal(result.openGraph.locale, 'uk_UA');
  assert.equal(result.openGraph.siteName, 'BARBERLAB');
  assert.equal(result.openGraph.images[0].url, '/logo-hd.png');
  assert.equal(result.twitter.card, 'summary_large_image');
  assert.match(result.description, /майдан Незалежності, 1/);
  assert.match(result.twitter.title, /BARBERLAB/);
});

test('metadata avoids inventing canonical and social image URLs when public origin is unset or invalid', () => {
  const script = `import {createPageMetadata} from './lib/seo.ts'; const settings=${JSON.stringify(settings)}; console.log(JSON.stringify(createPageMetadata({settings,path:'/team',title:'Команда',description:'Майстри.'})))`;
  const unset = run(script, { BARBERLAB_PUBLIC_URL: '' });
  assert.equal('canonical' in (unset.alternates ?? {}), false);
  assert.equal('images' in unset.openGraph, false);
  const invalid = run(script, { BARBERLAB_PUBLIC_URL: 'javascript:alert(1)' });
  assert.equal('canonical' in (invalid.alternates ?? {}), false);
  assert.equal('images' in invalid.twitter, false);
});

test('HairSalon and service JSON-LD lists only visible CMS services with confirmed fields', () => {
  const services = [
    { id: 'second', name: 'Борода', price: 400, duration: 30, category: 'Борода', note: 'Експерт-майстер', visible: true, order: 2 },
    { id: 'hidden', name: 'Прихована послуга', price: 999, duration: 99, category: 'Тест', note: '', visible: false, order: 0 },
    { id: 'first', name: 'Стрижка', price: 500, duration: 60, category: 'Стрижки', note: '', visible: true, order: 1 },
  ];
  const result = run(`import {buildHairSalonJsonLd,buildServicesJsonLd} from './lib/seo.ts'; const s=${JSON.stringify(settings)},services=${JSON.stringify(services)}; console.log(JSON.stringify({salon:buildHairSalonJsonLd(s,services),list:buildServicesJsonLd(s,services)}))`, { BARBERLAB_PUBLIC_URL: 'https://barberlab.example' });
  const catalog = result.salon.hasOfferCatalog;
  assert.deepEqual(catalog.itemListElement.map((offer) => offer.name), ['Стрижка', 'Борода']);
  assert.equal(catalog.itemListElement[0].price, 500);
  assert.equal(catalog.itemListElement[0].priceCurrency, 'UAH');
  assert.match(catalog.itemListElement[1].description, /30 хв/);
  assert.equal(result.salon.aggregateRating, undefined);
  assert.equal(result.salon.openingHours, undefined);
  assert.equal(result.salon.geo, undefined);
  assert.deepEqual(result.list.itemListElement.map((row) => row.item['@type']), ['Service', 'Service']);
  assert.equal(result.list.itemListElement[0].item.serviceType, 'Стрижки');
});

test('JSON-LD serialization prevents user-controlled text from closing its script element', () => {
  const result = run(`import {serializeJsonLd} from './lib/seo.ts'; console.log(JSON.stringify(serializeJsonLd({name:'</script><script>alert(1)</script>',separator:'&',line:'\\u2028'})))`);
  assert.equal(result.includes('<'), false);
  assert.equal(result.includes('>'), false);
  assert.equal(result.includes('&'), false);
  assert.equal(JSON.parse(result).name, '</script><script>alert(1)</script>');
});
