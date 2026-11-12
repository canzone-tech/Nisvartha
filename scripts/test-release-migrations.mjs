import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {inspectUnusedDatabase} from './check-unused-database.mjs';
import {assessMemberCodeInventory,assessMysqlVersion,readMemberCodeInventory,validatePreMigrationHistory} from './audit-production-readiness.mjs';
import {
 validateForwardRelease,validateAppliedMigrationChain,validateMemberReferralCodeReadiness
} from './check-release-migrations.mjs';

const names=readdirSync('backend/prisma/migrations',{withFileTypes:true})
 .filter(x=>x.isDirectory()).map(x=>x.name).sort();
const old='0024_member_wallet_payout_requests';
const current='0038_shared_member_contacts';
assert.equal(names.length,38,'Expected immutable migration chain 0001–0038');
assert.deepEqual(validateForwardRelease(old,current,names),[],
 'Verified 0024 -> 0038 upgrade should be allowed');
assert.ok(validateForwardRelease('9999_unknown',current,names)
 .some(issue=>issue.includes('Old release migration head')));
assert.ok(validateForwardRelease(current,old,names)
 .some(issue=>issue.includes('New release migration head')));
assert.ok(validateForwardRelease(current,'0023_unique_settlement_reference',names)
 .some(issue=>issue.includes('downgrade')));
assert.ok(validateForwardRelease(old,current,[...names,current])
 .some(issue=>issue.includes('Duplicate packaged')));
const finishedAt=new Date('2026-11-11T02:00:00Z');
const rows=names.map(name=>({migration_name:name,checksum:name,
 expectedChecksum:name,finished_at:finishedAt,rolled_back_at:null}));
assert.deepEqual(validateAppliedMigrationChain(names,rows),[],
 'Complete migration ledger should permit cutover');
assert.ok(validateAppliedMigrationChain(names,rows.slice(0,24))
 .some(issue=>issue.includes('Pending packaged migration')),
 'Must refuse cutover before running migration 0025–0038');
assert.ok(validateAppliedMigrationChain(names,[...rows,rows[0]])
 .some(issue=>issue.includes('Duplicate non-rolled-back')));
assert.ok(validateAppliedMigrationChain(names,rows.map((row,i)=>i===5?
 {...row,checksum:'tampered'}:row))
 .some(issue=>issue.includes('checksum mismatch')));
assert.ok(validateAppliedMigrationChain(names,rows.map((row,i)=>i===10?
 {...row,finished_at:null}:row))
 .some(issue=>issue.includes('Unfinished migration')));
assert.ok(validateAppliedMigrationChain(names,[...rows,{
 migration_name:'0040_unreviewed',checksum:'x',expectedChecksum:undefined,
 finished_at:finishedAt,rolled_back_at:null
}]).some(issue=>issue.includes('Unrecognized applied')));
assert.deepEqual(validateAppliedMigrationChain(names,[...rows,{
 ...rows[0],rolled_back_at:finishedAt
}]),[],'Properly rolled-back historical attempt should not imply second applied migration');
// Legacy NULL member codes must block code-only production cutover.
assert.deepEqual(validateMemberReferralCodeReadiness(0n),[]);
assert.deepEqual(validateMemberReferralCodeReadiness(0),[]);
assert.ok(validateMemberReferralCodeReadiness(1n).some(s=>s.includes('remediation')));
assert.ok(validateMemberReferralCodeReadiness(28).some(s=>s.includes('remediation')));
for(const invalid of [-1n,-2,1.2,NaN,Infinity,undefined,null,'0']){
 assert.ok(validateMemberReferralCodeReadiness(invalid).some(s=>s.includes('invalid')),
  'Incomplete legacy-code audit must fail closed: '+String(invalid));
}
assert.match(readFileSync('scripts/check-release-migrations.mjs','utf8'),
 /FROM member_accounts WHERE referralCode IS NULL/,
 'Packaged cutover must query missing codes from authoritative MySQL');

for(const name of names){
 const sql=readFileSync(join('backend/prisma/migrations',name,'migration.sql'),'utf8');
 assert.ok(sql.trim(),'Packaged SQL must exist for '+name);
}
// Pre-migration audit must validate an ordered, immutable applied prefix.
const expectedHashes=new Map(names.map(n=>[n,n]));
const prefixRows=rows.slice(0,24);
assert.deepEqual(validatePreMigrationHistory(names,prefixRows,expectedHashes).errors,[],
 'Legitimate 0024 baseline must permit a read-only pre-migration assessment');
