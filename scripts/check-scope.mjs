import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const policy=read('README.md');
const schema=read('backend/prisma/schema.prisma');
const content=read('frontend/lib/site.ts');
const pages=['about','activities','go-green','projects','volunteer','donate','membership','how-it-works','gallery','news-events','contact','privacy-policy','terms','accessibility','login','register'];
assert.match(policy,/fixed 1:3 matrix/);
assert.match(policy,/not.*MegaMitra's binary/i);
for(const name of pages)assert.ok(content.includes("slug: '"+name+"'"),'Missing SRS route '+name);
assert.match(schema,/model Enquiry/);
assert.doesNotMatch(schema,/Binary|Pair|Genealogy|Commission|Wallet|Referral|LuckyDraw/i,'Financial schema is out of P0 scope');
const migrations=readdirSync(new URL('backend/prisma/migrations/',root),{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name);
assert.deepEqual(migrations,['0001_public_enquiries','0002_staff_cms'],'Unexpected P0 database migration');
assert.match(read('frontend/app/robots.ts'),/disallow:'\/'/);
assert.match(read('backend/src/enquiries/enquiry.service.ts'),/PRIVACY_NOTICE_APPROVED/);
assert.match(read('backend/scripts/enquiries.mjs'),/NISVARTHA_OPERATOR_DATABASE_URL/);
console.log('Nisvartha phase/scope regression gate: PASS');

await import('./check-flyer.mjs');

assert.match(read('backend/prisma/schema.prisma'),/model CmsRevision/);
assert.match(read('backend/prisma/schema.prisma'),/model StaffSession/);
assert.match(read('backend/prisma/schema.prisma'),/model CmsAudit/);
