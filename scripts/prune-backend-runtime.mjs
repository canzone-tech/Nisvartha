import {existsSync,readFileSync,rmSync} from 'node:fs';
import {resolve,sep} from 'node:path';

const root=resolve('backend');
const modules=resolve(root,'node_modules');
const lock=JSON.parse(readFileSync(resolve(root,'package-lock.json'),'utf8'));
let removed=0;
for(const [key,item] of Object.entries(lock.packages||{})){
 if(!key.startsWith('node_modules/')||!(item?.dev===true||item?.devOptional===true))continue;
 const target=resolve(root,key);
 if(!target.startsWith(modules+sep))throw new Error('Unsafe package path in lockfile');
 if(existsSync(target)){rmSync(target,{recursive:true,force:true});removed++}
}
if(existsSync(resolve(modules,'prisma')))
 throw new Error('Prisma CLI must not ship in the long-running API artifact');
console.log('Removed '+removed+' dev/devOptional package paths from API runtime tree.');
