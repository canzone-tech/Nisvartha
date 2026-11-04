import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {brotliDecompressSync} from 'node:zlib';
import {clientResponsiveHtml,narrowMatrixStyle} from './client-responsive-adapter.mjs';
const b64=[1,2,3].map(i=>readFileSync(new URL('../frontend/vendor/client-bundle-v1.1.part'+i+'.txt',import.meta.url),'utf8')).join('');
const source=JSON.parse(brotliDecompressSync(Buffer.from(b64,'base64')).toString('utf8'));
for(const [name,html] of Object.entries(source)){
 if(!name.endsWith('.html'))continue;
 const adapted=clientResponsiveHtml(html,name);
 assert.equal(adapted.replace(narrowMatrixStyle,''),html,
  'Client source text/structure altered by narrow layout adapter: '+name);
 if(name==='how-it-works.html')assert.match(adapted,/client-narrow-matrix/);
 else assert.equal(adapted,html);
}
console.log('Client matrix narrow-screen repair preserves original copy, source files and all nine diagram nodes: PASS');
