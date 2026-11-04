export type GenealogyNode={
 id:string;label:string;status:string;level:number;children:GenealogyNode[];
};
export type GenealogyView={
 kind:'DIRECT_INVITATIONS';root:GenealogyNode;shown:number;
 maximumLevel:number;maximumNodes:number;truncated:boolean;
};

function Branch({node}:{node:GenealogyNode}){
 return <li className="genealogy-branch">
  <div className={'genealogy-person'+(node.level===0?' genealogy-root':'')}>
   <strong>{node.label}</strong>
   <span>Level {node.level} · {node.status.replaceAll('_',' ')}</span>
  </div>
  {node.children.length>0&&<ul className="genealogy-children">
   {node.children.map(child=><Branch key={child.id} node={child}/>)}
  </ul>}
 </li>;
}

export function GenealogyTree({tree}:{tree:GenealogyView}){
 return <section className="admin-panel genealogy-panel" aria-label="Referral genealogy">
  <h2>Referral genealogy tree</h2>
  <p>This tree shows recorded direct invitations and their descendants, not
   automatic 1:3 matrix placement or financial earnings.</p>
  <p className="genealogy-summary">
   {tree.shown} member{tree.shown===1?'':'s'} displayed ·
   Up to {tree.maximumLevel} descendant levels · Maximum {tree.maximumNodes} nodes
  </p>
  <div className="genealogy-tree">
   <ul className="genealogy-children genealogy-top"><Branch node={tree.root}/></ul>
  </div>
  {tree.root.children.length===0&&<p>No direct invitations recorded yet.</p>}
  {tree.truncated&&<p role="status">Only part of this genealogy is shown.
   The depth or node limit was reached; no relationships have been changed.</p>}
 </section>;
}
