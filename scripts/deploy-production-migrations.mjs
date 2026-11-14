/**
 * Explicit, operator-approved release migration entrypoint.
 * Lives in the compiled delivery artifact with the exact versioned Prisma
 * schema/migrations and lockfile. Never invoked by application startup.
 *
 * Require either a verified DB/media backup reference OR an explicit unused
 * database attestation backed by exact read-only table counts. Never touch
 * existing business records; always require a reviewed release SHA.
 */
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {inspectUnusedDatabase} from './check-unused-database.mjs';

const opsDir=dirname(fileURLToPath(import.meta.url));
const releaseDir=resolve(opsDir,'..');
function refuse(reason){
 console.error('Nisvartha migration refused: '+reason);
 process.exit(2);
}
let release;
try{release=JSON.parse(readFileSync(join(releaseDir,'RELEASE_INFO.json'),'utf8'))}
catch{refuse('release manifest missing or invalid')}
const expected=process.env.NISVARTHA_RELEASE_APPROVED_SHA;
if(!/^[a-f0-9]{40}$/.test(release?.commit||'')||
   expected!==release.commit)
 refuse('approved release SHA must match the exact packaged commit');
if(process.env.NISVARTHA_MIGRATION_APPROVED!=='true')
 refuse('independent migration approval is required');
// A genuinely unused installation database may be upgraded without an
// artificial backup reference. Explicit confirmation is NOT enough on its
// own: every existing authoritative application table is inspected first.
const backupRef=process.env.NISVARTHA_MIGRATION_BACKUP_REF||'';
const unusedConfirmed=process.env.NISVARTHA_UNUSED_DATABASE_CONFIRMED==='true';
if(backupRef&&!/^[A-Za-z0-9][A-Za-z0-9._:/-]{5,127}$/.test(backupRef))
 refuse('invalid verified backup reference');
if(!backupRef&&!unusedConfirmed)
 refuse('verified backup reference or confirmed unused-database inspection is required');
if(process.env.NODE_ENV!=='production'||Number(process.versions.node.split('.')[0])!==22)
 refuse('Node.js 22 and NODE_ENV=production are required');
const url=process.env.DATABASE_URL;
try{
 const db=new URL(url||'');
 const name=decodeURIComponent(db.pathname).replace(/^\/+/,'');
 if(db.protocol!=='mysql:'||!db.hostname||!db.username||!db.password||
    db.username==='root'||!name||name==='nisvartha_ci'||
    /(?:^|_)ci(?:$|_)/i.test(name)||db.password==='replace-me')
  refuse('a dedicated non-CI MySQL application account is required');
}catch{refuse('DATABASE_URL must be a valid non-CI MySQL connection')}
const schema=join(opsDir,'prisma','schema.prisma');
const migrations=join(opsDir,'prisma','migrations');
if(!existsSync(schema)||!existsSync(join(migrations,'migration_lock.toml'))||
   !existsSync(join(opsDir,'package-lock.json'))||
   !existsSync(join(opsDir,'package.json')))
 refuse('packaged Prisma migration inputs or lockfile missing');
const heads=readdirSync(migrations,{withFileTypes:true})
 .filter(entry=>entry.isDirectory()).map(entry=>entry.name).sort();
if(!heads.length||heads.at(-1)!==release.migration_head||
   !heads.every(name=>existsSync(join(migrations,name,'migration.sql'))))
 refuse('migration chain does not match the compiled release manifest');
if(!backupRef){
 const require=createRequire(join(releaseDir,'api','package.json'));
 const {PrismaClient,Prisma}=require('@prisma/client');
 const db=new PrismaClient();
 try{
  const problems=await inspectUnusedDatabase(db,Prisma.dmmf.datamodel.models);
  if(problems.length)
   refuse('unused-database inspection failed: '+problems.join('; '));
 }catch(error){
  if(error instanceof Error&&error.message.startsWith('unused-database inspection failed'))
   throw error;
  refuse('unused-database inspection could not be completed');
 }finally{await db.$disconnect()}
 console.log('Unused database independently verified; no backup reference required');
}
// Install locked CLI in a separate ops directory; the API production
// dependency tree is unchanged. No silent upgrades or remote code via npx.
const install=spawnSync('npm',['ci','--prefix',opsDir,'--include=dev','--no-audit'],{
 cwd:opsDir,env:process.env,stdio:'inherit'
});
if(install.error||install.status!==0)refuse('locked migration CLI install failed');
const cli=join(opsDir,'node_modules','.bin','prisma');
if(!existsSync(cli))refuse('locked Prisma CLI is missing');
const apply=spawnSync(cli,['migrate','deploy','--schema',schema],{
 cwd:opsDir,env:process.env,stdio:'inherit'
});
if(apply.error||apply.status!==0)refuse('Prisma migrate deploy failed; do not start this release');
console.log('Nisvartha migration deploy succeeded for approved commit '+release.commit.slice(0,12)+'.');
