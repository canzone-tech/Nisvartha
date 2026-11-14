import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';

// Every credential input uses one accessible reveal control; newly added
// password fields must not bypass it by introducing a naked password input.
const uses=new Map([
 ['member-auth-form.tsx',1],
 ['member-recovery-form.tsx',2],
 ['admin-login-form.tsx',1],
 ['admin-password-form.tsx',3],
 ['admin-member-registration.tsx',1],
 ['member-dashboard.tsx',2]
]);
for(const [name,count] of uses){
 const file=readFileSync(join('frontend/components',name),'utf8');
 assert.match(file,/import \{PasswordInput\} from '\.\/password-input'/,
  name+' must reuse the shared password control');
 assert.equal([...file.matchAll(/<PasswordInput\b/g)].length,count,
  name+' must render all credential controls through PasswordInput');
}
function check(path){
 for(const entry of readdirSync(path,{withFileTypes:true})){
  const file=join(path,entry.name);
  if(entry.isDirectory())check(file);
  if(!entry.isFile()||!file.endsWith('.tsx'))continue;
  const contents=readFileSync(file,'utf8');
  assert.doesNotMatch(contents,/<input\b[^>]*\btype\s*=\s*['"]password['"]/i,
   file+' must use the shared eye toggle instead of a bare password input');
 }
}
check('frontend');
const component=readFileSync('frontend/components/password-input.tsx','utf8');
for(const feature of [
 "type={visible?'text':'password'}",
 'type="button"',
 'aria-pressed={visible}',
 'aria-label={action}',
 'onClick={()=>setVisible(value=>!value)}'
])assert.ok(component.includes(feature),'Password visibility interaction missing: '+feature);
console.log('Shared password input and all ten credential fields: PASS');