assert.ok(validatePreMigrationHistory(names,prefixRows.filter(x=>x.migration_name!==names[5]),expectedHashes).errors.length);
assert.ok(validatePreMigrationHistory(names,[...prefixRows,prefixRows[0]],expectedHashes).errors.length);
assert.ok(validatePreMigrationHistory(names,[...prefixRows,{...rows[24],finished_at:null}],expectedHashes).errors.length);
assert.ok(validatePreMigrationHistory(names,prefixRows.map((r,i)=>i===4?{...r,checksum:'tampered'}:r),expectedHashes).errors.length);
assert.ok(validatePreMigrationHistory(names,[...prefixRows,{migration_name:'unapproved',checksum:'bad',finished_at:finishedAt,rolled_back_at:null}],expectedHashes).errors.length);
assert.deepEqual(assessMemberCodeInventory({memberCount:0n,missingCodeCount:0n},true).issues,[]);
assert.deepEqual(assessMemberCodeInventory({memberCount:3n,missingCodeCount:0n},true).issues,[]);
assert.ok(assessMemberCodeInventory({memberCount:3n,missingCodeCount:1n},true).issues.length);
assert.ok(assessMemberCodeInventory({memberCount:1n,missingCodeCount:2n},true).issues.length);
assert.ok(assessMemberCodeInventory(null,true).issues.length);
assert.ok(assessMemberCodeInventory({memberCount:0n,missingCodeCount:0n},false).issues.length);
assert.deepEqual(await readMemberCodeInventory({$queryRaw:async()=>[
 {memberCount:2n,missingCodeCount:0n}
]}),{issues:[],counts:{totalMembers:'2',missingCodes:'0'}},
 'Real MySQL count result shape must survive the preflight validation');
assert.ok((await readMemberCodeInventory({$queryRaw:async()=>[
 {memberCount:2n,missingCodeCount:1n}
]})).issues.some(x=>x.includes('remediation')));
assert.ok((await readMemberCodeInventory({$queryRaw:async()=>[
 {memberCount:2n,missingCodeCount:{toString:()=> '0'}}
]})).issues.some(x=>x.includes('invalid')),
 'Unexpected aggregate result types must fail closed');
assert.ok((await readMemberCodeInventory({$queryRaw:async()=>[]})).issues.length);
assert.ok((await readMemberCodeInventory({$queryRaw:async()=>[
 {memberCount:2n,missingCodeCount:0n},{memberCount:2n,missingCodeCount:0n}
]})).issues.length);
assert.deepEqual(assessMysqlVersion('8.4.7'),[]);
assert.ok(assessMysqlVersion('8.0.46').length,'Unvalidated production MySQL 8.0 must block');
assert.ok(assessMysqlVersion('invalid').length);
// Static fail-closed gate: production audit source must not contain migrations,
// DML, shell commands, Prisma writes or a production database reset.
const auditSource=readFileSync('scripts/audit-production-readiness.mjs','utf8');
assert.match(auditSource,/FROM _prisma_migrations ORDER BY started_at ASC/);
assert.match(auditSource,/FROM member_accounts/);
assert.match(auditSource,/SELECT COUNT\(\*\) FROM member_accounts WHERE referralCode IS NULL/,
 'Read-only inventory must use MySQL COUNT() rather than Decimal-producing SUM()');
assert.doesNotMatch(auditSource,/COALESCE\s*\(\s*SUM\s*\(/,
 'Decimal-producing SQL aggregate must not regress');
assert.doesNotMatch(auditSource,/db\.\$(?:executeRaw|transaction)|db\.[A-Za-z]+\.(?:create|update|delete|upsert)|spawnSync|execSync|migrate deploy/);

// Test the no-backup branch with fake Prisma delegates: never rely on a
// caller's assertion that the existing database contains no production data.
const metadata=Array.from({length:26},(_,i)=>({
 name:'SyntheticModel'+i,dbName:'synthetic_'+i
}));
metadata[0]={name:'MemberAccount',dbName:'member_accounts'};
const fakeDb=(names,counts={})=>{
 const db={$queryRaw:async()=>[
  {tableName:'_prisma_migrations'},{tableName:'staff_users'},
  ...names.map(tableName=>({tableName}))
 ]};
 for(const {name,dbName} of metadata)
  db[name[0].toLowerCase()+name.slice(1)]={count:async()=>counts[dbName]??0};
 return db;
};
assert.deepEqual(await inspectUnusedDatabase(fakeDb(['member_accounts']),metadata),[]);
const baselineDb=fakeDb(['financial_plan_versions','financial_plan_state']);
baselineDb.financialPlanVersion={findMany:async()=>[
 {id:1,requestKey:'00000000-0000-4000-8000-000000000001'}]};
baselineDb.financialPlanState={findUnique:async()=>({id:1,currentVersionId:1,revision:1})};
assert.deepEqual(await inspectUnusedDatabase(baselineDb,metadata),[],
 'Version-one system baseline is not business data');
baselineDb.financialPlanState={findUnique:async()=>({id:1,currentVersionId:2,revision:2})};
assert.ok((await inspectUnusedDatabase(baselineDb,metadata))
 .some(x=>x.includes('Financial plan has been modified')));
assert.ok((await inspectUnusedDatabase(
 fakeDb(['member_accounts'],{member_accounts:1}),metadata
 )).some(x=>x.includes('Existing application records')),
 'Used production database must NEVER skip backup');
assert.ok((await inspectUnusedDatabase(fakeDb(['legacy_unknown_table']),metadata))
 .some(x=>x.includes('Unexpected existing table')),
 'Unmanaged tables must prevent unused-database shortcut');
assert.ok((await inspectUnusedDatabase({$queryRaw:async()=>[]},metadata))
 .some(x=>x.includes('Migration history table missing')));
assert.ok((await inspectUnusedDatabase(fakeDb(['member_accounts']),[]))
 .some(x=>x.includes('metadata')));
console.log('Forward-only release migration contract and verified unused-DB backup bypass: PASS');
