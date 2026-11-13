/**
 * READ-ONLY production database pre-migration assessment.
 *
 * Only authoritative MySQL SELECTs. No DDL/DML, app startup, secrets in
 * stdout, backups assumed, or migration invocation. Designed to run from the
 * exact compiled release archive before an operator authorizes ANY migration.
 */
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {validateAppliedMigrationChain} from './check-release-migrations.mjs';

export function validatePreMigrationHistory(names,rows,expected){
 const errors=[];
 if(!Array.isArray(names)||names.length===0||
    !Array.isArray(rows)||!(expected instanceof Map))
  return {errors:['Invalid packaged or authoritative migration audit'],applied:[]};
 const active=rows.filter(row=>row.rolled_back_at===null);
 const prefix=names.slice(0,active.length);
 if(active.length===0)errors.push('No applied migration baseline; refuse existing-database audit');
 if(active.length>names.length)errors.push('More applied migrations than packaged');
 if(active.some((row,i)=>row.migration_name!==prefix[i]))
  errors.push('Applied migrations are not an ordered packaged prefix');
 errors.push(...validateAppliedMigrationChain(prefix,active.map(row=>({
  ...row,expectedChecksum:expected.get(row.migration_name)
 }))));
 return {errors,applied:active.map(row=>row.migration_name)};
}

/** Prevent release of code-only login if historic members have no code.
 * Return no member-level identifiers, emails, phones or credential material.
 */
export function assessMemberCodeInventory(value,hasCodeColumn){
 const issues=[];
 if(!hasCodeColumn)return {issues:['Member referralCode column is missing'],counts:null};
 if(!value||typeof value!=='object'||Array.isArray(value))
  return {issues:['Member code inventory unavailable'],counts:null};
 const parse=n=>{
  if(typeof n!=='bigint'&&!(typeof n==='number'&&Number.isSafeInteger(n)))return null;
  if(n<0)return null;
  return BigInt(n);
 };
 const total=parse(value.memberCount),missing=parse(value.missingCodeCount);
 if(total===null||missing===null||missing>total)
  return {issues:['Member code inventory is invalid'],counts:null};
 if(missing>0n)issues.push('Existing members without referral codes require audited member-ID remediation before migration');
 return {issues,counts:{totalMembers:total.toString(),missingCodes:missing.toString()}};
}

/**
 * COUNT(*) returns bigint through Prisma's MySQL raw-query driver, whereas
 * SUM(CASE ...) returns a Decimal that the fail-closed count validator rejects.
 * Read only aggregate counts; do not select member identifiers or contacts.
 */
export async function readMemberCodeInventory(db){
 const records=await db.$queryRaw`SELECT
  (SELECT COUNT(*) FROM member_accounts) AS memberCount,
  (SELECT COUNT(*) FROM member_accounts WHERE referralCode IS NULL) AS missingCodeCount`;
 return assessMemberCodeInventory(records.length===1?records[0]:undefined,true);
}

/**
 * MySQL 8.0.46 acceptance is scoped to one explicitly identified migration:
 * 0037→0038 OR 0038→0039. Every scope requires its own isolated rehearsal
 * evidence and operator acknowledgment for the exact release SHA. The older
 * 0038 attestation cannot authorize the new 0039 receipt migration.
 * It does not prove backups, legal/financial clearance or host acceptance.
 */
export function assessMysqlVersion(version,context={}){
 if(typeof version!=='string'||!/^8\.\d+\.\d+(?:[-+.]|$)/.test(version))
  return ['MySQL server version could not be verified'];
 if(/^8\.4\./.test(version))return [];
 const approvedSha=context.approvedReleaseSha;
 const evidence=context.rehearsalReference;
 const exactHostVersion=/^8\.0\.46(?:[-+.]|$)/.test(version);
 const exactUpgrade=(
  context.fromMigration==='0037_versioned_financial_amounts'&&
  context.toMigration==='0038_shared_member_contacts'
 )||(
  context.fromMigration==='0038_shared_member_contacts'&&
  context.toMigration==='0039_member_registration_receipts'
 );
 const exactRelease=/^[a-f0-9]{40}$/.test(context.releaseSha||'')&&
  approvedSha===context.releaseSha;
 const hasEvidence=typeof evidence==='string'&&
  /^[A-Za-z0-9][A-Za-z0-9._:/-]{5,127}$/.test(evidence);
 if(exactHostVersion&&exactUpgrade&&exactRelease&&hasEvidence&&
    context.operatorApproved===true)return [];
 return ['MySQL version differs from verified 8.4 baseline; exact-release 8.0.46 compatibility approval and rehearsal evidence are required'];
}

