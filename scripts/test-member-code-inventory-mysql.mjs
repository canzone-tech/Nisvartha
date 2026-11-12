/**
 * Test the exact production audit aggregate on the disposable real MySQL
 * database. Never connect to a production connection or perform DB writes.
 * Run only after the isolated migration chain has been applied.
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readMemberCodeInventory} from './audit-production-readiness.mjs';

const url=new URL(process.env.DATABASE_URL||'');
if(url.protocol!=='mysql:'||url.hostname!=='127.0.0.1'||
   url.pathname!=='/nisvartha_ci'||process.env.NODE_ENV==='production'){
 // CI full-stack builds use NODE_ENV=production, but their DB is disposable.
 // The exact database name and loopback host remain mandatory in that case.
 if(url.protocol!=='mysql:'||url.hostname!=='127.0.0.1'||
    url.pathname!=='/nisvartha_ci')
  throw Error('Audit integration test is restricted to disposable loopback nisvartha_ci');
}
const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient();
try{
 const result=await readMemberCodeInventory(db);
 assert.deepEqual(result.issues,[],
  'Disposable MySQL audit must return valid nonnegative bigint member counters');
 assert.match(result.counts.totalMembers,/^(0|[1-9][0-9]*)$/);
 assert.equal(result.counts.missingCodes,'0',
  'Disposable CI baseline must not contain legacy NULL referral codes');
 console.log('Read-only member inventory on real disposable MySQL: PASS');
}finally{
 await db.$disconnect();
}
