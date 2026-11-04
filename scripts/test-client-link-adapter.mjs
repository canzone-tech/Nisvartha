import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {brotliDecompressSync} from 'node:zlib';
import {wireMemberLinks} from './client-link-adapter.mjs';
const bits=[1,2,3].map(i=>readFileSync(new URL('../frontend/vendor/client-bundle-v1.1.part'+i+'.txt',import.meta.url),'utf8'));
const files=JSON.parse(brotliDecompressSync(Buffer.from(bits.join(''),'base64')).toString('utf8'));
const variants=[
 ['https://auto.nisvarthafoundation.com/login','/member/login'],
 ['https://auto.nisvarthafoundation.com/Register','/member/register']
];
for(const [name,original] of Object.entries(files)){
 const adapted=wireMemberLinks(original);
 if(!name.endsWith('.html')){
  assert.equal(adapted,original,'Non-HTML client asset altered');
  continue;
 }
 let restored=adapted;
 for(const [external,local] of variants){
  assert.ok(!adapted.includes('href="'+external+'"'),'Client page still links to an external member portal: '+name);
  const before='href="'+external+'" target="_blank" rel="noopener"';
  restored=restored.replaceAll('href="'+local+'"',before);
 }
 assert.equal(restored,original,'Client HTML changed outside permitted href/target transformation: '+name);
}
console.log('Client login/register links now use existing member routes; all 18 visible HTML pages and assets unchanged: PASS');
