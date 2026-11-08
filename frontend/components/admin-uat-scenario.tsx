'use client';
import {useEffect,useRef,useState} from 'react';
import {UatScenarioView} from './uat-scenario-view';
import type {UatScenario} from './uat-scenario-view';

export function AdminUatScenario({memberId}:{memberId:string}){
 const [scenario,setScenario]=useState<UatScenario|null>(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const requestKey=useRef<string|null>(null);
 const path='/api/admin/backend/cms/membership/uat-scenario/'+encodeURIComponent(memberId);
 useEffect(()=>{
  const controller=new AbortController();
  Promise.resolve().then(async()=>{
   setLoading(true);setError('');setScenario(null);requestKey.current=null;
   try{
    const response=await fetch(path,{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw Error('Local scenario is unavailable');
    const data=await response.json() as UatScenario;
    if(data.status!=='LOCAL_SYNTHETIC_REFERENCE_ONLY'||data.memberId!==memberId)
     throw Error('Unexpected local scenario response');
    if(!controller.signal.aborted)setScenario(data);
   }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Unavailable')}
   finally{if(!controller.signal.aborted)setLoading(false)}
  });
  return ()=>controller.abort();
 },[memberId,path]);
 async function record(){
  if(!scenario||scenario.joiningRecorded||busy)return;
  if(!window.confirm('Record an illustrative local joining reference? No real payment is settled.'))return;
  setBusy(true);setError('');
  requestKey.current??=crypto.randomUUID();
  try{
   const response=await fetch(path+'/record',{method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({requestKey:requestKey.current})
   });
   const data=await response.json();
   if(!response.ok)throw Error(data?.message||'Synthetic record rejected');
   if(data?.status!=='LOCAL_SYNTHETIC_REFERENCE_ONLY'||data.memberId!==memberId)
    throw Error('Unexpected scenario response');
   setScenario(data as UatScenario);
   requestKey.current=null;
  }catch(e){setError(e instanceof Error?e.message:'Unable to record scenario')}
  finally{setBusy(false)}
 }
 return <div className="foundation-uat-scenario-admin">
  {loading&&<p role="status">Loading local financial UAT history…</p>}
  {error&&<p role="alert" className="admin-error">{error}</p>}
  {scenario&&<>
   {!scenario.joiningRecorded&&<button type="button" className="button" disabled={busy}
    onClick={()=>void record()}>Record synthetic joining reference</button>}
   {scenario.joiningRecorded&&<p role="status">Joining reference already recorded (idempotent).</p>}
   <UatScenarioView scenario={scenario}/>
  </>}
 </div>;
}
