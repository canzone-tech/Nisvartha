'use client';
import {useEffect,useState} from 'react';
import {MemberMatrixTree} from './member-matrix-tree';
import type {MemberMatrixView} from './member-matrix-tree';
export function AdminMemberMatrix({memberId}:{memberId:string}){
 const [matrix,setMatrix]=useState<MemberMatrixView|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  const abort=new AbortController();
  Promise.resolve().then(async()=>{
   setMatrix(null);setError('');
   try{
    const response=await fetch('/api/admin/backend/cms/membership/matrix/'+encodeURIComponent(memberId),{
     cache:'no-store',signal:abort.signal
    });
    if(!response.ok)throw Error('Unable to load member matrix');
    const data=await response.json() as MemberMatrixView;
    if(data.kind!=='FORCED_1_TO_3'||data.root?.memberId!==memberId||data.width!==3)
     throw Error('Unexpected matrix response');
    if(!abort.signal.aborted)setMatrix(data);
   }catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:'Matrix unavailable')}
  });
  return ()=>abort.abort();
 },[memberId]);
 return <div className="admin-genealogy-inspector">
  {!matrix&&!error&&<p role="status">Loading member matrix…</p>}
  {error&&<p role="alert">{error}</p>}
  {matrix&&<MemberMatrixTree matrix={matrix}/>}
 </div>;
}
