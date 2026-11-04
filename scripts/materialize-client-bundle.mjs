import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,existsSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {brotliDecompressSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const publicDir=join(root,'frontend/public');
const output=join(publicDir,'client-template');
const archiveParts=[1,2,3].map(n=>readFileSync(join(root,'frontend/vendor/client-bundle-v1.1.part'+n+'.txt'),'utf8'));
const archive=Buffer.from(archiveParts.join(''),'base64');
const manifestPath=join(root,'frontend/vendor/client-bundle-v1.1.manifest.json');
const marker=join(output,'.nisvartha-generated');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const shouldPreview=process.env.NISVARTHA_CLIENT_TEMPLATE_PREVIEW==='true';
const site=process.env.NEXT_PUBLIC_SITE_URL||'http://127.0.0.1:3102';
let url;
try{url=new URL(site);}catch{throw Error('Invalid NEXT_PUBLIC_SITE_URL')}
if(shouldPreview&&!(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)&&process.env.PUBLIC_CONTENT_APPROVED!=='true')){
 throw Error('Exact client prototype can only run on private local HTTP with PUBLIC_CONTENT_APPROVED disabled');
}
if(!shouldPreview){
 if(existsSync(output)){
  if(!existsSync(marker))throw Error('Refusing to remove unmarked public/client-template folder');
  rmSync(output,{recursive:true,force:true});
 }
 console.log('Exact client HTML preview disabled; original Next.js public routes remain authoritative');
 process.exit(0);
}
const raw=brotliDecompressSync(archive);
const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
assert.equal(hash(raw),manifest.sha256_json,'Compressed client source integrity mismatch');
const pages=JSON.parse(raw.toString('utf8'));
assert.equal(Object.keys(pages).length,20,'Expected 18 HTML files, CSS and JavaScript');
for(const name of Object.keys(pages)){
 if(!/^(?:[a-z0-9-]+\.html|assets\/(?:site\.js|styles\.css))$/.test(name))
  throw Error('Unexpected client bundle path');
 const bytes=Buffer.from(pages[name],'utf8');
 assert.equal(hash(bytes),manifest.files[name],'Client file was altered: '+name);
}
assert.equal(Object.keys(manifest.files).length,20);
if(existsSync(output)){
 if(!existsSync(marker))throw Error('Refusing to overwrite unmarked client-template directory');
 rmSync(output,{recursive:true,force:true});
}
mkdirSync(join(output,'assets'),{recursive:true});
for(const [name,body] of Object.entries(pages)){
 writeFileSync(join(output,name),body,{encoding:'utf8',flag:'wx',mode:0o644});
}
writeFileSync(marker,'generated from verified client bundle v1.1\n',{flag:'wx'});
console.log('Verified and materialized 18 unmodified client HTML pages and exact CSS/JS for local preview');
