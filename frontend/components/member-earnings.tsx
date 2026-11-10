export type MemberEarningsView={
 sale:{reference:string;amountPaise:number;receivedAt:string;createdAt:string;evidenceRef?:string}|null;
 earnings:Array<{id:string;kind:string;level:number|null;amountPaise:number;status:'EARNED'|'SETTLED';
  createdAt:string;settlementReference:string|null;settlementEvidenceRef?:string|null;settledAt:string|null;
  sourcePosition:{sequence:number;kind:string}|null;sourceMember:{displayName?:string}|null}>;
 summary:{earnedPaise:number;settledPaise:number;earnedCount:number;settledCount:number};
 totalPaise:number;
};
const inr=(paise:number)=>'₹'+(paise/100).toLocaleString('en-IN');
const label=(kind:string)=>kind==='DIRECT_REFERRAL'?'Direct referral':
 kind.replace('MATRIX_LEVEL_','Matrix level ');
export function MemberEarnings({data}:{data:MemberEarningsView}){
 return <section className="admin-panel" aria-label="Member earnings">
  <h2>Earnings and offline settlements</h2>
  {data.sale&&<p>Offline transaction confirmed: <strong>{inr(data.sale.amountPaise)}</strong>
   {' '}· Reference <code>{data.sale.reference}</code> · {new Date(data.sale.receivedAt).toLocaleString()}</p>}
  <div className="foundation-admin-stats">
   <div><strong>{inr(data.totalPaise)}</strong><span>Total earned</span></div>
   <div><strong>{inr(data.summary.earnedPaise)}</strong><span>Pending settlement</span></div>
   <div><strong>{inr(data.summary.settledPaise)}</strong><span>Settled offline</span></div>
  </div>
  {data.earnings.length===0?<p>No earnings recorded yet.</p>:<div className="table-scroll"><table>
   <thead><tr><th>Type</th><th>Amount</th><th>Status</th><th>Source</th><th>Settlement</th></tr></thead>
   <tbody>{data.earnings.map(row=><tr key={row.id}>
    <td>{label(row.kind)}</td><td>{inr(row.amountPaise)}</td><td>{row.status}</td>
    <td>{row.sourcePosition?'Matrix #'+row.sourcePosition.sequence:
      row.sourceMember?.displayName?'Referral: '+row.sourceMember.displayName:'—'}</td>
    <td>{row.status==='SETTLED'?<>{row.settlementReference||'Recorded'}
      {row.settledAt&&<> · {new Date(row.settledAt).toLocaleDateString()}</>}</>:'Pending'}</td>
   </tr>)}</tbody>
  </table></div>}
  <p className="foundation-admin-footnote">Bank/UPI/cash transfer happens offline. This portal records the entitlement and the Admin-confirmed settlement reference.</p>
 </section>;
}
