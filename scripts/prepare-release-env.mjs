import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {parseEnv} from 'node:util';
import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';
import {pathToFileURL} from 'node:url';

// Prepare candidate env files only. Never overwrite active environment or emit secrets.
const [releaseInput,oldApiPath,nextApiPath,nextWebPath]=process.argv.slice(2);
if(!releaseInput||!oldApiPath||!nextApiPath||!nextWebPath)
 throw Error('Expected release root, existing API env, and two new env destinations');
const root=resolve(releaseInput);
const release=JSON.parse(readFileSync(join(root,'RELEASE_INFO.json'),'utf8'));
const {validateReleasePair,validateClientReviewArtifact}=await import(pathToFileURL(join(root,'ops/release-profile.mjs')));
const {validateReleaseConfiguration}=await import(pathToFileURL(join(root,'ops/release-preflight.mjs')));
const rejects=validateClientReviewArtifact(release);
if(rejects.length)throw Error('Non-shippable release: '+rejects.join('; '));
if(release.origin!=='https://nisvarthafoundation.in')throw Error('Unexpected deployment origin');
const api=parseEnv(readFileSync(oldApiPath,'utf8'));
if(api.NODE_ENV!=='production'||api.HOST!=='127.0.0.1'||api.PORT!=='3110'||
   !api.DATABASE_URL||api.PUBLIC_WEB_ORIGIN!==release.origin||
   api.MEDIA_SCANNER_BIN!=='clamscan'||!api.MEDIA_STORAGE_ROOT)
 throw Error('Existing production API baseline has changed');
let key=(api.PIN_VAULT_KEY||'').trim();
const keyPath=join(dirname(oldApiPath),'pin-vault.key');
if(existsSync(keyPath)){
 const persisted=readFileSync(keyPath,'utf8').trim();
 if(key&&persisted!==key)throw Error('Existing PIN vault key conflicts with protected key file');
 key=persisted;
}
if(!key){
 // Never rotate an existing PIN vault that may contain encrypted bearer codes.
 const require=createRequire(join(root,'api/package.json'));
 const {PrismaClient}=require('@prisma/client');
 const db=new PrismaClient({datasources:{db:{url:api.DATABASE_URL}}});
 let count;
 try{count=await db.registrationPin.count()}finally{await db.$disconnect()}
 if(count!==0)throw Error('PIN vault key missing while registration PIN records exist');
 key=randomBytes(32).toString('base64url');
 writeFileSync(keyPath,key+'\n',{flag:'wx',mode:0o600});
 console.log('New protected PIN vault key provisioned; arrange encrypted off-host key escrow before real PIN issuance');
}
if(!/^[A-Za-z0-9_-]{43}$/.test(key)||Buffer.from(key,'base64url').toString('base64url')!==key)
 throw Error('PIN vault key format invalid');
const nextApi={...api,PIN_VAULT_KEY:key};
const flags=release.build_env;
for(const field of [
 'MEMBER_PORTAL_ENABLED','MEMBER_APPLICATIONS_ENABLED',
 'MEMBER_STAFF_REGISTRATION_ENABLED','MEMBER_RECOVERY_ENABLED',
 'REGISTRATION_ACCESS_PIN_ENABLED','MEMBER_PIN_AUTO_ACTIVATE_ENABLED',
 'MATRIX_PLACEMENT_ENABLED','MEMBER_COMPENSATION_ENABLED',
 'MEMBER_COMPENSATION_APPROVED','MEMBER_WALLET_ENABLED',
 'DONATION_ACCOUNTING_ENABLED','MEMBER_TERMS_VERSION','MEMBER_PRIVACY_VERSION'
])nextApi[field]=flags[field];
const nextWeb={NODE_ENV:'production',API_INTERNAL_URL:'http://127.0.0.1:3110',...flags};
const errors=[...validateReleasePair(nextApi,nextWeb,release),
 ...validateReleaseConfiguration(nextApi,'api'),
 ...validateReleaseConfiguration(nextWeb,'web')];
if(errors.length)throw Error('Release configuration refused: '+errors.join('; '));
const serialize=env=>Object.entries(env).map(([k,v])=>{
 if(!/^[A-Z][A-Z0-9_]*$/.test(k)||typeof v!=='string'||/[\r\n]/.test(v))
  throw Error('Invalid env field: '+k);
 return k+'='+JSON.stringify(v);
}).join('\n')+'\n';
writeFileSync(nextApiPath,serialize(nextApi),{flag:'wx',mode:0o600});
writeFileSync(nextWebPath,serialize(nextWeb),{flag:'wx',mode:0o600});
console.log('Compiled API/web policy parity and release configuration: PASS');
