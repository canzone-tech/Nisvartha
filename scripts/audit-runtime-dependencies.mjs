import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const lock=JSON.parse(readFileSync('backend/package-lock.json','utf8'));
const run=spawnSync('npm',['audit','--prefix','backend','--omit=dev','--json'],{
 encoding:'utf8',maxBuffer:20*1024*1024
});
let report;
try{report=JSON.parse(run.stdout||'{}')}catch{
 console.error('Backend dependency audit returned invalid JSON');
 process.exit(1);
}
if(run.error){
 console.error('Backend dependency audit could not execute');
 process.exit(1);
}
const severe=new Set(['high','critical']);
const runtime=[];
const tooling=[];
for(const [name,vulnerability] of Object.entries(report.vulnerabilities||{})){
 if(!severe.has(vulnerability.severity))continue;
 const nodes=Array.isArray(vulnerability.nodes)?vulnerability.nodes:[];
 const classified=nodes.length>0&&nodes.every(node=>{
  const item=lock.packages?.[node];
  return item&&(item.dev===true||item.devOptional===true);
 });
 (classified?tooling:runtime).push({name,severity:vulnerability.severity,nodes});
}
if(tooling.length)
 console.log('Controlled non-runtime migration/dev audit findings: '+
  tooling.map(x=>x.name+'('+x.severity+')').join(', '));
if(runtime.length){
 console.error('High/critical backend runtime dependency vulnerabilities: '+
  runtime.map(x=>x.name+'('+x.severity+')').join(', '));
 process.exit(1);
}
console.log('Backend runtime dependency audit: PASS');
