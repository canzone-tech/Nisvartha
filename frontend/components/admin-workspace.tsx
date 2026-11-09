import {redirect} from 'next/navigation';
import Link from 'next/link';
import {staffFetch} from '@/lib/staff-session';
import {AdminLogoutButton} from '@/components/admin-logout';
import {StaffManagement} from '@/components/admin-staff-panel';
import {AdminMatrixPreview} from '@/components/admin-matrix-preview';
import {AdminAuditPanel} from '@/components/admin-audit-panel';
import {EnquiryCasePanel} from '@/components/admin-enquiries';
import {MembershipReviewPanel} from '@/components/admin-memberships';
import {StaffAssistedRegistrationPanel} from '@/components/admin-member-registration';
import {AdminRegistrationPins} from '@/components/admin-uat-signup-pins';
import {AdminMemberRecoveryPanel} from '@/components/admin-member-recovery';
import {DonationRegister} from '@/components/admin-donation-register';

type Role='ADMIN';
type User={id:string;email:string;role:Role};
export type AdminView='overview'|'enquiries'|'members'|'staff'|'audit'|'epin'|'recovery'|'matrix'|'donations';
type NavigationItem={view:AdminView;label:string;description:string};
type Group={label:string;items:NavigationItem[]};
type Counts={members:number;pendingApplications:number;newContacts:number;newVolunteers:number};

function availableGroups(recoveryEnabled:boolean,planEnabled:boolean,donationsEnabled:boolean):Group[]{
 const groups:Group[]=[
  {label:'Main workspace',items:[
   {view:'overview',label:'Dashboard',description:'Member and enquiry overview'},
   {view:'members',label:'Members',description:'Applications, registrations and member accounts'},
   {view:'epin',label:'E-PIN inventory',description:'Admin-created registration E-PINs'},
   {view:'enquiries',label:'Contact enquiries',description:'Contact and volunteer submissions'},
   ...(donationsEnabled?[{view:'donations' as const,label:'Donations',description:'Offline bank-reference register'}]:[]),
  ]},
  {label:'Operations',items:[
   ...(planEnabled?[{view:'matrix' as const,label:'Matrix sandbox',description:'Simulation only; no financial entitlements'}]:[]),
   ...(recoveryEnabled?[{view:'recovery' as const,label:'Member recovery',description:'Verified account recovery'}]:[]),
   {view:'audit',label:'Audit history',description:'Administrative activity log'},
   {view:'staff',label:'Admin security',description:'Single-administrator access and legacy account retirement'},
  ]}
 ];
 return groups;
}
const ADMIN_PATHS:Record<AdminView,string>={
 overview:'/admin',
 enquiries:'/admin/enquiries',members:'/admin/members',
 staff:'/admin/staff',audit:'/admin/audit',
 epin:'/admin/epin',recovery:'/admin/recovery',matrix:'/admin/matrix',donations:'/admin/donations'
};
export function adminHref(view:AdminView){return ADMIN_PATHS[view];}
export function legacyAdminHref(view:string):string|null{
 if(view==='content'||view==='media')return '/admin';
 return Object.hasOwn(ADMIN_PATHS,view)?ADMIN_PATHS[view as AdminView]:null;
}

async function Overview({groups}:{groups:Group[]}){
 const response=await staffFetch('staff/overview');
 const counts:Counts|null=response.ok?await response.json() as Counts:null;
 const metrics=[
  ['Active members',counts?.members],
  ['Pending applications',counts?.pendingApplications],
  ['New contacts',counts?.newContacts],
  ['New volunteer enquiries',counts?.newVolunteers],
 ] as const;
 const shortcuts=groups.flatMap(group=>group.items).filter(item=>['members','epin','enquiries','matrix'].includes(item.view));
 return <>
  <section className="foundation-admin-welcome">
   <p className="eyebrow">Nisvartha Foundation</p>
   <h2>Member operations at a glance</h2>
   <p>Manage members, registration records and enquiries from one administrative workspace. Matrix modelling remains simulation-only.</p>
  </section>
  <section aria-label="Member and enquiry overview">
   <h2 className="foundation-admin-section-title">At a glance</h2>
   {counts?<div className="foundation-admin-stats">
    {metrics.map(([name,value])=><div key={name}><strong>{value}</strong><span>{name}</span></div>)}
   </div>:<p role="status">Live summary is unavailable. Try reloading the dashboard.</p>}
  </section>
  <section aria-label="Workspace shortcuts">
   <h2 className="foundation-admin-section-title">Where would you like to go?</h2>
   <div className="foundation-admin-shortcuts">
    {shortcuts.map(item=><Link key={item.view} href={adminHref(item.view)} className="foundation-admin-shortcut">
     <strong>{item.label}</strong><span>{item.description}</span><span className="foundation-admin-shortcut-arrow" aria-hidden="true">→</span>
    </Link>)}
   </div>
  </section>
 </>;
}