async function main(){
 const releaseDir=resolve(process.argv[2]||'');
 if(process.argv.length!==3||process.argv[2]?.startsWith('-'))
  throw Error('Expected absolute extracted release directory');
 const manifest=JSON.parse(readFileSync(join(releaseDir,'RELEASE_INFO.json'),'utf8'));
 const approved=process.env.NISVARTHA_RELEASE_AUDIT_SHA;
 if(!/^[a-f0-9]{40}$/.test(approved||'')||manifest.commit!==approved)
  throw Error('Preflight release SHA does not match the selected compiled artifact');
 if(process.env.NODE_ENV!=='production'||Number(process.versions.node.split('.')[0])!==22)
  throw Error('Preflight requires NODE_ENV=production and Node.js 22');
 const url=new URL(process.env.DATABASE_URL||'');
 const name=decodeURIComponent(url.pathname).replace(/^\/+/, '');
 if(url.protocol!=='mysql:'||!url.hostname||!url.username||!url.password||
    url.username==='root'||!name||name==='nisvartha_ci'||
    /(?:^|_)ci(?:$|_)/i.test(name))
  throw Error('A dedicated non-CI, non-root MySQL connection is required');
 const dir=join(releaseDir,'ops/prisma/migrations');
 const names=readdirSync(dir,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name).sort();
 if(names.length===0||names.at(-1)!==manifest.migration_head)
  throw Error('Packaged migration head differs from the exact release manifest');
 const expected=new Map(names.map(n=>[n,
  createHash('sha256').update(readFileSync(join(dir,n,'migration.sql'))).digest('hex')
 ]));
 const require=createRequire(join(releaseDir,'api/package.json'));
 const {PrismaClient}=require('@prisma/client');
 const db=new PrismaClient();
 try{
  const [rows,versions]=await Promise.all([
   db.$queryRaw`SELECT migration_name,checksum,finished_at,rolled_back_at
    FROM _prisma_migrations ORDER BY started_at ASC`,
   db.$queryRaw`SELECT VERSION() AS mysqlVersion`
  ]);
  const history=validatePreMigrationHistory(names,rows,expected);
  const receiptUpgrade=history.applied.at(-1)==='0038_shared_member_contacts'&&
   manifest.migration_head==='0039_member_registration_receipts';
  const mysqlVersionContext={
   releaseSha:manifest.commit,
   approvedReleaseSha:process.env.NISVARTHA_MYSQL80_APPROVED_RELEASE_SHA,
   rehearsalReference:receiptUpgrade
    ?process.env.NISVARTHA_MYSQL80_0039_REHEARSAL_REF
    :process.env.NISVARTHA_MYSQL80_0038_REHEARSAL_REF,
   operatorApproved:receiptUpgrade
    ?process.env.NISVARTHA_MYSQL80_0039_COMPATIBILITY_APPROVED==='true'
    :process.env.NISVARTHA_MYSQL80_0038_COMPATIBILITY_APPROVED==='true',
   fromMigration:history.applied.at(-1),
   toMigration:manifest.migration_head
  };
  const versionIssues=assessMysqlVersion(versions[0]?.mysqlVersion,mysqlVersionContext);
  const issues=[...history.errors,...versionIssues];
  const referralIntroduced=names.indexOf('0011_synthetic_pin_invitation');
  if(referralIntroduced<0)issues.push('Required referral-code migration is missing from package');
  if(history.applied.length<=referralIntroduced)
   issues.push('Existing database has not reached referral-code schema; manual compatibility audit required');
  let counts=null;
  if(history.applied.length>referralIntroduced&&history.errors.length===0){
   const inventory=await readMemberCodeInventory(db);
   counts=inventory.counts;
   issues.push(...inventory.issues);
  }
  const output={
   result:issues.length?'BLOCKED':'PRE_MIGRATION_READ_ONLY_AUDIT_PASS',
   releaseCommit:manifest.commit,migrationHead:manifest.migration_head,
   appliedMigrationHead:history.applied.at(-1)??null,
   appliedMigrationCount:history.applied.length,
   mysqlVersion:typeof versions[0]?.mysqlVersion==='string'
    ?versions[0].mysqlVersion.split('-')[0]:null,
   members:counts,blockers:issues,
   mysql8046CompatibilityAttested:
    /^8\.0\.46(?:[-+.]|$)/.test(versions[0]?.mysqlVersion||'')&&
    versionIssues.length===0,
   outsideScope:['Paired production MySQL/private-media backup',
    'Verified off-host encrypted copy and isolated restore',
    'Live host TLS/systemd/Apache smoke and human UAT',
    'Independent deployment and financial approval']
  };
  console.log(JSON.stringify(output,null,2));
  if(issues.length)process.exitCode=2;
 }finally{await db.$disconnect()}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 await main().catch(()=>{
  // Never emit Prisma errors or URLs (may include credentials).
  console.error('Nisvartha read-only production pre-migration audit: BLOCKED (invalid inputs or database audit unavailable)');
  process.exitCode=2;
 });
