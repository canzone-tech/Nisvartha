export type MemberMatrixNode={
 positionId:string;memberId:string;label:string;status:string;
 sequence:number;slot:number;level:number;children:MemberMatrixNode[];
};
export type MemberMatrixView={
 kind:'FORCED_1_TO_3';root:MemberMatrixNode;shown:number;
 width:3;maximumLevel:5;maximumNodes:364;truncated:boolean;
 levels:{level:number;capacity:number;filled:number;complete:boolean;referenceAmountINR:number}[];
 rebirthEligibility:{level:4|5;count:number;eligible:boolean}[];
 canCredit:false;canPay:false;
};
function MatrixNode({node,maximumLevel}:{node:MemberMatrixNode;maximumLevel:number}){
 if(node.level>=maximumLevel)return <li><strong>{node.label}</strong> · #{node.sequence}</li>;
 const bySlot=new Map(node.children.map(child=>[child.slot,child]));
 return <li className="genealogy-slot-node">
  <details className="genealogy-slot-details" open={node.level===0}>
   <summary className="genealogy-slot-person">
    <strong>{node.label}</strong><span>Position #{node.sequence} · Level {node.level}</span>
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
  <p className="foundation-admin-footnote">
   Rebirth eligibility: Level 4 {matrix.rebirthEligibility[0]?.eligible?'eligible':'pending'} (1 ID) ·
   {' '}Level 5 {matrix.rebirthEligibility[1]?.eligible?'eligible':'pending'} (3 IDs).
   Monetary credit and withdrawal are not performed by this view.
  </p>
  {matrix.truncated&&<p role="status">Additional matrix positions are outside this five-level view.</p>}
 </section>;
}
