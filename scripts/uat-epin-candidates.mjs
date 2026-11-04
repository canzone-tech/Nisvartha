#!/usr/bin/env node
// Local-only exercise of the existing unissued 256-bit E-PIN candidate factory.
// NEVER issues PIN inventory, redeems a code, accepts money or creates members.
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {existsSync,mkdtempSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const ONLY='UNISSUED_ONLY';
function fail(message){throw new Error(message)}
function options(argv){
 if(argv.length!==2)fail('Expected --quantity=N and --expires-at=ISO8601-with-timezone');
 const values=new Map();
 for(const item of argv){
  const found=/^--(quantity|expires-at)=(.+)$/.exec(item);
  if(!found||values.has(found[1]))fail('Invalid or repeated preview argument');
  values.set(found[1],found[2]);
 }
 if(!values.has('quantity')||!values.has('expires-at'))fail('Missing preview argument');
 const raw=values.get('quantity');
 if(!/^(?:[1-9]|[1-9][0-9]{1,2})$/.test(raw))
  fail('Quantity must be an integer from 1 to 500');
 const quantity=Number(raw);
 if(quantity>500)fail('Quantity must not exceed 500');
 return {quantity,expiresAt:values.get('expires-at')};
}
function main(){
 if(process.env.NISVARTHA_UAT_EPINS!==ONLY||process.env.NODE_ENV==='production'){
  fail('Refusing candidate preview outside explicitly opted-in nonproduction UAT');
 }
 const request=options(process.argv.slice(2));
 const compiled=fileURLToPath(new URL('../backend/dist/security/epin-batch.js',import.meta.url));
 if(!existsSync(compiled))fail('Compiled backend missing; run npm --prefix backend run verify first');
 const require=createRequire(import.meta.url);
 const {prepareEpinBatch}=require(compiled);
 const candidates=prepareEpinBatch(request);
 // A fresh, private folder avoids overwrites, symlink surprises and accidental
 // writes into a repo, mounted volume or authoritative data store.
 const directory=mkdtempSync(join(tmpdir(),'nisvartha-unissued-epin-'));
 const file=join(directory,'UNISSUED-TEST-CANDIDATES.json');
 const payload={
  classification:'UNISSUED_TEST_CANDIDATES_NOT_VALID_FOR_SIGNUP',
  purpose:'SYNTHETIC_NONFINANCIAL_UAT',
  notice:'Not issued or redeemable; no member activation, payment or referral entitlement',
  generatedAt:new Date().toISOString(),
  quantity:candidates.length,
  expiresAt:candidates[0].expiresAt,
  candidates:candidates.map(candidate=>({
   code:candidate.code,
   displaySuffix:candidate.displaySuffix
  }))
 };
 writeFileSync(file,JSON.stringify(payload,null,2)+'\n',{
  mode:0o600,flag:'wx',encoding:'utf8'
 });
 process.stdout.write('UNISSUED TEST CANDIDATES ONLY — NOT VALID FOR SIGNUP\n');
 process.stdout.write('Generated '+candidates.length+' unique 256-bit synthetic candidates.\n');
 process.stdout.write('Private test file: '+file+'\n');
 process.stdout.write('No database rows, staff-issued E-PINs, payments or member entitlements created.\n');
 process.stdout.write('Delete the private test file when UAT is finished.\n');
}
try{main()}
catch(error){
 // Never print secrets or file contents on error.
 console.error('E-PIN UAT candidate preview denied: '+(error instanceof Error?error.message:'Invalid request'));
 process.exitCode=1;
}
