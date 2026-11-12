/** Read-only contract between the packaged migration chain and the existing
 * authoritative MySQL history. Must pass BEFORE switching compiled releases.
 * This module never runs migrations or changes database state.
 */
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

export function validateAppliedMigrationChain(names,rows){
 const issues=[];
 const actual=new Map();
 for(const row of rows){
  if(row.rolled_back_at!==null)continue;
  if(actual.has(row.migration_name)){
   issues.push('Duplicate non-rolled-back migration '+row.migration_name);
   continue;
  }
  actual.set(row.migration_name,row);
  if(row.finished_at===null)issues.push('Unfinished migration '+row.migration_name);
 }
 if(actual.size!==names.length)
  issues.push('Applied migration count differs from packaged chain');
 for(const name of names){
  const row=actual.get(name);
  if(!row)issues.push('Pending packaged migration '+name);
  else if(row.expectedChecksum!==undefined&&row.checksum!==row.expectedChecksum)
   issues.push('Migration checksum mismatch '+name);
 }
 for(const name of actual.keys())
  if(!names.includes(name))issues.push('Unrecognized applied migration '+name);
 return issues;
}

/** A code-only member login release cannot strand pre-0011 members with NULL codes.
 * Never synthesize or rewrite identity data in a release preflight.
 * Prisma/MySQL COUNT(*) normally returns bigint, but unit fixtures may use numbers.
 */
export function validateMemberReferralCodeReadiness(missingCount){
 if(!(typeof missingCount==='bigint' || Number.isSafeInteger(missingCount)) ||
    missingCount<0)
  return ['Member referral code audit count unavailable or invalid'];
 if(missingCount>0)
  return ['Member referral code migration readiness: legacy accounts lack login codes; audited remediation is required before cutover'];
 return [];
}

export function validateForwardRelease(oldHead,newHead,names){
 const issues=[];
 if(!names.includes(oldHead))issues.push('Old release migration head not in new package');
 if(names.at(-1)!==newHead)issues.push('New release migration head mismatch');
 if(names.includes(oldHead)&&names.includes(newHead)&&
   names.indexOf(newHead)<names.indexOf(oldHead))
  issues.push('Release migration downgrade prohibited');
 if(new Set(names).size!==names.length)issues.push('Duplicate packaged migration name');
 return issues;
}

async function main(){
 const [rootInput,previousInput]=process.argv.slice(2);
 if(!rootInput||!previousInput)
  throw Error('Expected packaged release root and previous release path');
 const root=resolve(rootInput),previous=resolve(previousInput);
 const info=JSON.parse(readFileSync(join(root,'RELEASE_INFO.json'),'utf8'));
 const old=JSON.parse(readFileSync(join(previous,'RELEASE_INFO.json'),'utf8'));
 const dir=join(root,'ops/prisma/migrations');
 const names=readdirSync(dir,{withFileTypes:true})
  .filter(entry=>entry.isDirectory()).map(entry=>entry.name).sort();
 const issues=validateForwardRelease(old.migration_head,info.migration_head,names);
 if(issues.length)throw Error(issues.join('; '));
 const expected=new Map(names.map(name=>[
  name,createHash('sha256').update(readFileSync(join(dir,name,'migration.sql'))).digest('hex')
 ]));
 const require=createRequire(join(root,'api/package.json'));
 const {PrismaClient}=require('@prisma/client');
 const db=new PrismaClient();
 try{
  const rows=await db.$queryRaw`
   SELECT migration_name, checksum, finished_at, rolled_back_at
   FROM _prisma_migrations ORDER BY started_at ASC`;
  const checked=rows.map(row=>({...row,
   expectedChecksum:expected.get(row.migration_name)
  }));
  const mismatches=validateAppliedMigrationChain(names,checked);
  if(mismatches.length)throw Error(mismatches.join('; '));
  // Historical 0011 added nullable referral codes; email sign-in no longer exists.
  // Read-only, constant SQL after exact packaged schema/migration verification.
  if(names.includes('0038_shared_member_contacts')){
   const missing=await db.$queryRaw`SELECT COUNT(*) AS missingCount
    FROM member_accounts WHERE referralCode IS NULL`;
   const errors=validateMemberReferralCodeReadiness(
    missing.length===1?missing[0]?.missingCount:undefined);
   if(errors.length)throw Error(errors.join('; '));
  }
 }finally{await db.$disconnect()}
 console.log('Packaged migration chain and authoritative MySQL history: PASS ('+
  names.length+' applied, current '+info.migration_head+')');
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 await main().catch(error=>{
  // Never output raw DB URLs, passwords or Prisma connection diagnostics.
  console.error('Migration cutover REFUSED: '+
   (error instanceof Error&&/migration|chain|checksum|release|packaged|referral code audit/i.test(error.message)
    ?error.message:'Migration history could not be verified'));
  process.exitCode=1;
 });
