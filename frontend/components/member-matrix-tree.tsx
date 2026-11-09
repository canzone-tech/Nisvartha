export type MemberMatrixNode={
 positionId:string;memberId:string;label:string;status:string;completedAt:string|null;
 sequence:number;slot:number;level:number;kind:string;children:MemberMatrixNode[];
};
export type MemberMatrixView={
 kind:'FORCED_1_TO_3';root:MemberMatrixNode;shown:number;
 width:3;maximumLevel:5;maximumNodes:364;truncated:boolean;
 levels:{level:number;capacity:number;filled:number;complete:boolean;referenceAmountINR:number}[];
 rebirthPositions:{sequence:number;sourceSequence:number|null;triggerLevel:number|null;ordinal:number|null;completedAt:string|null;state:'ACTIVE'|'COMPLETED_READ_ONLY'}[];
 canCredit:boolean;canPay:false;
};
function MatrixNode({node,maximumLevel}:{node:MemberMatrixNode;maximumLevel:number}){
 if(node.level>=maximumLevel)return <li><strong>{node.label}</strong> · #{node.sequence}{node.completedAt?' · Completed':''}</li>;
 const bySlot=new Map(node.children.map(child=>[child.slot,child]));
 return <li className="genealogy-slot-node">
  <details className="genealogy-slot-details" open={node.level===0}>
   <summary className="genealogy-slot-person">
    <strong>{node.label}</strong><span>Position #{node.sequence} · Level {node.level}{node.kind==='REBIRTH'?' · Rebirth':''}{node.completedAt?' · Completed (read-only)':''}</span>
   </summary>
   <ol className="genealogy-three-slots" aria-label={'Matrix level '+(node.level+1)+' slots'}>
    {[1,2,3].map(slot=>{
     const child=bySlot.get(slot);
     return <li className="genealogy-slot" key={child?.positionId??node.positionId+'-'+slot}>
      <span className="genealogy-slot-position">Slot {slot}</span>
      {child?<MatrixNode node={child} maximumLevel={maximumLevel}/>:
       <div className="genealogy-empty-slot"><span aria-hidden="true">+</span><strong>Empty</strong></div>}
     </li>;
    })}
   </ol>
  </details>
 </li>;
}
export function MemberMatrixTree({matrix}:{matrix:MemberMatrixView}){
 return <section className="admin-panel genealogy-panel" aria-label="1:3 member matrix">
  <h2>1:3 Auto Pool Matrix</h2>
  <p>Persistent member placement uses three slots per position, breadth-first. Direct referrals are tracked separately.</p>
  <div className="genealogy-level-stats">
   {matrix.levels.map(level=><div key={level.level}>
    <strong>{level.filled}/{level.capacity}</strong>
    <span>Level {level.level} · ₹{level.referenceAmountINR.toLocaleString('en-IN')}</span>
   </div>)}
  </div>
  <div className="genealogy-tree genealogy-slot-tree">
   <ol className="genealogy-root-list"><MatrixNode node={matrix.root} maximumLevel={matrix.maximumLevel}/></ol>
  </div>
  <h3>Rebirth entries</h3>
  {matrix.rebirthPositions.length===0?<p>No rebirth entries generated yet.</p>:
   <ul>{matrix.rebirthPositions.map(entry=><li key={entry.sequence}>
    Position #{entry.sequence} · triggered at Level {entry.triggerLevel} · ID {entry.ordinal}
    {entry.sourceSequence?' · source #'+entry.sourceSequence:''}
    {' · '}{entry.state==='COMPLETED_READ_ONLY'?'Completed (read-only)':'Active'}
   </li>)}</ul>}
  <p className="foundation-admin-footnote">Rebirth IDs auto-fill the next available matrix positions. Completed parent positions remain available to view, while their own financial activity is closed. {matrix.canCredit?'Approved level earnings are shown in Earnings.':'Earnings are not enabled.'}</p>
  {matrix.truncated&&<p role="status">Additional matrix positions are outside this five-level view.</p>}
 </section>;
}
