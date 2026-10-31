import {createRequire} from 'node:module';
import assert from 'node:assert/strict';

const require=createRequire(new URL('../package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const [action,reference,flag,...extra]=process.argv.slice(2);
const usage='Usage: node backend/scripts/enquiries.mjs list | show NF-<uuid> --reveal';
const operatorUrl=process.env.NISVARTHA_OPERATOR_DATABASE_URL;
if(!operatorUrl || !operatorUrl.startsWith('mysql://')){
 console.error('Set NISVARTHA_OPERATOR_DATABASE_URL to a dedicated read-only MySQL account.');
 process.exit(2);
}
if(process.env.NODE_ENV==='production' && operatorUrl===process.env.DATABASE_URL){
 console.error('Operator connection must not reuse the application writer in production.');
 process.exit(2);
}
if(extra.length || !['list','show'].includes(action) ||
 (action==='list' && (reference!==undefined || flag!==undefined)) ||
 (action==='show' && (!/^NF-[a-f0-9-]{36}$/i.test(reference||'') || flag!=='--reveal'))){
 console.error(usage);
 process.exit(2);
}
const db=new PrismaClient({datasources:{db:{url:operatorUrl}}});
try{
 if(action==='list'){
  const rows=await db.enquiry.findMany({
   orderBy:[{createdAt:'desc'},{id:'desc'}],take:50,
   select:{reference:true,category:true,status:true,createdAt:true}
  });
  for(const row of rows)process.stdout.write(JSON.stringify(row)+'\n');
  console.error('Displayed '+rows.length+' most recent references, with no personal fields.');
 }else{
  const row=await db.enquiry.findUnique({where:{reference}});
  assert.ok(row,'Enquiry not found');
  process.stdout.write(JSON.stringify(row,null,2)+'\n');
 }
}catch(error){
 console.error(error instanceof assert.AssertionError?'Enquiry not found':'Operator read failed');
 process.exitCode=1;
}finally{await db.$disconnect();}
