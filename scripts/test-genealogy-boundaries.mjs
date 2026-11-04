import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {GenealogyService,GENEALOGY_MAX_LEVEL,GENEALOGY_MAX_NODES}=
 require('../backend/dist/members/genealogy.service.js');
const keys=['NODE_ENV','DATABASE_URL','NISVARTHA_UAT_PIN_REGISTRATION',
 'MEMBER_PORTAL_ENABLED','MEMBER_APPLICATIONS_ENABLED'];
const saved=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
delete process.env.NODE_ENV;
process.env.DATABASE_URL='mysql://nisvartha_ci:fake@127.0.0.1/nisvartha_ci';
process.env.NISVARTHA_UAT_PIN_REGISTRATION='synthetic';
process.env.MEMBER_PORTAL_ENABLED='true';
process.env.MEMBER_APPLICATIONS_ENABLED='true';

const account=(id,status='ACTIVE')=>({id,displayName:'Sensitive Name '+id,status});
const db=(members,links)=>{
 const ordered=[...links].sort((a,b)=>a.createdAt-b.createdAt||a.id.localeCompare(b.id));
 return {
  memberAccount:{findUnique:async({where})=>members.get(where.id)??null},
  memberInvitation:{
   findMany:async({where,take})=>ordered
    .filter(edge=>where.inviterId.in.includes(edge.inviterId))
    .slice(0,take).map(edge=>({inviterId:edge.inviterId,
     invitee:members.get(edge.inviteeId)})),
   count:async({where})=>ordered
    .filter(edge=>where.inviterId.in.includes(edge.inviterId)).length
  }
 };
};
const edge=(id,from,to,n)=>({id,inviterId:from,inviteeId:to,createdAt:n});
try{
 assert.equal(GENEALOGY_MAX_LEVEL,5);
 assert.equal(GENEALOGY_MAX_NODES,150);
 const people=new Map(['root','alpha','beta','grandchild']
  .map(id=>[id,account(id)]));
 const tree=new GenealogyService(db(people,[
  edge('edge-b','root','beta',2),edge('edge-a','root','alpha',1),
  edge('edge-c','alpha','grandchild',3)
 ]));
 const privateView=await tree.forMember({id:'root',email:'owner@example.invalid',status:'ACTIVE'});
 assert.deepEqual(privateView.root.children.map(x=>x.id),['alpha','beta']);
 assert.equal(privateView.root.children[0].children[0].id,'grandchild');
 assert.equal(privateView.shown,4);
 assert.equal(privateView.truncated,false);
 assert.equal(privateView.root.label,'You');
 assert.ok(!JSON.stringify(privateView).includes('Sensitive Name'),
  'Invitee personal details were exposed to a member');
 const admin=await tree.forStaff('root');
 assert.equal(admin.root.children[0].label,'Sensitive Name alpha');
 await assert.rejects(()=>tree.forMember({id:'root',status:'PENDING'}),
  error=>error.getStatus?.()===403);
 await assert.rejects(()=>tree.forStaff('missing'),
  error=>error.getStatus?.()===404);

 const chain=new Map(Array.from({length:8},(_,i)=>['c'+i,account('c'+i)]));
 const ancestry=new GenealogyService(db(chain,
  Array.from({length:7},(_,i)=>edge('c-edge-'+i,'c'+i,'c'+(i+1),i))
 ));
 const deep=await ancestry.forStaff('c0');
 assert.equal(deep.shown,6,'Do not render nodes beyond fifth level');
 assert.equal(deep.truncated,true,'Hidden deep descendants must be disclosed');

 const broad=new Map([['root',account('root')],...Array.from({length:160},(_,i)=>{
  const id='b'+String(i).padStart(3,'0');return [id,account(id)];
 })]);
 const spread=new GenealogyService(db(broad,Array.from({length:160},(_,i)=>{
  const id='b'+String(i).padStart(3,'0');
  return edge('wide-'+id,'root',id,i);
 })));
 const limited=await spread.forStaff('root');
 assert.equal(limited.shown,150);
 assert.equal(limited.root.children.length,149);
 assert.equal(limited.truncated,true,'Nodes beyond hard safety limit must be disclosed');

 const bad=new GenealogyService(db(new Map([
  ['root',account('root')],['a',account('a')]
 ]),[edge('cycle1','root','a',1),edge('cycle2','a','root',2)]));
 await assert.rejects(()=>bad.forStaff('root'),
  error=>error.getStatus?.()===409,'Cycles must not be silently rendered');
 process.env.NODE_ENV='production';
 await assert.rejects(()=>tree.forStaff('root'),
  error=>error.getStatus?.()===503,'Production must not expose synthetic genealogy');
 console.log('Genealogy bounded BFS, depth 5, node cap 150, stable levels, privacy, cycle rejection and production guard: PASS');
}finally{
 for(const [key,value] of Object.entries(saved)){
  if(value===undefined)delete process.env[key];else process.env[key]=value;
 }
}
