export type GenealogyNode={
 id:string;label:string;status:string;level:number;children:GenealogyNode[];
};
export type GenealogyView={
 kind:'DIRECT_INVITATIONS';root:GenealogyNode;shown:number;
 maximumLevel:number;maximumNodes:number;truncated:boolean;
};

const MATRIX_WIDTH=3 as const;

function levelCounts(root:GenealogyNode,maximumLevel:number){
 const counts=Array.from({length:maximumLevel},()=>0);
 const stack=[root],seen=new Set<string>();
 while(stack.length){
  const node=stack.pop()!;
  if(seen.has(node.id))continue;
  seen.add(node.id);
  if(node.level>0&&node.level<=maximumLevel)counts[node.level-1]++;
  for(const child of node.children)stack.push(child);
 }
 return counts;
}

/** Visual slots only. These are real direct invitation edges, NOT matrix placements.
 * Overflow always stays visible; invitations must never silently disappear. */
function MatrixBranch({node,maximumLevel}:{node:GenealogyNode;maximumLevel:number}){
 const visibleChildren=node.children.slice(0,MATRIX_WIDTH);
 const overflow=node.children.slice(MATRIX_WIDTH);
 const hasNext=node.level<maximumLevel;
 return <li className="genealogy-slot-node">
  <details className="genealogy-slot-details" open={node.level===0}>
   <summary className="genealogy-slot-person">
    <strong>{node.label}</strong>
    <span>Level {node.level} · {node.status.replaceAll('_',' ')}</span>
    {hasNext&&<small>{node.children.length} direct invite{node.children.length===1?'':'s'}</small>}
   </summary>
   {hasNext&&<ol className="genealogy-three-slots" aria-label={'Three referral slots at level '+(node.level+1)}>
    {Array.from({length:MATRIX_WIDTH},(_,index)=>{
     const child=visibleChildren[index];
     return <li className="genealogy-slot" key={child?.id??'empty-'+index}>
      <span className="genealogy-slot-position">Slot {index+1}</span>
      {child?<MatrixBranch node={child} maximumLevel={maximumLevel}/>:
       <div className="genealogy-empty-slot" aria-label={'Empty slot '+(index+1)}>
        <span aria-hidden="true">+</span><strong>Empty</strong>
       </div>}
     </li>;
    })}
   </ol>}
   {overflow.length>0&&<div className="genealogy-overflow" role="status">
    <strong>{overflow.length} additional direct invitations</strong>
    <p>More than three direct invitations exist. These are not silently placed into a
     forced matrix; the authoritative placement policy is not approved.</p>
    <ul>{overflow.map(extra=><li key={extra.id}>{extra.label} · {extra.status.replaceAll('_',' ')}</li>)}</ul>
   </div>}
  </details>
 </li>;
}

export function GenealogyTree({tree}:{tree:GenealogyView}){
 const counts=levelCounts(tree.root,tree.maximumLevel);
 return <section className="admin-panel genealogy-panel" aria-label="Referral genealogy">
  <h2>1:3 referral slots and genealogy</h2>
  <p>Each member shows three numbered visual slots. Unoccupied positions stay visible as
   Empty. These are recorded direct invitations, <strong>not confirmed forced-matrix
   placement</strong>, and no commission or rebirth is generated.</p>
  <div className="genealogy-level-stats" aria-label="Invitations by level">
   {counts.map((count,index)=><div key={index}>
    <strong>{count}</strong><span>Level {index+1}</span>
   </div>)}
  </div>
  <p className="genealogy-summary">
   {tree.shown} member{tree.shown===1?'':'s'} displayed ·
   {tree.root.children.length} direct invite{tree.root.children.length===1?'':'s'} ·
   {MATRIX_WIDTH} slots per node · Up to {tree.maximumLevel} levels · Limit {tree.maximumNodes} nodes
  </p>
  <p className="foundation-admin-footnote">
   Expand each branch to see its three slots. Vacant slots are not real member accounts.
   Labels are privacy-masked for Members.
  </p>
  <div className="genealogy-tree genealogy-slot-tree">
   <ol className="genealogy-root-list"><MatrixBranch node={tree.root} maximumLevel={tree.maximumLevel}/></ol>
  </div>
  {tree.truncated&&<p role="status">Additional invitation records are outside this bounded view.
   No members have been assigned to unverified matrix positions.</p>}
 </section>;
}
