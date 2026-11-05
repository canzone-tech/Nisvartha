export type UatScenarioEntry={
 id:string;kind:'JOINING_REFERENCE'|'DIRECT_REFERRAL_REFERENCE';
 amountPaise:number;createdAt:string;sourceMemberId:string;
};
export type UatScenario={
 status:'LOCAL_SYNTHETIC_REFERENCE_ONLY';
 canAcceptPayment:false;canCredit:false;canWithdraw:false;
 memberId:string;joiningRecorded:boolean;directReferralEvents:number;
 directReferralReferencePaise:number;
 reference:{joiningInr:number;directReferralInr:number;levelPayoutsInr:number[]};
 entries:UatScenarioEntry[];truncated:boolean;
};
const rupees=(paise:number)=>new Intl.NumberFormat('en-IN',{
 style:'currency',currency:'INR',maximumFractionDigits:2
}).format(paise/100);
export function UatScenarioView({scenario}:{scenario:UatScenario}){
 return <section className="admin-panel" aria-label="Local financial UAT reference history">
  <h2>Owner-confirmed plan — local financial UAT</h2>
  <p><strong>Illustrative records only:</strong> amounts below are stored in the isolated local MySQL
   test database. They do not mean that any payment settled or commission was credited.</p>
  <div className="foundation-admin-stats foundation-member-stats">
   <div><strong>{rupees(scenario.reference.joiningInr*100)}</strong><span>One-time joining reference</span></div>
   <div><strong>{rupees(scenario.reference.directReferralInr*100)}</strong><span>Direct referral reference per qualified event</span></div>
   <div><strong>{scenario.directReferralEvents}</strong><span>Recorded synthetic direct referrals</span></div>
  </div>
  <p><strong>Your synthetic referral reference total:</strong> {rupees(scenario.directReferralReferencePaise)}
   {' '}— <strong>not payable or withdrawable.</strong></p>
  <p>Level payouts in owner-confirmed flyer: {scenario.reference.levelPayoutsInr.map(value=>
   new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(value)
  ).join(' / ')}. These are configuration inputs, not credited level payouts.</p>
  {scenario.entries.length===0?<p>No Admin-recorded local scenario events yet.</p>:
   <div className="foundation-uat-history">
    <table>
     <caption>Persisted synthetic scenario history</caption>
     <thead><tr><th>Reference type</th><th>Amount</th><th>Date</th></tr></thead>
     <tbody>{scenario.entries.map(entry=><tr key={entry.id}>
      <td>{entry.kind==='JOINING_REFERENCE'?'Joining reference':'Direct referral reference'}</td>
      <td>{rupees(entry.amountPaise)}</td>
      <td><time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleDateString('en-IN')}</time></td>
     </tr>)}</tbody>
    </table>
   </div>}
  {scenario.truncated&&<p role="status">Only the 200 most recent entries are displayed.</p>}
  <p className="foundation-admin-footnote">No wallet, withdrawal, payment capture, settlement or payable commission exists in this local reference flow.</p>
 </section>;
}
