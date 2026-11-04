import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {brotliDecompressSync} from 'node:zlib';
const archive=Buffer.from([1,2,3].map(n=>readFileSync(new URL('../frontend/vendor/client-bundle-v1.1.part'+n+'.txt',import.meta.url),'utf8')).join(''),'base64');
const raw=brotliDecompressSync(archive);
const manifest=JSON.parse(readFileSync(new URL('../frontend/vendor/client-bundle-v1.1.manifest.json',import.meta.url),'utf8'));
const hash=(bytes)=>createHash('sha256').update(bytes).digest('hex');
assert.equal(hash(raw),manifest.sha256_json);
const files=JSON.parse(raw.toString('utf8'));
const html=Object.keys(files).filter(x=>x.endsWith('.html'));
assert.equal(html.length,18,'All 18 client public pages must be present');
assert.equal(Object.keys(files).length,20);
for(const [name,source] of Object.entries(files)){
 assert.equal(hash(Buffer.from(source)),manifest.files[name],'Client source altered: '+name);
 if(name.endsWith('.html')){
  assert.match(source,/<main id="main">/);
  assert.match(source,/assets\/styles\.css/);
  assert.match(source,/assets\/site\.js/);
 }
}
const expected=['index','about','activities','go-green','projects','volunteer','donate','membership','auto-pool-plan','gallery','news-events','contact','faq','how-it-works','login','register','privacy-policy','terms'];
assert.deepEqual(html.map(x=>x.slice(0,-5)).sort(),expected.sort());
assert.match(files['assets/styles.css'],/--navy:#123b63/);
assert.match(files['contact.html'],/data-demo-form/);
assert.match(files['auto-pool-plan.html'],/review|pending|approval/i);
assert.match(files['register.html'],/auto\.nisvarthafoundation\.com\/Register/);
console.log('Client v1.1 visual and copy integrity: all 18 pages, CSS and JavaScript unchanged PASS');
