'use client';
import {useEffect,useState} from 'react';
import {GenealogyTree} from './genealogy-tree';
import type {GenealogyView} from './genealogy-tree';

// The browser receives data only through the authenticated, staff-RBAC
// same-origin BFF. Aborted requests cannot populate a different member row.
export function AdminMemberGenealogy({memberId}:{memberId:string}){
 const [tree,setTree]=useState<GenealogyView|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  const abort=new AbortController();
  Promise.resolve().then(async()=>{
   setTree(null);setError('');
   try{
    const response=await fetch('/api/admin/backend/cms/membership/genealogy/'+encodeURIComponent(memberId),{
     cache:'no-store',signal:abort.signal
    });
    if(!response.ok)throw Error('Unable to load authorized genealogy');
    const data=await response.json() as GenealogyView;
    if(data.kind!=='DIRECT_INVITATIONS'||!data.root||data.root.id!==memberId||
       typeof data.shown!=='number'||data.shown>150)
     throw Error('Unexpected genealogy response');
    if(!abort.signal.aborted)setTree(data);
   }catch(e){
    if(!abort.signal.aborted)setError(e instanceof Error?e.message:'Genealogy unavailable');
   }
  });
  return ()=>abort.abort();
 },[memberId]);
 return <div className="admin-genealogy-inspector">
  {!tree&&!error&&<p role="status">Loading invitation genealogy…</p>}
  {error&&<p role="alert">{error}</p>}
  {tree&&<GenealogyTree tree={tree}/>}
 </div>;
}