export async function AdminWorkspace({view}:{view:AdminView}){
 const response=await staffFetch('staff/me');
 if(!response.ok)redirect('/admin/login');
 const user=await response.json() as User;
 if(user.role!=='ADMIN')redirect('/admin/login');
 const admin=true;
 const groups=availableGroups(process.env.MEMBER_RECOVERY_ENABLED==='true',process.env.NISVARTHA_UAT_PLAN==='synthetic',process.env.DONATION_ACCOUNTING_ENABLED==='true');
 const permitted=new Set(groups.flatMap(group=>group.items.map(item=>item.view)));
 if(!permitted.has(view))redirect('/admin');
 const selected=groups.flatMap(group=>group.items).find(item=>item.view===view)!;
 return <main id="main-content" className="admin-shell foundation-admin">
  <header className="foundation-admin-header">
   <div>
    <p className="eyebrow">Member administration</p>
    <h1>{selected.label}</h1>
    <p className="foundation-admin-subtitle">{selected.description}</p>
   </div>
   <div className="foundation-admin-account">
    <span title={user.email}>{user.email}</span>
    <AdminLogoutButton/>
   </div>
  </header>
  <div className="foundation-admin-layout">
   <aside className="foundation-admin-sidebar">
    <nav aria-label="Workspace navigation">
     {groups.map(group=><div key={group.label} className="foundation-admin-nav-group">
      {group.label==='Operations'?<details open={group.items.some(item=>item.view===view)}>
       <summary>Operations</summary>
       {group.items.map(item=><Link key={item.view} href={adminHref(item.view)}
        aria-current={view===item.view?'page':undefined}
        className={'foundation-admin-nav-link'+(view===item.view?' active':'')}>
        {item.label}
       </Link>)}
      </details>:<>
       <p>{group.label}</p>
       {group.items.map(item=><Link key={item.view} href={adminHref(item.view)}
        aria-current={view===item.view?'page':undefined}
        className={'foundation-admin-nav-link'+(view===item.view?' active':'')}>
        {item.label}
       </Link>)}
      </>}
     </div>)}
    </nav>
    <Link href="/" className="foundation-admin-public-link">View public website <span aria-hidden="true">↗</span></Link>
   </aside>
   <div className="foundation-admin-main" data-workspace-view={view}>
    {view==='overview'&&<Overview groups={groups}/>}
    {view==='enquiries'&&<EnquiryCasePanel user={{id:user.id,role:user.role}}/>}
    {view==='members'&&admin&&process.env.MEMBER_STAFF_REGISTRATION_ENABLED==='true'&&
      process.env.MEMBER_PORTAL_ENABLED==='true'&&process.env.MEMBER_APPLICATIONS_ENABLED==='true'&&
      process.env.MEMBER_TERMS_VERSION&&process.env.MEMBER_PRIVACY_VERSION&&
      <StaffAssistedRegistrationPanel termsVersion={process.env.MEMBER_TERMS_VERSION}
       privacyVersion={process.env.MEMBER_PRIVACY_VERSION}
       uatPinEnabled={process.env.NISVARTHA_UAT_PIN_REGISTRATION==='synthetic'}
       accessPinEnabled={process.env.REGISTRATION_ACCESS_PIN_ENABLED==='true'}/>}
    {view==='members'&&<MembershipReviewPanel canViewGenealogy={process.env.NISVARTHA_UAT_PIN_REGISTRATION==='synthetic'||
     process.env.REGISTRATION_ACCESS_PIN_ENABLED==='true'}
     canViewMatrix={process.env.MATRIX_PLACEMENT_ENABLED==='true'}
     compensationEnabled={process.env.MEMBER_COMPENSATION_ENABLED==='true'}/> }
    {view==='staff'&&admin&&<StaffManagement currentAdminId={user.id}/>}
    {view==='audit'&&admin&&<AdminAuditPanel/>}
    {view==='donations'&&<DonationRegister/>}
    {view==='recovery'&&admin&&process.env.MEMBER_RECOVERY_ENABLED==='true'&&<AdminMemberRecoveryPanel/>}
    {view==='epin'&&(
     process.env.NISVARTHA_UAT_PIN_REGISTRATION==='synthetic'
      ?<AdminRegistrationPins mode="synthetic"/>
      :process.env.REGISTRATION_ACCESS_PIN_ENABLED==='true'
      ?<AdminRegistrationPins mode="access" saleBacked={process.env.MEMBER_COMPENSATION_ENABLED==='true'}/>
      :<section className="admin-panel"><h2>Registration E-PINs are disabled</h2>
        <p>Admin-only E-PIN generation is currently disabled for this environment.</p>
       </section>
    )}
    {view==='matrix'&&process.env.NISVARTHA_UAT_PLAN==='synthetic'&&<AdminMatrixPreview canEdit={admin} actorId={user.id}/>}
   </div>
  </div>
 </main>;
}
