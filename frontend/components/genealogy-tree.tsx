export type GenealogyNode={
 id:string;label:string;status:string;level:number;children:GenealogyNode[];
};
export type GenealogyView={
 kind:'DIRECT_INVITATIONS';root:GenealogyNode;shown:number;
 maximumLevel:number;maximumNodes:number;truncated:boolean;
};

function branchSummary(node:GenealogyNode){
 return <>
  <strong>{node.label}</strong>
  <span>Level {node.level} · {node.status.replaceAll('_',' ')}</span>
  {node.children.length>0&&<span>{node.children.length} direct {node.children.length===1?'invite':'invites'}</span>}
 </>;
}
function Branch({node}:{node:GenealogyNode}){
 const styling='genealogy-person'+(node.level===0?' genealogy-root':'');
 return <li className="genealogy-branch">
  {node.children.length>0?
   <details open={node.level<=1} className="genealogy-expandable">
    <summary className={styling}>{branchSummary(node)}</summary>
    <ul className="genealogy-children">
     {node.children.map(child=><Branch key={child.id} node={child}/>)}
    </ul>
   </details>
   :<div className={styling}>{branchSummary(node)}</div>}
 </li>;
}
function levelCounts(root:GenealogyNode,maximumLevel:number){
 const counts=Array.from({length:maximumLevel},()=>0);
 const stack=[root],visited=new Set<string>();
 while(stack.length){
  const current=stack.pop()!;
  if(visited.has(current.id))continue;
  visited.add(current.id);
  if(current.level>=1&&current.level<=maximumLevel)counts[current.level-1]++;
  for(const child of current.children)stack.push(child);
 }
 return counts;
}

export function GenealogyTree({tree}:{tree:GenealogyView}){
 const counts=levelCounts(tree.root,tree.maximumLevel);
 return <section className="admin-panel genealogy-panel" aria-label="Referral genealogy">
  <h2>Referral genealogy tree</h2>
  <p>Recorded nonfinancial invitations only. This is not an automatic 1:3
   matrix placement, commission network or payout entitlement.</p>
  <div className="genealogy-level-stats" aria-label="Invitations by level">
   {counts.map((count,index)=><div key={index}>
    <strong>{count}</strong><span>Level {index+1}</span>
   </div>)}
  </div>
  <p className="genealogy-summary">
   {tree.shown} member{tree.shown===1?'':'s'} displayed ·
   {tree.root.children.length} direct invite{tree.root.children.length===1?'':'s'} ·
   Up to {tree.maximumLevel} descendant levels · Limit {tree.maximumNodes} nodes
  </p>
  <p className="foundation-admin-footnote">Select a member with descendants to expand or collapse their branch.
   Member identities are privacy-masked; Admin sees details only with authorized access.</p>
  <div className="genealogy-tree">
   <ul className="genealogy-children genealogy-top"><Branch node={tree.root}/></ul>
  </div>
  {tree.root.children.length===0&&<p>No direct invitations recorded yet.</p>}
  {tree.truncated&&<p role="status">Only part of this genealogy is shown.
   The depth or node limit was reached; no relationships have been changed.</p>}
 </section>;
}
