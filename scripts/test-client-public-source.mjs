import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {brotliDecompressSync} from 'node:zlib';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const packed=JSON.parse(read('frontend/lib/client-bundle.json')).archiveBase64;
const vendor=[1,2,3].map(i=>read('frontend/vendor/client-bundle-v1.1.part'+i+'.txt')).join('');
assert.equal(packed,vendor,'Server-rendered public copy diverged from immutable client bundle');
const bytes=brotliDecompressSync(Buffer.from(packed,'base64'));
const sha256=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(read('frontend/vendor/client-bundle-v1.1.manifest.json'));
assert.equal(sha256(bytes),manifest.sha256_json);
const sources=JSON.parse(bytes.toString('utf8'));
let pageCount=0;
for(const [path,body] of Object.entries(sources)){
 assert.equal(sha256(Buffer.from(body)),manifest.files[path]);
 if(!path.endsWith('.html'))continue;
 pageCount++;
 const main=/<main id="main">([\s\S]*?)<\/main>/.exec(body);
 assert.ok(main,'Client page missing main region: '+path);
 assert.doesNotMatch(main[1],/<script\b/i,'Untrusted script within client content: '+path);
 assert.match(main[1],/<h1\b[^>]*>/,'Missing client H1: '+path);
}
assert.equal(pageCount,18);
for(const path of [
 'frontend/app/page.tsx','frontend/app/activities/page.tsx',
 'frontend/app/go-green/page.tsx','frontend/app/projects/page.tsx',
 'frontend/app/gallery/page.tsx','frontend/app/news-events/page.tsx',
 'frontend/app/[section]/page.tsx'
])assert.match(read(path),/ClientPage/,'Public route failed to reuse client source: '+path);
const detail=read('frontend/app/projects/[slug]/page.tsx');
assert.match(detail,/getPublishedCms/,'Published CMS project detail route lost');
assert.match(read('frontend/app/[section]/page.tsx'),/EnquiryForm/,
 'Privacy-approved real enquiries lost their backend connection');
assert.match(read('frontend/app/projects/page.tsx'),/listPublishedCms/,
 'Published CMS project listing lost');
assert.match(read('frontend/app/gallery/page.tsx'),/approvedGallery/,
 'Rights-approved media listing lost');
assert.match(read('frontend/app/news-events/page.tsx'),/listPublishedCms/,
 'Approved news/events listing lost');
assert.match(read('frontend/app/robots.ts'),/auto-pool-plan/,
 'Held financial plan index gate lost');
console.log('Approved client content is canonical in Next.js; live CMS/enquiry contracts and finance HOLD preserved: PASS');
